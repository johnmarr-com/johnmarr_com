/**
 * Blarf — pure game logic (copied from the Next app's
 * `src/app/games/blarf/blarfTypes.ts`; the functions package can't import from
 * `src/`). Keep in sync with the client copy — deterministic by construction.
 */

export interface BlarfRoundData {
  letter: string;
  words: string[];
  voiceStyle?: string | undefined;
}

export interface RoleAssignment {
  blarfers: string[];
  assignments: Record<string, string>;
  blarferLetter: string;
}

export interface BlarfRoundScoreResult {
  deltas: Record<string, number>;
  voteCounts: Record<string, number>;
  detectedBlarfers: string[];
  undetectedBlarfers: string[];
}

export function shuffleArray<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function initScores(playerUids: string[]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const uid of playerUids) scores[uid] = 0;
  return scores;
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
  const maxPoints = Math.max(...entries.map(([, p]) => p));
  const winners = entries.filter(([, p]) => p === maxPoints).map(([uid]) => uid);
  return { winners, points: maxPoints };
}

export function getBlarferCount(playerCount: number): number {
  if (playerCount >= 13) return 3;
  if (playerCount >= 7) return 2;
  return 1;
}

export function getVotesPerPlayer(playerCount: number): number {
  if (playerCount >= 13) return 3;
  if (playerCount >= 7) return 2;
  return 1;
}

export function selectRounds(
  allRounds: readonly BlarfRoundData[],
  count: number,
): BlarfRoundData[] {
  return shuffleArray(allRounds).slice(0, count);
}

export function getCurrentRound(
  rounds: readonly BlarfRoundData[],
  round: number,
): BlarfRoundData | null {
  return rounds[round - 1] ?? null;
}

/**
 * Pick `count` Blarfers, fewest prior turns first (random tiebreak). Fair
 * rotation: everyone gets a turn before anyone repeats, and it recycles
 * automatically — when all counts are equal the minimum just rises, freeing
 * everyone again. No reset bookkeeping needed.
 */
export function pickBlarfers(
  playerUids: string[],
  count: number,
  blarferCounts: Record<string, number>,
): string[] {
  // Shuffle first so equal counts are broken randomly (Array.sort is stable in V8).
  const ordered = shuffleArray(playerUids);
  ordered.sort((a, b) => (blarferCounts[a] ?? 0) - (blarferCounts[b] ?? 0));
  return ordered.slice(0, count);
}

/** Pick Blarfers (fair rotation via `blarferCounts`) + assign unique words to
 *  non-Blarfers. */
export function assignRoles(
  playerUids: string[],
  roundData: BlarfRoundData,
  blarferCounts: Record<string, number> = {},
): RoleAssignment {
  const blarferCount = getBlarferCount(playerUids.length);
  const blarfers = pickBlarfers(playerUids, blarferCount, blarferCounts);
  const nonBlarfers = playerUids.filter((u) => !blarfers.includes(u));

  const shuffledWords = shuffleArray(roundData.words);
  const assignments: Record<string, string> = {};
  for (let i = 0; i < nonBlarfers.length; i++) {
    assignments[nonBlarfers[i]!] = shuffledWords[i % shuffledWords.length]!;
  }
  for (const uid of blarfers) assignments[uid] = "";

  return { blarfers, assignments, blarferLetter: roundData.letter };
}

/**
 * Score a round. Correct vote (on a Blarfer): +1 per vote. Blarfer undetected:
 * +3; detected by 1–5 unique voters: −1; by 6+: −2. Wrong votes: no penalty.
 */
export function scoreBlarfRound(
  votes: Record<string, string[]>,
  blarfers: string[],
  allPlayerUids: string[],
): BlarfRoundScoreResult {
  const deltas: Record<string, number> = {};
  const voteCounts: Record<string, number> = {};
  for (const uid of allPlayerUids) {
    deltas[uid] = 0;
    voteCounts[uid] = 0;
  }

  const uniqueVotersPerTarget: Record<string, Set<string>> = {};
  for (const [voterId, targets] of Object.entries(votes)) {
    for (const targetUid of targets) {
      voteCounts[targetUid] = (voteCounts[targetUid] ?? 0) + 1;
      if (!uniqueVotersPerTarget[targetUid]) uniqueVotersPerTarget[targetUid] = new Set();
      uniqueVotersPerTarget[targetUid]!.add(voterId);
      if (blarfers.includes(targetUid)) {
        deltas[voterId] = (deltas[voterId] ?? 0) + 1;
      }
    }
  }

  const detectedBlarfers: string[] = [];
  const undetectedBlarfers: string[] = [];
  for (const blarferId of blarfers) {
    const uniqueDetectors = uniqueVotersPerTarget[blarferId]?.size ?? 0;
    if (uniqueDetectors === 0) {
      deltas[blarferId] = (deltas[blarferId] ?? 0) + 3;
      undetectedBlarfers.push(blarferId);
    } else if (uniqueDetectors <= 5) {
      deltas[blarferId] = (deltas[blarferId] ?? 0) - 1;
      detectedBlarfers.push(blarferId);
    } else {
      deltas[blarferId] = (deltas[blarferId] ?? 0) - 2;
      detectedBlarfers.push(blarferId);
    }
  }

  return { deltas, voteCounts, detectedBlarfers, undetectedBlarfers };
}
