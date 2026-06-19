"use client";

import { composeGame } from "../_gamecore";
import WordonkulousGame from "./WordonkulousGame";
import type { GC3Props } from "../_gamecore/registry/types";

function WordonkulousGameAdapter({ sessionId, gameData, onGameEnd }: GC3Props) {
  return (
    <WordonkulousGame
      sessionId={sessionId}
      gameData={gameData}
      onGameEnd={onGameEnd}
      {...(gameData.splashBgURL ? { splashBgURL: gameData.splashBgURL } : {})}
      gameLogoURL={gameData.splashLogoURL ?? gameData.coverURL}
    />
  );
}

export default composeGame({
  slug: "wordonkulous",
  GameComponent: WordonkulousGameAdapter,
  // Group game: no AI players (removed — they were test scaffolding).
  allowAI: false,
  // Server-authoritative: the gameEngine Cloud Function owns all phase
  // progression + scoring (engineKey "wordonkulous").
  authority: { engineKey: "wordonkulous" },
  // Lobby = invite + Start only. The host configures the pack + round count
  // AFTER Start, on the pack-select screen (same picker as Play Again).
  // Floor at 2 players (the reducer's minimum) so a solo start can't wedge.
  lobbyCanStart: ({ session }) => (session.players?.length ?? 0) >= 2,
  // Play Again → engine start-of-game shape. The generic fields (status,
  // currentRound:0, rounds:[], winner:null, seq:0, inbox:{}) satisfy the
  // value-checked engineKey host-reset rule; phaseDeadlineAt:0 = untimed.
  resetFields: () => ({
    status: "playing",
    currentRound: 0,
    rounds: [],
    winner: null,
    seq: 0,
    inbox: {},
    phaseDeadlineAt: 0,
    wkPhase: "pack-select",
    wkPackId: null,
    wkPackName: null,
    wkPackCoverURL: null,
    wkDefinitions: [],
    wkCurrentRound: 1,
    wkTotalRounds: 1,
    wkSubmissions: {},
    wkVotes: {},
    wkScores: {},
    wkWinners: [],
    wkWinnerPoints: 0,
    wkSubmitDeadline: 0,
    wkVoteDeadline: 0,
    wkShuffledAuthors: [],
  }),
});
