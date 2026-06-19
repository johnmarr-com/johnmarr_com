import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebase-admin";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getVotesPerPlayer, selectRounds, initScores } from "@/app/games/blarf/blarfTypes";
import type { BlarfRoundData } from "@/app/games/blarf/blarfTypes";

// ─── Per-UID rate limiting ──────────────────────────────────

const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 60;

const requestLog = new Map<string, number[]>();

function isRateLimited(uid: string): boolean {
  const now = Date.now();
  const timestamps = requestLog.get(uid) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) return true;
  recent.push(now);
  requestLog.set(uid, recent);
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [uid, timestamps] of requestLog) {
    const recent = timestamps.filter((t) => now - t < RATE_WINDOW_MS);
    if (recent.length === 0) requestLog.delete(uid);
    else requestLog.set(uid, recent);
  }
}, RATE_WINDOW_MS);

// ─── Route ──────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ─── Authenticate ─────────────────────────────────────────
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid authorization header" },
      { status: 401 },
    );
  }

  let uid: string;
  try {
    const decoded = await verifyIdToken(authHeader.substring(7));
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
  }

  if (isRateLimited(uid)) {
    return NextResponse.json(
      { error: "Too many requests — try again shortly" },
      { status: 429 },
    );
  }

  try {
    const body = await request.json();
    const { action } = body as { action: string };

    if (action === "select-pack") {
      return handleSelectPack(body, uid);
    }

    if (action === "speaker-done") {
      return handleSpeakerDone(body, uid);
    }

    if (action === "confirm-role") {
      return handleConfirmRole(body, uid);
    }

    if (action === "submit-votes") {
      return handleSubmitVotes(body, uid);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error(`[BLARF] Error for uid=${uid}:`, err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ─── SELECT PACK (host-only setup) ─────────────────────────

const MAX_ROUNDS_IN_PACK = 500;

interface SelectPackBody {
  action: "select-pack";
  sessionId: string;
  packId: string;
  packName?: string;
  packCoverURL?: string | null;
  rounds: BlarfRoundData[];
  roundCount: number;
}

/**
 * Host picks the pack + round count. The round data (letters + word pools) is
 * SECRET — written to `blarfSecret/{sid}` (server-only) so it can't leak; only
 * public meta (pack name/cover, total rounds, initial scores) goes on the
 * session doc. NOT bfPhase: the engine flips pack-select → round-intro.
 */
async function handleSelectPack(body: unknown, uid: string): Promise<NextResponse> {
  const { sessionId, packId, packName, packCoverURL, rounds, roundCount } =
    body as SelectPackBody;
  if (
    !sessionId ||
    typeof packId !== "string" ||
    !Array.isArray(rounds) ||
    rounds.length === 0 ||
    rounds.length > MAX_ROUNDS_IN_PACK ||
    typeof roundCount !== "number"
  ) {
    return NextResponse.json({ error: "Invalid pack payload" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const sessionRef = db.doc(`gameSessions/${sessionId}`);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  const data = sessionSnap.data()!;
  if (data["ownerId"] !== uid) {
    return NextResponse.json({ error: "Only the host can select the pack" }, { status: 403 });
  }
  if (((data["bfPhase"] as string) ?? "pack-select") !== "pack-select") {
    return NextResponse.json({ error: "Pack already selected" }, { status: 409 });
  }

  const playerUids = (data["playerUids"] as string[]) ?? [];
  const count = Math.max(1, Math.min(Math.floor(roundCount), rounds.length));
  const chosen = selectRounds(rounds, count);

  // Secret round data (server-only).
  await db.doc(`blarfSecret/${sessionId}`).set({ rounds: chosen });
  // Public meta only.
  await sessionRef.update({
    bfPackId: packId,
    bfPackName: packName ?? null,
    bfPackCoverURL: packCoverURL ?? null,
    bfTotalRounds: count,
    bfCurrentRound: 1,
    bfScores: initScores(playerUids),
    bfWinners: [],
    bfWinnerPoints: 0,
    bfLobbyPackId: FieldValue.delete(),
    bfLobbyPackName: FieldValue.delete(),
    bfLobbyPackCoverURL: FieldValue.delete(),
    bfLobbyRounds: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return NextResponse.json({ ok: true });
}

// ─── SPEAKER DONE ──────────────────────────────────────────

interface SpeakerDoneBody {
  action: "speaker-done";
  sessionId: string;
}

/** The CURRENT speaker signals they're done — engine advances to the next
 *  speaker (or the timer does it if they freeze). */
async function handleSpeakerDone(body: unknown, uid: string): Promise<NextResponse> {
  const { sessionId } = body as SpeakerDoneBody;
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }
  const db = getAdminFirestore();
  const sessionRef = db.doc(`gameSessions/${sessionId}`);
  const snap = await sessionRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  const data = snap.data()!;
  if (data["bfPhase"] !== "speaking") {
    return NextResponse.json({ error: "Not in speaking phase" }, { status: 409 });
  }
  const order = (data["bfSpeakingOrder"] as string[]) ?? [];
  const idx = (data["bfCurrentSpeaker"] as number) ?? 0;
  if (order[idx] !== uid) {
    return NextResponse.json({ error: "Not your turn to speak" }, { status: 409 });
  }
  await sessionRef.update({
    [`inbox.speakerDone.${uid}`]: { at: Date.now() },
    updatedAt: FieldValue.serverTimestamp(),
  });
  return NextResponse.json({ ok: true });
}

// ─── CONFIRM ROLE ──────────────────────────────────────────

interface ConfirmRoleBody {
  action: "confirm-role";
  sessionId: string;
}

async function handleConfirmRole(
  body: unknown,
  uid: string,
): Promise<NextResponse> {
  const { sessionId } = body as ConfirmRoleBody;
  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing sessionId" },
      { status: 400 },
    );
  }

  const db = getAdminFirestore();
  const sessionRef = db.doc(`gameSessions/${sessionId}`);
  const sessionSnap = await sessionRef.get();

  if (!sessionSnap.exists) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const data = sessionSnap.data()!;

  // Verify player is in session
  const playerUids = (data["playerUids"] as string[]) ?? [];
  const players = (data["players"] as { uid: string }[]) ?? [];
  const inPlayerUids = playerUids.includes(uid);
  const inPlayers = players.some((p) => p.uid === uid);

  if (!inPlayerUids && !inPlayers) {
    console.error(
      `[BLARF confirm-role] 403: uid=${uid} not in session=${sessionId}`,
    );
    return NextResponse.json(
      { error: "You are not in this session" },
      { status: 403 },
    );
  }

  // Verify correct phase
  if (data["bfPhase"] !== "role-reveal") {
    return NextResponse.json(
      { error: "Not in role-reveal phase" },
      { status: 400 },
    );
  }

  // Verify player hasn't already confirmed
  const confirmed = (data["bfRoleConfirmed"] as Record<string, boolean>) ?? {};
  if (confirmed[uid]) {
    return NextResponse.json(
      { error: "Already confirmed" },
      { status: 400 },
    );
  }

  // Write the confirmation
  await sessionRef.update({
    [`bfRoleConfirmed.${uid}`]: true,
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`[BLARF confirm-role] OK uid=${uid} session=${sessionId}`);
  return NextResponse.json({ ok: true });
}

// ─── SUBMIT VOTES ──────────────────────────────────────────

interface SubmitVotesBody {
  action: "submit-votes";
  sessionId: string;
  votes: string[];
}

async function handleSubmitVotes(
  body: unknown,
  uid: string,
): Promise<NextResponse> {
  const { sessionId, votes } = body as SubmitVotesBody;
  if (!sessionId || !Array.isArray(votes)) {
    return NextResponse.json(
      { error: "Missing sessionId or votes array" },
      { status: 400 },
    );
  }

  const db = getAdminFirestore();
  const sessionRef = db.doc(`gameSessions/${sessionId}`);
  const sessionSnap = await sessionRef.get();

  if (!sessionSnap.exists) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const data = sessionSnap.data()!;

  // Verify player is in session
  const playerUids = (data["playerUids"] as string[]) ?? [];
  const players = (data["players"] as { uid: string }[]) ?? [];
  const inPlayerUids = playerUids.includes(uid);
  const inPlayers = players.some((p) => p.uid === uid);

  if (!inPlayerUids && !inPlayers) {
    console.error(
      `[BLARF submit-votes] 403: uid=${uid} not in session=${sessionId}`,
    );
    return NextResponse.json(
      { error: "You are not in this session" },
      { status: 403 },
    );
  }

  // Verify correct phase
  if (data["bfPhase"] !== "voting") {
    return NextResponse.json(
      { error: "Not in voting phase" },
      { status: 400 },
    );
  }

  // Verify player hasn't already voted
  const existingVotes = (data["bfVotes"] as Record<string, string[]>) ?? {};
  if (existingVotes[uid] != null) {
    return NextResponse.json(
      { error: "Already voted" },
      { status: 400 },
    );
  }

  // Verify vote count matches expected
  const playerCount = players.length || playerUids.length;
  const expectedVotes = getVotesPerPlayer(playerCount);
  if (votes.length !== expectedVotes) {
    return NextResponse.json(
      { error: `Expected ${expectedVotes} votes, got ${votes.length}` },
      { status: 400 },
    );
  }

  // Verify no self-votes
  if (votes.includes(uid)) {
    return NextResponse.json(
      { error: "Cannot vote for yourself" },
      { status: 400 },
    );
  }

  // Verify all vote targets are valid players
  const allUids = new Set([...playerUids, ...players.map((p) => p.uid)]);
  for (const targetUid of votes) {
    if (!allUids.has(targetUid)) {
      return NextResponse.json(
        { error: "Invalid vote target" },
        { status: 400 },
      );
    }
  }

  // Write the votes
  await sessionRef.update({
    [`bfVotes.${uid}`]: votes,
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(
    `[BLARF submit-votes] OK uid=${uid} session=${sessionId} votes=[${votes.join(",")}]`,
  );
  return NextResponse.json({ ok: true });
}
