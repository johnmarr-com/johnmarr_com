/**
 * Boaty pure logic — server copy of the geometry/attack/AI functions from
 * `src/app/games/boaty/boatyLogic.ts`. Pure + deterministic-given-RNG; copied
 * because the functions package can't import the Next app's `src/`. Kept in
 * sync with a parity test (`boaty.logic.test.ts`). Animation constants and
 * client-only helpers (tryRotate/findRaftAt/isRaftDestroyed) are intentionally
 * omitted.
 */

import type {
  Position,
  RaftDef,
  RaftType,
  Rotation,
  PlayerBoard,
  AttackRecord,
  AttackResult,
} from "./types";

export const GRID_SIZE = 5;
export const TOTAL_RAFT_SQUARES = 9; // 4 + 3 + 2

// ─── Raft Shape Offsets ──────────────────────────────────────
const SQUARE_OFFSETS: [number, number][] = [[0, 0], [0, 1], [1, 0], [1, 1]];

const L_OFFSETS: Record<Rotation, [number, number][]> = {
  0: [[0, 0], [0, 1], [1, 1]],
  90: [[0, 1], [1, 0], [1, 1]],
  180: [[0, 0], [1, 0], [1, 1]],
  270: [[0, 0], [0, 1], [1, 0]],
};

const SHORTY_OFFSETS: Record<Rotation, [number, number][]> = {
  0: [[0, 0], [1, 0]],
  90: [[0, 0], [0, 1]],
  180: [[0, 0], [1, 0]],
  270: [[0, 0], [0, 1]],
};

export const RAFT_OFFSETS: Record<RaftType, Record<Rotation, [number, number][]>> = {
  square: { 0: SQUARE_OFFSETS, 90: SQUARE_OFFSETS, 180: SQUARE_OFFSETS, 270: SQUARE_OFFSETS },
  lshape: L_OFFSETS,
  shorty: SHORTY_OFFSETS,
};

// ─── Geometry ────────────────────────────────────────────────
export function getOccupiedSquares(raft: RaftDef): Position[] {
  const offsets = RAFT_OFFSETS[raft.type][raft.rotation];
  return offsets.map(([dr, dc]) => ({
    row: raft.anchor.row + dr,
    col: raft.anchor.col + dc,
  }));
}

export function isInBounds(pos: Position): boolean {
  return pos.row >= 0 && pos.row < GRID_SIZE && pos.col >= 0 && pos.col < GRID_SIZE;
}

export function isRaftInBounds(raft: RaftDef): boolean {
  return getOccupiedSquares(raft).every(isInBounds);
}

export function posKey(p: Position): string {
  return `${p.row},${p.col}`;
}

export function overlapsSet(raft: RaftDef, occupied: Set<string>): boolean {
  return getOccupiedSquares(raft).some((s) => occupied.has(posKey(s)));
}

export function buildOccupiedSet(rafts: RaftDef[], excludeIndex?: number): Set<string> {
  const set = new Set<string>();
  rafts.forEach((r, i) => {
    if (i === excludeIndex) return;
    for (const s of getOccupiedSquares(r)) set.add(posKey(s));
  });
  return set;
}

export function isValidPlacement(raft: RaftDef, otherOccupied: Set<string>): boolean {
  if (!isRaftInBounds(raft)) return false;
  return !overlapsSet(raft, otherOccupied);
}

// ─── Rotation tables (for random placement) ──────────────────
const ROTATIONS: Rotation[] = [0, 90, 180, 270];
const SQUARE_FIXED_ROTATION: Rotation = 0;
const SHORTY_VERTICAL_ROTATIONS: Rotation[] = [0, 180];
const SHORTY_HORIZONTAL_ROTATIONS: Rotation[] = [90, 270];

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

// ─── Random Placement ────────────────────────────────────────
export function randomPlacement(): RaftDef[] {
  const types: RaftType[] = ["square", "lshape", "shorty"];
  const placed: RaftDef[] = [];

  for (const type of types) {
    const occupied = buildOccupiedSet(placed);
    let found = false;

    for (let attempt = 0; attempt < 200 && !found; attempt++) {
      const rotation =
        type === "lshape"
          ? (0 as Rotation)
          : type === "square"
            ? SQUARE_FIXED_ROTATION
            : (SHORTY_VERTICAL_ROTATIONS[
                Math.floor(Math.random() * SHORTY_VERTICAL_ROTATIONS.length)
              ]! as Rotation);
      const row = Math.floor(Math.random() * GRID_SIZE);
      const col = Math.floor(Math.random() * GRID_SIZE);
      const raft: RaftDef = { type, anchor: { row, col }, rotation };

      if (isValidPlacement(raft, occupied)) {
        placed.push(raft);
        found = true;
      }
    }

    if (!found) {
      const rotationOrder =
        type === "lshape"
          ? ROTATIONS
          : type === "square"
            ? [SQUARE_FIXED_ROTATION]
            : [...shuffleArray(SHORTY_VERTICAL_ROTATIONS), ...shuffleArray(SHORTY_HORIZONTAL_ROTATIONS)];
      for (const rotation of rotationOrder) {
        for (let r = 0; r < GRID_SIZE && !found; r++) {
          for (let c = 0; c < GRID_SIZE && !found; c++) {
            const raft: RaftDef = { type, anchor: { row: r, col: c }, rotation };
            if (isValidPlacement(raft, occupied)) {
              placed.push(raft);
              found = true;
            }
          }
        }
      }
    }
  }

  return placed;
}

export function randomGatorPosition(rafts: RaftDef[]): Position {
  const occupied = buildOccupiedSet(rafts);
  const free: Position[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!occupied.has(posKey({ row: r, col: c }))) free.push({ row: r, col: c });
    }
  }
  return free[Math.floor(Math.random() * free.length)] ?? { row: 0, col: 0 };
}

// ─── Gator Movement ─────────────────────────────────────────
const DIRS: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export function moveGator(pos: Position, rafts: RaftDef[]): Position {
  const occupied = buildOccupiedSet(rafts);
  const shuffled = shuffleArray(DIRS);
  for (const [dr, dc] of shuffled) {
    const next: Position = { row: pos.row + dr, col: pos.col + dc };
    if (isInBounds(next) && !occupied.has(posKey(next))) return next;
  }
  return pos; // trapped
}

// ─── Attack Resolution + Win ─────────────────────────────────
export function resolveAttack(
  row: number,
  col: number,
  targetBoard: PlayerBoard,
): AttackResult {
  const key = posKey({ row, col });
  const allRaftSquares = targetBoard.rafts.flatMap(getOccupiedSquares);
  if (allRaftSquares.some((s) => posKey(s) === key)) return "hit";
  if (posKey(targetBoard.gator) === key) return "gator";
  return "miss";
}

export function checkWin(attacks: AttackRecord): boolean {
  return attacks.hits.length >= TOTAL_RAFT_SQUARES;
}

/** The raft (if any) occupying a cell. */
export function findRaftAt(rafts: RaftDef[], row: number, col: number): RaftDef | undefined {
  const key = posKey({ row, col });
  return rafts.find((r) => getOccupiedSquares(r).some((s) => posKey(s) === key));
}

/** True when every cell of this raft is in the hits list (it's destroyed). */
export function isRaftDestroyed(raft: RaftDef, hits: Position[]): boolean {
  const hitSet = new Set(hits.map(posKey));
  return getOccupiedSquares(raft).every((s) => hitSet.has(posKey(s)));
}

// ─── AI target selection (self-contained "standard" strategy) ─
export function aiPickTarget(attacks: AttackRecord): Position {
  const explored = new Set([
    ...attacks.hits.map(posKey),
    ...attacks.misses.map(posKey),
    ...attacks.gatorHits.map(posKey),
  ]);

  if (attacks.hits.length > 0) {
    const hitSet = new Set(attacks.hits.map(posKey));
    for (const hit of attacks.hits) {
      for (const [dr, dc] of DIRS) {
        const neighbor: Position = { row: hit.row + dr, col: hit.col + dc };
        if (hitSet.has(posKey(neighbor))) {
          const forward: Position = { row: neighbor.row + dr, col: neighbor.col + dc };
          const backward: Position = { row: hit.row - dr, col: hit.col - dc };
          if (isInBounds(forward) && !explored.has(posKey(forward))) return forward;
          if (isInBounds(backward) && !explored.has(posKey(backward))) return backward;
        }
      }
    }
    const candidates: Position[] = [];
    for (const hit of attacks.hits) {
      for (const [dr, dc] of DIRS) {
        const adj: Position = { row: hit.row + dr, col: hit.col + dc };
        if (isInBounds(adj) && !explored.has(posKey(adj))) candidates.push(adj);
      }
    }
    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)]!;
    }
  }

  const primary: Position[] = [];
  const secondary: Position[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (explored.has(posKey({ row: r, col: c }))) continue;
      if ((r + c) % 2 === 0) primary.push({ row: r, col: c });
      else secondary.push({ row: r, col: c });
    }
  }
  const pool = primary.length > 0 ? primary : secondary;
  return pool[Math.floor(Math.random() * pool.length)] ?? { row: 0, col: 0 };
}
