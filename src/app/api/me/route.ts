import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase-admin";

/**
 * The signed-in user's profile, over plain HTTPS.
 *
 * Reads go through the Admin SDK on a stateless request — NOT the Firestore
 * realtime stream, which iOS Safari suspends/wedges (a `getDoc` then queues for
 * 30s+). This load path therefore behaves identically on every device. The
 * client caches the result in localStorage for instant hydration and calls this
 * to refresh. (Realtime listeners are reserved for genuinely-live data.)
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

  const db = getAdminFirestore();
  const snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists) {
    return NextResponse.json({ user: null }, { headers: { "Cache-Control": "no-store" } });
  }
  const d = snap.data() ?? {};

  // Return only the profile fields the client needs (mapped client-side).
  return NextResponse.json(
    {
      user: {
        tier: d["tier"] ?? null,
        gamertag: d["gamertag"] ?? null,
        avatarName: typeof d["avatarName"] === "string" ? d["avatarName"] : null,
        level: typeof d["level"] === "number" ? d["level"] : 1,
        points: typeof d["points"] === "number" ? d["points"] : 0,
        levelledUp: d["levelledUp"] === true,
        aiImageGenSettings: d["aiImageGenSettings"] ?? null,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
