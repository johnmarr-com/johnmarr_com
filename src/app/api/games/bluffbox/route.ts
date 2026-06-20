import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  calculateTotalRounds,
  initScores,
  shuffleTurnOrder,
  shuffleCards,
} from "@/app/games/bluffbox/tournament";

// ─── Per-UID rate limiting ──────────────────────────────────
const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 60;
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

const MAX_CARDS = 2000;
const MAX_ROUNDS = 10;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing authorization header" }, { status: 401 });
  }
  let uid: string;
  try {
    uid = (await verifyIdToken(authHeader.substring(7))).uid;
  } catch {
    return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
  }
  if (isRateLimited(uid)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action as string | undefined;
  const sessionId = body?.sessionId as string | undefined;
  if (!action || !sessionId) {
    return NextResponse.json({ error: "Missing action or sessionId" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const sessionRef = db.doc(`gameSessions/${sessionId}`);
  const snap = await sessionRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  const data = snap.data()!;
  if (data["engineKey"] !== "bluffbox") {
    return NextResponse.json({ error: "Not a BluffBox engine session" }, { status: 400 });
  }
  const playerUids = (data["playerUids"] as string[]) ?? [];
  if (!playerUids.includes(uid)) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }

  // ─── select-pack (host-only setup) ───
  if (action === "select-pack") {
    if (data["ownerId"] !== uid) {
      return NextResponse.json({ error: "Only the host can select the pack" }, { status: 403 });
    }
    if (((data["bbPhase"] as string) ?? "pack-select") !== "pack-select") {
      return NextResponse.json({ error: "Pack already selected" }, { status: 409 });
    }
    const packId = body?.packId as string | undefined;
    const cards = body?.cards as string[] | undefined;
    if (!packId || !Array.isArray(cards) || cards.length === 0 || cards.length > MAX_CARDS) {
      return NextResponse.json({ error: "Invalid pack payload" }, { status: 400 });
    }
    // Host-chosen round count (defaults to the headcount-based auto count on the
    // client); clamp server-side so it stays sane regardless of what's sent.
    const requestedRounds = Number(body?.rounds);
    const totalRounds =
      Number.isFinite(requestedRounds) && requestedRounds >= 1
        ? Math.min(MAX_ROUNDS, Math.floor(requestedRounds))
        : calculateTotalRounds(playerUids.length);
    // Secret card pool (shuffled, server-only) so upcoming cards can't be peeked.
    await db.doc(`bluffSecrets/${sessionId}`).set({ cardPool: shuffleCards(cards), sharerChoice: null });
    // Public meta + turn order; engine flips pack-select → round-intro.
    await sessionRef.update({
      selectedPackId: packId,
      selectedPackName: (body?.packName as string | undefined) ?? null,
      selectedPackCoverURL: (body?.packCoverURL as string | undefined) ?? null,
      totalRounds,
      roundNumber: 1,
      turnOrder: shuffleTurnOrder(playerUids),
      currentTurnIndex: 0,
      scores: initScores(playerUids),
      bbHistory: [],
      winners: [],
      winnerPoints: 0,
      cardURL: null,
      guesses: {},
      bbChoiceMade: false,
      bbRevealChoice: null,
      bluffLobbyPackId: FieldValue.delete(),
      bluffLobbyPackName: FieldValue.delete(),
      bluffLobbyPackCoverURL: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true });
  }

  // ─── sharer-choice (current sharer locks their hidden truth/lie) ───
  if (action === "sharer-choice") {
    if (data["bbPhase"] !== "sharing") {
      return NextResponse.json({ error: "Not in sharing phase" }, { status: 409 });
    }
    const order = (data["turnOrder"] as string[]) ?? [];
    const idx = (data["currentTurnIndex"] as number) ?? 0;
    if (order[idx] !== uid) {
      return NextResponse.json({ error: "Not your turn to share" }, { status: 409 });
    }
    const choice = body?.choice as string | undefined;
    if (choice !== "truth" && choice !== "lie") {
      return NextResponse.json({ error: "Invalid choice" }, { status: 400 });
    }
    // Hidden answer → secret doc. Then a non-revealing session flag to fire the
    // engine (it only triggers on gameSessions writes).
    await db.doc(`bluffSecrets/${sessionId}`).set({ sharerChoice: choice }, { merge: true });
    await sessionRef.update({ bbChoiceMade: true, updatedAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ ok: true });
  }

  // ─── submit-guess (non-sharer votes truth/lie) ───
  if (action === "submit-guess") {
    if (data["bbPhase"] !== "guessing") {
      return NextResponse.json({ error: "Not in guessing phase" }, { status: 409 });
    }
    const order = (data["turnOrder"] as string[]) ?? [];
    const idx = (data["currentTurnIndex"] as number) ?? 0;
    if (order[idx] === uid) {
      return NextResponse.json({ error: "The sharer doesn't guess" }, { status: 409 });
    }
    const guess = body?.guess as string | undefined;
    if (guess !== "truth" && guess !== "lie") {
      return NextResponse.json({ error: "Invalid guess" }, { status: 400 });
    }
    const guesses = (data["guesses"] as Record<string, string>) ?? {};
    if (guesses[uid]) {
      return NextResponse.json({ error: "Already guessed" }, { status: 409 });
    }
    await sessionRef.update({
      [`guesses.${uid}`]: guess,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
