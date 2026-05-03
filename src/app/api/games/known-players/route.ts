import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase-admin";

/**
 * Cross-write known-players for every human in a session via the Admin SDK.
 *
 * Why server-side: iOS Safari frequently fails to land client-side Firestore
 * writes during the auth-token / page-transition window when a player
 * joins or starts a game. Doing this through the Admin SDK bypasses the
 * client's connection state entirely and guarantees the relationship is
 * recorded once the request returns 200.
 *
 * The endpoint is idempotent — `arrayUnion` dedupes, so it's safe to call
 * from any subscribed client whenever the player list changes.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid authorization header" },
      { status: 401 },
    );
  }

  let callerUid: string;
  try {
    const decoded = await verifyIdToken(authHeader.substring(7));
    callerUid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
  }

  let sessionId: string;
  try {
    const body = await request.json();
    sessionId = (body as { sessionId?: string }).sessionId ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const sessionRef = db.collection("gameSessions").doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const sessionData = sessionSnap.data() ?? {};
  const players = (sessionData["players"] as Array<{ uid: string }> | undefined) ?? [];
  const allUids = players.map((p) => p.uid);

  // Caller must actually be a participant in the session.
  if (!allUids.includes(callerUid)) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }

  const humanUids = allUids.filter((u) => !u.startsWith("ai-"));
  if (humanUids.length < 2) {
    return NextResponse.json({ ok: true, written: 0 });
  }

  // For each human player, append the *other* humans to their knownPlayerUids.
  const batch = db.batch();
  for (const playerUid of humanUids) {
    const others = humanUids.filter((u) => u !== playerUid);
    if (others.length === 0) continue;
    batch.set(
      db.collection("users").doc(playerUid),
      { knownPlayerUids: FieldValue.arrayUnion(...others) },
      { merge: true },
    );
  }
  await batch.commit();

  return NextResponse.json({ ok: true, written: humanUids.length });
}
