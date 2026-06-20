import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * MegaSketchy — intent-writer route (engineKey "megasketchy").
 *
 * The gameEngine reducer owns the live game (play-order, chain seeding, the
 * draw/guess loop with a 60s hourglass + auto-skip, all phase transitions) and
 * the LLM judge/scoring run as post-commit effects. This route only writes host
 * setup + player move intents into the inbox (the engine resolves them) and
 * resets for a rematch.
 */

const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 120;
const requestLog = new Map<string, number[]>();

function isRateLimited(uid: string): boolean {
  const now = Date.now();
  const recent = (requestLog.get(uid) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) return true;
  recent.push(now);
  requestLog.set(uid, recent);
  return false;
}
setInterval(() => {
  const now = Date.now();
  for (const [uid, ts] of requestLog) {
    const recent = ts.filter((t) => now - t < RATE_WINDOW_MS);
    if (recent.length === 0) requestLog.delete(uid);
    else requestLog.set(uid, recent);
  }
}, RATE_WINDOW_MS);

function eventId(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing or invalid authorization header" }, { status: 401 });
  }
  let uid: string;
  try {
    uid = (await verifyIdToken(authHeader.substring(7))).uid;
  } catch {
    return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
  }
  if (isRateLimited(uid)) {
    return NextResponse.json({ error: "Too many requests — try again shortly" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const action = body?.action as string | undefined;
    const sessionId = body?.sessionId as string | undefined;
    if (!action || !sessionId) {
      return NextResponse.json({ error: "Missing action or sessionId" }, { status: 400 });
    }

    const db = getAdminFirestore();
    const sessionRef = db.doc(`gameSessions/${sessionId}`);
    const snap = await sessionRef.get();
    if (!snap.exists) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    const data = snap.data()!;
    if (data["engineKey"] !== "megasketchy") {
      return NextResponse.json({ error: "Not a MegaSketchy engine session" }, { status: 400 });
    }

    const isHost = data["ownerId"] === uid;
    const phase = (data["skPhase"] as string) ?? "lobby";
    const playerUids = (data["playerUids"] ?? []) as string[];
    const inGame = playerUids.includes(uid);

    // ── begin-mission (host, briefing) ──
    if (action === "begin-mission") {
      if (!isHost) return NextResponse.json({ error: "Only the host can begin" }, { status: 403 });
      if (phase !== "briefing") return NextResponse.json({ error: "Not in briefing" }, { status: 409 });
      const missionId = body?.missionId as string | undefined;
      if (!missionId) return NextResponse.json({ error: "Missing missionId" }, { status: 400 });
      await sessionRef.update({ [`inbox.beginMission.${uid}`]: { missionId, eventId: eventId() } });
      return NextResponse.json({ ok: true });
    }

    // ── reorder play order (host, briefing) ──
    if (action === "reorder") {
      if (!isHost) return NextResponse.json({ error: "Only the host can reorder" }, { status: 403 });
      if (phase !== "briefing") return NextResponse.json({ error: "Not in briefing" }, { status: 409 });
      const order = body?.order as string[] | undefined;
      if (!Array.isArray(order)) return NextResponse.json({ error: "Missing order" }, { status: 400 });
      await sessionRef.update({ [`inbox.reorder.${uid}`]: { order, eventId: eventId() } });
      return NextResponse.json({ ok: true });
    }

    // ── transmit a draw/guess (player, active) — engine validates the turn ──
    if (action === "transmit") {
      if (phase !== "active") return NextResponse.json({ error: "Not in the drawing phase" }, { status: 409 });
      if (!inGame) return NextResponse.json({ error: "Not a player in this session" }, { status: 403 });
      const elementIndex = body?.elementIndex as number | undefined;
      const value = body?.value as string | undefined;
      if (elementIndex == null || typeof value !== "string" || value.length === 0) {
        return NextResponse.json({ error: "Missing elementIndex or value" }, { status: 400 });
      }
      await sessionRef.update({ [`inbox.transmit.${uid}`]: { elementIndex, value, eventId: eventId() } });
      return NextResponse.json({ ok: true });
    }

    // ── vote (player, voting) ──
    if (action === "vote") {
      if (phase !== "voting") return NextResponse.json({ error: "Not in voting" }, { status: 409 });
      if (!inGame) return NextResponse.json({ error: "Not a player in this session" }, { status: 403 });
      const targetUid = body?.targetUid as string | undefined;
      if (!targetUid) return NextResponse.json({ error: "Missing targetUid" }, { status: 400 });
      await sessionRef.update({ [`inbox.vote.${uid}`]: { targetUid, eventId: eventId() } });
      return NextResponse.json({ ok: true });
    }

    // ── advance a result/display phase (any participant) ──
    // The end-game display phases (madlibs/reveal/scoring) are advanceable by
    // anyone so the group never waits on the host to reach the viewer.
    if (action === "advance") {
      if (!inGame) return NextResponse.json({ error: "Not a player in this session" }, { status: 403 });
      await sessionRef.update({ [`inbox.advance.${uid}`]: { eventId: eventId() } });
      return NextResponse.json({ ok: true });
    }

    // ── play-again (host) — reset to lobby; the engine re-shuffles → briefing ──
    if (action === "play-again") {
      if (!isHost) return NextResponse.json({ error: "Only the host can restart" }, { status: 403 });
      const missionNumber = ((data["missionNumber"] as number | undefined) ?? 0) + 1;
      await sessionRef.update({
        // The previous game ended with status:"finished"; restore "playing" so
        // the engine fires again (lobby → briefing).
        status: "playing",
        winner: null,
        skPhase: "lobby",
        playOrder: [],
        message: null,
        chains: {},
        chainDeadlines: {},
        gameMode: "basic",
        moleId: null,
        eliminatedPlayers: [],
        missionNumber,
        votes: {},
        elementMatches: null,
        scoringResult: null,
        inbox: {},
        phaseDeadlineAt: 0,
        seq: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error(`[MEGASKETCHY] Error for uid=${uid}:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
