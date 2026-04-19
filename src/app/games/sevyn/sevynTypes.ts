/**
 * SEVYN — Types & Interfaces
 *
 * Core types for the SEVYN heist game. Card key assignments are
 * server-authoritative and never transmitted to operative clients.
 */

// ─── Heist Element Labels (fixed narrative roles) ──────────

export const HEIST_ELEMENT_LABELS = [
  "Intel",
  "Inside Man",
  "Cover Story",
  "Specialist",
  "Distraction",
  "Escape Route",
  "Payday",
] as const;

export type HeistElementLabel = (typeof HEIST_ELEMENT_LABELS)[number];

// ─── Heist Data (Firestore: sevynHeists/{id}) ──────────────

export interface SevynHeistSetting {
  location: string;
  era: string;
  atmosphere: string;
}

export interface SevynAsset {
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

export interface SevynCivilian {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
}

/** Standalone bomb entity in sevynBombs collection (used as templates for per-element bombs) */
export interface SevynBombEntity {
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

export interface SevynWordPool {
  tier1: string[];
  tier2: string[];
  tier3: string[];
}

export interface SevynHeist {
  id: string;
  title: string;
  briefing: string;
  backgroundImageUrl: string;
  targetObjectImageUrl: string;

  setting: SevynHeistSetting;

  assets: SevynAsset[]; // exactly 7 — each carries its own per-element bomb
  civilians: SevynCivilian[]; // exactly 5
  winMessage: string;
  words: SevynWordPool;

  // Metadata
  visibility: "official" | "private" | "shared";
  draft?: boolean;
  creatorId: string;
  creatorGamertag: string;
  createdAt: unknown; // Timestamp
  updatedAt: unknown; // Timestamp
}

// ─── Game Phases ────────────────────────────────────────────

export type SevynPhase =
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
export interface SevynBoardCard {
  index: number;
  word: string;
  revealed: boolean;
  /** Set after reveal — which type it was */
  revealedType?: CardType;
  /** Asset/civilian/bomb metadata, populated after reveal */
  revealedName?: string;
  revealedDescription?: string;
  revealedImageUrl?: string;
  /** For assets: which number this was (1-7) for the owning team */
  revealedAssetNumber?: number;
  /** For bombs: sound effect URL from the per-element bomb */
  revealedSoundEffect?: string;
}

// ─── Teams & Roles ──────────────────────────────────────────

export type SevynTeam = "syndicate1" | "syndicate2";

export interface SevynTeamRoster {
  /** UIDs of all team members (including boss) */
  members: string[];
  /** UID of the elected boss */
  bossUid: string | null;
}

// ─── Clue ───────────────────────────────────────────────────

export interface SevynClue {
  word: string;
  number: number;          // 1–7
  givenBy: string;         // boss UID
}

// ─── Tap / Cancel State ─────────────────────────────────────

export interface SevynPendingTap {
  /** Index of the tapped card (0–19) */
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

export interface SevynSessionState {
  svPhase: SevynPhase;

  // Heist selection
  selectedHeistId: string | null;
  selectedHeistTitle: string | null;
  selectedHeistBgUrl: string | null;
  selectedHeistTargetUrl: string | null;

  // Briefing data (populated at briefing phase)
  heistBriefing: string | null;
  heistSetting: SevynHeistSetting | null;
  // Teams
  teams: Record<SevynTeam, SevynTeamRoster> | null;
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
  board: SevynBoardCard[] | null;  // 20 cards, no color info for operatives

  // Turn state
  activeTeam: SevynTeam | null;
  currentClue: SevynClue | null;
  guessesRemaining: number;
  guessesUsedThisTurn: number;
  /** Bonus guess available (after using all clue-number guesses correctly) */
  bonusGuessAvailable: boolean;

  // Tap / cancel
  pendingTap: SevynPendingTap | null;

  // Score: how many assets each team has revealed
  t1Score: number;
  t2Score: number;
  t1RevealCount: number;
  t2RevealCount: number;

  // Asset reveal order per team (indexes into the heist.assets array)
  t1RevealedAssets: number[];
  t2RevealedAssets: number[];

  // Game result
  winningTeam: SevynTeam | null;
  loseByBomb: boolean;
  bombRevealedBy: string | null; // UID who tapped the bomb

  // Server key reference (doc ID in sevynKeys collection)
  keyDocId: string | null;
}

// ─── Server Key Document (sevynKeys/{id}) — ADMIN ONLY ─────

export interface SevynKeyDoc {
  sessionId: string;
  /** The secret assignment: key[i] maps to board[i] */
  key: CardType[];
  /** Sequential reveal counters — assets are revealed in story order, not pre-assigned */
  t1RevealCount: number; // 0–7, next asset index for red team
  t2RevealCount: number; // 0–7, next asset index for blue team
  /** Civilian assignments: which board index maps to which civilian */
  civilianAssignments: Record<number, number>; // boardIndex → heist.civilians index
  /** The bomb board index */
  bombIndex: number;
  createdAt: unknown; // Timestamp
}

// ─── Boss View (returned by API, never stored client-side) ──────

export interface SevynBossView {
  /** Color map: cardIndex → CardType for the boss's color-coded grid */
  colorMap: CardType[];
}

// ─── Card Reveal Result (returned by API on operative tap) ──

export interface SevynRevealResult {
  cardIndex: number;
  cardType: CardType;
  /** Asset/civilian/bomb metadata */
  name: string;
  description: string;
  imageUrl: string;
  /** For assets: which number (1–7) for the owning team */
  assetNumber?: number;
  /** For bombs: per-element sound effect URL */
  bombSoundEffect?: string;
}
