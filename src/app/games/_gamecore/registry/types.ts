/**
 * GameCore Registry Types
 *
 * Defines the slot interfaces, variant metadata, and shared types
 * that power the swappable phase component system.
 */

import type { ComponentType, ReactNode } from "react";
import type { JMContent } from "@/lib/content-types";
import type { GameSession, GameSessionPlayer } from "@/lib/game-sessions";
import type { AIPersona } from "../aiPersonas";

// ─────────────────────────────────────────────────────────────
// PHASE SLOTS
// ─────────────────────────────────────────────────────────────

/** The five configurable phase slots (GC3 is always custom per game). */
export type GCSlot = "gc0" | "gc1" | "gc2" | "gc4" | "gc5";

/** Human-readable labels for each slot. */
export const GC_SLOT_LABELS: Record<GCSlot | "gc3", string> = {
  gc0: "Landing",
  gc1: "Gate",
  gc2: "Lobby",
  gc3: "Game",
  gc4: "Result",
  gc5: "Replay",
};

// ─────────────────────────────────────────────────────────────
// VARIANT METADATA
// ─────────────────────────────────────────────────────────────

/** Metadata describing a registered variant (used by the admin GUI). */
export interface VariantMeta {
  /** Unique ID within its slot, e.g. "splash-cinematic". */
  id: string;
  /** Which phase slot this variant belongs to. */
  slot: GCSlot;
  /** Short display label, e.g. "Cinematic Splash". */
  label: string;
  /** One-line description for the admin picker. */
  description: string;
  /** Optional preview image URL for the admin GUI. */
  thumbnail?: string;
}

/** A registered variant: metadata + the React component. */
export interface VariantEntry<P = unknown> extends VariantMeta {
  component: ComponentType<P>;
}

// ─────────────────────────────────────────────────────────────
// ASSEMBLY CONFIG (stored on JMContent)
// ─────────────────────────────────────────────────────────────

/** Per-slot selection: which variant ID to use. */
export interface SlotSelection {
  variantId: string;
}

/** Full assembly config stored on a game's JMContent document. */
export interface GameAssembly {
  gc0: SlotSelection;
  gc1: SlotSelection;
  gc2: SlotSelection;
  gc4: SlotSelection;
  gc5: SlotSelection;
}

// ─────────────────────────────────────────────────────────────
// GAME END RESULT (passed from GC3 → GC4)
// ─────────────────────────────────────────────────────────────

/** Data the game component passes when gameplay ends. */
export interface GameEndResult {
  /** Winning player(s). */
  winners: GameSessionPlayer[];
  /** Winner score (all winners share the same top score). */
  winnerPoints: number;
  /** All players who participated. */
  allPlayers: GameSessionPlayer[];
  /** Final scores keyed by UID. */
  scores: Record<string, number>;
}

// ─────────────────────────────────────────────────────────────
// SLOT PROP INTERFACES
// ─────────────────────────────────────────────────────────────

/** GC0: Landing — splash screen with branding and a "Play" button. */
export interface GC0Props {
  gameData: JMContent;
  onPlay: () => void;
  onSoloPlay?: () => void;
  onSoloVsAI?: (persona: AIPersona) => void;
}

/** GC1: Gate — mode selection (Solo / Host / Join). */
export interface GC1Props {
  gameData: JMContent;
  onHost: (sessionId: string) => void;
  onJoin: (sessionId: string) => void;
  onSolo?: () => void;
  onSoloVsAI?: (persona: AIPersona) => void;
}

/** GC2: Lobby — host configures, players wait. */
export interface GC2Props {
  gameData: JMContent;
  session: GameSession;
  isHost: boolean;
  lobbyExtra?: ReactNode | ((ctx: { session: GameSession }) => ReactNode);
  lobbyCanStart?: (ctx: { session: GameSession }) => boolean;
  onGameStart: (sessionId: string) => void;
}

/** GC3: Game — custom per game (no registry variant). */
export interface GC3Props {
  sessionId: string;
  gameData: JMContent;
  onGameEnd: (result: GameEndResult) => void;
}

/** Per-game overrides for the GC4 result screen. */
export interface GC4ResultOptions {
  /** Tailwind `right-*` class for the logo position (default: "right-[-8px]"). */
  logoRight?: string;
  /** Hide the points subtitle on winner cards and the leaderboard section. */
  hideScores?: boolean;
  /** Resume the game's background music on the result screen. */
  playMusic?: boolean;
  /** Show a "View {AI}'s Post-Game Comments" button if the session has any
   * AI-authored comments at `session.aiPostGameComments[aiUid]`. */
  showAIPostGameComments?: boolean;
}

/** GC4: Result — win/lose screen after gameplay ends. */
export interface GC4Props {
  gameData: JMContent;
  session: GameSession;
  result: GameEndResult;
  isHost: boolean;
  onPlayAgain: () => void;
  onExit: () => void;
  resultOptions?: GC4ResultOptions;
}

/** GC5: Replay — quick reconfig before starting again. */
export interface GC5Props {
  gameData: JMContent;
  session: GameSession;
  isHost: boolean;
  lobbyExtra?: ReactNode | ((ctx: { session: GameSession }) => ReactNode);
  onRestart: (sessionId: string) => void;
  onExit: () => void;
}

// ─────────────────────────────────────────────────────────────
// COMPOSE GAME INPUT
// ─────────────────────────────────────────────────────────────

/** How engine routes resolve the skin (JMContent) document. */
export type EngineSkinLoadError =
  | "missing_game_param"
  | "game_not_found"
  | "game_wrong_engine";

/** Config passed to `composeGame()` to assemble a game page. */
export interface ComposeGameInput {
  /**
   * Default / engine route slug. Used to load CMS when `contentSlugFromQueryParam`
   * is not set. When using a query param skin, this is a fallback for labels only;
   * session metadata uses the loaded game’s `slug` / `id`.
   */
  slug: string;
  /**
   * When set, game content is loaded with `getContentBySlug("game", searchParams.get(name))`
   * instead of `slug`. The query value must match the **published** game document’s
   * `slug` in Firestore (not necessarily the same as the document id).
   */
  contentSlugFromQueryParam?: string;
  /** The custom GC3 game component. */
  GameComponent: ComponentType<GC3Props>;
  /** Extra UI injected into the host lobby (pack picker, game length, etc.). */
  lobbyExtra?: GC2Props["lobbyExtra"];
  /** Additional condition for enabling the "Start Game" button. */
  lobbyCanStart?: (ctx: { session: GameSession }) => boolean;
  /** Firestore fields to reset when the host clicks "Play Again". */
  resetFields: (session: GameSession) => Record<string, unknown>;
  /** Allow AI players in the lobby. */
  allowAI?: boolean;
  /** Pulse the splash icon in scale on the landing page. */
  pulseIcon?: boolean;
  /** Rock the splash icon left/right on the landing page. */
  rockIcon?: boolean;
  /** "versus" = 2-player with sides. "party" = N-player (default). */
  multiplayerFlowMode?: "versus" | "party";
  /** Side labels for versus mode (e.g. ["Red", "Blue"]). */
  sideLabels?: [string, string];
  /** Per-game overrides for the GC4 result screen. */
  resultOptions?: GC4ResultOptions;
}

// ─────────────────────────────────────────────────────────────
// OUTER PHASE (managed by useGameFlow)
// ─────────────────────────────────────────────────────────────

/** Outer phase state machine — which GC# is currently active. */
export type GameFlowPhase =
  | "landing"   // GC0
  | "gate"      // GC1
  | "lobby"     // GC2
  | "game"      // GC3
  | "result"    // GC4
  | "replay";   // GC5
