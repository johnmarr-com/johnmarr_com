/**
 * JohnMarr.com Content Type Definitions
 * 
 * Content Architecture:
 * - JMContent: Individual content items (shows, stories, cards, games)
 * - JMExperience: Curated rows of content for homepage display
 * 
 * Hierarchy Examples:
 * - Shows: Series → Season → Episode (3 levels)
 * - Stories: Novel → Part → Chapter (3 levels) or Novel → Chapter (2 levels)
 * - Cards: Pack → Card (2 levels) or Single Card (standalone)
 * - Games: Collection → Game (2 levels) or Single Game (standalone)
 */

import type { Timestamp } from "firebase/firestore";

// ─────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────

/**
 * Types of content available on the platform
 */
export type JMContentType = "show" | "story" | "card" | "game";

/**
 * Days of the week for recurring release schedules
 */
export type JMReleaseDay = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

/**
 * Release day display labels
 */
export const JMReleaseDayLabels: Record<JMReleaseDay, string> = {
  sunday: "Sundays",
  monday: "Mondays",
  tuesday: "Tuesdays",
  wednesday: "Wednesdays",
  thursday: "Thursdays",
  friday: "Fridays",
  saturday: "Saturdays",
};

/**
 * Content type display labels (for UI)
 */
export const JMContentTypeLabels: Record<JMContentType, string> = {
  show: "Show",
  story: "Story",
  card: "Card",
  game: "Game",
};

/**
 * Content type plural labels (for UI)
 */
export const JMContentTypePluralLabels: Record<JMContentType, string> = {
  show: "Shows",
  story: "Stories",
  card: "Cards",
  game: "Games",
};

/**
 * What level in the content hierarchy is this item?
 * 
 * - series: Top-level container (TV show, novel, card pack, game collection)
 * - season: Optional grouping within a series (Season 1, Book Part 1)
 * - episode: Individual playable/viewable item (episode, chapter, single card)
 * - standalone: No nesting - plays/views directly (movie, single greeting card)
 */
export type JMContentLevel = "series" | "season" | "episode" | "standalone";

/**
 * Content level display labels (for UI)
 */
export const JMContentLevelLabels: Record<JMContentLevel, string> = {
  series: "Series",
  season: "Season",
  episode: "Episode",
  standalone: "Standalone",
};

/**
 * Context-specific labels based on content type + level
 */
export const getContentLevelLabel = (
  contentType: JMContentType,
  level: JMContentLevel
): string => {
  const labels: Record<JMContentType, Partial<Record<JMContentLevel, string>>> = {
    show: {
      series: "Series",
      season: "Season",
      episode: "Episode",
      standalone: "Movie/Special",
    },
    story: {
      series: "Novel",
      season: "Part",
      episode: "Chapter",
      standalone: "Short Story",
    },
    card: {
      series: "Card Pack",
      season: "Category",
      episode: "Card",
      standalone: "Single Card",
    },
    game: {
      series: "Game Collection",
      season: "Category",
      episode: "Game",
      standalone: "Game",
    },
  };
  
  return labels[contentType][level] || JMContentLevelLabels[level];
};

// ─────────────────────────────────────────────────────────────
// JMCONTENT - The core content item
// ─────────────────────────────────────────────────────────────

/**
 * Core content item - can represent any level of content hierarchy
 * Stored in Firestore: /content/{contentId}
 */
export interface JMContent {
  id: string;
  contentType: JMContentType;
  contentLevel: JMContentLevel;
  
  // ─── Basic Metadata ───────────────────────────────────────
  name: string;
  description: string;
  creatorId: string;              // User UID of creator
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // ─── Artwork ──────────────────────────────────────────────
  coverURL: string;               // 1:1 square (for scroller tiles)
  backdropURL?: string;           // 16:9 landscape (for detail pages)
  
  // ─── Hierarchy & Ordering ─────────────────────────────────
  parentId: string | null;        // null = top-level content
  order: number;                  // Position within parent/experience
  seasonNumber?: number;          // For seasons: 1, 2, 3...
  episodeNumber?: number;         // For episodes: 1, 2, 3...
  
  // ─── Playback (for episodes/standalones) ──────────────────
  mediaURL?: string;              // Firebase Storage URL to actual content
  duration?: number;              // Seconds (for video/audio)
  
  // ─── Discovery ────────────────────────────────────────────
  tags?: string[];                // ["comedy", "animated", "family"]
  releaseDate?: Timestamp;        // When episode streams (free tier: 1 week ahead)
  releaseDay?: JMReleaseDay;      // For series: recurring release day (e.g., "monday")
  
  // ─── Status ───────────────────────────────────────────────
  isPublished: boolean;           // Draft vs live
}

/**
 * Input type for creating new content (omits server-generated fields)
 */
export interface JMContentInput {
  contentType: JMContentType;
  contentLevel: JMContentLevel;
  name: string;
  description: string;
  coverURL: string;
  backdropURL?: string;
  parentId?: string | null;
  order?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  mediaURL?: string;
  duration?: number;
  tags?: string[];
  releaseDate?: Timestamp;
  releaseDay?: JMReleaseDay;
  isPublished?: boolean;
}

/**
 * Input type for updating existing content (all fields optional)
 */
export type JMContentUpdate = Partial<Omit<JMContent, "id" | "creatorId" | "createdAt">>;

// ─────────────────────────────────────────────────────────────
// JMEXPERIENCE - A curated row of content for the home page
// ─────────────────────────────────────────────────────────────

/**
 * A curated collection of content displayed as a horizontal scroller row
 * Stored in Firestore: /experiences/{experienceId}
 */
export interface JMExperience {
  id: string;
  title: string;                  // Row title: "Trending Shows", "New Stories"
  description?: string;           // Optional subtitle or description
  creatorId: string;              // User UID of creator
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // ─── Content Configuration ────────────────────────────────
  contentType?: JMContentType;    // Optional: filter row to one type
  contentIds: string[];           // Ordered array of JMContent IDs
                                  // Should only reference series/standalone content
  
  // ─── Display ──────────────────────────────────────────────
  order: number;                  // Position on homepage (lower = higher)
  isPublished: boolean;           // Draft vs live
}

/**
 * Input type for creating new experiences (omits server-generated fields)
 */
export interface JMExperienceInput {
  title: string;
  description?: string;
  contentType?: JMContentType;
  contentIds?: string[];
  order?: number;
  isPublished?: boolean;
}

/**
 * Input type for updating existing experiences (all fields optional)
 */
export type JMExperienceUpdate = Partial<Omit<JMExperience, "id" | "creatorId" | "createdAt">>;

// ─────────────────────────────────────────────────────────────
// HELPER TYPES
// ─────────────────────────────────────────────────────────────

/**
 * Content with resolved children (for UI display)
 * Used when fetching a series with all its seasons/episodes
 */
export interface JMContentWithChildren extends JMContent {
  children?: JMContentWithChildren[];
}

/**
 * Experience with resolved content items (for UI display)
 * Used when fetching an experience row with all its content
 */
export interface JMExperienceWithContent extends JMExperience {
  content: JMContent[];
}

/**
 * Counts of content by type (for admin dashboard)
 */
export interface JMContentCounts {
  shows: number;
  stories: number;
  cards: number;
  games: number;
  total: number;
}

// ─────────────────────────────────────────────────────────────
// VALIDATION HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Check if a content level can have children
 */
export const canHaveChildren = (level: JMContentLevel): boolean => {
  return level === "series" || level === "season";
};

/**
 * Check if a content level can be played directly
 */
export const isPlayable = (level: JMContentLevel): boolean => {
  return level === "episode" || level === "standalone";
};

/**
 * Get valid child levels for a given content level
 */
export const getValidChildLevels = (level: JMContentLevel): JMContentLevel[] => {
  switch (level) {
    case "series":
      return ["season", "episode"]; // Can have seasons OR episodes directly
    case "season":
      return ["episode"];
    case "episode":
    case "standalone":
      return []; // No children
  }
};

/**
 * Validate that a child level is valid for a parent level
 */
export const isValidChildLevel = (
  parentLevel: JMContentLevel,
  childLevel: JMContentLevel
): boolean => {
  return getValidChildLevels(parentLevel).includes(childLevel);
};

// ─────────────────────────────────────────────────────────────
// ALERT TYPES
// ─────────────────────────────────────────────────────────────

/**
 * Alert for displaying site-wide notifications
 * Only one alert can be published at a time
 */
export interface JMAlert {
  id: string;
  text: string;
  isPublished: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Input for creating a new alert
 */
export interface JMAlertInput {
  text: string;
}

/**
 * Input for updating an alert
 */
export interface JMAlertUpdate {
  text?: string;
  isPublished?: boolean;
}
