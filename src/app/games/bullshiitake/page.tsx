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
  // NOTE: no `authority: { engineKey: … }` yet — the server reducer ships
  // with the real game build. Until then GC3 renders a "Pending" placeholder
  // and the session only carries the `bs`-prefixed setup phase below.
  resetFields: () => ({ bsPhase: "setup" }),
});
