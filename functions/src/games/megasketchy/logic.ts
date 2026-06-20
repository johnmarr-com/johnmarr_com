/**
 * MegaSketchy — pure game logic (copied into the functions package; no `@/`
 * alias). "Eat Poop You Cat" / Telestrations: a secret message's elements each
 * seed a chain; players alternate drawing the previous entry and guessing the
 * previous drawing. Mirrors src/app/games/megasketchy/chainEngine.ts +
 * megasketchy-missions.missionToSecretMessage so behavior is preserved; the
 * engine reducer + LLM effect handlers now own it.
 */

// ─── Chain types ─────────────────────────────────────────────

export interface ChainEntry {
  type: "text" | "image";
  value: string;
  playerId: string;
  timestamp: number;
}
export type Chains = Record<string, ChainEntry[]>;
export type TaskType = "draw" | "guess";

export interface SecretMessage {
  template: string;
  elements: string[];
  sourceId: string;
}

export interface MissionSegment {
  descriptiveText: string;
  missionText: string;
}

// ─── Helpers ─────────────────────────────────────────────────

export function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

// ─── Chain progression (ported from chainEngine.ts) ──────────

/** Which player handles `stepIndex` of element `elementIndex`. */
export function getPlayerForStep(elementIndex: number, stepIndex: number, playOrder: string[]): string {
  const N = playOrder.length;
  const playerIdx = (elementIndex + (stepIndex - 1)) % N;
  return playOrder[playerIdx]!;
}

/** Even player counts need N+1 entries; odd need N — so every chain ends on text. */
export function chainTargetLength(playerCount: number): number {
  return playerCount % 2 === 1 ? playerCount : playerCount + 1;
}

export function isChainComplete(chain: ChainEntry[], playerCount: number): boolean {
  return chain.length >= chainTargetLength(playerCount);
}

/** Text input → the player must draw; image input → the player must guess. */
export function taskTypeFromInput(entry: ChainEntry): TaskType {
  return entry.type === "text" ? "draw" : "guess";
}

export function allChainsComplete(chains: Chains, playerCount: number): boolean {
  for (let k = 0; k < playerCount; k++) {
    const chain = chains[String(k)];
    if (!chain || !isChainComplete(chain, playerCount)) return false;
  }
  return true;
}

/** Initial chains: one per element, each seeded with Control's original text. */
export function buildInitialChains(elements: string[], now: number): Chains {
  const chains: Chains = {};
  elements.forEach((text, i) => {
    chains[String(i)] = [{ type: "text", value: text, playerId: "control", timestamp: now }];
  });
  return chains;
}

/** The placeholder entry written when a player's 60s hourglass runs out. */
export function timeoutEntry(taskType: TaskType, playerId: string, now: number): ChainEntry {
  return taskType === "draw"
    ? { type: "image", value: "", playerId, timestamp: now } // blank sketch
    : { type: "text", value: "???", playerId, timestamp: now };
}

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

export function assembleOriginal(template: string, elements: string[]): string {
  let result = template;
  elements.forEach((el, i) => {
    result = result.replace(`{${i}}`, el);
  });
  return result;
}

// ─── Mission → secret message (ported from megasketchy-missions.ts) ──

export function missionToSecretMessage(
  segments: MissionSegment[],
  missionId: string,
  playerCount: number,
): SecretMessage {
  const count = Math.min(playerCount, segments.length);
  const slice = segments.slice(0, count);
  const templateParts: string[] = [];
  const elements: string[] = [];
  slice.forEach((seg, i) => {
    const desc = (seg.descriptiveText ?? "").trim();
    templateParts.push(desc ? `${desc} "{${i}}"` : `"{${i}}"`);
    elements.push(seg.missionText);
  });
  let template = templateParts.join(" ");
  if (!/[.!?]$/.test(template)) template += ".";
  return { template, elements, sourceId: missionId };
}

// ─── LLM judge + scoring (used by the effect handlers) ───────

/** Build the element-judge prompt (Original → Received pairs). */
export function buildJudgePrompt(elements: string[], finalElements: string[]): string {
  const pairs = elements
    .map((orig, i) => `${i + 1}. "${orig}" → "${finalElements[i] ?? "???"}"`)
    .join("\n");
  return `You are judging a spy-themed party game. Players passed a secret message through a chain of drawing and guessing (like Telephone). For each element below, decide if the received word/phrase preserves the core meaning of the original (even if wording changed).

ELEMENT PAIRS (Original → Received):
${pairs}

For each element, respond with ONLY a comma-separated list of "Y" or "N" (Y = close enough, N = wrong). Example for 4 elements: Y,N,N,Y

Response:`;
}

/**
 * Parse the judge reply into a boolean[] per element. Returns [] (the
 * "unjudged" sentinel) when the reply is empty/garbled, so the relay is shown
 * without a fake verdict rather than scoring everything a MISS.
 */
export function parseJudgeReply(comment: string, elementCount: number): boolean[] {
  const tokens = comment
    .trim()
    .split(/[,\s]+/)
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
  const usable =
    tokens.length >= elementCount &&
    tokens.slice(0, elementCount).every((t) => t === "Y" || t === "N");
  return usable ? Array.from({ length: elementCount }, (_, i) => tokens[i] === "Y") : [];
}

/** Mission passes when a majority of elements survived. */
export function missionPassed(matches: boolean[], elementCount: number): boolean {
  const matchCount = matches.filter(Boolean).length;
  return matchCount >= Math.ceil(elementCount / 2);
}

/** Build the dramatic-debrief scoring prompt. */
export function buildScoringPrompt(
  original: string,
  garbled: string,
  elements: string[],
  finalElements: string[],
  matches: boolean[],
): string {
  const matchCount = matches.filter(Boolean).length;
  const passed = missionPassed(matches, elements.length);
  const elementComparison = elements
    .map((orig, i) => `  ${i + 1}. "${orig}" → "${finalElements[i] ?? "???"}" [${matches[i] ? "MATCH" : "MISS"}]`)
    .join("\n");
  return `You are the AI handler for a spy-themed party game called "Mega Sketchy." A secret message was relayed through a chain of agents via alternating sketching and guessing, like Telephone/Telestrations.

ORIGINAL MESSAGE FROM CONTROL:
${original}

WHAT CAME THROUGH THE SPY NETWORK:
${garbled}

ELEMENT-BY-ELEMENT (already judged):
${elementComparison}

Result: ${matchCount}/${elements.length} elements matched. Mission ${passed ? "PASSED" : "FAILED"}.

Write 2-3 sentences as a dramatic spy mission debrief. Be funny and reference specific elements that were hilariously mangled or surprisingly preserved. Stay in character as a spy handler. Just the narrative, no labels or prefixes.`;
}
