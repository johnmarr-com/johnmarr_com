/**
 * Boaty pure types — server copy.
 *
 * Mirrors the geometry/board types in
 * `src/app/games/boaty/boatyTypes.ts` (minus the client-only GameSession /
 * BoatyState shapes). Kept in sync by `tests/boaty-parity.test.ts` (repo root).
 */

export type RaftType = "square" | "lshape" | "shorty";
export type Rotation = 0 | 90 | 180 | 270;
export type AttackResult = "miss" | "hit" | "gator";

export interface Position {
  row: number;
  col: number;
}

export interface RaftDef {
  type: RaftType;
  anchor: Position;
  rotation: Rotation;
}

export interface PlayerBoard {
  rafts: RaftDef[];
  gator: Position;
}

export interface AttackRecord {
  hits: Position[];
  misses: Position[];
  gatorHits: Position[];
}

export interface LastAttack {
  attackerUid: string;
  targetUid: string;
  row: number;
  col: number;
  result: AttackResult;
  defenderGatorBefore?: Position;
  /** Server-computed: did this hit destroy a whole raft? (drives the taunt) */
  sunk?: boolean;
  /** The raft type destroyed, when `sunk`. */
  sunkType?: RaftType;
}
