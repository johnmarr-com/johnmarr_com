"use client";

import { composeGame } from "../_gamecore";
import type { GC3Props } from "../_gamecore/registry/types";
import type { GameSession } from "@/lib/game-sessions";
import MegaSketchyGame from "./MegaSketchyGame";
import MegaSketchyCreateMissionButton from "./MegaSketchyCreateMissionButton";

/** MegaSketchy needs at least 4 players for the drawing chains to work. The
 * pre-factory page hard-coded this floor (multiplayerMinPlayers={4}); enforce
 * it here so it holds even if the CMS minPlayers field is unset. */
const MIN_PLAYERS = 4;

// MegaSketchy is a custom-flow PARTY game (drawing chains → mad libs → reveal →
// scoring → voting → done → share) with its own multi-phase endgame and its own
// Play Again, so it does NOT use the factory result screen (GC4) — the adapter
// omits onGameEnd, MegaSketchyGame stays mounted in GC3 and owns the endgame.
// The factory provides the shared splash / host-join / lobby. No AI: AI players
// were removed by design (the LLM only judges Mad Libs + scoring).
function MegaSketchyAdapter({ sessionId, gameData }: GC3Props) {
  return (
    <MegaSketchyGame
      sessionId={sessionId}
      gameSlug="megasketchy"
      {...(gameData.splashBgURL ? { splashBgURL: gameData.splashBgURL } : {})}
      {...(gameData.splashLogoURL ? { splashLogoURL: gameData.splashLogoURL } : {})}
      {...(gameData.backgroundMusicURL ? { backgroundMusicURL: gameData.backgroundMusicURL } : {})}
      {...(gameData.backgroundMusicVolume != null
        ? { backgroundMusicVolume: gameData.backgroundMusicVolume }
        : {})}
      {...(gameData.bgMusicLandingOnly != null
        ? { bgMusicLandingOnly: gameData.bgMusicLandingOnly }
        : {})}
    />
  );
}

export default composeGame({
  slug: "megasketchy",
  GameComponent: MegaSketchyAdapter,
  multiplayerFlowMode: "party",
  // Server-authoritative: the gameEngine reducer owns the live game (chain
  // seeding + the draw/guess loop with a 60s hourglass + auto-skip + all phase
  // transitions), and the LLM judge/scoring run as post-commit engine effects.
  authority: { engineKey: "megasketchy" },
  landingExtra: <MegaSketchyCreateMissionButton />,
  lobbyCanStart: ({ session }: { session: GameSession }) =>
    (session.players?.length ?? 0) >= MIN_PLAYERS,
  // MegaSketchy runs its own rematch via the route (play-again → lobby → engine
  // re-shuffles → briefing), so GC5 is never reached. This satisfies composeGame
  // + the value-checked engineKey reset rule for a clean start shape if it ever is.
  resetFields: () => ({
    status: "playing",
    currentRound: 0,
    rounds: [],
    winner: null,
    seq: 0,
    inbox: {},
    skPhase: "lobby",
    playOrder: [],
    message: null,
    chains: {},
    chainDeadlines: {},
    gameMode: "basic",
    moleId: null,
    eliminatedPlayers: [],
    missionNumber: 0,
    votes: {},
    elementMatches: null,
    scoringResult: null,
    phaseDeadlineAt: 0,
  }),
});
