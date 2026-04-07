import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { ActivityKey } from "@/lib/points";

const VALID_KEYS = new Set([
  "watch_video",
  "watch_short_film",
  "read_story",
  "listen_song",
  "play_game",
  "host_game",
  "share_social",
]);

/**
 * POST /api/user/points
 * Body: { activityKey: ActivityKey }
 *
 * Looks up the point value for the activity, increments the user's
 * `points` field, and returns the new total.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid authorization header" }, { status: 401 });
    }

    const decodedToken = await verifyIdToken(authHeader.substring(7));
    const uid = decodedToken.uid;

    const body = await request.json();
    const activityKey = body.activityKey as ActivityKey;

    if (!activityKey || !VALID_KEYS.has(activityKey)) {
      return NextResponse.json({ error: "Invalid activity key" }, { status: 400 });
    }

    const db = getAdminFirestore();

    const activityDoc = await db.collection("pointActivities").doc(activityKey).get();
    if (!activityDoc.exists) {
      return NextResponse.json({ error: "Activity not configured" }, { status: 404 });
    }

    const activityData = activityDoc.data();
    const pointsToAward = activityData?.["points"] ?? 0;
    if (pointsToAward <= 0) {
      return NextResponse.json({ awarded: 0, message: "Activity has no point value" });
    }

    const userRef = db.collection("users").doc(uid);

    const userSnap = await userRef.get();
    const prevData = userSnap.data();
    const prevPoints = prevData?.["points"] ?? 0;
    const prevLevel = prevData?.["level"] ?? 1;

    await userRef.update({
      points: FieldValue.increment(pointsToAward),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const newTotal = prevPoints + pointsToAward;

    // Check for level-up: find the highest level the user now qualifies for
    const levelsSnap = await db.collection("levels").orderBy("level", "asc").get();
    let newLevel = prevLevel;
    for (const doc of levelsSnap.docs) {
      const lvl = doc.data();
      if ((lvl["minPoints"] ?? 0) <= newTotal) {
        newLevel = lvl["level"] ?? newLevel;
      }
    }

    let levelledUp = false;
    if (newLevel > prevLevel) {
      levelledUp = true;
      await userRef.update({
        level: newLevel,
        levelledUp: true,
      });
    }

    return NextResponse.json({ awarded: pointsToAward, total: newTotal, levelledUp });
  } catch (error) {
    console.error("Points award error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
