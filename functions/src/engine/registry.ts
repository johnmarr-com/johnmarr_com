/**
 * Engine registry.
 *
 * New games register a `Reducer` under an `engineKey`. Legacy simultaneous-move
 * games (hml/rps) keep registering via `registerResolver` in
 * `../roundEngine/registry` and are reached through a built-in adapter — so
 * their spec files never change and `getReducer` always returns something
 * sensible (the adapter no-ops on a truly unknown key).
 */

import { FieldValue } from "firebase-admin/firestore";
import { resolveByKey } from "../roundEngine/registry";
import type { EngineSession, Reducer, StateUpdate } from "./types";

const ENGINE = new Map<string, Reducer>();

export function registerEngine(key: string, reducer: Reducer): void {
  ENGINE.set(key, reducer);
}

/** All players present in `pendingMoves` (the simultaneous-move inbox). */
function allMovesIn(s: EngineSession): boolean {
  const players = s.players ?? [];
  if (players.length < 2) return false;
  const pending = s.pendingMoves ?? {};
  return players.every((p) => pending[p.uid] != null);
}

/**
 * Adapter that presents the legacy `resolveByKey(key, session)` resolver as a
 * `Reducer`. Used for any key not registered as a native engine reducer —
 * which covers hml/rps and harmlessly no-ops for an unrecognized key.
 */
function simultaneousMoveAdapter(key: string): Reducer {
  return {
    shouldRun(s) {
      return (
        s.status === "playing" &&
        allMovesIn(s) &&
        (s.rounds?.length ?? 0) === (s.currentRound ?? 0)
      );
    },
    reduce(ctx): StateUpdate | null {
      const s = ctx.session;
      if (!this.shouldRun(s)) return null;
      const out = resolveByKey(key, s);
      if (!out) return null; // unknown key — never wedge the session
      const round = s.currentRound ?? 0;
      return {
        fields: {
          rounds: FieldValue.arrayUnion(out.roundEntry),
          transcript: FieldValue.arrayUnion(...out.transcriptLines),
          currentRound: round + 1,
          pendingMoves: {},
        },
        gameOver: out.gameOver,
        winner: out.winner,
      };
    },
  };
}

/** Resolve the reducer for a session key (native engine reducer, else the
 *  simultaneous-move adapter). Never returns undefined. */
export function getReducer(key: string): Reducer {
  return ENGINE.get(key) ?? simultaneousMoveAdapter(key);
}
