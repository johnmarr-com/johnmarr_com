"use client";

import { composeGame } from "../_gamecore";
import SweepTheLegGame from "./SweepTheLegGame";
import type { GC3Props } from "../_gamecore/registry/types";

function SweepTheLegAdapter({ sessionId, gameData, onGameEnd }: GC3Props) {
  return (
    <SweepTheLegGame
      sessionId={sessionId}
      gameData={gameData}
      onGameEnd={onGameEnd}
    />
  );
}

export default composeGame({
  slug: "sweeptheleg",
  GameComponent: SweepTheLegAdapter,
  multiplayerFlowMode: "versus",
  sideLabels: ["red", "white"],
  allowAI: true,
  rockIcon: true,
  resultOptions: {
    hideScores: true,
    playMusic: true,
    showAIPostGameComments: true,
  },
  // Play Again (GC5) resets the round state for a fresh match; sides persist.
  resetFields: () => ({
    status: "playing",
    currentRound: 0,
    pendingMoves: {},
    rounds: [],
    transcript: [],
    winner: null,
    stlAiReason: {},
    aiPostGameComments: null,
  }),
});
