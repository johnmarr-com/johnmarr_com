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

const MAX_FACT_LENGTH = 200;
const MIN_FACT_LENGTH = 2;

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

    if (action === "submit-fact") {
      return handleSubmitFact(body, uid);
    }

    if (action === "submit-vote") {
      return handleSubmitVote(body, uid);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error(`[LINEUP] Error for uid=${uid}:`, err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/** Verify the caller is a participant. Checks both `playerUids` and the
 *  `players` array for resilience (the same belt-and-suspenders Wordonkulous
 *  uses against a transient lobby/session inconsistency). */
function isParticipant(
  data: FirebaseFirestore.DocumentData,
  uid: string,
): boolean {
  const playerUids = (data["playerUids"] as string[]) ?? [];
  const players = (data["players"] as { uid: string }[]) ?? [];
  return playerUids.includes(uid) || players.some((p) => p.uid === uid);
}

// ─── SUBMIT FACT ────────────────────────────────────────────

interface SubmitFactBody {
  action: "submit-fact";
  sessionId: string;
  fact: string;
}

/**
 * A player submits their fun fact. The fact text is SECRET — written to the
 * owner-readable `lineupFacts/{sid}/facts/{uid}` so no one else can read whose
 * fact is whose. Only a public `luSubmitted.{uid}` marker (no text) goes on the
 * session doc, so others can see the submitted count without the content. The
 * two writes are batched so the marker and the fact can never diverge.
 */
async function handleSubmitFact(body: unknown, uid: string): Promise<NextResponse> {
  const { sessionId, fact } = body as SubmitFactBody;
  if (!sessionId || typeof fact !== "string") {
    return NextResponse.json({ error: "Missing sessionId or fact" }, { status: 400 });
  }

  const trimmed = fact.trim();
  if (trimmed.length < MIN_FACT_LENGTH || trimmed.length > MAX_FACT_LENGTH) {
    return NextResponse.json(
      { error: `Fact must be ${MIN_FACT_LENGTH}-${MAX_FACT_LENGTH} characters` },
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

  if (!isParticipant(data, uid)) {
    console.error(`[LINEUP submit-fact] 403: uid=${uid} not in session=${sessionId}`);
    return NextResponse.json({ error: "You are not in this session" }, { status: 403 });
  }

  if (data["luPhase"] !== "collecting") {
    return NextResponse.json({ error: "Not in the fact-collecting phase" }, { status: 400 });
  }

  const submitted = (data["luSubmitted"] as Record<string, boolean>) ?? {};
  if (submitted[uid]) {
    return NextResponse.json({ error: "Already submitted" }, { status: 400 });
  }

  // Secret fact doc (owner-readable) + public submission marker, atomically.
  const batch = db.batch();
  batch.set(db.doc(`lineupFacts/${sessionId}/facts/${uid}`), { fact: trimmed });
  batch.update(sessionRef, {
    [`luSubmitted.${uid}`]: true,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();

  console.log(`[LINEUP submit-fact] OK uid=${uid} session=${sessionId}`);
  return NextResponse.json({ ok: true });
}

// ─── SUBMIT VOTE ────────────────────────────────────────────

interface SubmitVoteBody {
  action: "submit-vote";
  sessionId: string;
  votedForUid: string;
}

/** Cast a guess for who wrote the current fact. The author doesn't vote on
 *  their own fact (the engine excludes them); a stray author vote is harmless. */
async function handleSubmitVote(body: unknown, uid: string): Promise<NextResponse> {
  const { sessionId, votedForUid } = body as SubmitVoteBody;
  if (!sessionId || typeof votedForUid !== "string" || !votedForUid) {
    return NextResponse.json({ error: "Missing sessionId or votedForUid" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const sessionRef = db.doc(`gameSessions/${sessionId}`);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  const data = sessionSnap.data()!;

  if (!isParticipant(data, uid)) {
    console.error(`[LINEUP submit-vote] 403: uid=${uid} not in session=${sessionId}`);
    return NextResponse.json({ error: "You are not in this session" }, { status: 403 });
  }

  if (data["luPhase"] !== "voting") {
    return NextResponse.json({ error: "Not in voting phase" }, { status: 400 });
  }

  // You can't guess yourself — your own facts never come up for you to vote on.
  if (votedForUid === uid) {
    return NextResponse.json({ error: "Cannot vote for yourself" }, { status: 400 });
  }

  // Target must be a real player in this session.
  const playerUids = (data["playerUids"] as string[]) ?? [];
  const players = (data["players"] as { uid: string }[]) ?? [];
  const allUids = new Set([...playerUids, ...players.map((p) => p.uid)]);
  if (!allUids.has(votedForUid)) {
    return NextResponse.json({ error: "Invalid vote target" }, { status: 400 });
  }

  // One guess per round.
  const votes = (data["luVotes"] as Record<string, string>) ?? {};
  if (votes[uid] != null) {
    return NextResponse.json({ error: "Already voted" }, { status: 400 });
  }

  await sessionRef.update({
    [`luVotes.${uid}`]: votedForUid,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true });
}
