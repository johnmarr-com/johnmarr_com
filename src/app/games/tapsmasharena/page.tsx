"use client";

import { composeGame } from "../_gamecore";
import TapSmashArenaGame from "./TapSmashArenaGame";
import type { GC3Props } from "../_gamecore/registry/types";

function TapSmashArenaAdapter({ sessionId, gameData, onGameEnd }: GC3Props) {
  return (
    <TapSmashArenaGame
      sessionId={sessionId}
      gameData={gameData}
      onGameEnd={onGameEnd}
    />
  );
}

export default composeGame({
  slug: "tapsmasharena",
  GameComponent: TapSmashArenaAdapter,
  multiplayerFlowMode: "versus",
  sideLabels: ["p1", "p2"],
  allowAI: true,
  pulseIcon: true,
  // Server-authoritative round resolution (generic resolveRound Cloud Function).
  round: { resolverKey: "rps" },
  resultOptions: {
    hideScores: true,
    playMusic: true,
    showAIPostGameComments: true,
    // Color the WINNER title + name by the winning side (P1 blue / P2 orange).
    sideColors: { p1: "#3b82f6", p2: "#f97316" },
  },
  resetFields: () => ({
    status: "playing",
    currentRound: 0,
    pendingMoves: {},
    rounds: [],
    transcript: [],
    winner: null,
    seq: 0,
    aiPostGameComments: null,
  }),
});
