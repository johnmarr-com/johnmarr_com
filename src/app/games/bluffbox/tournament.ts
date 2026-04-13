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
 * Pick the next two players to compete **within the current round only**.
 * `alive` = still need a matchup this round. `played` / `eliminated` = done for now.
 *
 * - **2+ alive** → random pair (real players).
 * - **1 alive** → that player must face a **stand-in** listener from `candidates` (anyone else),
 *   including eliminated players — **never** end the round here just because only one person
 *   is left non-eliminated; they still take their turn.
 * - **0 alive** → no one left to schedule → **round is complete** (then host may `round-end` and
 *   run `evaluateRound` once). Winner / TPK / tie are **never** decided here.
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
    return { sharer: finalPlayer, opponent: standIn, isStandIn: true };
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

/**
 * Opponent guesses whether the sharer told the truth or lied.
 * If they guess **correctly**, the sharer is eliminated. If wrong, the sharer survives.
 * The listener is never eliminated by this outcome.
 */
export function resolveTurn(
  sharerChoice: "truth" | "lie",
  opponentGuess: "truth" | "lie",
): { sharerEliminated: boolean } {
  const opponentGuessedCorrectly = opponentGuess === sharerChoice;
  return { sharerEliminated: opponentGuessedCorrectly };
}

// ─── Round Evaluation ────────────────────────────────────────

export type RoundAction = "next-round" | "winner" | "bonus-round" | "tie" | "tpk";

export interface RoundEvaluation {
  action: RoundAction;
  survivors: string[];
  winner?: string;
}

/** Non-eliminated players still in the tournament (survived the round so far). */
export function survivorIdsSorted(
  playerStatuses: Record<string, PlayerStatus>,
): string[] {
  return Object.entries(playerStatuses)
    .filter(([, s]) => s !== "eliminated")
    .map(([uid]) => uid)
    .sort();
}

function sameSortedIdSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const as = [...a].sort();
  const bs = [...b].sort();
  return as.every((id, i) => id === bs[i]);
}

/**
 * After a **full round** (host only reaches here when no `alive` players remain to schedule).
 * Win / tie / TPK / bonus / next round are decided **only** here — never after an individual matchup.
 *
 * - **1 survivor** → game winner.
 * - **0 survivors** → bonus round (everyone back) if `bonusRoundCount < 2`, else TPK.
 * - **2+ survivors**, same set as **previous round-end** (stalemate) → bonus round if
 *   `bonusRoundCount < 2`, else **tie** among those survivors.
 * - **2+ survivors**, different set → next normal round (`prevRoundSurvivorIds` is updated by host).
 */
export function evaluateRound(
  playerStatuses: Record<string, PlayerStatus>,
  bonusRoundCount: number,
  prevRoundSurvivorIds: string[] | null,
): RoundEvaluation {
  const survivors = survivorIdsSorted(playerStatuses);

  if (survivors.length === 1) {
    return { action: "winner", survivors, winner: survivors[0]! };
  }

  if (survivors.length === 0) {
    if (bonusRoundCount < 2) {
      return { action: "bonus-round", survivors: [] };
    }
    return { action: "tpk", survivors: [] };
  }

  const prev =
    prevRoundSurvivorIds != null && prevRoundSurvivorIds.length > 0
      ? [...prevRoundSurvivorIds].sort()
      : null;

  const stalemate =
    prev != null &&
    survivors.length > 1 &&
    sameSortedIdSet(survivors, prev);

  if (stalemate) {
    if (bonusRoundCount < 2) {
      return { action: "bonus-round", survivors };
    }
    return { action: "tie", survivors };
  }

  return { action: "next-round", survivors };
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
 * Reset for a bonus round so matchups can run again.
 * - Normally: only **non-eliminated** players become `alive`; eliminated stay out (stalemate / tie-break).
 * - If **everyone** is eliminated (total party kill), resurrect **all** players so the bonus round can play out.
 */
export function resetForBonusRound(statuses: Record<string, PlayerStatus>): Record<string, PlayerStatus> {
  const entries = Object.entries(statuses);
  const allEliminated =
    entries.length > 0 && entries.every(([, s]) => s === "eliminated");

  if (allEliminated) {
    const next: Record<string, PlayerStatus> = {};
    for (const uid of Object.keys(statuses)) {
      next[uid] = "alive";
    }
    return next;
  }

  const next: Record<string, PlayerStatus> = {};
  for (const [uid, s] of entries) {
    next[uid] = s === "eliminated" ? "eliminated" : "alive";
  }
  return next;
}
