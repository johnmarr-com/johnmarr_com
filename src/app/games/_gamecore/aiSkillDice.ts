/**
 * Skill mechanism for LLM-native games (BluffBox, Wordonkulous,
 * SweepTheLeg, TapSmashArena).
 *
 * The LLM always tries to play its best. Skill differentiation comes from
 * how much game history each tier is allowed to see, plus a framing
 * directive that tells the LLM which tier-persona to inhabit.
 *
 * Why gated history instead of "produce 3 ranked options, dice-roll the pick":
 * an LLM instructed to "play unskilled" still KNOWS the optimal move — it's
 * just performing bad play, which can feel theatrical. An LLM that literally
 * wasn't shown the patterns can't meta-game. Genuine skill delta, simpler
 * prompt contract.
 *
 *   Enthusiast (L1-3) → "none"    — persona + current problem only
 *   Champion   (L4-7) → "recent"  — persona + this round / last N events
 *   Game Master (L8+) → "full"    — persona + complete history + strategic framing
 *
 * Breakpoints mirror `aiEngineTierForLevel` so procedural and LLM-native
 * games share the same L3/L7 ladder.
 */


export type AIHistoryTier = "none" | "recent" | "full";

export function aiHistoryTierForLevel(level: number | undefined): AIHistoryTier {
  // Reverted: all AI personas get full history regardless of skill level.
  // The tier-gating mechanism is left wired up but disabled here so it can
  // be re-enabled later (single-line change) once we have production data.
  void level;
  return "full";
}

/**
 * Slice an event history by tier.
 *
 * Games define their own event type — a shared card in BluffBox, a round
 * result in Wordonkulous, a combat exchange in SweepTheLeg. The helper just
 * knows how to clip the tail. If a game wants strict round-boundary slicing
 * (e.g. "events from this round only"), pre-filter before calling.
 *
 * @param history  ordered event log (oldest → newest)
 * @param tier     from `aiHistoryTierForLevel`
 * @param recentN  how many trailing events Champion sees (default 5)
 */
export function sliceHistoryByTier<T>(
  history: readonly T[],
  tier: AIHistoryTier,
  recentN = 5,
): T[] {
  if (tier === "none") return [];
  if (tier === "recent") return history.slice(-recentN);
  return [...history];
}

/** Convenience: level → tier → slice in one call. */
export function sliceHistoryForLevel<T>(
  history: readonly T[],
  level: number | undefined,
  recentN = 5,
): T[] {
  return sliceHistoryByTier(history, aiHistoryTierForLevel(level), recentN);
}

/**
 * Framing directive to append to the persona prompt. Tells the LLM which
 * tier-persona it is inhabiting and, critically, sets expectations about
 * what it's allowed to reason about.
 */
// Reverted: tier directives are no-ops. No skill-level prompt framing
// is injected. Persona personality + voice handle the AI's character.
export const TIER_PROMPT_DIRECTIVE: Record<AIHistoryTier, string> = {
  none: "",
  recent: "",
  full: "",
};

// ─────────────────────────────────────────────────────────────
// Ranked-roll helper — for games where the options themselves are naturally
// ranked by quality (e.g. lookahead scoring). Most games prefer
// sliceHistoryByTier instead.
// ─────────────────────────────────────────────────────────────

const RANK_WEIGHTS: Record<AIHistoryTier, number[]> = {
  none: [0.40, 0.24, 0.36],
  recent: [0.70, 0.21, 0.09],
  full: [1, 0, 0],
};

/**
 * Weighted pick from a ranked list (best-first). Weights per tier:
 *   Enthusiast  40 / 24 / 36
 *   Champion    70 / 21 /  9
 *   Game Master 100 /  0 /  0
 */
export function pickByRankedRoll<T>(
  ranked: readonly T[],
  level: number | undefined,
): T {
  if (ranked.length === 0) throw new Error("pickByRankedRoll: empty list");
  const weights = RANK_WEIGHTS[aiHistoryTierForLevel(level)];
  const r = Math.random();
  let cumulative = 0;
  for (let i = 0; i < ranked.length; i++) {
    cumulative += weights[i] ?? 0;
    if (r <= cumulative) return ranked[i]!;
  }
  return ranked[ranked.length - 1]!;
}
