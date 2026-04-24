// Boaty AI — two-layer algorithmic opponent.
//
//   Layer 1  Skill tier (basic / standard / sharp) → produces a RANKED list
//            of candidate cells, best-first.
//   Layer 2  Play-style bias → picks from the ranked list per persona style.
//
// Both layers are pure code, zero tokens per turn. See AI-PLAY-PLAN.md.
//
//   basic    — unexplored cells in random order. No hunt, no parity.
//   standard — hunt adjacent hits first, then checkerboard seek.
//   sharp    — probability heat map over all valid raft placements.

import type { Position, AttackRecord, RaftType, Rotation } from "./boatyTypes";
import {
  GRID_SIZE,
  RAFT_OFFSETS,
  posKey,
  isInBounds,
} from "./boatyLogic";
import {
  aiEngineTierForLevel,
  DEFAULT_AI_SKILL_LEVEL,
  type AIEngineTier,
  type AIPlayStyle,
} from "@/app/games/_gamecore/aiPersonas";

/** Alias for the engine tier this file implements. */
export type BoatySkillTier = AIEngineTier;

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

// ─── Shared helpers ───────────────────────────────────────────

function exploredSet(attacks: AttackRecord): Set<string> {
  return new Set<string>([
    ...attacks.hits.map(posKey),
    ...attacks.misses.map(posKey),
    ...attacks.gatorHits.map(posKey),
  ]);
}

function unexploredCells(attacks: AttackRecord): Position[] {
  const explored = exploredSet(attacks);
  const out: Position[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!explored.has(posKey({ row: r, col: c }))) out.push({ row: r, col: c });
    }
  }
  return out;
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function isAdjacentToHit(cell: Position, hits: Position[]): boolean {
  const hitSet = new Set(hits.map(posKey));
  for (const [dr, dc] of DIRS) {
    const n: Position = { row: cell.row + dr, col: cell.col + dc };
    if (hitSet.has(posKey(n))) return true;
  }
  return false;
}

// ─── Layer 1: Basic ───────────────────────────────────────────
// Random unexplored cell. No hunt, no parity.

function rankCandidatesBasic(attacks: AttackRecord): Position[] {
  return shuffle(unexploredCells(attacks));
}

// ─── Layer 1: Standard ────────────────────────────────────────
// Priority list: line-extensions → any-adjacent → parity-primary → secondary.

function rankCandidatesStandard(attacks: AttackRecord): Position[] {
  const explored = exploredSet(attacks);
  const hitSet = new Set(attacks.hits.map(posKey));

  const lineExtensions: Position[] = [];
  const adjacentToAnyHit: Position[] = [];
  const adjacentSeen = new Set<string>();
  const lineSeen = new Set<string>();

  // Line-extension candidates: if two hits are adjacent, both "forward" and
  // "backward" cells along that line are high-priority.
  for (const hit of attacks.hits) {
    for (const [dr, dc] of DIRS) {
      const neighbor: Position = { row: hit.row + dr, col: hit.col + dc };
      if (!hitSet.has(posKey(neighbor))) continue;
      const forward: Position = { row: neighbor.row + dr, col: neighbor.col + dc };
      const backward: Position = { row: hit.row - dr, col: hit.col - dc };
      for (const cand of [forward, backward]) {
        const k = posKey(cand);
        if (isInBounds(cand) && !explored.has(k) && !lineSeen.has(k)) {
          lineSeen.add(k);
          lineExtensions.push(cand);
        }
      }
    }
  }

  // Adjacent-to-any-hit candidates not already covered by line-extension.
  for (const hit of attacks.hits) {
    for (const [dr, dc] of DIRS) {
      const cand: Position = { row: hit.row + dr, col: hit.col + dc };
      const k = posKey(cand);
      if (
        isInBounds(cand) &&
        !explored.has(k) &&
        !lineSeen.has(k) &&
        !adjacentSeen.has(k)
      ) {
        adjacentSeen.add(k);
        adjacentToAnyHit.push(cand);
      }
    }
  }

  // Checkerboard parity for seek mode — primary = (r+c) even, secondary = odd.
  const parityPrimary: Position[] = [];
  const paritySecondary: Position[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const k = posKey({ row: r, col: c });
      if (explored.has(k) || lineSeen.has(k) || adjacentSeen.has(k)) continue;
      if ((r + c) % 2 === 0) parityPrimary.push({ row: r, col: c });
      else paritySecondary.push({ row: r, col: c });
    }
  }

  return [
    ...lineExtensions,
    ...shuffle(adjacentToAnyHit),
    ...shuffle(parityPrimary),
    ...shuffle(paritySecondary),
  ];
}

// ─── Layer 1: Sharp (probability heat map) ────────────────────

const RAFT_TYPES: RaftType[] = ["square", "lshape", "shorty"];

function enumerateValidPlacements(blocked: Set<string>): Position[][] {
  const out: Position[][] = [];
  for (const type of RAFT_TYPES) {
    const byRotation = RAFT_OFFSETS[type];
    const seenShapes = new Set<string>();
    for (const rot of Object.keys(byRotation).map((k) => Number(k) as Rotation)) {
      const offsets = byRotation[rot];
      const shapeKey = offsets
        .map(([dr, dc]) => `${dr},${dc}`)
        .sort()
        .join("|");
      if (seenShapes.has(shapeKey)) continue;
      seenShapes.add(shapeKey);
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          const cells = offsets.map<Position>(([dr, dc]) => ({
            row: r + dr,
            col: c + dc,
          }));
          if (cells.every((p) => isInBounds(p) && !blocked.has(posKey(p)))) {
            out.push(cells);
          }
        }
      }
    }
  }
  return out;
}

function rankCandidatesSharp(attacks: AttackRecord): Position[] {
  const hitSet = new Set(attacks.hits.map(posKey));
  const blocked = new Set<string>([
    ...attacks.misses.map(posKey),
    ...attacks.gatorHits.map(posKey),
  ]);
  const placements = enumerateValidPlacements(blocked);
  const haveHits = attacks.hits.length > 0;

  const heat = new Map<string, number>();
  const HIT_WEIGHT = 50;
  for (const cells of placements) {
    const hitsCovered = cells.reduce(
      (n, cell) => n + (hitSet.has(posKey(cell)) ? 1 : 0),
      0,
    );
    const weight = hitsCovered > 0 ? 1 + hitsCovered * HIT_WEIGHT : 1;
    const effective = haveHits && hitsCovered === 0 ? 0 : weight;
    if (effective === 0) continue;
    for (const cell of cells) {
      const k = posKey(cell);
      if (blocked.has(k) || hitSet.has(k)) continue;
      heat.set(k, (heat.get(k) ?? 0) + effective);
    }
  }

  if (heat.size === 0) return rankCandidatesBasic(attacks);

  const ranked: Position[] = [...heat.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => {
      const [r, c] = k.split(",").map(Number);
      return { row: r!, col: c! };
    });
  return ranked;
}

// ─── Tier dispatcher (ranked) ─────────────────────────────────

export function rankCandidates(
  attacks: AttackRecord,
  tier: BoatySkillTier,
): Position[] {
  switch (tier) {
    case "basic":
      return rankCandidatesBasic(attacks);
    case "standard":
      return rankCandidatesStandard(attacks);
    case "sharp":
      return rankCandidatesSharp(attacks);
  }
}

// ─── Layer 2: Play-style bias ─────────────────────────────────
// Rerouting of the Layer 1 ranked list per persona style. Each style may pick
// from a different slice of the list — aggressive preferentially strikes next
// to known hits; cautious never deviates from the top; creative softens the
// edges of the top pick; chaotic throws sand occasionally; etc.

// Tuned via self-play: K=5 / P=0.40 was too soft — creative and chaotic lost
// 15–20pp to their balanced tier, beyond the 5pp guardrail. K=3 / P=0.20
// keeps the flavor (non-top picks, occasional random throws) but lands near
// 5pp drop, which reads as "quirky player" not "handicapped player."
const CREATIVE_TOP_K = 3;
const CHAOTIC_RANDOM_CHANCE = 0.2;

export function applyStyleBias(
  style: AIPlayStyle,
  ranked: Position[],
  attacks: AttackRecord,
): Position {
  if (ranked.length === 0) return { row: 0, col: 0 };

  switch (style) {
    case "aggressive": {
      // Prefer anything adjacent to an existing hit. Fall back to top-of-rank.
      if (attacks.hits.length > 0) {
        const adjacent = ranked.filter((c) => isAdjacentToHit(c, attacks.hits));
        if (adjacent.length > 0) {
          return adjacent[Math.floor(Math.random() * adjacent.length)]!;
        }
      }
      return ranked[0]!;
    }

    case "cautious":
      // Always the most confident pick. No deviation.
      return ranked[0]!;

    case "analytical":
      // Pure heat-map math. No stylistic flavor beyond what the tier provides.
      return ranked[0]!;

    case "creative": {
      // Pick uniformly from the top K, so the move still matches the
      // algorithm's best-guess neighborhood but isn't always #1.
      const k = Math.min(CREATIVE_TOP_K, ranked.length);
      return ranked[Math.floor(Math.random() * k)]!;
    }

    case "chaotic": {
      // 40% of the time, ignore ranking entirely and pick any unexplored cell.
      if (Math.random() < CHAOTIC_RANDOM_CHANCE) {
        const all = unexploredCells(attacks);
        if (all.length > 0) {
          return all[Math.floor(Math.random() * all.length)]!;
        }
      }
      return ranked[0]!;
    }

    case "balanced":
    default:
      return ranked[0]!;
  }
}

// ─── Unified dispatchers ──────────────────────────────────────

/** Level-based dispatch with no style flavor. Equivalent to balanced. */
export function pickTargetForLevel(
  attacks: AttackRecord,
  skillLevel: number | undefined,
): Position {
  const lvl = skillLevel ?? DEFAULT_AI_SKILL_LEVEL;
  const ranked = rankCandidates(attacks, aiEngineTierForLevel(lvl));
  return applyStyleBias("balanced", ranked, attacks);
}

/** Full persona dispatch: skill sets strength, play style sets flavor. */
export function pickTargetForPersona(
  attacks: AttackRecord,
  skillLevel: number | undefined,
  playStyle: AIPlayStyle,
): Position {
  const lvl = skillLevel ?? DEFAULT_AI_SKILL_LEVEL;
  const ranked = rankCandidates(attacks, aiEngineTierForLevel(lvl));
  return applyStyleBias(playStyle, ranked, attacks);
}

/** Explicit tier (rarely needed by app code; handy for tests / self-play). */
export function pickTargetByTier(
  attacks: AttackRecord,
  tier: BoatySkillTier,
): Position {
  return applyStyleBias("balanced", rankCandidates(attacks, tier), attacks);
}

// Per-tier single-pick helpers — retained for self-play + legacy call sites.
export function basicPickTarget(attacks: AttackRecord): Position {
  return applyStyleBias("balanced", rankCandidatesBasic(attacks), attacks);
}
export function standardPickTarget(attacks: AttackRecord): Position {
  return applyStyleBias("balanced", rankCandidatesStandard(attacks), attacks);
}
export function sharpPickTarget(attacks: AttackRecord): Position {
  return applyStyleBias("balanced", rankCandidatesSharp(attacks), attacks);
}
