"use client";

import { composeGame } from "../_gamecore";
import BullshiitakeGame from "./BullshiitakeGame";
import BullshiitakeCreatePacksButton from "./BullshiitakeCreatePacksButton";

export default composeGame({
  slug: "bullshiitake",
  GameComponent: BullshiitakeGame,
  // Group game: no AI players (site-wide policy for group games).
  allowAI: false,
  multiplayerFlowMode: "party",
  landingExtra: <BullshiitakeCreatePacksButton />,
  // Host-presented viewer game — deliberately NO engineKey: the host IS the
  // presenter and writes presentation state directly (legacy owner-writes
  // regime); there is no scoring, no timers, and no game end to referee.
  resetFields: () => ({
    bsPhase: "setup",
    bsItem: null,
    bsRevealed: false,
    bsPackId: null,
    bsSeenIds: [],
  }),
});
