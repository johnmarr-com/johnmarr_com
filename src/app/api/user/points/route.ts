import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { ActivityKey } from "@/lib/points";
import { ACTIVITY_KEYS } from "@/lib/points";

const VALID_KEYS = new Set<string>(ACTIVITY_KEYS);

/** Keys tied to a game session (validated + deduped against the session). */
const GAME_KEYS = new Set<ActivityKey>(["play_game", "host_game", "win_game"]);

/** Game keys that make no sense without a session. */
const SESSION_REQUIRED_KEYS = new Set<ActivityKey>(["host_game", "win_game"]);

/**
 * Minimum seconds between awards of the same key for one user. Applies to
 * media keys always, and to sessionless `play_game` (true-solo modes).
 * Values sit just under the natural duration of the activity.
 */
const COOLDOWN_SECONDS: Partial<Record<ActivityKey, number>> = {
  watch_video: 120,
  watch_short_film: 120,
  read_story: 300,
  listen_song: 60,
  share_social: 3600,
  play_game: 180,
};

/**
 * Does this session record the caller as (one of) the winner(s)?
 * Canonical: `winnerUids` (written by the engine at gameOver). The rest are
 * fallbacks for sessions finished before the engine wrote winnerUids.
 */
function isSessionWinner(session: Record<string, unknown>, uid: string): boolean {
  const winnerUids = session["winnerUids"];
  if (Array.isArray(winnerUids)) return winnerUids.includes(uid);

  if (session["winner"] === uid) return true;
  // MegaSketchy co-op sentinel: a passed mission means every participant won.
  if (session["winner"] === "agents") return true;
  // FYVE team sentinel: winner is a team name; check its member roster.
  const teams = session["teams"] as
    | Record<string, { members?: string[] } | undefined>
    | undefined;
  const winningTeam =
    typeof session["winner"] === "string" ? teams?.[session["winner"]] : undefined;
  if (winningTeam?.members?.includes(uid)) return true;
  // Winner arrays: bluffbox `winners`, plus game-prefixed (bfWinners, …).
  return Object.entries(session).some(
    ([key, value]) =>
      (key === "winners" || /Winners$/.test(key)) &&
      Array.isArray(value) &&
      value.includes(uid),
  );
}

/**
 * POST /api/user/points
 * Body: { activityKey: ActivityKey, sessionId?: string }
 *
 * Awards are server-guarded (see docs/SYSTEM-REVIEW.md item 5):
 * - Game keys carry a sessionId; the caller must be a session participant,
 *   `win_game` requires a finished session that records them as a winner,
 *   and each (session, key, uid) awards at most once — a `pointsAwarded`
 *   marker on the session makes replays no-ops.
 * - Media keys (and sessionless solo `play_game`) are rate-limited by
 *   per-key cooldown timestamps on the user doc.
 * All checks and the increment run in one transaction, so parallel replays
 * can't double-award.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid authorization header" }, { status: 401 });
    }

    const decodedToken = await verifyIdToken(authHeader.substring(7));
    const uid = decodedToken.uid;

    const body = (await request.json()) as { activityKey?: string; sessionId?: string };
    const activityKey = body.activityKey as ActivityKey;
    const sessionId =
      typeof body.sessionId === "string" && body.sessionId.length > 0
        ? body.sessionId
        : null;

    if (!activityKey || !VALID_KEYS.has(activityKey)) {
      return NextResponse.json({ error: "Invalid activity key" }, { status: 400 });
    }
    if (SESSION_REQUIRED_KEYS.has(activityKey) && !sessionId) {
      return NextResponse.json({ error: "sessionId required for this activity" }, { status: 400 });
    }

    const db = getAdminFirestore();

    const activityDoc = await db.collection("pointActivities").doc(activityKey).get();
    if (!activityDoc.exists) {
      return NextResponse.json({ error: "Activity not configured" }, { status: 404 });
    }
    const pointsToAward = (activityDoc.data()?.["points"] as number | undefined) ?? 0;
    if (pointsToAward <= 0) {
      return NextResponse.json({ awarded: 0, message: "Activity has no point value" });
    }

    // Levels rarely change — read once outside the transaction.
    const levelsSnap = await db.collection("levels").orderBy("level", "asc").get();
    const levels = levelsSnap.docs.map((doc) => ({
      level: (doc.data()["level"] as number | undefined) ?? 1,
      minPoints: (doc.data()["minPoints"] as number | undefined) ?? 0,
    }));

    const userRef = db.collection("users").doc(uid);
    const sessionRef =
      GAME_KEYS.has(activityKey) && sessionId
        ? db.collection("gameSessions").doc(sessionId)
        : null;

    const result = await db.runTransaction(async (txn) => {
      const userSnap = await txn.get(userRef);
      const userData = userSnap.data() ?? {};
      const prevPoints = (userData["points"] as number | undefined) ?? 0;
      const prevLevel = (userData["level"] as number | undefined) ?? 1;

      if (sessionRef) {
        // Game-key path: participant check + once-per-session dedup.
        const sessionSnap = await txn.get(sessionRef);
        if (!sessionSnap.exists) {
          return { status: 404 as const, error: "Session not found" };
        }
        const session = sessionSnap.data() ?? {};
        const playerUids = Array.isArray(session["playerUids"])
          ? (session["playerUids"] as string[])
          : [];
        if (!playerUids.includes(uid)) {
          return { status: 403 as const, error: "Not a session participant" };
        }
        if (activityKey === "win_game") {
          if (session["status"] !== "finished") {
            return { status: 409 as const, error: "Game not finished" };
          }
          if (!isSessionWinner(session, uid)) {
            return { status: 403 as const, error: "Not a winner of this session" };
          }
        }
        // Dedup per replay generation — Play Again reuses the session doc,
        // so the marker key includes replayCount.
        const generation = (session["replayCount"] as number | undefined) ?? 0;
        const markerKey = `${activityKey}:${generation}`;
        const awarded = (session["pointsAwarded"] as Record<string, unknown> | undefined)?.[markerKey];
        if (Array.isArray(awarded) && awarded.includes(uid)) {
          return { status: 200 as const, dedup: true, prevPoints, prevLevel };
        }
        txn.set(
          sessionRef,
          { pointsAwarded: { [markerKey]: FieldValue.arrayUnion(uid) } },
          { merge: true },
        );
      } else {
        // Cooldown path (media keys + sessionless solo play_game).
        const cooldown = COOLDOWN_SECONDS[activityKey] ?? 60;
        const last = (userData["pointCooldowns"] as Record<string, unknown> | undefined)?.[activityKey];
        if (last instanceof Timestamp) {
          const elapsed = (Date.now() - last.toMillis()) / 1000;
          if (elapsed < cooldown) {
            return { status: 200 as const, dedup: true, prevPoints, prevLevel };
          }
        }
        txn.set(
          userRef,
          { pointCooldowns: { [activityKey]: FieldValue.serverTimestamp() } },
          { merge: true },
        );
      }

      const newTotal = prevPoints + pointsToAward;
      let newLevel = prevLevel;
      for (const lvl of levels) {
        if (lvl.minPoints <= newTotal) newLevel = lvl.level;
      }
      const levelledUp = newLevel > prevLevel;

      // set+merge, never update(): the users doc may lag for brand-new signups.
      txn.set(
        userRef,
        {
          points: FieldValue.increment(pointsToAward),
          updatedAt: FieldValue.serverTimestamp(),
          ...(levelledUp ? { level: newLevel, levelledUp: true } : {}),
        },
        { merge: true },
      );

      return { status: 200 as const, dedup: false, newTotal, levelledUp };
    });

    if (result.status !== 200) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    if (result.dedup) {
      return NextResponse.json({ awarded: 0, total: result.prevPoints, levelledUp: false });
    }
    return NextResponse.json({
      awarded: pointsToAward,
      total: result.newTotal,
      levelledUp: result.levelledUp,
    });
  } catch (error) {
    console.error("Points award error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
