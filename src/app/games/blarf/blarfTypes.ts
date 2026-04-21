/**
 * BLARF! — Types & Pure Game Logic
 *
 * Zero Firestore dependencies. All scoring/selection functions are
 * deterministic and testable in isolation.
 */

// ─── Voice Styles ──────────────────────────────────────────

export type VoiceStyle =
  | "normal"
  | "shout"
  | "whisper"
  | "sing"
  | "robot"
  | "opera"
  | "cowboy"
  | "baby"
  | "dramatic"
  | "bored"
  | "pirate"
  | "british"
  | "valley_girl";

export const VOICE_STYLE_LABELS: Record<VoiceStyle, string> = {
  normal: "Say your word",
  shout: "SHOUT your word!",
  whisper: "Whisper your word...",
  sing: "🎵 Sing your word!",
  robot: "Say it like a robot 🤖",
  opera: "Opera singer style! 🎭",
  cowboy: "Say it like a cowboy 🤠",
  baby: "Baby voice 👶",
  dramatic: "DRAMATICALLY! 🎬",
  bored: "Say it like you're bored 😑",
  pirate: "Arrr! Pirate voice! 🏴‍☠️",
  british: "Posh British accent 🎩",
  valley_girl: "Like, totally say it? 💅",
};

// ─── Round Data ────────────────────────────────────────────

export interface BlarfRoundData {
  letter: string;
  words: string[];
  voiceStyle?: VoiceStyle | undefined;
}

// ─── Phase ─────────────────────────────────────────────────

export type BlarfPhase =
  | "pack-select"
  | "round-intro"
  | "role-reveal"
  | "speaking"
  | "voting"
  | "results"
  | "final";

// ─── State (derived from Firestore session doc) ────────────

export interface BlarfState {
  session: import("@/lib/game-sessions").GameSession | null;
  bfPhase: BlarfPhase;
  bfPackId: string | null;
  bfPackName: string | null;
  bfPackCoverURL: string | null;
  bfRounds: BlarfRoundData[];
  bfCurrentRound: number;
  bfTotalRounds: number;
  /** Blarfer UIDs for current round */
  bfBlarfers: string[];
  /** playerId → assigned word (empty string for Blarfers) */
  bfAssignments: Record<string, string>;
  /** Letter hint shown to Blarfers */
  bfBlarferLetter: string;
  /** Voice style for current round */
  bfVoiceStyle: VoiceStyle | null;
  /** playerId → true (tapped "Got it!") */
  bfRoleConfirmed: Record<string, boolean>;
  /** Randomized speaker order */
  bfSpeakingOrder: string[];
  /** Index into speakingOrder (0-based) */
  bfCurrentSpeaker: number;
  /** voterId → array of target UIDs (multi-vote with stacking) */
  bfVotes: Record<string, string[]>;
  /** Epoch ms — voting phase deadline */
  bfVoteDeadline: number;
  /** Cumulative scores across all rounds */
  bfScores: Record<string, number>;
  /** Points earned this round */
  bfRoundDeltas: Record<string, number>;
  /** Votes received per player this round */
  bfVoteCounts: Record<string, number>;
  bfWinners: string[];
  bfWinnerPoints: number;
  /** Pack pre-selected in lobby */
  bfLobbyPackId: string | null;
  bfLobbyPackName: string | null;
  bfLobbyPackCoverURL: string | null;
  /** Round count chosen in lobby */
  bfLobbyRounds: number | null;
  /** Host has revealed results to all players */
  bfRevealed: boolean;
  isHost: boolean;
}

// ─── Round score result ────────────────────────────────────

export interface BlarfRoundScoreResult {
  /** Points earned this round, keyed by playerId */
  deltas: Record<string, number>;
  /** Votes received per player */
  voteCounts: Record<string, number>;
  /** Blarfers who were detected (had at least 1 unique voter) */
  detectedBlarfers: string[];
  /** Blarfers who were NOT detected */
  undetectedBlarfers: string[];
}

// ─── Pure helpers ──────────────────────────────────────────

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

// ─── BLARF-specific helpers ────────────────────────────────

/** How many Blarfers for a given player count. */
export function getBlarferCount(playerCount: number): number {
  if (playerCount >= 13) return 3;
  if (playerCount >= 7) return 2;
  return 1;
}

/** How many votes each player gets. */
export function getVotesPerPlayer(playerCount: number): number {
  if (playerCount >= 13) return 3;
  if (playerCount >= 7) return 2;
  return 1;
}

/** Shuffle and take the first `count` rounds from the pack. */
export function selectRounds(
  allRounds: readonly BlarfRoundData[],
  count: number,
): BlarfRoundData[] {
  return shuffleArray(allRounds).slice(0, count);
}

/** Get the round data for the current 1-based round. */
export function getCurrentRound(
  rounds: readonly BlarfRoundData[],
  round: number,
): BlarfRoundData | null {
  return rounds[round - 1] ?? null;
}

export interface RoleAssignment {
  blarfers: string[];
  assignments: Record<string, string>;
  blarferLetter: string;
}

/**
 * Assign roles for a round. Randomly picks Blarfers and assigns
 * unique words to non-Blarfers from the round's word list.
 */
export function assignRoles(
  playerUids: string[],
  roundData: BlarfRoundData,
): RoleAssignment {
  const blarferCount = getBlarferCount(playerUids.length);
  const shuffled = shuffleArray(playerUids);
  const blarfers = shuffled.slice(0, blarferCount);
  const nonBlarfers = shuffled.slice(blarferCount);

  // Shuffle words and assign one per non-Blarfer
  const shuffledWords = shuffleArray(roundData.words);
  const assignments: Record<string, string> = {};

  for (let i = 0; i < nonBlarfers.length; i++) {
    assignments[nonBlarfers[i]!] = shuffledWords[i % shuffledWords.length]!;
  }
  // Blarfers get empty string
  for (const uid of blarfers) {
    assignments[uid] = "";
  }

  return {
    blarfers,
    assignments,
    blarferLetter: roundData.letter,
  };
}

/**
 * Score a single BLARF round.
 *
 * Scoring:
 * - Correct vote (voted for a Blarfer): +1 per vote
 * - Blarfer undetected (0 unique voters): +3
 * - Blarfer detected by 1–5 unique voters: -1
 * - Blarfer detected by 6+ unique voters: -2
 * - Wrong votes: no penalty
 */
export function scoreBlarfRound(
  votes: Record<string, string[]>,
  blarfers: string[],
  allPlayerUids: string[],
): BlarfRoundScoreResult {
  const deltas: Record<string, number> = {};
  for (const uid of allPlayerUids) deltas[uid] = 0;

  // Count votes received per player
  const voteCounts: Record<string, number> = {};
  for (const uid of allPlayerUids) voteCounts[uid] = 0;

  // Track unique voters per target
  const uniqueVotersPerTarget: Record<string, Set<string>> = {};

  for (const [voterId, targets] of Object.entries(votes)) {
    for (const targetUid of targets) {
      voteCounts[targetUid] = (voteCounts[targetUid] ?? 0) + 1;
      if (!uniqueVotersPerTarget[targetUid]) {
        uniqueVotersPerTarget[targetUid] = new Set();
      }
      uniqueVotersPerTarget[targetUid].add(voterId);

      // Correct vote: +1 per vote placed on a Blarfer
      if (blarfers.includes(targetUid)) {
        deltas[voterId] = (deltas[voterId] ?? 0) + 1;
      }
    }
  }

  // Score Blarfers
  const detectedBlarfers: string[] = [];
  const undetectedBlarfers: string[] = [];

  for (const blarferId of blarfers) {
    const uniqueDetectors = uniqueVotersPerTarget[blarferId]?.size ?? 0;

    if (uniqueDetectors === 0) {
      // Undetected: +3
      deltas[blarferId] = (deltas[blarferId] ?? 0) + 3;
      undetectedBlarfers.push(blarferId);
    } else if (uniqueDetectors <= 5) {
      // Detected by 1-5: -1
      deltas[blarferId] = (deltas[blarferId] ?? 0) - 1;
      detectedBlarfers.push(blarferId);
    } else {
      // Detected by 6+: -2
      deltas[blarferId] = (deltas[blarferId] ?? 0) - 2;
      detectedBlarfers.push(blarferId);
    }
  }

  return { deltas, voteCounts, detectedBlarfers, undetectedBlarfers };
}
