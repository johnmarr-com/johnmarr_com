"use client";

/**
 * GC1 Variant: Modal Gate
 *
 * Solo / Host / Join mode selection in a dialog.
 * For V1, the actual rendering is handled by GameMultiplayerFlow
 * inside composeGame — this registration provides metadata for the admin GUI.
 */

import { registerVariant } from "../registry";
import type { GC1Props } from "../types";

function GC1GateModal(_props: GC1Props) {
  // Rendering handled by composeGame via GameMultiplayerFlow.
  // This component is a placeholder for direct-use scenarios.
  return null;
}

registerVariant({
  id: "gate-modal",
  slot: "gc1",
  label: "Modal Gate",
  description: "Solo / Host / Join selection in a dialog overlay.",
  component: GC1GateModal,
});

export default GC1GateModal;
