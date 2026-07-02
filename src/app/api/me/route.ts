import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { buildInitialUserFields } from "@/lib/user-init";

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
  let decoded: Awaited<ReturnType<typeof verifyIdToken>>;
  try {
    decoded = await verifyIdToken(authHeader.substring(7));
  } catch {
    return NextResponse.json({ error: "Invalid auth token" }, { status: 401 });
  }
  const uid = decoded.uid;

  const db = getAdminFirestore();
  const ref = db.doc(`users/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) {
    // First-ever sign-in: create the user doc SERVER-SIDE (Admin SDK, reliable)
    // so every downstream write path (gamertag, avatar, points, profile) finds
    // it — instead of depending on the CLIENT-side saveUserProfile write, which
    // queues on iOS/flaky networks and may not have landed. /api/me runs on auth,
    // before any onboarding write. Idempotent — only creates when missing.
    await ref.set(
      {
        ...buildInitialUserFields({
          uid,
          email: decoded.email ?? null,
          displayName: typeof decoded["name"] === "string" ? (decoded["name"] as string) : null,
          photoURL: typeof decoded["picture"] === "string" ? (decoded["picture"] as string) : null,
        }),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return NextResponse.json(
      {
        user: {
          tier: "free",
          gamertag: null,
          avatarName: null,
          level: 1,
          points: 0,
          levelledUp: false,
          aiImageGenSettings: null,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
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
