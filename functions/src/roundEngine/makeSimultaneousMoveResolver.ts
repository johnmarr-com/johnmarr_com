/**
 * Factory for "both players submit a move, a beats-table decides, score,
 * first-to-N" resolvers — the shape shared by Sweep the Leg (hml) and
 * Tap Smash Arena (rps).
 *
 * The factory owns the identical winner / cumulative-score / game-over math.
 * Per-game `result` field names and transcript strings differ, so those are
 * supplied via `buildResult` / `buildTranscript` callbacks. Cumulative scores
 * are recomputed by replaying prior rounds' moves (deterministic), so the
 * factory never needs to know a game's stored delta field names.
 */

import type { ResolverFn, SessionData } from "./types";

export interface SimMoveContext {
  /** Zero-based index of the round being resolved (session.currentRound). */
  round: number;
  sideAUid: string;
  sideBUid: string;
  /** Move played by sides[0] / sides[1] (defaults applied). */
  sideAMove: string;
  sideBMove: string;
  /** Winning side key (sides[0] | sides[1]) or null on a tie. */
  winnerSide: string | null;
  /** This round's points for side A / side B. */
  aDelta: number;
  bDelta: number;
  /** Cumulative score INCLUDING this round. */
  aScore: number;
  bScore: number;
  /** Gamertags (undefined if the player has none). */
  aTag: string | undefined;
  bTag: string | undefined;
  gameOver: boolean;
  winnerUid: string | null;
}

export interface SimMoveConfig {
  /** [sideAKey, sideBKey], e.g. ["red","white"] or ["p1","p2"]. */
  sides: [string, string];
  /** Attacker move -> the move it beats, e.g. { H:"L", M:"H", L:"M" }. */
  beats: Record<string, string>;
  /** Move used when a player has no entry for the round. */
  defaultMove: string;
  pointsToWin: number;
  /** Points awarded to the winner for a single round (bonus rules live here). */
  scoreDelta: (winnerSide: string, aMove: string, bMove: string) => number;
  buildResult: (ctx: SimMoveContext) => Record<string, unknown>;
  buildTranscript: (ctx: SimMoveContext) => string[];
}

export function makeSimultaneousMoveResolver(config: SimMoveConfig): ResolverFn {
  const [sideA, sideB] = config.sides;

  const decide = (aMove: string, bMove: string): string | null => {
    if (aMove === bMove) return null;
    return config.beats[aMove] === bMove ? sideA : sideB;
  };

  const deltasFor = (
    aMove: string,
    bMove: string,
  ): { a: number; b: number; winnerSide: string | null } => {
    const w = decide(aMove, bMove);
    if (w === sideA) return { a: config.scoreDelta(sideA, aMove, bMove), b: 0, winnerSide: w };
    if (w === sideB) return { a: 0, b: config.scoreDelta(sideB, aMove, bMove), winnerSide: w };
    return { a: 0, b: 0, winnerSide: null };
  };

  return (session: SessionData) => {
    const sidesMap = session.playerSides ?? {};
    let aUid = "";
    let bUid = "";
    for (const [uid, side] of Object.entries(sidesMap)) {
      if (side === sideA) aUid = uid;
      else if (side === sideB) bUid = uid;
    }

    const moves = session.pendingMoves ?? {};
    const aMove = moves[aUid] ?? config.defaultMove;
    const bMove = moves[bUid] ?? config.defaultMove;

    // Cumulative scores from prior rounds — recomputed from stored moves
    // (deterministic, so no coupling to game-specific delta field names).
    let aScore = 0;
    let bScore = 0;
    for (const r of session.rounds ?? []) {
      const pa = r.moves?.[aUid] ?? config.defaultMove;
      const pb = r.moves?.[bUid] ?? config.defaultMove;
      const d = deltasFor(pa, pb);
      aScore += d.a;
      bScore += d.b;
    }

    const cur = deltasFor(aMove, bMove);
    aScore += cur.a;
    bScore += cur.b;

    const gameOver = aScore >= config.pointsToWin || bScore >= config.pointsToWin;
    const winnerUid = gameOver ? (aScore >= config.pointsToWin ? aUid : bUid) : null;

    const players = session.players ?? [];
    const ctx: SimMoveContext = {
      round: session.currentRound ?? 0,
      sideAUid: aUid,
      sideBUid: bUid,
      sideAMove: aMove,
      sideBMove: bMove,
      winnerSide: cur.winnerSide,
      aDelta: cur.a,
      bDelta: cur.b,
      aScore,
      bScore,
      aTag: players.find((p) => p.uid === aUid)?.gamertag,
      bTag: players.find((p) => p.uid === bUid)?.gamertag,
      gameOver,
      winnerUid,
    };

    return {
      roundEntry: {
        round: ctx.round,
        moves: { [aUid]: aMove, [bUid]: bMove },
        result: config.buildResult(ctx),
      },
      transcriptLines: config.buildTranscript(ctx),
      gameOver,
      winner: winnerUid,
    };
  };
}
