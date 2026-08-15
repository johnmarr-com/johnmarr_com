"use client";

import { composeGame } from "../_gamecore";
import AZVGame from "./AZVGame";
import AZVCreatePacksButton from "./AZVCreatePacksButton";

export default composeGame({
  slug: "azv",
  GameComponent: AZVGame,
  // Group game: no AI players (site-wide policy for group games).
  allowAI: false,
  multiplayerFlowMode: "party",
  landingExtra: <AZVCreatePacksButton />,
  // Game experience is still a placeholder — no session state to reset yet.
  resetFields: () => ({}),
});
