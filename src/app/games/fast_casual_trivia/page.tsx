"use client";

import { composeGame } from "../_gamecore";
import { FastCasualTriviaGame } from "./FastCasualTriviaGame";

const ENGINE_SLUG = "fast_casual_trivia";

export default composeGame({
  slug: ENGINE_SLUG,
  contentSlugFromQueryParam: "game",
  GameComponent: FastCasualTriviaGame,
  /** Phase 1 shell is live. Phase 2 will gate this on per-game readiness. */
  lobbyCanStart: () => true,
  resetFields: () => ({
    fctPhase: null,
    fctMode: null,
    fctTeamCount: null,
    fctTeams: null,
    fctActiveTags: null,
    fctScores: null,
  }),
  multiplayerFlowMode: "party",
  allowAI: true,
});
