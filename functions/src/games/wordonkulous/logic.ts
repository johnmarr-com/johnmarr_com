/**
 * Wordonkulous — pure game logic (copied from the Next app's
 * `src/app/games/wordonkulous/wordonkulousTypes.ts`; the functions package
 * can't import from `src/`). Keep in sync with the client copy — these are
 * deterministic and identical by construction.
 */

export interface RoundScoreResult {
  deltas: Record<string, number>;
  firstPlace: string[];
  voteCounts: Record<string, number>;
}

/** Fisher-Yates shuffle (returns new array). */
export function shuffleArray<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Initialise every player's score to 0. */
export function initScores(playerUids: string[]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const uid of playerUids) scores[uid] = 0;
  return scores;
}

/** Shuffle and take the first `count` definitions from the pack. */
export function selectDefinitions(
  allDefinitions: readonly string[],
  count: number,
): string[] {
  return shuffleArray(allDefinitions).slice(0, count);
}

/** Get the definition for the current 1-based round. */
export function getCurrentDefinition(
  definitions: readonly string[],
  round: number,
): string {
  return definitions[round - 1] ?? "";
}

/**
 * Score a single round. 1st place earns points equal to votes received, capped
 * at 3; ties share. Everyone else gets 0.
 */
export function scoreRound(
  votes: Record<string, string>,
  submissions: Record<string, string>,
): RoundScoreResult {
  const voteCounts: Record<string, number> = {};
  for (const uid of Object.keys(submissions)) voteCounts[uid] = 0;
  for (const authorId of Object.values(votes)) {
    voteCounts[authorId] = (voteCounts[authorId] ?? 0) + 1;
  }

  const sorted = Object.entries(voteCounts)
    .map(([authorId, count]) => ({ authorId, count }))
    .sort((a, b) => b.count - a.count);

  if (sorted.length === 0) {
    return { deltas: {}, firstPlace: [], voteCounts };
  }

  const firstCount = sorted[0]!.count;
  const firstPlace =
    firstCount > 0
      ? sorted.filter((s) => s.count === firstCount).map((s) => s.authorId)
      : [];

  const deltas: Record<string, number> = {};
  for (const uid of Object.keys(submissions)) {
    deltas[uid] = firstPlace.includes(uid) ? Math.min(voteCounts[uid] ?? 0, 3) : 0;
  }

  return { deltas, firstPlace, voteCounts };
}

/** Merge round deltas into cumulative scores. */
export function applyScoreDeltas(
  scores: Record<string, number>,
  deltas: Record<string, number>,
): Record<string, number> {
  const next = { ...scores };
  for (const [uid, delta] of Object.entries(deltas)) {
    next[uid] = (next[uid] ?? 0) + delta;
  }
  return next;
}

/** Determine winner(s) — highest cumulative score. */
export function determineWinners(
  scores: Record<string, number>,
): { winners: string[]; points: number } {
  const entries = Object.entries(scores);
  if (entries.length === 0) return { winners: [], points: 0 };
  const maxPoints = Math.max(...entries.map(([, p]) => p));
  const winners = entries.filter(([, p]) => p === maxPoints).map(([uid]) => uid);
  return { winners, points: maxPoints };
}
