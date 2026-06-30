"use client";

import { composeGame } from "../_gamecore";
import LineupGame from "./LineupGame";
import type { GC3Props } from "../_gamecore/registry/types";

function LineupGameAdapter({ sessionId, gameData, onGameEnd }: GC3Props) {
  return (
    <LineupGame
      sessionId={sessionId}
      gameData={gameData}
      onGameEnd={onGameEnd}
      {...(gameData.splashBgURL ? { splashBgURL: gameData.splashBgURL } : {})}
      gameLogoURL={gameData.splashLogoURL ?? gameData.coverURL}
    />
  );
}

export default composeGame({
  slug: "lineup",
  GameComponent: LineupGameAdapter,
  // Facts come from the humans in the room — no AI players, no content packs.
  allowAI: false,
  // Server-authoritative: the gameEngine Cloud Function owns all phase
  // progression + scoring (engineKey "lineup").
  authority: { engineKey: "lineup" },
  // Lobby = invite + Start only. There's nothing to configure (round count is
  // the player count); the engine drops straight into fact collection on Start.
  // Floor at 2 (the reducer's minimum) so a solo start can't wedge.
  lobbyCanStart: ({ session }) => (session.players?.length ?? 0) >= 2,
  // Play Again → engine start-of-game shape. The generic fields satisfy the
  // value-checked engineKey host-reset rule; phaseDeadlineAt:0 = untimed and
  // luPhase:"" is the sentinel that makes the reducer open a FRESH collection
  // window (and blocks early fact submits until it flips to "collecting").
  resetFields: () => ({
    status: "playing",
    currentRound: 0,
    rounds: [],
    winner: null,
    seq: 0,
    inbox: {},
    phaseDeadlineAt: 0,
    luPhase: "",
    luSubmitted: {},
    luCurrentIndex: 0,
    luCurrentFact: "",
    luTotalRounds: 0,
    luVotes: {},
    luScores: {},
    luReveal: null,
    luWinners: [],
    luWinnerPoints: 0,
  }),
});
