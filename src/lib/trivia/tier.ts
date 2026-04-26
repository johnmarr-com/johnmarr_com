import type { TriviaContentTier } from "./types";
import { TRIVIA_TARGET_COUNT } from "./types";

/**
 * Tier assignment from the spec:
 *   Top 10% (rank 1-50)   → Tier 1 (universally known)
 *   Next 25% (rank 51-175) → Tier 2 (culturally fluent)
 *   Remaining (176+)       → Tier 3 (deep cut)
 */
export function assignTier(rank: number): TriviaContentTier {
  const percentile = rank / TRIVIA_TARGET_COUNT;
  if (percentile <= 0.1) return 1;
  if (percentile <= 0.35) return 2;
  return 3;
}
