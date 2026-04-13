/**
 * Pure tournament logic for Bluff Box.
 * No Firestore dependency — just functions that compute state transitions.
 */

export type PlayerStatus = "alive" | "played" | "eliminated";

// ─── Matchup Selection ───────────────────────────────────────

export interface Matchup {
  sharer: string;
  opponent: string;
  isStandIn: boolean;
}

/**
 * Pick the next two players to compete.
 * - 2+ alive → random pair, random sharer assignment
 * - 1 alive  → stand-in from any player (even eliminated), stand-in shares
 * - 0 alive  → null (round complete)
 */
export function selectNextMatchup(
  playerStatuses: Record<string, PlayerStatus>,
  allPlayerUids: string[],
): Matchup | null {
  const alive = allPlayerUids.filter((uid) => playerStatuses[uid] === "alive");

  if (alive.length >= 2) {
    const shuffled = [...alive].sort(() => Math.random() - 0.5);
    return { sharer: shuffled[0]!, opponent: shuffled[1]!, isStandIn: false };
  }

  if (alive.length === 1) {
    const finalPlayer = alive[0]!;
    const candidates = allPlayerUids.filter((uid) => uid !== finalPlayer);
    if (candidates.length === 0) return null;
    const standIn = candidates[Math.floor(Math.random() * candidates.length)]!;
    return { sharer: standIn, opponent: finalPlayer, isStandIn: true };
  }

  return null;
}

// ─── Card Selection ──────────────────────────────────────────

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

// ─── Turn Resolution ─────────────────────────────────────────

export function resolveTurn(
  sharerChoice: "truth" | "lie",
  opponentGuess: "truth" | "lie",
): { opponentSurvived: boolean } {
  return { opponentSurvived: opponentGuess === sharerChoice };
}

// ─── Round Evaluation ────────────────────────────────────────

export type RoundAction = "next-round" | "winner" | "bonus-round" | "tie" | "tpk";

export interface RoundEvaluation {
  action: RoundAction;
  survivors: string[];
  winner?: string;
}

/**
 * After all matchups in a round, evaluate what happens next.
 * "played" status means the player survived and finished their matchup.
 */
export function evaluateRound(
  playerStatuses: Record<string, PlayerStatus>,
  bonusRoundCount: number,
): RoundEvaluation {
  const survivors = Object.entries(playerStatuses)
    .filter(([, s]) => s === "played")
    .map(([uid]) => uid);

  if (survivors.length > 1) {
    return { action: "next-round", survivors };
  }

  if (survivors.length === 1) {
    return { action: "winner", survivors, winner: survivors[0]! };
  }

  // 0 survivors — total elimination
  if (bonusRoundCount < 2) {
    return { action: "bonus-round", survivors: [] };
  }

  return { action: "tpk", survivors: [] };
}

/**
 * Build the initial player statuses (everyone alive).
 */
export function initPlayerStatuses(playerUids: string[]): Record<string, PlayerStatus> {
  const statuses: Record<string, PlayerStatus> = {};
  for (const uid of playerUids) {
    statuses[uid] = "alive";
  }
  return statuses;
}

/**
 * Reset for a new round: "played" → "alive", "eliminated" stays.
 */
export function resetForNewRound(statuses: Record<string, PlayerStatus>): Record<string, PlayerStatus> {
  const next: Record<string, PlayerStatus> = {};
  for (const [uid, s] of Object.entries(statuses)) {
    next[uid] = s === "played" ? "alive" : s;
  }
  return next;
}

/**
 * Reset for a bonus round: ALL players become "alive" again.
 */
export function resetForBonusRound(statuses: Record<string, PlayerStatus>): Record<string, PlayerStatus> {
  const next: Record<string, PlayerStatus> = {};
  for (const uid of Object.keys(statuses)) {
    next[uid] = "alive";
  }
  return next;
}
