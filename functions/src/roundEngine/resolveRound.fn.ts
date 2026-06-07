/**
 * Generic server-authoritative round resolver.
 *
 * Fires on every gameSessions update but early-returns unless the session has a
 * `resolverKey` (legacy/client-resolved games are untouched). When all players
 * have submitted their move for the current round, it resolves the round via
 * the registered resolver inside a transaction and writes the result. This
 * removes the host-as-single-point-of-failure: no client's connection can stall
 * a round.
 *
 * Idempotency: the transaction only commits when `rounds.length === currentRound`
 * (the start-of-round invariant). A duplicate/echo fire — including the function's
 * own write, which clears pendingMoves — fails the gate and no-ops.
 */

import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { resolveByKey } from "./registry";
import type { SessionData } from "./types";

function allMovesIn(data: SessionData): boolean {
  const players = data.players ?? [];
  if (players.length < 2) return false;
  const pending = data.pendingMoves ?? {};
  return players.every((p) => pending[p.uid] != null);
}

export const resolveRound = onDocumentUpdated(
  { document: "gameSessions/{sessionId}", minInstances: 1, memory: "256MiB" },
  async (event) => {
    const after = event.data?.after;
    if (!after || !after.exists) return;
    const data = after.data() as SessionData;

    // Gate: only server-resolved sessions, only during play, only once all
    // moves are in for the un-resolved current round.
    const key = data.resolverKey;
    if (!key || data.status !== "playing") return;
    if (!allMovesIn(data)) return;
    if ((data.rounds?.length ?? 0) !== (data.currentRound ?? 0)) return;

    const db = getFirestore();
    const ref = db.doc(`gameSessions/${event.params.sessionId}`);

    await db.runTransaction(async (txn) => {
      const snap = await txn.get(ref);
      if (!snap.exists) return;
      const s = snap.data() as SessionData;

      // Re-validate authoritatively inside the transaction.
      if (s.resolverKey !== key || s.status !== "playing") return;
      const round = s.currentRound ?? 0;
      if ((s.rounds?.length ?? 0) !== round) return; // already resolved → no-op
      if (!allMovesIn(s)) return;

      const out = resolveByKey(key, s);
      if (!out) return; // unknown resolverKey — never wedge the session

      const updates: Record<string, unknown> = {
        rounds: FieldValue.arrayUnion(out.roundEntry),
        transcript: FieldValue.arrayUnion(...out.transcriptLines),
        currentRound: round + 1,
        pendingMoves: {},
        seq: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (out.gameOver) {
        updates.status = "finished";
        updates.winner = out.winner ?? null;
      }
      txn.update(ref, updates);
    });
  },
);
