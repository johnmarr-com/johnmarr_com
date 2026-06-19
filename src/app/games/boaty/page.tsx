"use client";

import { composeGame } from "../_gamecore";
import BoatyGame from "./BoatyGame";
import type { GC3Props } from "../_gamecore/registry/types";

function BoatyGameAdapter({ sessionId, gameData, onGameEnd }: GC3Props) {
  return (
    <BoatyGame
      sessionId={sessionId}
      gameData={gameData}
      onGameEnd={onGameEnd}
    />
  );
}

export default composeGame({
  slug: "boaty",
  GameComponent: BoatyGameAdapter,
  multiplayerFlowMode: "versus",
  sideLabels: ["P1", "P2"],
  allowAI: true,
  rockIcon: true,
  resultOptions: {
    logoRight: "right-3",
    hideScores: true,
    playMusic: true,
    showAIPostGameComments: true,
  },
  resetFields: () => ({
    btPhase: "setup",
    btBoards: {},
    btReady: {},
    btCurrentTurn: null,
    btAttacks: {},
    btLastAttack: null,
    btWinner: null,
    aiPostGameComments: null,
  }),
});
