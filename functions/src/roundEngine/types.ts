/**
 * Server-side round-resolution types.
 *
 * The functions package is standalone (no path alias to the Next app's src/),
 * so these mirror the relevant client types. They describe only the subset of
 * a gameSessions document that a round resolver reads/writes.
 */

export interface SessionPlayer {
  uid: string;
  gamertag?: string;
}

export interface RoundResult {
  round: number;
  moves: Record<string, string>;
  result: Record<string, unknown>;
}

export interface SessionData {
  players?: SessionPlayer[];
  playerSides?: Record<string, string>;
  pendingMoves?: Record<string, string>;
  rounds?: RoundResult[];
  currentRound?: number;
  status?: string;
  resolverKey?: string;
  seq?: number;
}

export interface ResolveOutput {
  roundEntry: RoundResult;
  transcriptLines: string[];
  gameOver: boolean;
  winner: string | null;
}

export type ResolverFn = (session: SessionData) => ResolveOutput;
