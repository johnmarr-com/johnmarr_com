import type React from "react";

/**
 * Game Length Presets — reusable mechanism for round-limiter selection.
 *
 * Each game defines its own presets (name, rounds, estimated time).
 * The _gamecore layer provides only the shared type and a tiny helper;
 * the UI lives in JMKit so it can be reused across games.
 */

export interface GameLengthPreset {
  /** Unique key for this preset (e.g. "quick", "standard", "marathon") */
  key: string;
  /** Display label (e.g. "Quick") */
  label: string;
  /** Number of rounds for this preset */
  rounds: number;
  /** Estimated game duration in minutes */
  estimatedMinutes: number;
  /** Optional Lucide icon component */
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  /** Optional icon color (CSS color string) */
  iconColor?: string;
}

/** Find a preset by key, falling back to the first preset in the array. */
export function resolvePreset(
  presets: readonly GameLengthPreset[],
  key: string | null | undefined,
): GameLengthPreset | undefined {
  if (!key) return presets[0];
  return presets.find((p) => p.key === key) ?? presets[0];
}
