/**
 * Types for the Fast Casual Trivia engine. All session fields are stored
 * on the GameSession Firestore doc with the `fct` prefix.
 */

import type { GameSession } from "@/lib/game-sessions";

/** Sub-phase within GC3 (the game body). */
export type FctPhase =
  | "mode_select"
  | "team_selector"
  | "team_leads_assign"
  | "board";

/** How the room is playing — drives team setup + leaderboard mode. */
export type FctMode = "single" | "full_team" | "team_leads";

/** Team color from the Phase 1 spec roster. */
export interface FctTeamColor {
  name: string;
  hex: string;
}

export const FCT_TEAM_COLORS: FctTeamColor[] = [
  { name: "Red", hex: "#E53E3E" },
  { name: "Blue", hex: "#3182CE" },
  { name: "Green", hex: "#38A169" },
  { name: "Orange", hex: "#DD6B20" },
  { name: "Purple", hex: "#805AD5" },
  { name: "Pink", hex: "#D53F8C" },
  { name: "Yellow", hex: "#D69E2E" },
  { name: "White", hex: "#E2E8F0" },
  { name: "Black", hex: "#1A202C" },
  { name: "Teal", hex: "#319795" },
];

/** A team built either via the Team Selector (full_team) or Team Leads Assignment. */
export interface FctTeam {
  id: string;
  name: string;
  colorName: string;
  colorHex: string;
  /** Logo identifier — resolved to imagery via the team logo system. */
  logoId: string;
  /** For team_leads mode: the player who owns the team device. */
  leadPlayerId?: string;
  /** Player UIDs assigned to this team (full_team mode). */
  memberPlayerIds: string[];
}

/** Live derived state, read from the session doc. */
export interface FctState {
  session: GameSession | null;
  phase: FctPhase;
  mode: FctMode | null;
  teamCount: number;
  teams: FctTeam[];
  /** Active game skin (currentGameId in the spec). */
  skinId: string;
  /** Tag filter — empty array means "all on" (default). */
  activeTags: string[];
  /** Per-player or per-team scores (keyed by uid or teamId). */
  scores: Record<string, number>;
  isHost: boolean;
}

/** Default state used when a session doc is missing the fct fields. */
export const FCT_DEFAULT_PHASE: FctPhase = "mode_select";
export const FCT_DEFAULT_TEAM_COUNT = 2;

// ─── Color helpers ─────────────────────────────────────────

/**
 * Returns a high-contrast text color (dark or light) for any background hex.
 * Uses relative luminance — if the background reads bright, return dark text.
 */
export function contrastTextColor(
  bgHex: string,
  dark = "#0a0a0a",
  light = "#ffffff",
): string {
  if (!bgHex || bgHex.length < 7 || !bgHex.startsWith("#")) return light;
  const r = Number.parseInt(bgHex.slice(1, 3), 16);
  const g = Number.parseInt(bgHex.slice(3, 5), 16);
  const b = Number.parseInt(bgHex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? dark : light;
}
