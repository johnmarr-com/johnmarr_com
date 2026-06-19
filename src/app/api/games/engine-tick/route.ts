import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Generic engine nudge.
 *
 * The server-authority engine only runs on a `gameSessions/{id}` write. Timed
 * phases with no player input (a round intro, a results hold) would otherwise
 * sit until the 1-minute deadline sweep. This lets any present client poke the
 * engine the instant its phase deadline passes: it writes only `deadlineTick`
 * (never game state), firing the engine, whose reducer reads `now` and decides
 * whether to advance. Idempotent — concurrent pokes just fire it again; the
 * reducer no-ops once advanced (the `seq` fence). Participant-gated.
 */
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

  const body = await request.json().catch(() => null);
  const sessionId = body?.sessionId as string | undefined;
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const ref = db.doc(`gameSessions/${sessionId}`);
  const snap = await ref.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  const data = snap.data()!;
  if (!((data["playerUids"] as string[] | undefined) ?? []).includes(uid)) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }
  if (data["status"] !== "playing") {
    return NextResponse.json({ ok: true, skipped: "not-playing" });
  }

  await ref.update({
    deadlineTick: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return NextResponse.json({ ok: true });
}
