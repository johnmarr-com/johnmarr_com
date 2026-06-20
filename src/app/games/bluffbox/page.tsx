"use client";

import { composeGame } from "../_gamecore";
import BluffBoxGame from "./BluffBoxGame";
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
  // Group game: no AI players (removed).
  allowAI: false,
  // Server-authoritative: gameEngine owns all progression + scoring + the
  // rotating-sharer flow (engineKey "bluffbox").
  authority: { engineKey: "bluffbox" },
  // Lobby = invite + Start; the host picks the pack AFTER Start (pack-select
  // phase). Floor at 2 players.
  lobbyCanStart: ({ session }) => (session.players?.length ?? 0) >= 2,
  landingExtra: <BluffCreatePacksButton />,
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
    bbPhase: "pack-select",
    selectedPackId: null,
    selectedPackName: null,
    selectedPackCoverURL: null,
    roundNumber: 1,
    totalRounds: 1,
    turnOrder: [],
    currentTurnIndex: 0,
    cardURL: null,
    guesses: {},
    bbChoiceMade: false,
    bbRevealChoice: null,
    scores: {},
    bbHistory: [],
    winners: [],
    winnerPoints: 0,
  }),
});
