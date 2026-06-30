/**
 * Lineup — Types & Pure Game Logic
 *
 * Zero Firestore dependencies. The pure functions are deterministic and are
 * mirrored verbatim in `functions/src/games/lineup/logic.ts` (the functions
 * package can't import from `src/`). Keep the two copies in sync.
 */

import type { GameSession } from "@/lib/game-sessions";

// ─── Phase ──────────────────────────────────────────────────

export type LineupPhase =
  | "lobby" // joined, waiting for the host to hit Start (engine hasn't opened the game yet)
  | "collecting" // everyone writes a fun fact about themselves
  | "voting" // one fact shown; everyone else guesses the author
  | "results" // author revealed, correct guessers scored
  | "final"; // winner + leaderboard

// ─── Reveal (published by the engine at `results`) ──────────

export interface LineupReveal {
  /** The fact's true author. */
  authorUid: string;
  authorGamertag: string;
  /** The fact text (now safe to attribute). */
  fact: string;
  /** Eligible voters who guessed the author correctly (+1 each). */
  correctVoterUids: string[];
}

// ─── State (derived from the Firestore session doc) ─────────

export interface LineupState {
  session: GameSession | null;
  luPhase: LineupPhase;
  /** uid → true once that player has submitted their fact (no text — secret). */
  luSubmitted: Record<string, boolean>;
  /** 0-based index of the fact currently up for voting. */
  luCurrentIndex: number;
  /** The current fact's text (author hidden). */
  luCurrentFact: string;
  /** Total voting rounds = number of facts submitted. */
  luTotalRounds: number;
  /** voterId → guessed authorId (current round only). */
  luVotes: Record<string, string>;
  /** Cumulative scores across all rounds. */
  luScores: Record<string, number>;
  /** Set at `results`; null otherwise. */
  luReveal: LineupReveal | null;
  luWinners: string[];
  luWinnerPoints: number;
  /** Epoch ms — current phase deadline (0 = untimed). */
  phaseDeadlineAt: number;
  /** This player's OWN submitted fact (from the owner-readable secret doc), so
   *  the client can tell when the current fact is theirs without leaking it. */
  myFact: string | null;
  isHost: boolean;
}

// ─── Pure helpers (mirror functions/src/games/lineup/logic.ts) ──

/** Fisher-Yates shuffle (returns a new array). */
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

/**
 * Score one guessing round: every eligible voter who named the fact's true
 * author earns +1. The author never votes (they're excluded from
 * `eligibleVoterUids`), so they can't score on their own fact.
 */
export function scoreGuessRound(
  votes: Record<string, string>,
  authorUid: string,
  eligibleVoterUids: readonly string[],
): { deltas: Record<string, number>; correctVoterUids: string[] } {
  const deltas: Record<string, number> = {};
  const correctVoterUids: string[] = [];
  for (const uid of eligibleVoterUids) {
    if (votes[uid] === authorUid) {
      deltas[uid] = 1;
      correctVoterUids.push(uid);
    }
  }
  return { deltas, correctVoterUids };
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
