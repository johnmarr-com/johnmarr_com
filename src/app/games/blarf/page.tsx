"use client";

import { composeGame } from "../_gamecore";
import BlarfGame from "./BlarfGame";
import BlarfPackLobbySelector from "./BlarfPackLobbySelector";
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
  lobbyExtra: ({ session }) => <BlarfPackLobbySelector sessionId={session.id} />,
  lobbyCanStart: ({ session }) =>
    !!(session as unknown as Record<string, unknown>)["bfLobbyPackId"],
  resetFields: () => ({
    bfPhase: "pack-select",
    bfPackId: null,
    bfPackName: null,
    bfPackCoverURL: null,
    bfRounds: [],
    bfCurrentRound: 1,
    bfTotalRounds: 1,
    bfBlarfers: [],
    bfAssignments: {},
    bfBlarferLetter: "",
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
    bfRevealed: false,
    bfLobbyRounds: null,
  }),
});
