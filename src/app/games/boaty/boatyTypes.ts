import type { GameSession } from "@/lib/game-sessions";

// ─── Core Types ──────────────────────────────────────────────

export type BoatyPhase = "setup" | "play" | "finished";
export type RaftType = "square" | "lshape" | "shorty";
export type Rotation = 0 | 90 | 180 | 270;
export type AttackResult = "miss" | "hit" | "gator";

export interface Position {
  row: number;
  col: number;
}

/** A raft definition: type, anchor (top-left of bounding box), and rotation. */
export interface RaftDef {
  type: RaftType;
  anchor: Position;
  rotation: Rotation;
}

/** A player's board state stored in Firestore. */
export interface PlayerBoard {
  rafts: RaftDef[];
  gator: Position;
}

/** Accumulated attacks made against a player's board. */
export interface AttackRecord {
  hits: Position[];
  misses: Position[];
  /** Squares where the gator was hit — explored but no marker left. */
  gatorHits: Position[];
}

/** Info about the most recent attack (for animation/display). */
export interface LastAttack {
  attackerUid: string;
  targetUid: string;
  row: number;
  col: number;
  result: AttackResult;
  /** Defender's gator before the post-hit slither (throw phase shows this; then board shows new pos). */
  defenderGatorBefore?: Position;
}

// ─── Session State ───────────────────────────────────────────

export interface BoatyState {
  session: GameSession | null;
  btPhase: BoatyPhase;
  btBoards: Record<string, PlayerBoard>;
  btReady: Record<string, boolean>;
  btCurrentTurn: string | null;
  /** Attacks keyed by TARGET uid — attacks made against that player's board. */
  btAttacks: Record<string, AttackRecord>;
  btLastAttack: LastAttack | null;
  btWinner: string | null;
  isHost: boolean;
}
