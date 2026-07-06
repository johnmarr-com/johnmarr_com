/**
 * Generalized server-authority engine types.
 *
 * The engine turns a Firestore `gameSessions/{id}` update into one atomic,
 * server-authored game step. Each game registers a pure `Reducer` keyed by
 * `engineKey` (legacy `resolverKey` still works via the simultaneous-move
 * adapter in `registry.ts`). The trigger (`gameEngine.fn.ts`) owns the
 * transaction, the monotonic `seq` bump, secret-doc reads, and post-commit
 * effects; the reducer owns the pure game logic and returns `null` when there
 * is nothing to advance (the universal no-op that prevents self-write loops).
 *
 * The functions package is standalone (no `@/` alias into the Next app's
 * `src/`), so the session shape is described here and game-specific pure logic
 * is copied into `functions/src/games/*` with a parity unit test.
 */

import type { SessionPlayer, RoundResult } from "../roundEngine/types";

export type { SessionPlayer, RoundResult };

/** A single player event written to the inbox by a client. */
export interface InboxEvent {
  /** Client-generated id; lets a retried write be idempotent (same slot). */
  eventId?: string;
  [k: string]: unknown;
}

/**
 * Superset of the gameSessions fields the engine + reducers read. Game-specific
 * fields (bt*, wk*, sv*, …) are opaque to the engine and reached via the index
 * signature.
 */
export interface EngineSession {
  players?: SessionPlayer[];
  playerUids?: string[];
  playerSides?: Record<string, string>;
  ownerId?: string;
  status?: string;
  /** New canonical key; `resolverKey` is the back-compat alias. */
  engineKey?: string;
  resolverKey?: string;
  seq?: number;
  /** Namespaced client→server inbox: channel → uid → event. */
  inbox?: Record<string, Record<string, InboxEvent>>;
  /** Legacy simultaneous-move fields (hml/rps). */
  pendingMoves?: Record<string, string>;
  rounds?: RoundResult[];
  currentRound?: number;
  winner?: string | null;
  [k: string]: unknown;
}

/** A write to a doc other than the session (e.g. a secret board), same txn. */
export interface DocWrite {
  /** Full Firestore path, e.g. `boatyBoards/{sessionId}`. */
  path: string;
  /** Field map (dot-paths + FieldValue sentinels allowed). */
  fields: Record<string, unknown>;
  /** When true, merge into the existing doc; otherwise overwrite. */
  merge?: boolean;
}

/** A side-effect to run AFTER the transaction commits (never blocks the step). */
export interface EngineEffect {
  /** Dispatched to a handler registered via `registerEffect`. */
  kind: string;
  [k: string]: unknown;
}

/** One atomic advance the reducer asks the engine to apply. */
export interface StateUpdate {
  /** Session-doc field updates (dot-paths + FieldValue sentinels allowed). */
  fields: Record<string, unknown>;
  /** Optional writes to other docs in the same transaction. */
  docWrites?: DocWrite[];
  /** Post-commit side-effects (e.g. drive a pure-code AI turn). */
  effects?: EngineEffect[];
  /** When true, the engine sets status:"finished" + winner + winnerUids. */
  gameOver?: boolean;
  winner?: string | null;
  /**
   * Canonical winning-player uids, written to the session at gameOver.
   * Supply when winners ≠ [winner] (ties, teams, co-op); defaults to
   * `[winner]`. Server consumers (e.g. the points API) validate win claims
   * against this.
   */
  winnerUids?: string[];
}

export interface ReduceContext {
  session: EngineSession;
  sessionId: string;
  /** Wall-clock millis, injected for determinism/testability. */
  now: number;
  /** Secret docs declared via `Reducer.secretRefs`, keyed by path (null if absent). */
  secrets: Record<string, Record<string, unknown> | null>;
}

export interface Reducer {
  /** Cheap, allocation-light pre-transaction gate. Pure. */
  shouldRun(s: EngineSession): boolean;
  /** Secret doc paths to read inside the transaction (e.g. the hidden board). */
  secretRefs?(s: EngineSession, sessionId: string): string[];
  /** Pure: the next atomic advance, or null when nothing should change. */
  reduce(ctx: ReduceContext): StateUpdate | null;
}
