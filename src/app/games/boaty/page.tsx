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
  // Server-authoritative: the gameEngine Cloud Function owns all progression.
  authority: { engineKey: "boaty" },
  resultOptions: {
    logoRight: "right-3",
    hideScores: true,
    playMusic: true,
    showAIPostGameComments: true,
  },
  // Play Again: reset to the engine's start-of-game shape. Clearing btReady (not
  // the secret boards) makes the engine wait for fresh board submissions before
  // starting, so stale boards are overwritten. status/winner/seq cleared so the
  // host-reset rule (value-checked) permits this write.
  resetFields: () => ({
    status: "playing",
    currentRound: 0,
    rounds: [],
    winner: null,
    seq: 0,
    inbox: {},
    btPhase: "setup",
    btReady: {},
    btCurrentTurn: null,
    btAttacks: {},
    btLastAttack: null,
    btWinner: null,
    aiPostGameComments: null,
  }),
});
