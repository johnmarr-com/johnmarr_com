import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase-admin";

/**
 * Plain-HTTPS read of a game session's current state.
 *
 * This is the transport-independent fallback for the realtime listener: iOS
 * Safari suspends Firestore's long-lived Watch stream (the WebChannel) on
 * backgrounding / idle, stranding the client on stale state for ~30s until the
 * SDK's internal recovery. A normal HTTPS GET rides none of that machinery, so
 * it always returns the live state in <1s. The client polls this on a watchdog
 * and renders from whichever transport delivers the newest `seq`, keeping the
 * game playable even while the realtime channel is wedged.
 */
export async function GET(request: NextRequest) {
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

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const db = getAdminFirestore();
  const snap = await db.doc(`gameSessions/${sessionId}`).get();
  if (!snap.exists) {
    return NextResponse.json({ session: null });
  }
  const data = snap.data() as Record<string, unknown>;

  // Only participants may read session state.
  const playerUids = (data["playerUids"] as string[] | undefined) ?? [];
  if (!playerUids.includes(uid)) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }

  return NextResponse.json(
    { session: { id: snap.id, ...data } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
