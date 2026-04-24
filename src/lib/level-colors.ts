// Palette for user levels. Used anywhere we visually tint content by level
// (e.g. the AIPersonaGrid level cards). Canonical copy in USER-LEVELS.md.
//
// Not intended for Firestore — colors are a client-side visual concern, not
// stored per-document. Keep this in sync with USER-LEVELS.md when tuning.

export const LEVEL_COLOR_HEX: Record<number, string> = {
  1: "#a8aeb5", // Noob — light gray
  2: "#f3f4f6", // Explorer — white
  3: "#3e4a5e", // Enthusiast — gunmetal blue
  4: "#7b9068", // Adventurer — sage green
  5: "#3a1a1a", // ThrillSeeker — pale red / black
  6: "#d97706", // Wildling — fiery orange-yellow
  7: "#8b5cf6", // Champion — purple & white
  8: "#3a2c08", // Legend — gold & black
  9: "#2a5782", // Icon — pale yellow + flame blue
  10: "#0f0f0f", // Game Master — black
};

/**
 * Convert a hex color to an rgba() string at the given alpha.
 * Safely handles unknown levels → falls back to a soft white tint.
 */
export function levelBgStyle(
  level: number,
  alpha = 0.18,
): { backgroundColor: string } {
  const hex = LEVEL_COLOR_HEX[level] ?? "#ffffff";
  const clean = hex.replace("#", "");
  const n = parseInt(clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean,
    16,
  );
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return { backgroundColor: `rgba(${r}, ${g}, ${b}, ${alpha})` };
}
