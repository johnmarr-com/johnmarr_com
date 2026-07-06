import type { GameSession } from "@/lib/game-sessions";
import type { GameEndResult } from "./registry";

/** Player-won banner phrases for human-vs-human matches. */
export const WIN_PHRASES = [
  "CONGRATS!", "WAY TO GO!", "YOU CRUSHED!", "YOU DID IT!", "YOU RULE!",
  "YOU DA BOSS!", "YOU'RE FANTASTIC!", "YOU'RE AMAZING!", "YOU DOMINATED!", "YOU'RE THE BEST!",
];

export function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * Map an AI's free-text ACTION line to a move by prefix match
 * ("Rock smash!" → "R"). Keys must be lowercase.
 */
export function parseActionByPrefix<M extends string>(
  action: string,
  map: Record<string, M>,
): M | null {
  const key = action.toLowerCase().trim();
  for (const [word, move] of Object.entries(map)) {
    if (key.startsWith(word)) return move;
  }
  return null;
}

/** The opponent's gamertag in a 1v1 session, if present. */
export function getOpponentGamertag(
  session: GameSession | null,
  userId: string,
): string | null {
  if (!session || !userId) return null;
  const opp = session.players.find((p) => p.uid !== userId);
  return opp?.gamertag ?? null;
}

/**
 * Build the factory GameEndResult for a two-side match (p1/p2, red/white).
 * `aWon` decides the winner between the uid on side `a` and the uid on side `b`.
 */
export function buildTwoSideGameEnd(
  session: GameSession,
  sides: { a: string; b: string },
  scoreA: number,
  scoreB: number,
  aWon: boolean,
): GameEndResult {
  const players = session.players;
  const sideMap = session.playerSides ?? {};
  const aUid = Object.entries(sideMap).find(([, s]) => s === sides.a)?.[0] ?? "";
  const bUid = Object.entries(sideMap).find(([, s]) => s === sides.b)?.[0] ?? "";
  const winnerUid = aWon ? aUid : bUid;
  const winner = players.find((p) => p.uid === winnerUid);

  const scores: Record<string, number> = {};
  if (aUid) scores[aUid] = scoreA;
  if (bUid) scores[bUid] = scoreB;

  return {
    winners: winner ? [winner] : [],
    winnerPoints: Math.max(scoreA, scoreB),
    allPlayers: players,
    scores,
  };
}
