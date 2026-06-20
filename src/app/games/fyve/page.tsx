"use client";

import { composeGame } from "../_gamecore";
import type { GameSession } from "@/lib/game-sessions";
import FyveGame from "./FyveGame";
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
  // Server-authoritative: the gameEngine reducer owns the live game (board +
  // secret-key generation, the reveal loop, turns, win/loss). Setup (heist /
  // teams / bosses) is host-driven via /api/games/fyve.
  authority: { engineKey: "fyve" },
  // Lobby = invite + Start only; the host picks the heist AFTER Start (the
  // heist-select phase). Two teams of 2 is the realistic floor.
  lobbyCanStart: ({ session }: { session: GameSession }) =>
    (session.players?.length ?? 0) >= 4,
  landingExtra: <FyveBuildHeistsButton />,
  // FYVE runs its own rematch via the route (play-again → boss-select), so GC5
  // is never reached. This satisfies composeGame + the value-checked engineKey
  // reset rule for a clean start-of-game shape if it ever is.
  resetFields: () => ({
    status: "playing",
    currentRound: 0,
    rounds: [],
    winner: null,
    seq: 0,
    inbox: {},
    svPhase: "heist-select",
    board: null,
    keyDocId: null,
    activeTeam: null,
    currentClue: null,
    guessesRemaining: 0,
    guessesUsedThisTurn: 0,
    winningTeam: null,
    loseByBomb: false,
    bombRevealedBy: null,
    t1Score: 0,
    t2Score: 0,
    t1RevealCount: 0,
    t2RevealCount: 0,
    t1RevealedAssets: [],
    t2RevealedAssets: [],
  }),
});
