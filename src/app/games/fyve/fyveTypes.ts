/**
 * FYVE — Types & Interfaces
 *
 * Core types for the FYVE heist game. Card key assignments are
 * server-authoritative and never transmitted to operative clients.
 */

// ─── Heist Element Labels (fixed narrative roles) ──────────

export const HEIST_ELEMENT_LABELS = [
  "Intel",
  "Insider",
  "Distract",
  "Escape",
  "Payday",
] as const;

export type HeistElementLabel = (typeof HEIST_ELEMENT_LABELS)[number];

// ─── Heist Data (Firestore: fyveHeists/{id}) ──────────────

export interface FyveHeistSetting {
  location: string;
  era: string;
  atmosphere: string;
}

export interface FyveAsset {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  /** Per-element bomb: narrative description of what went wrong */
  bombDescription: string;
  /** Per-element bomb: failure image URL */
  bombImageUrl: string;
  /** Per-element bomb: failure sound effect URL */
  bombSoundEffect: string;
}

export interface FyveCivilian {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
}

/** Standalone bomb entity in fyveBombs collection (used as templates for per-element bombs) */
export interface FyveBombEntity {
  id: string;
  name: string;
  imageUrl: string;
  audioUrl: string;
  visibility: "official" | "private" | "shared";
  creatorId: string;
  creatorGamertag: string;
  createdAt: unknown; // Timestamp
  updatedAt: unknown; // Timestamp
}

export interface FyveWordPool {
  tier1: string[];
  tier2: string[];
  tier3: string[];
}

export interface FyveHeist {
  id: string;
  title: string;
  briefing: string;
  backgroundImageUrl: string;
  targetObjectImageUrl: string;

  setting: FyveHeistSetting;

  assets: FyveAsset[]; // exactly 5 — each carries its own per-element bomb
  civilians: FyveCivilian[]; // exactly 5
  winMessage: string;
  words: FyveWordPool;

  // Metadata
  visibility: "official" | "private" | "shared";
  draft?: boolean;
  creatorId: string;
  creatorGamertag: string;
  createdAt: unknown; // Timestamp
  updatedAt: unknown; // Timestamp
}

// ─── Game Phases ────────────────────────────────────────────

export type FyvePhase =
  | "heist-select"
  | "briefing"
  | "team-formation"
  | "boss-select"
  | "game-start"       // coin flip animation
  | "boss-clue"        // active boss submitting clue
  | "operative-guess"  // active team guessing
  | "card-reveal"      // reveal animation in progress
  | "turn-switch"      // switching active team
  | "game-over";       // win/loss screen

// ─── Card Types ─────────────────────────────────────────────

/** Card assignment type — only exists server-side in the key */
export type CardType = "T1" | "T2" | "N" | "BOMB";

/** A single board card as seen by clients */
export interface FyveBoardCard {
  index: number;
  word: string;
  revealed: boolean;
  /** Set after reveal — which type it was */
  revealedType?: CardType;
  /** Asset/civilian/bomb metadata, populated after reveal */
  revealedName?: string;
  revealedDescription?: string;
  revealedImageUrl?: string;
  /** For assets: which number this was (1-5) for the owning team */
  revealedAssetNumber?: number;
  /** For bombs: sound effect URL from the per-element bomb */
  revealedSoundEffect?: string;
}

// ─── Teams & Roles ──────────────────────────────────────────

export type FyveTeam = "syndicate1" | "syndicate2";

export interface FyveTeamRoster {
  /** UIDs of all team members (including boss) */
  members: string[];
  /** UID of the elected boss */
  bossUid: string | null;
}

// ─── Clue ───────────────────────────────────────────────────

export interface FyveClue {
  word: string;
  number: number;          // 1–5
  givenBy: string;         // boss UID
}

// ─── Tap / Cancel State ─────────────────────────────────────

export interface FyvePendingTap {
  /** Index of the tapped card (0–15) */
  cardIndex: number;
  /** UID of the operative who tapped */
  tappedBy: string;
  /** Gamertag for display */
  tappedByGamertag: string;
  /** Server timestamp when the tap was confirmed (for 3s countdown) */
  confirmedAt: number;    // Date.now() millis
  /** Set to true if any teammate cancels */
  cancelled?: boolean;
}

// ─── Session State (extra fields on gameSessions doc) ───────

export interface FyveSessionState {
  svPhase: FyvePhase;

  // Heist selection
  selectedHeistId: string | null;
  selectedHeistTitle: string | null;
  selectedHeistBgUrl: string | null;
  selectedHeistTargetUrl: string | null;

  // Briefing data (populated at briefing phase)
  heistBriefing: string | null;
  heistSetting: FyveHeistSetting | null;
  // Teams
  teams: Record<FyveTeam, FyveTeamRoster> | null;
  /** Display names like "Wolves", "Hawks" — color comes from UI tinting */
  t1Name: string | null;
  t2Name: string | null;

  // Draft team formation (live sync while host picks)
  draftTeam1: string[] | null;
  draftTeam2: string[] | null;
  draftT1Logo: string | null;
  draftT2Logo: string | null;

  // (boss selection is host-only — no votes field needed)

  // Board
  board: FyveBoardCard[] | null;  // 16 cards, no color info for operatives

  // Turn state
  activeTeam: FyveTeam | null;
  currentClue: FyveClue | null;
  guessesRemaining: number;
  guessesUsedThisTurn: number;
  /** Bonus guess available (after using all clue-number guesses correctly) */
  bonusGuessAvailable: boolean;

  // Tap / cancel
  pendingTap: FyvePendingTap | null;

  // Score: how many assets each team has revealed
  t1Score: number;
  t2Score: number;
  t1RevealCount: number;
  t2RevealCount: number;

  // Asset reveal order per team (indexes into the heist.assets array)
  t1RevealedAssets: number[];
  t2RevealedAssets: number[];

  // Game result
  winningTeam: FyveTeam | null;
  loseByBomb: boolean;
  bombRevealedBy: string | null; // UID who tapped the bomb

  // Server key reference (doc ID in fyveKeys collection)
  keyDocId: string | null;
}

// ─── Server Key Document (fyveKeys/{id}) — ADMIN ONLY ─────

export interface FyveKeyDoc {
  sessionId: string;
  /** The secret assignment: key[i] maps to board[i] */
  key: CardType[];
  /** Sequential reveal counters — assets are revealed in story order, not pre-assigned */
  t1RevealCount: number; // 0–5, next asset index for red team
  t2RevealCount: number; // 0–5, next asset index for blue team
  /** Civilian assignments: which board index maps to which civilian */
  civilianAssignments: Record<number, number>; // boardIndex → heist.civilians index
  /** The bomb board index */
  bombIndex: number;
  createdAt: unknown; // Timestamp
}

// ─── Boss View (returned by API, never stored client-side) ──────

export interface FyveBossView {
  /** Color map: cardIndex → CardType for the boss's color-coded grid */
  colorMap: CardType[];
}

// ─── Card Reveal Result (returned by API on operative tap) ──

export interface FyveRevealResult {
  cardIndex: number;
  cardType: CardType;
  /** Asset/civilian/bomb metadata */
  name: string;
  description: string;
  imageUrl: string;
  /** For assets: which number (1–5) for the owning team */
  assetNumber?: number;
  /** For bombs: per-element sound effect URL */
  bombSoundEffect?: string;
}
