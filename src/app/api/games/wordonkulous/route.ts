import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken } from "@/lib/firebase-admin";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

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

// ─── Constants ──────────────────────────────────────────────

const MAX_WORD_LENGTH = 40;

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

    if (action === "submit-word") {
      return handleSubmitWord(body, uid);
    }

    if (action === "submit-vote") {
      return handleSubmitVote(body, uid);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error(`[WORDONKULOUS] Error for uid=${uid}:`, err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ─── SUBMIT WORD ────────────────────────────────────────────

interface SubmitWordBody {
  action: "submit-word";
  sessionId: string;
  word: string;
}

async function handleSubmitWord(
  body: unknown,
  uid: string,
): Promise<NextResponse> {
  const { sessionId, word } = body as SubmitWordBody;
  if (!sessionId || typeof word !== "string") {
    return NextResponse.json(
      { error: "Missing sessionId or word" },
      { status: 400 },
    );
  }

  const trimmed = word.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_WORD_LENGTH) {
    return NextResponse.json(
      { error: `Word must be 1-${MAX_WORD_LENGTH} characters` },
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

  // Verify player is in session (check both playerUids and players array for resilience)
  const playerUids = (data["playerUids"] as string[]) ?? [];
  const players = (data["players"] as { uid: string }[]) ?? [];
  const inPlayerUids = playerUids.includes(uid);
  const inPlayers = players.some((p) => p.uid === uid);

  if (!inPlayerUids && !inPlayers) {
    console.error(
      `[WORDONKULOUS submit-word] 403: uid=${uid} not in session=${sessionId}. ` +
      `playerUids=[${playerUids.join(",")}] players=[${players.map((p) => p.uid).join(",")}]`,
    );
    return NextResponse.json(
      { error: "You are not in this session" },
      { status: 403 },
    );
  }
  if (!inPlayerUids && inPlayers) {
    console.warn(
      `[WORDONKULOUS submit-word] uid=${uid} found in players but NOT playerUids — data inconsistency. ` +
      `playerUids=[${playerUids.join(",")}] players=[${players.map((p) => p.uid).join(",")}]`,
    );
  }

  // Verify correct phase
  if (data["wkPhase"] !== "submitting") {
    console.warn(
      `[WORDONKULOUS submit-word] uid=${uid} tried to submit during phase="${data["wkPhase"]}"`,
    );
    return NextResponse.json(
      { error: "Not in submission phase" },
      { status: 400 },
    );
  }

  // Verify player hasn't already submitted
  const submissions = (data["wkSubmissions"] as Record<string, string>) ?? {};
  if (submissions[uid] != null) {
    return NextResponse.json(
      { error: "Already submitted" },
      { status: 400 },
    );
  }

  // Write the submission
  await sessionRef.update({
    [`wkSubmissions.${uid}`]: trimmed.toUpperCase(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(
    `[WORDONKULOUS submit-word] OK uid=${uid} session=${sessionId} word="${trimmed}" ` +
    `playerCount=${players.length}`,
  );
  return NextResponse.json({ ok: true });
}

// ─── SUBMIT VOTE ────────────────────────────────────────────

interface SubmitVoteBody {
  action: "submit-vote";
  sessionId: string;
  votedForUid: string;
}

async function handleSubmitVote(
  body: unknown,
  uid: string,
): Promise<NextResponse> {
  const { sessionId, votedForUid } = body as SubmitVoteBody;
  if (!sessionId || !votedForUid) {
    return NextResponse.json(
      { error: "Missing sessionId or votedForUid" },
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

  // Verify player is in session (check both playerUids and players array for resilience)
  const playerUids = (data["playerUids"] as string[]) ?? [];
  const players = (data["players"] as { uid: string }[]) ?? [];
  const inPlayerUids = playerUids.includes(uid);
  const inPlayers = players.some((p) => p.uid === uid);

  if (!inPlayerUids && !inPlayers) {
    console.error(
      `[WORDONKULOUS submit-vote] 403: uid=${uid} not in session=${sessionId}. ` +
      `playerUids=[${playerUids.join(",")}] players=[${players.map((p) => p.uid).join(",")}]`,
    );
    return NextResponse.json(
      { error: "You are not in this session" },
      { status: 403 },
    );
  }

  // Verify correct phase
  if (data["wkPhase"] !== "voting") {
    return NextResponse.json(
      { error: "Not in voting phase" },
      { status: 400 },
    );
  }

  // Cannot vote for yourself
  if (votedForUid === uid) {
    return NextResponse.json(
      { error: "Cannot vote for your own word" },
      { status: 400 },
    );
  }

  // Verify the voted-for player has a submission
  const submissions = (data["wkSubmissions"] as Record<string, string>) ?? {};
  if (submissions[votedForUid] == null) {
    return NextResponse.json(
      { error: "Invalid vote target" },
      { status: 400 },
    );
  }

  // Verify player hasn't already voted
  const votes = (data["wkVotes"] as Record<string, string>) ?? {};
  if (votes[uid] != null) {
    return NextResponse.json(
      { error: "Already voted" },
      { status: 400 },
    );
  }

  // Write the vote
  await sessionRef.update({
    [`wkVotes.${uid}`]: votedForUid,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true });
}
