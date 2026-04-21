/**
 * Point activity definitions and the PointsManager for awarding points.
 *
 * Activities are stored in Firestore `pointActivities/{activityKey}`.
 * Each doc has: key, label, points, order, createdAt, updatedAt.
 *
 * The PointsManager is a server-side singleton that caches the activity
 * point values and exposes `awardPoints(uid, activityKey)`.
 */

export interface PointActivity {
  key: string;
  label: string;
  points: number;
  order: number;
}

/** Hardcoded activity keys that map to analytics events. */
export const ACTIVITY_KEYS = [
  "watch_video",
  "watch_short_film",
  "read_story",
  "listen_song",
  "play_game",
  "host_game",
  "win_game",
  "share_social",
] as const;

export type ActivityKey = (typeof ACTIVITY_KEYS)[number];

export const ACTIVITY_LABELS: Record<ActivityKey, string> = {
  watch_video: "Watch Video",
  watch_short_film: "Watch Short Film",
  read_story: "Read Story / Chapter",
  listen_song: "Listen to Song",
  play_game: "Play Game",
  host_game: "Host a Game",
  win_game: "Win a Game",
  share_social: "Share to Social",
};

/* ─── Client-side Firestore helpers (for admin panel) ─── */

export async function getAllPointActivities(): Promise<PointActivity[]> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, collection, query, orderBy, getDocs } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  const q = query(collection(db, "pointActivities"), orderBy("order", "asc"));
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({ key: d.id, ...d.data() } as PointActivity));
}

export async function setPointActivity(key: string, data: { label: string; points: number; order: number }): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, setDoc, serverTimestamp } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  await setDoc(doc(db, "pointActivities", key), {
    ...data,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * Seed default activities if they don't exist yet.
 * Called from the admin panel on first load.
 */
export async function seedDefaultActivities(): Promise<void> {
  const { initializeFirebase } = await import("./firebase");
  const { getFirestore, doc, getDoc, setDoc, serverTimestamp } = await import("firebase/firestore");

  const { app } = await initializeFirebase();
  const db = getFirestore(app);

  let order = 0;
  for (const key of ACTIVITY_KEYS) {
    const ref = doc(db, "pointActivities", key);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        label: ACTIVITY_LABELS[key],
        points: key === "win_game" ? 5 : 0,
        order,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    order++;
  }
}

/* ─── PointsManager: client-side singleton for awarding points ─── */

export interface AwardResult {
  awarded: number;
  total: number;
  levelledUp?: boolean;
}

/**
 * Client-side points manager. Import and call from anywhere in the app:
 *
 *   import { PointsManager, Activity } from "@/lib/points";
 *   const result = await PointsManager.award(Activity.PLAY_GAME);
 */
export const Activity = {
  WATCH_VIDEO: "watch_video",
  WATCH_SHORT_FILM: "watch_short_film",
  READ_STORY: "read_story",
  LISTEN_SONG: "listen_song",
  PLAY_GAME: "play_game",
  HOST_GAME: "host_game",
  WIN_GAME: "win_game",
  SHARE_SOCIAL: "share_social",
} as const satisfies Record<string, ActivityKey>;

let _refreshCallback: (() => Promise<void>) | null = null;

export const PointsManager = {
  /**
   * Register a callback that refreshes user context (called by AuthProvider).
   */
  registerRefresh(cb: () => Promise<void>) {
    _refreshCallback = cb;
  },

  /**
   * Award points for a completed activity.
   * Returns the number of points awarded and the user's new total,
   * or null if the request failed (user not logged in, etc.).
   * Automatically refreshes the auth context afterward.
   */
  async award(activity: ActivityKey): Promise<AwardResult | null> {
    console.log("[PointsManager] award() called for:", activity);
    try {
      const { getAuth } = await import("./auth");
      const auth = await getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.log("[PointsManager] ✗ no currentUser — aborting");
        return null;
      }
      console.log("[PointsManager] user:", currentUser.uid);

      const idToken = await currentUser.getIdToken();
      const res = await fetch("/api/user/points", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ activityKey: activity }),
      });

      console.log("[PointsManager] API response status:", res.status);
      if (!res.ok) {
        const errBody = await res.text();
        console.log("[PointsManager] ✗ API error body:", errBody);
        return null;
      }

      const data = await res.json();
      console.log("[PointsManager] API response data:", data);
      const result: AwardResult = {
        awarded: data.awarded ?? 0,
        total: data.total ?? 0,
        levelledUp: data.levelledUp ?? false,
      };

      if (result.awarded > 0 && _refreshCallback) {
        console.log("[PointsManager] refreshing auth context...");
        await _refreshCallback();
      }

      return result;
    } catch (err) {
      console.error("[PointsManager] award failed:", err);
      return null;
    }
  },
};
