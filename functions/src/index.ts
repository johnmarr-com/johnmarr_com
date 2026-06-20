import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions";

// Server-authoritative game engine: register game reducers (side-effect
// imports) and export the generic Firestore-triggered engine. hml/rps register
// via the legacy round-resolver registry and are served through the engine's
// simultaneous-move adapter, so `gameEngine` fully replaces the old
// `resolveRound` trigger (they must not both run, or rounds double-resolve).
import "./roundEngine/hml.spec";
import "./roundEngine/rps.spec";
import "./games/boaty/boaty.spec";
import "./games/wordonkulous/wordonkulous.spec";
import "./games/blarf/blarf.spec";
import "./games/bluffbox/bluffbox.spec";
import "./games/fyve/fyve.spec";

initializeApp();

export { gameEngine } from "./engine/gameEngine.fn";
export { sweepDeadlines } from "./engine/sweepDeadlines.fn";

const LEGACY_RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * Scheduled game data cleanup — runs daily at 3:00 AM UTC.
 *
 * Deletes expired game sessions and all associated data:
 *   - game-sketches/{sessionId}/… in Storage
 *   - gameInvites where sessionId matches
 *   - inviteCodes/{normalizedCode}
 *   - gameSessions/{sessionId}
 *
 * Writes a cleanupLogs doc for admin visibility.
 */
export const scheduledGameCleanup = onSchedule(
  {
    schedule: "every day 03:00",
    timeZone: "UTC",
    retryCount: 1,
    memory: "256MiB",
  },
  async () => {
    const db = getFirestore();
    const now = new Date();

    // 1) Sessions with an expiresAt field that has passed
    const expiredByField = await db
      .collection("gameSessions")
      .where("expiresAt", "<=", now)
      .get();

    // 2) Legacy sessions (no expiresAt) older than 24 h
    const legacyCutoff = new Date(Date.now() - LEGACY_RETENTION_MS);
    const allOldSessions = await db
      .collection("gameSessions")
      .where("createdAt", "<=", legacyCutoff)
      .get();
    const legacyExpired = allOldSessions.docs.filter(
      (d) => d.data()["expiresAt"] == null,
    );

    // Deduplicate
    const sessionMap = new Map<string, FirebaseFirestore.DocumentSnapshot>();
    for (const d of expiredByField.docs) sessionMap.set(d.id, d);
    for (const d of legacyExpired) sessionMap.set(d.id, d);

    if (sessionMap.size === 0) {
      logger.info("No expired sessions found.");
      await db.collection("cleanupLogs").add({
        trigger: "scheduled",
        sessionsDeleted: 0,
        inviteCodesDeleted: 0,
        gameInvitesDeleted: 0,
        sketchesDeleted: 0,
        errors: [],
        createdAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    const bucket = getStorage().bucket();
    let sessionsDeleted = 0;
    let inviteCodesDeleted = 0;
    let gameInvitesDeleted = 0;
    let sketchesDeleted = 0;
    const errors: string[] = [];

    for (const [sessionId, snap] of sessionMap) {
      try {
        const data = snap.data() ?? {};

        // Storage: delete game-sketches/{sessionId}/
        try {
          const [files] = await bucket.getFiles({
            prefix: `game-sketches/${sessionId}/`,
          });
          if (files.length > 0) {
            await bucket.deleteFiles({
              prefix: `game-sketches/${sessionId}/`,
            });
            sketchesDeleted += files.length;
          }
        } catch {
          // Non-fatal
        }

        // gameInvites referencing this session
        const invites = await db
          .collection("gameInvites")
          .where("sessionId", "==", sessionId)
          .get();
        if (invites.size > 0) {
          const batch = db.batch();
          invites.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
          gameInvitesDeleted += invites.size;
        }

        // inviteCodes doc
        const inviteCode = data["inviteCode"] as string | undefined;
        if (inviteCode) {
          await db.doc(`inviteCodes/${inviteCode.toLowerCase()}`).delete();
          inviteCodesDeleted++;
        }

        // The session itself
        await db.doc(`gameSessions/${sessionId}`).delete();
        sessionsDeleted++;
      } catch (err) {
        const msg = `${sessionId}: ${err instanceof Error ? err.message : String(err)}`;
        errors.push(msg);
        logger.error(msg);
      }
    }

    // Write cleanup log
    await db.collection("cleanupLogs").add({
      trigger: "scheduled",
      sessionsDeleted,
      inviteCodesDeleted,
      gameInvitesDeleted,
      sketchesDeleted,
      errors,
      createdAt: FieldValue.serverTimestamp(),
    });

    logger.info(
      `Cleanup complete: ${sessionsDeleted} sessions, ${sketchesDeleted} sketches, ${inviteCodesDeleted} invite codes, ${gameInvitesDeleted} game invites deleted.`,
    );
  },
);

/**
 * Callable: record an AI persona game result (win/loss).
 * Accepts { personaId: string, won: boolean }.
 * Requires authenticated caller.
 */
export const recordAIGameResult = onCall(
  { memory: "128MiB" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const { personaId, won } = request.data as { personaId?: string; won?: boolean };
    if (!personaId || typeof won !== "boolean") {
      throw new HttpsError("invalid-argument", "Requires personaId (string) and won (boolean).");
    }

    const db = getFirestore();
    const ref = db.doc(`aiPersonas/${personaId}`);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Persona not found.");
    }

    const updates: Record<string, FirebaseFirestore.FieldValue> = {
      "stats.gamesPlayed": FieldValue.increment(1),
    };
    if (won) {
      updates["stats.wins"] = FieldValue.increment(1);
    } else {
      updates["stats.losses"] = FieldValue.increment(1);
    }

    await ref.update(updates);
    return { ok: true };
  },
);
