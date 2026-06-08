"use client";

import { composeGame } from "../_gamecore";
import type { GameSession } from "@/lib/game-sessions";
import FyveGame from "./FyveGame";
import HeistLobbySelector from "./HeistLobbySelector";
import FyveBuildHeistsButton from "./FyveBuildHeistsButton";
import type { GC3Props } from "../_gamecore/registry/types";

// FYVE is a TEAM game with its own multi-stage win/loss cinematic and its own
// Play Again, so it does NOT use the factory result screen (GC4) — the adapter
// omits onGameEnd, FyveGame stays mounted in GC3 and owns the endgame. The
// factory just provides the shared splash / host-join / lobby.
function FyveAdapter({ sessionId, gameData }: GC3Props) {
  return (
    <FyveGame
      sessionId={sessionId}
      {...(gameData.splashLogoURL || gameData.coverURL
        ? { gameLogoURL: gameData.splashLogoURL ?? gameData.coverURL }
        : {})}
      {...(gameData.backgroundMusicURL ? { musicUrl: gameData.backgroundMusicURL } : {})}
    />
  );
}

export default composeGame({
  slug: "fyve",
  GameComponent: FyveAdapter,
  multiplayerFlowMode: "party",
  lobbyExtra: ({ session }: { session: GameSession }) => (
    <HeistLobbySelector sessionId={session.id} />
  ),
  lobbyCanStart: ({ session }: { session: GameSession }) =>
    !!(session as unknown as Record<string, unknown>)["fyveLobbyHeistId"],
  landingExtra: <FyveBuildHeistsButton />,
  // Required by composeGame; FYVE handles its own rematch (handlePlayAgain) so
  // GC5 is never reached. Mirrors handlePlayAgain for correctness if it ever is.
  resetFields: () => ({
    board: null,
    keyDocId: null,
    activeTeam: null,
    currentClue: null,
    guessesRemaining: 0,
    guessesUsedThisTurn: 0,
    bonusGuessAvailable: false,
    pendingTap: null,
    winningTeam: null,
    loseByBomb: false,
    bombRevealedBy: null,
    t1Score: 0,
    t2Score: 0,
    t1RevealCount: 0,
    t2RevealCount: 0,
    t1RevealedAssets: [],
    t2RevealedAssets: [],
    status: "playing",
    svPhase: "boss-select",
  }),
});
