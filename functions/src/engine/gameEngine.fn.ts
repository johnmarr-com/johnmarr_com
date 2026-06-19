/**
 * Generalized server-authoritative game engine.
 *
 * Fires on every `gameSessions/{id}` update, early-returns unless the session
 * has an `engineKey` (or legacy `resolverKey`). Looks up the game's reducer,
 * and in a transaction: re-reads the session, reads any secret docs the reducer
 * declares (e.g. a hidden board), calls the pure `reduce`, and atomically
 * applies the returned field-map + secret-doc writes, always bumping the
 * monotonic `seq`. After commit it runs post-commit effects (e.g. a pure-code
 * AI turn).
 *
 * Idempotency / no self-write loop: `reduce` is convergent — given a state the
 * engine just produced it returns `null` (no-op). The `seq` fence (optimistic
 * transaction retry) prevents two overlapping fires from committing the same
 * step. This generalizes the old `resolveRound` (which only handled the
 * simultaneous-move round shape) without changing hml/rps.
 */

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getReducer } from "./registry";
import { runEffects } from "./effects";
import type { EngineSession, EngineEffect } from "./types";

export const gameEngine = onDocumentUpdated(
  { document: "gameSessions/{sessionId}", minInstances: 1, memory: "256MiB" },
  async (event) => {
    const after = event.data?.after;
    if (!after || !after.exists) return;
    const data = after.data() as EngineSession;

    const key = data.engineKey ?? data.resolverKey;
    if (!key || data.status !== "playing") return;

    const reducer = getReducer(key);
    if (!reducer.shouldRun(data)) return; // cheap pre-transaction gate

    const db = getFirestore();
    const sessionId = event.params.sessionId;
    const ref = db.doc(`gameSessions/${sessionId}`);
    const secretPaths = reducer.secretRefs?.(data, sessionId) ?? [];

    let pendingEffects: EngineEffect[] = [];

    await db.runTransaction(async (txn) => {
      const snap = await txn.get(ref);
      if (!snap.exists) return;
      const s = snap.data() as EngineSession;

      // Re-validate authoritatively inside the transaction.
      if ((s.engineKey ?? s.resolverKey) !== key || s.status !== "playing") return;
      if (!reducer.shouldRun(s)) return;

      // Read declared secret docs (e.g. hidden boards) within the same txn.
      const secrets: Record<string, Record<string, unknown> | null> = {};
      for (const path of secretPaths) {
        const ss = await txn.get(db.doc(path));
        secrets[path] = ss.exists ? (ss.data() as Record<string, unknown>) : null;
      }

      const out = reducer.reduce({ session: s, sessionId, now: Date.now(), secrets });
      if (!out) return; // nothing to advance — also breaks the self-write loop

      const fields: Record<string, unknown> = {
        ...out.fields,
        seq: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (out.gameOver) {
        fields["status"] = "finished";
        fields["winner"] = out.winner ?? null;
      }
      txn.update(ref, fields);

      for (const w of out.docWrites ?? []) {
        txn.set(db.doc(w.path), w.fields, { merge: w.merge ?? true });
      }

      pendingEffects = out.effects ?? [];
    });

    if (pendingEffects.length > 0) {
      await runEffects(pendingEffects, { db, sessionId });
    }
  },
);
