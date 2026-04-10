// ─── Types ───────────────────────────────────────────────────

export interface ChainEntry {
  type: "text" | "image";
  value: string;
  playerId: string;
  timestamp: number;
}

export type Chains = Record<string, ChainEntry[]>;

export type TaskType = "draw" | "guess";

export interface PlayerTask {
  elementIndex: number;
  /** The chain entry the player needs to respond to */
  input: ChainEntry;
  /** What this player must produce */
  taskType: TaskType;
  /** Where this entry will land in the chain */
  stepIndex: number;
}

// ─── Core Logic ──────────────────────────────────────────────

/**
 * For element k with N players in playOrder, figure out which player
 * handles step `stepIndex` and what they should produce.
 *
 * Step 0: original text from Control
 * Step 1: playOrder[k] draws
 * Step 2: playOrder[(k+1) % N] guesses (text)
 * ...
 * Step N: chain complete (N player contributions + 1 original = N+1 entries)
 */
export function getPlayerForStep(
  elementIndex: number,
  stepIndex: number,
  playOrder: string[],
): string {
  const N = playOrder.length;
  const playerIdx = (elementIndex + (stepIndex - 1)) % N;
  return playOrder[playerIdx]!;
}

export function getTaskTypeForStep(stepIndex: number): TaskType {
  return stepIndex % 2 === 1 ? "draw" : "guess";
}

export function isChainComplete(chain: ChainEntry[], playerCount: number): boolean {
  return chain.length >= playerCount + 1;
}

/**
 * Derive the queue of tasks waiting for a given player.
 * Scans all chains and returns tasks where this player is next, sorted by
 * element index (their own starting element first, then others in order).
 */
export function getPlayerQueue(
  userId: string,
  chains: Chains,
  playOrder: string[],
): PlayerTask[] {
  const N = playOrder.length;
  const tasks: PlayerTask[] = [];

  for (let k = 0; k < N; k++) {
    const chain = chains[String(k)];
    if (!chain || chain.length === 0) continue;
    if (isChainComplete(chain, N)) continue;

    const nextStep = chain.length;
    const nextPlayer = getPlayerForStep(k, nextStep, playOrder);

    if (nextPlayer === userId) {
      tasks.push({
        elementIndex: k,
        input: chain[nextStep - 1]!,
        taskType: getTaskTypeForStep(nextStep),
        stepIndex: nextStep,
      });
    }
  }

  // Sort by stepIndex (natural chain progression order), then element index as tiebreaker
  tasks.sort((a, b) => {
    if (a.stepIndex !== b.stepIndex) return a.stepIndex - b.stepIndex;
    return a.elementIndex - b.elementIndex;
  });

  return tasks;
}

/**
 * Check if a specific player has completed all their steps across every chain.
 * Each player handles exactly one step per element.
 */
export function isPlayerFullyDone(
  userId: string,
  chains: Chains,
  playOrder: string[],
): boolean {
  const N = playOrder.length;
  const playerIdx = playOrder.indexOf(userId);
  if (playerIdx === -1) return true;

  for (let k = 0; k < N; k++) {
    const myStep = ((playerIdx - k + N) % N) + 1;
    const chain = chains[String(k)];
    if (!chain || chain.length <= myStep) return false;
  }
  return true;
}

/**
 * Check if ALL chains are complete.
 */
export function allChainsComplete(chains: Chains, playerCount: number): boolean {
  for (let k = 0; k < playerCount; k++) {
    const chain = chains[String(k)];
    if (!chain || !isChainComplete(chain, playerCount)) return false;
  }
  return true;
}

/**
 * Build the initial chains object: one chain per element,
 * each starting with the original text from Control.
 */
export function buildInitialChains(elements: string[]): Chains {
  const chains: Chains = {};
  elements.forEach((text, i) => {
    chains[String(i)] = [
      { type: "text", value: text, playerId: "control", timestamp: Date.now() },
    ];
  });
  return chains;
}

/**
 * Get the final text entry from each chain and assemble the mad-libs result.
 */
export function assembleMadLibs(
  template: string,
  chains: Chains,
  elementCount: number,
): { result: string; finalElements: string[] } {
  const finalElements: string[] = [];

  for (let k = 0; k < elementCount; k++) {
    const chain = chains[String(k)];
    if (!chain || chain.length === 0) {
      finalElements.push("???");
      continue;
    }
    const last = chain[chain.length - 1]!;
    finalElements.push(last.type === "text" ? last.value : "[sketch]");
  }

  let result = template;
  finalElements.forEach((el, i) => {
    result = result.replace(`{${i}}`, el);
  });

  return { result, finalElements };
}

/**
 * Assemble the original message from the template and original elements.
 */
export function assembleOriginal(
  template: string,
  elements: string[],
): string {
  let result = template;
  elements.forEach((el, i) => {
    result = result.replace(`{${i}}`, el);
  });
  return result;
}
