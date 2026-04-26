/**
 * Shared types for the Fast Casual Trivia platform.
 *
 * The Content Research Agent populates `trivia-content`, `trivia-tags`,
 * and `trivia-agent-state` collections in Firestore. A downstream
 * Question Designer Agent (future) reads from `trivia-content` and
 * writes generated questions to Neon.
 */

export type TriviaGameId =
  | "nabster"
  | "outtakes"
  | "plated"
  | "extra_extra"
  | "pwn_stars"
  | "first_ed"
  | "geek_freak"
  | "ctrl_alt_defeat"
  | "paparazza"
  | "pop_wow"
  | "season_tix"
  | "where_in_the";

/**
 * A vertical can host multiple ranked lists (nabster → albums + songs;
 * outtakes → films, future: directors). listType scopes everything:
 * cache, agent state, content rank, dedup.
 */
export type TriviaListType = string;

export type TriviaCitation = {
  name: string;
  url: string;
  type: "primary" | "secondary";
};

export type TriviaContentTier = 1 | 2 | 3;

export type TriviaContentStatus = "indexed" | "ready";

/**
 * One researched subject (album, film, dish, event, etc.) that the
 * downstream Question Designer Agent will turn into trivia questions.
 */
export interface TriviaContentDoc {
  gameId: TriviaGameId;
  listType: TriviaListType;
  name: string;
  nameLower: string;
  /** Creator/artist/director/author. Display-friendly secondary text. */
  subtitle: string;
  /** Original year (release/publication). Optional — not all sources have it. */
  year?: number;
  /** Label/publisher/studio. Optional. */
  provider?: string;
  /** Genre/category surfaced by source. Optional. */
  genre?: string;
  popularityRank: number;
  tier: TriviaContentTier;
  sourceDb: string;
  sourceId: string | null;
  sourceUrl: string | null;
  citations: TriviaCitation[];
  tags: Record<string, string>;
  crossTags: Record<string, string> | null;
  sourcePageIndex: number;
  status: TriviaContentStatus;
  // createdAt / updatedAt are server timestamps written by the API.
}

export interface TriviaTagDoc {
  category: string;
  value: string;
  count: number;
  gameIds: TriviaGameId[];
  listTypes?: TriviaListType[];
}

export type TriviaAgentStatus = "idle" | "running" | "paused" | "complete";

export interface TriviaAgentStateDoc {
  gameId: TriviaGameId;
  listType: TriviaListType;
  sourceUrl: string | null;
  lastPageIndex: number;
  totalFound: number;
  status: TriviaAgentStatus;
  error: string | null;
}

/**
 * Shape returned to the client per /api/admin/trivia-research call.
 * One call processes one batch.
 */
export interface TriviaResearchBatchResult {
  gameId: TriviaGameId;
  listType: TriviaListType;
  added: number;
  skipped: number;
  totalFound: number;
  lastPageIndex: number;
  status: TriviaAgentStatus;
  done: boolean;
  log: TriviaActivityEntry[];
}

export interface TriviaActivityEntry {
  type: "info" | "found" | "skipped" | "error" | "complete";
  message: string;
  rank?: number;
  tags?: Record<string, string>;
  citations?: number;
}

/**
 * Canonical normalized item shape. Claude reads any source JSON and
 * maps onto this; everything downstream consumes this shape uniformly,
 * regardless of source layout.
 */
export interface TriviaSourceItem {
  rank: number;
  name: string;
  creator?: string;
  year?: number;
  provider?: string;
  genre?: string;
  /** Optional canonical reference URL surfaced by the source (Wikipedia, etc.) */
  citationUrl?: string;
}

/**
 * Cached parsed source list per (gameId, sourceUrl). One discovery fetch
 * per vertical-source combo; reused across every enrichment batch.
 */
export interface TriviaSourceCacheDoc {
  gameId: TriviaGameId;
  listType: TriviaListType;
  sourceUrl: string;
  loaderId: string;
  items: TriviaSourceItem[];
  // fetchedAt set as server timestamp by the API.
}

/**
 * Target subject count per vertical. The agent stops at this number.
 */
export const TRIVIA_TARGET_COUNT = 500;
