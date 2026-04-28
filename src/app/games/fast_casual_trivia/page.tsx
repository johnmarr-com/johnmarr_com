"use client";

import { composeGame } from "../_gamecore";
import type { GC3Props } from "../_gamecore/registry/types";
import { FastCasualTriviaStubGame } from "./FastCasualTriviaStubGame";

const ENGINE_SLUG = "fast_casual_trivia";

function FastCasualTriviaAdapter({ sessionId, gameData, onGameEnd }: GC3Props) {
  return (
    <FastCasualTriviaStubGame sessionId={sessionId} gameData={gameData} onGameEnd={onGameEnd} />
  );
}

export default composeGame({
  slug: ENGINE_SLUG,
  contentSlugFromQueryParam: "game",
  GameComponent: FastCasualTriviaAdapter,
  /** Host cannot start a round until the trivia engine is implemented. */
  lobbyCanStart: () => false,
  resetFields: () => ({}),
  multiplayerFlowMode: "party",
  allowAI: true,
});
