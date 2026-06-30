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

/** Everyone starts at 100. */
const STARTING_SCORE = 100;

/** Initialise every player's score to the starting value. */
export function initScores(playerUids: string[]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const uid of playerUids) scores[uid] = STARTING_SCORE;
  return scores;
}

/**
 * Score one guessing round. Each eligible voter who actually guessed:
 *   correct → +10, plus 2× their wager
 *   wrong   → −5, minus their wager
 * Non-voters (no guess) are unaffected. `wager` is 0 ("None") unless set. The
 * author never votes (excluded from `eligibleVoterUids`). The 0-floor is applied
 * in `applyScoreDeltas`, so scores never go negative even on a big lost wager.
 */
export function scoreGuessRound(
  votes: Record<string, string>,
  wagers: Record<string, number>,
  authorUid: string,
  eligibleVoterUids: readonly string[],
): { deltas: Record<string, number>; correctVoterUids: string[] } {
  const deltas: Record<string, number> = {};
  const correctVoterUids: string[] = [];
  for (const uid of eligibleVoterUids) {
    const guessed = votes[uid];
    if (guessed == null) continue; // didn't vote → no change
    const wager = wagers[uid] ?? 0;
    if (guessed === authorUid) {
      deltas[uid] = 10 + 2 * wager;
      correctVoterUids.push(uid);
    } else {
      deltas[uid] = -(5 + wager);
    }
  }
  return { deltas, correctVoterUids };
}

/** Merge round deltas into cumulative scores; scores never drop below 0. */
export function applyScoreDeltas(
  scores: Record<string, number>,
  deltas: Record<string, number>,
): Record<string, number> {
  const next = { ...scores };
  for (const [uid, delta] of Object.entries(deltas)) {
    next[uid] = Math.max(0, (next[uid] ?? 0) + delta);
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
