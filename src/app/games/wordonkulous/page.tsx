"use client";

import { composeGame } from "../_gamecore";
import WordonkulousGame from "./WordonkulousGame";
import WordonkulousPackLobbySelector from "./WordonkulousPackLobbySelector";
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
  allowAI: true,
  lobbyExtra: ({ session }) => <WordonkulousPackLobbySelector sessionId={session.id} />,
  lobbyCanStart: ({ session }) =>
    !!(session as unknown as Record<string, unknown>)["wkLobbyPackId"],
  resetFields: () => ({
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
    wkLobbyRounds: null,
  }),
});
