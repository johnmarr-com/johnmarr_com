/**
 * Deadline sweep — the all-absent safety net for timed engine phases.
 *
 * Reducers stamp a generic `phaseDeadlineAt` (epoch ms) whenever they open a
 * timed phase (submit/vote/results/…). Two things advance a passed deadline:
 *   1. CLIENT NUDGE (fast): any present client pokes `/api/games/engine-tick`
 *      the instant its phase deadline passes, firing the engine immediately.
 *   2. THIS SWEEP (slow safety net): if NO client is present to nudge, this
 *      scheduled pass finds sessions whose deadline has passed and writes a
 *      `deadlineTick`, firing the engine so the game can never wedge.
 *
 * It writes only `deadlineTick`/`updatedAt` (never game state) — the reducer
 * reads `now` and decides the actual advance. Untimed phases delete
 * `phaseDeadlineAt`, so an absent field is naturally excluded from the range
 * query and never swept.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";

const MAX_PER_RUN = 200;

export const sweepDeadlines = onSchedule(
  { schedule: "every 1 minutes", memory: "256MiB" },
  async () => {
    const db = getFirestore();
    const now = Date.now();

    // phaseDeadlineAt > 0 excludes untimed phases (sentinel 0 / absent).
    const due = await db
      .collection("gameSessions")
      .where("status", "==", "playing")
      .where("phaseDeadlineAt", ">", 0)
      .where("phaseDeadlineAt", "<=", now)
      .limit(MAX_PER_RUN)
      .get();

    if (due.empty) return;

    let poked = 0;
    await Promise.all(
      due.docs.map(async (d) => {
        try {
          await d.ref.update({
            deadlineTick: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          });
          poked++;
        } catch (err) {
          logger.warn(`[sweepDeadlines] ${d.id}: poke failed`, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }),
    );
    logger.info(`[sweepDeadlines] poked ${poked}/${due.size} due session(s)`);
  },
);
