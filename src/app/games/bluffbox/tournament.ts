/**
 * Pure game logic for Bluff Box (points-based group game).
 * No Firestore dependency — just functions that compute state transitions.
 */

// ─── Round Calculation ──────────────────────────────────────

/**
 * How many rounds to play based on the number of players.
 * Tuned so every game produces a meaningful point spread.
 */
export function calculateTotalRounds(playerCount: number): number {
  if (playerCount <= 3) return 3;
  if (playerCount <= 8) return 2;
  return 1;
}

// ─── Scores ─────────────────────────────────────────────────

/** Initialise every player at zero points. */
export function initScores(playerUids: string[]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const uid of playerUids) {
    scores[uid] = 0;
  }
  return scores;
}

/**
 * After a turn, compute how many points each player earned.
 * +1 for every guesser who matched the sharer's actual choice.
 * In **3+ player** games, if **every** guesser is wrong, the sharer gets +1 (fooled the group).
 */
/** Max points a sharer can earn from wrong guesses in a single turn. */
const SHARER_POINT_CAP = 3;

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

/** Add deltas to current scores, returning a new object. */
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

/** Find the player(s) with the highest score. */
export function determineWinners(
  scores: Record<string, number>,
): { winners: string[]; points: number } {
  const entries = Object.entries(scores);
  if (entries.length === 0) return { winners: [], points: 0 };

  const maxPoints = Math.max(...entries.map(([, s]) => s));
  const winners = entries
    .filter(([, s]) => s === maxPoints)
    .map(([uid]) => uid);
  return { winners, points: maxPoints };
}

// ─── Turn Order ─────────────────────────────────────────────

/** Shuffle player UIDs into a random turn order for a round. */
export function shuffleTurnOrder(playerUids: string[]): string[] {
  const shuffled = [...playerUids];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

// ─── Card Selection ─────────────────────────────────────────

export function selectCard(cardPool: string[]): { card: string; remainingPool: string[] } {
  if (cardPool.length === 0) throw new Error("Card pool is empty");
  const idx = Math.floor(Math.random() * cardPool.length);
  const card = cardPool[idx]!;
  const remainingPool = [...cardPool.slice(0, idx), ...cardPool.slice(idx + 1)];
  return { card, remainingPool };
}

export function shuffleCards(cards: string[]): string[] {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}
