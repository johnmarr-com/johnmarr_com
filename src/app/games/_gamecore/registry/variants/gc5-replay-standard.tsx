"use client";

/**
 * GC5 Variant: Standard Replay
 *
 * Host-only "Play Again" trigger that resets session fields and
 * re-enters the lobby or game. For V1, the replay behavior is
 * handled by the GC4 result screen's onPlayAgain callback wired
 * through composeGame — this registration provides metadata for
 * the admin GUI.
 */

import { registerVariant } from "../registry";
import type { GC5Props } from "../types";

function GC5ReplayStandard(_props: GC5Props) { // eslint-disable-line @typescript-eslint/no-unused-vars -- required by registerVariant interface
  // Replay behavior is handled by composeGame:
  // 1. Calls config.resetFields(session) to get the field map
  // 2. Writes those fields to Firestore via updateSessionFields
  // 3. Transitions phase back to "game" (same players, fresh state)
  return null;
}

registerVariant({
  id: "replay-standard",
  slot: "gc5",
  label: "Standard Replay",
  description: "Host resets the game and plays again with the same group.",
  component: GC5ReplayStandard,
});

export default GC5ReplayStandard;
