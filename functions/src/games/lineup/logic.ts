/**
 * Lineup — pure game logic (copied from the Next app's
 * `src/app/games/lineup/lineupTypes.ts`; the functions package can't import
 * from `src/`). Keep in sync with the client copy — deterministic by
 * construction.
 */

/** Fisher-Yates shuffle (returns a new array). */
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

/**
 * Score one guessing round: every eligible voter who named the fact's true
 * author earns +1. The author never votes (they're excluded from
 * `eligibleVoterUids`), so they can't score on their own fact.
 */
export function scoreGuessRound(
  votes: Record<string, string>,
  authorUid: string,
  eligibleVoterUids: readonly string[],
): { deltas: Record<string, number>; correctVoterUids: string[] } {
  const deltas: Record<string, number> = {};
  const correctVoterUids: string[] = [];
  for (const uid of eligibleVoterUids) {
    if (votes[uid] === authorUid) {
      deltas[uid] = 1;
      correctVoterUids.push(uid);
    }
  }
  return { deltas, correctVoterUids };
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

/** Determine winner(s) — highest cumulative score. Ties share. */
export function determineWinners(
  scores: Record<string, number>,
): { winners: string[]; points: number } {
  const entries = Object.entries(scores);
  if (entries.length === 0) return { winners: [], points: 0 };
  const maxPoints = Math.max(...entries.map(([, p]) => p));
  const winners = entries.filter(([, p]) => p === maxPoints).map(([uid]) => uid);
  return { winners, points: maxPoints };
}
