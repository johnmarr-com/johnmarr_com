/**
 * Wordonkulous — Types & Pure Game Logic
 *
 * Zero Firestore dependencies. All scoring/selection functions are
 * deterministic and testable in isolation.
 */

// ─── Phase ──────────────────────────────────────────────────

export type WordonkulousPhase =
  | "pack-select"
  | "round-intro"
  | "submitting"
  | "voting"
  | "results"
  | "final";

// ─── State (derived from Firestore session doc) ─────────────

export interface WordonkulousState {
  session: import("@/lib/game-sessions").GameSession | null;
  wkPhase: WordonkulousPhase;
  wkPackId: string | null;
  wkPackName: string | null;
  wkPackCoverURL: string | null;
  wkDefinitions: string[];
  wkCurrentRound: number;
  wkTotalRounds: number;
  /** playerId → invented word (current round only) */
  wkSubmissions: Record<string, string>;
  /** voterId → authorId they voted for (current round only) */
  wkVotes: Record<string, string>;
  /** Cumulative scores across all rounds */
  wkScores: Record<string, number>;
  wkWinners: string[];
  wkWinnerPoints: number;
  /** Epoch ms — submission phase deadline */
  wkSubmitDeadline: number;
  /** Epoch ms — voting phase deadline */
  wkVoteDeadline: number;
  /** Randomised author order for vote display (set by host) */
  wkShuffledAuthors: string[];
  /** Pack pre-selected in lobby */
  wkLobbyPackId: string | null;
  wkLobbyPackName: string | null;
  /** Round count chosen in lobby (null = use default preset) */
  wkLobbyRounds: number | null;
  isHost: boolean;
}

// ─── Round result (returned by scoreRound) ──────────────────

export interface RoundScoreResult {
  /** Points earned this round, keyed by playerId */
  deltas: Record<string, number>;
  /** Author IDs that placed 1st */
  firstPlace: string[];
  /** Vote counts per author */
  voteCounts: Record<string, number>;
}

// ─── Pure helpers ───────────────────────────────────────────

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
 * Score a single round.
 *
 * Scoring: 1st place earns points equal to votes received, capped at 3.
 * Ties: all tied players receive the same points.
 */
export function scoreRound(
  votes: Record<string, string>,
  submissions: Record<string, string>,
): RoundScoreResult {
  // Count votes per author
  const voteCounts: Record<string, number> = {};
  for (const uid of Object.keys(submissions)) voteCounts[uid] = 0;
  for (const authorId of Object.values(votes)) {
    voteCounts[authorId] = (voteCounts[authorId] ?? 0) + 1;
  }

  // Sort authors by vote count descending
  const sorted = Object.entries(voteCounts)
    .map(([authorId, count]) => ({ authorId, count }))
    .sort((a, b) => b.count - a.count);

  if (sorted.length === 0) {
    return { deltas: {}, firstPlace: [], voteCounts };
  }

  const firstCount = sorted[0]!.count;
  const firstPlace = firstCount > 0
    ? sorted.filter((s) => s.count === firstCount).map((s) => s.authorId)
    : [];

  // 1st place earns votes received, max 3. Everyone else gets 0.
  const deltas: Record<string, number> = {};
  for (const uid of Object.keys(submissions)) {
    if (firstPlace.includes(uid)) {
      deltas[uid] = Math.min(voteCounts[uid] ?? 0, 3);
    } else {
      deltas[uid] = 0;
    }
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
  const winners = entries
    .filter(([, p]) => p === maxPoints)
    .map(([uid]) => uid);

  return { winners, points: maxPoints };
}
