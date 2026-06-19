"use client";

import { composeGame } from "../_gamecore";
import BlarfGame from "./BlarfGame";
import type { GC3Props } from "../_gamecore/registry/types";

function BlarfGameAdapter({ sessionId, gameData, onGameEnd }: GC3Props) {
  return (
    <BlarfGame
      sessionId={sessionId}
      gameData={gameData}
      onGameEnd={onGameEnd}
      {...(gameData.splashBgURL ? { splashBgURL: gameData.splashBgURL } : {})}
      gameLogoURL={gameData.splashLogoURL ?? gameData.coverURL}
    />
  );
}

export default composeGame({
  slug: "blarf",
  GameComponent: BlarfGameAdapter,
  rockIcon: true,
  // Server-authoritative: the gameEngine Cloud Function owns all progression +
  // role assignment + scoring (engineKey "blarf").
  authority: { engineKey: "blarf" },
  // Lobby = invite + Start only. The host picks the pack + round count AFTER
  // Start, on the pack-select screen. Floor at 3 players (deduction needs a few).
  lobbyCanStart: ({ session }) => (session.players?.length ?? 0) >= 3,
  // Play Again → engine start-of-game shape (generic fields satisfy the
  // value-checked engineKey host-reset rule; phaseDeadlineAt:0 = untimed).
  resetFields: () => ({
    status: "playing",
    currentRound: 0,
    rounds: [],
    winner: null,
    seq: 0,
    inbox: {},
    phaseDeadlineAt: 0,
    bfPhase: "pack-select",
    bfPackId: null,
    bfPackName: null,
    bfPackCoverURL: null,
    bfCurrentRound: 1,
    bfTotalRounds: 1,
    bfBlarfers: [],
    bfVoiceStyle: null,
    bfRoleConfirmed: {},
    bfSpeakingOrder: [],
    bfCurrentSpeaker: 0,
    bfVotes: {},
    bfVoteDeadline: 0,
    bfScores: {},
    bfRoundDeltas: {},
    bfVoteCounts: {},
    bfWinners: [],
    bfWinnerPoints: 0,
    bfReveal: {},
  }),
});
