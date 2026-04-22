import type { Position, RaftDef, RaftType, Rotation, PlayerBoard, AttackRecord, AttackResult } from "./boatyTypes";

// ─── Constants ───────────────────────────────────────────────

export const GRID_SIZE = 5;
export const TOTAL_RAFT_SQUARES = 9; // 4 + 3 + 2

/** Molotov arc — keep in sync with `bt-molotov-throw` duration in globals.css */
export const BOATY_THROW_MS = 1500;
/** Impact burst — keep in sync with `bt-molotov-impact` duration in globals.css */
export const BOATY_IMPACT_ANIM_MS = 400;
/** Full seconds the revealed result stays on screen after impact finishes. */
export const BOATY_POST_REVEAL_HOLD_MS = 3000;

/** Throw + impact + post-reveal hold before turn advance / game end (human + AI). */
export const BOATY_ATTACK_ANIM_MS =
  BOATY_THROW_MS + BOATY_IMPACT_ANIM_MS + BOATY_POST_REVEAL_HOLD_MS;

// ─── Raft Shape Offsets ──────────────────────────────────────
// Offsets from the anchor (top-left of bounding box) for each rotation.

const SQUARE_OFFSETS: [number, number][] = [[0, 0], [0, 1], [1, 0], [1, 1]];

const L_OFFSETS: Record<Rotation, [number, number][]> = {
  0:   [[0, 0], [0, 1], [1, 1]],
  90:  [[0, 1], [1, 0], [1, 1]],
  180: [[0, 0], [1, 0], [1, 1]],
  270: [[0, 0], [0, 1], [1, 0]],
};

const SHORTY_OFFSETS: Record<Rotation, [number, number][]> = {
  0:   [[0, 0], [1, 0]],   // vertical (default)
  90:  [[0, 0], [0, 1]],   // horizontal
  180: [[0, 0], [1, 0]],   // vertical
  270: [[0, 0], [0, 1]],   // horizontal
};

export const RAFT_OFFSETS: Record<RaftType, Record<Rotation, [number, number][]>> = {
  square: { 0: SQUARE_OFFSETS, 90: SQUARE_OFFSETS, 180: SQUARE_OFFSETS, 270: SQUARE_OFFSETS },
  lshape: L_OFFSETS,
  shorty: SHORTY_OFFSETS,
};

// ─── Raft Geometry ───────────────────────────────────────────

/** Get all grid squares occupied by a raft. */
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

/** Make a set key from a position for fast lookups. */
export function posKey(p: Position): string {
  return `${p.row},${p.col}`;
}

/** Check if a raft overlaps with any positions in a set. */
export function overlapsSet(raft: RaftDef, occupied: Set<string>): boolean {
  return getOccupiedSquares(raft).some((s) => occupied.has(posKey(s)));
}

/** Build an occupied-squares set from an array of rafts, optionally excluding one by index. */
export function buildOccupiedSet(rafts: RaftDef[], excludeIndex?: number): Set<string> {
  const set = new Set<string>();
  rafts.forEach((r, i) => {
    if (i === excludeIndex) return;
    for (const s of getOccupiedSquares(r)) set.add(posKey(s));
  });
  return set;
}

/** Check if a raft placement is valid (in bounds, no overlaps with others). */
export function isValidPlacement(raft: RaftDef, otherOccupied: Set<string>): boolean {
  if (!isRaftInBounds(raft)) return false;
  return !overlapsSet(raft, otherOccupied);
}

// ─── Rotation ────────────────────────────────────────────────

const ROTATIONS: Rotation[] = [0, 90, 180, 270];

/** Square raft art is authored at 0°; shape is symmetric in grid — do not offer rotation. */
export const SQUARE_FIXED_ROTATION: Rotation = 0;

/** Shorty starts vertical (0° / 180°); horizontal tried only if random attempts fail. */
const SHORTY_VERTICAL_ROTATIONS: Rotation[] = [0, 180];
const SHORTY_HORIZONTAL_ROTATIONS: Rotation[] = [90, 270];

/** Rotate a raft 90° clockwise. If blocked, tries further rotations. Returns null if all blocked. */
export function tryRotate(raft: RaftDef, otherOccupied: Set<string>): RaftDef | null {
  if (raft.type === "square") return null;
  const startIdx = ROTATIONS.indexOf(raft.rotation);
  for (let i = 1; i <= 3; i++) {
    const nextRotation = ROTATIONS[(startIdx + i) % 4] as Rotation;
    const candidate: RaftDef = { ...raft, rotation: nextRotation };
    if (isValidPlacement(candidate, otherOccupied)) return candidate;
  }
  return null; // all rotations blocked
}

// ─── Random Placement ────────────────────────────────────────

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

/** Randomly place all 3 rafts on the grid. */
export function randomPlacement(): RaftDef[] {
  const types: RaftType[] = ["square", "lshape", "shorty"];
  const placed: RaftDef[] = [];

  for (const type of types) {
    const occupied = buildOccupiedSet(placed);
    let found = false;

    // Try random positions until one fits
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

    // Fallback: exhaustive search
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

/** Find a random unoccupied cell for the gator. */
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

/** Move gator one step to a random adjacent free cell. Returns same pos if trapped. */
export function moveGator(pos: Position, rafts: RaftDef[]): Position {
  const occupied = buildOccupiedSet(rafts);
  const shuffled = shuffleArray(DIRS);

  for (const [dr, dc] of shuffled) {
    const next: Position = { row: pos.row + dr, col: pos.col + dc };
    if (isInBounds(next) && !occupied.has(posKey(next))) return next;
  }
  return pos; // trapped
}

// ─── Attack Resolution ──────────────────────────────────────

/** Resolve what an attack on (row, col) hits on the target's board. */
export function resolveAttack(
  row: number,
  col: number,
  targetBoard: PlayerBoard,
): AttackResult {
  const key = posKey({ row, col });

  // Check raft hit
  const allRaftSquares = targetBoard.rafts.flatMap(getOccupiedSquares);
  if (allRaftSquares.some((s) => posKey(s) === key)) return "hit";

  // Check gator hit
  if (posKey(targetBoard.gator) === key) return "gator";

  return "miss";
}

// ─── Win Check ──────────────────────────────────────────────

/** True if all 9 raft squares have been hit. */
export function checkWin(attacks: AttackRecord): boolean {
  return attacks.hits.length >= TOTAL_RAFT_SQUARES;
}

// ─── AI Logic ───────────────────────────────────────────────
//
// The AI knows:
//   - hits:       confirmed raft squares (fire markers)
//   - misses:     confirmed water (ripple markers)
//   - gatorHits:  explored cells where the gator was — no raft there,
//                 no marker left, but the cell is "cleared" intel.
//                 Gator hits also granted a free turn, so they're free probes.
//
// Strategy:
//   1. HUNT — if there are unsunk raft hits, probe adjacent cells
//   2. SEEK — otherwise, pick a random unexplored cell
//   Unexplored = not in hits, misses, OR gatorHits.

/** Pick the best attack target given everything the AI knows. */
export function aiPickTarget(attacks: AttackRecord): Position {
  // All explored cells — everything the AI has already thrown at
  const explored = new Set([
    ...attacks.hits.map(posKey),
    ...attacks.misses.map(posKey),
    ...attacks.gatorHits.map(posKey),
  ]);

  // ── HUNT MODE ──────────────────────────────────────────────
  // Find hits that likely have unsunk neighbors (adjacent unexplored cells).
  // Prioritize extending lines of 2+ consecutive hits.

  if (attacks.hits.length > 0) {
    const hitSet = new Set(attacks.hits.map(posKey));

    // First: look for lines of 2+ hits and extend them
    for (const hit of attacks.hits) {
      for (const [dr, dc] of DIRS) {
        const neighbor: Position = { row: hit.row + dr, col: hit.col + dc };
        if (hitSet.has(posKey(neighbor))) {
          // We have two hits in a line — try extending both directions
          const forward: Position = { row: neighbor.row + dr, col: neighbor.col + dc };
          const backward: Position = { row: hit.row - dr, col: hit.col - dc };
          if (isInBounds(forward) && !explored.has(posKey(forward))) return forward;
          if (isInBounds(backward) && !explored.has(posKey(backward))) return backward;
        }
      }
    }

    // Second: any unexplored cell adjacent to any hit
    const candidates: Position[] = [];
    for (const hit of attacks.hits) {
      for (const [dr, dc] of DIRS) {
        const adj: Position = { row: hit.row + dr, col: hit.col + dc };
        if (isInBounds(adj) && !explored.has(posKey(adj))) {
          candidates.push(adj);
        }
      }
    }
    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)]!;
    }
  }

  // ── SEEK MODE ──────────────────────────────────────────────
  // Checkerboard pattern for efficiency: only target (row+col) % 2 === 0
  // cells first, since the smallest raft is 2 squares (covers both parities).
  const primary: Position[] = [];
  const secondary: Position[] = [];

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (explored.has(posKey({ row: r, col: c }))) continue;
      if ((r + c) % 2 === 0) {
        primary.push({ row: r, col: c });
      } else {
        secondary.push({ row: r, col: c });
      }
    }
  }

  const pool = primary.length > 0 ? primary : secondary;
  return pool[Math.floor(Math.random() * pool.length)] ?? { row: 0, col: 0 };
}
