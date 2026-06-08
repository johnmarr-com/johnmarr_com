"use client";

import { composeGame } from "../_gamecore";
import BluffBoxGame from "./BluffBoxGame";
import BluffPackLobbySelector from "./BluffPackLobbySelector";
import BluffCreatePacksButton from "./BluffCreatePacksButton";
import type { GC3Props } from "../_gamecore/registry/types";

function BluffBoxAdapter({ sessionId, gameData, onGameEnd }: GC3Props) {
  return (
    <BluffBoxGame
      sessionId={sessionId}
      gameData={gameData}
      onGameEnd={onGameEnd}
      {...(gameData.splashBgURL ? { splashBgURL: gameData.splashBgURL } : {})}
      gameLogoURL={gameData.splashLogoURL ?? gameData.coverURL}
    />
  );
}

export default composeGame({
  slug: "bluffbox",
  GameComponent: BluffBoxAdapter,
  allowAI: true,
  lobbyExtra: ({ session }) => <BluffPackLobbySelector sessionId={session.id} />,
  landingExtra: <BluffCreatePacksButton />,
  resetFields: () => ({
    bbPhase: "pack-select",
    selectedPackId: null,
    selectedPackName: null,
    selectedPackCoverURL: null,
    cardPool: [],
    roundNumber: 1,
    totalRounds: 1,
    turnOrder: [],
    currentTurnIndex: 0,
    cardURL: null,
    sharerChoice: null,
    guesses: {},
    aiShareText: null,
    humanShareText: null,
    scores: {},
    bbHistory: [],
    winners: [],
    winnerPoints: 0,
  }),
});
