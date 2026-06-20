/**
 * BluffBox — pure game logic (copied from the Next app's
 * `src/app/games/bluffbox/tournament.ts`; the functions package can't import
 * from `src/`). Keep in sync with the client copy — deterministic by construction.
 */

const SHARER_POINT_CAP = 3;

export function calculateTotalRounds(playerCount: number): number {
  if (playerCount <= 3) return 3;
  if (playerCount <= 8) return 2;
  return 1;
}

export function initScores(playerUids: string[]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const uid of playerUids) scores[uid] = 0;
  return scores;
}

/** +1 per guesser who matched the sharer's actual choice; sharer +1 per fooled
 *  guesser, capped at 3. */
export function scoreTurn(
  sharerChoice: "truth" | "lie",
  guesses: Record<string, "truth" | "lie">,
  sharerUid: string,
): Record<string, number> {
  const deltas: Record<string, number> = {};
  const guesserUids = Object.keys(guesses).filter((uid) => uid !== sharerUid);

  let wrongCount = 0;
  for (const uid of guesserUids) {
    const correct = guesses[uid] === sharerChoice;
    deltas[uid] = correct ? 1 : 0;
    if (!correct) wrongCount++;
  }

  deltas[sharerUid] = Math.min(wrongCount, SHARER_POINT_CAP);
  return deltas;
}

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

export function determineWinners(
  scores: Record<string, number>,
): { winners: string[]; points: number } {
  const entries = Object.entries(scores);
  if (entries.length === 0) return { winners: [], points: 0 };
  const maxPoints = Math.max(...entries.map(([, s]) => s));
  const winners = entries.filter(([, s]) => s === maxPoints).map(([uid]) => uid);
  return { winners, points: maxPoints };
}

export function shuffleTurnOrder(playerUids: string[]): string[] {
  const shuffled = [...playerUids];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

/** Pick a random card and return the remaining pool (immutable). */
export function selectCard(cardPool: string[]): { card: string; remainingPool: string[] } {
  const idx = Math.floor(Math.random() * cardPool.length);
  const card = cardPool[idx]!;
  return { card, remainingPool: [...cardPool.slice(0, idx), ...cardPool.slice(idx + 1)] };
}
