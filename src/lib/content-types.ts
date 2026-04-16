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
export type JMContentType = "show" | "story" | "card" | "game" | "artist";

/**
 * Days of the week for recurring release schedules
 */
export type JMReleaseDay = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

/**
 * Video orientation for playback sizing
 */
export type JMVideoOrientation = "landscape" | "portrait" | "square";

/**
 * Video orientation display labels
 */
export const JMVideoOrientationLabels: Record<JMVideoOrientation, string> = {
  landscape: "Landscape (16:9)",
  portrait: "Portrait (9:16)",
  square: "Square (1:1)",
};

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
  artist: "Artist",
};

/**
 * Content type plural labels (for UI)
 */
export const JMContentTypePluralLabels: Record<JMContentType, string> = {
  show: "Shows",
  story: "Stories",
  card: "Cards",
  game: "Games",
  artist: "Artists",
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
    artist: {
      standalone: "Artist",
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
  subtitle?: string;              // Optional subtitle (used by games, etc.)
  slug?: string;                  // URL-friendly identifier (used by artists, games)
  description: string;
  creatorId: string;              // User UID of creator
  brandId?: string;               // Optional: associate with a brand
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // ─── Artwork ──────────────────────────────────────────────
  coverURL: string;               // 1:1 square (for scroller tiles)
  backdropURL?: string;           // 16:9 landscape (for detail pages)
  loginBgURL?: string;            // Custom background for auth page when accessing this content
  
  // ─── Game Splash (for games) ────────────────────────────
  splashBgURL?: string;           // Full-screen background for game landing page
  splashIconURL?: string;         // 4:3 game icon for landing page
  splashLogoURL?: string;         // 2:1 game title logo for landing page
  backgroundMusicURL?: string;    // Looping background music for gameplay (falls back to /music/{slug}.mp3)
  backgroundMusicVolume?: number; // 0–1 volume level (default 0.3)
  bgMusicLandingOnly?: boolean;   // If true, stop background music when the game starts (only plays on landing/lobby)
  minPlayers?: number;            // Min players required (default 1; >1 means no solo/AI mode)
  maxPlayers?: number;            // Max players for multiplayer games (default 2)
  trueSoloMode?: boolean;         // true = pure solo (no opponent). false/undefined = solo means vs AI
  retentionDays?: number;         // 1 = delete session data after 24h (default). 30 = keep for 30 days.
  primaryColor?: string;          // Primary accent hex (e.g. "#E84C1E") for in-game UI + asset selectors
  secondaryColor?: string;        // Secondary accent hex (e.g. "#3B82F6") for complementary UI elements

  // ─── Hierarchy & Ordering ─────────────────────────────────
  parentId: string | null;        // null = top-level content
  order: number;                  // Position within parent/experience
  seasonNumber?: number;          // For seasons: 1, 2, 3...
  episodeNumber?: number;         // For episodes: 1, 2, 3...
  
  // ─── Playback (for episodes/standalones) ──────────────────
  mediaURL?: string;              // Firebase Storage URL to actual content
  duration?: number;              // Seconds (for video/audio)
  videoOrientation?: JMVideoOrientation; // landscape, portrait, or square
  
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
  subtitle?: string;
  slug?: string;
  description: string;
  coverURL: string;
  backdropURL?: string;
  splashBgURL?: string;
  splashIconURL?: string;
  splashLogoURL?: string;
  backgroundMusicURL?: string;
  backgroundMusicVolume?: number;
  bgMusicLandingOnly?: boolean;
  minPlayers?: number;
  maxPlayers?: number;
  trueSoloMode?: boolean;
  retentionDays?: number;
  primaryColor?: string;
  secondaryColor?: string;
  brandId?: string;
  parentId?: string | null;
  order?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  mediaURL?: string;
  duration?: number;
  videoOrientation?: JMVideoOrientation;
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
  rowKind?: "content" | "feature";  // "feature" = single row-banner (from content with rowBannerURL)
  contentType?: JMContentType | "auction";  // For feature rows: "auction" (more types later)
  contentIds: string[];           // Ordered array of content IDs; for feature: [singleId]
  autoPopulate?: boolean;         // If true, auto-populate from contentType (content rows only)
  
  // ─── Display ──────────────────────────────────────────────
  order: number;                  // Position on homepage (lower = higher)
  rowScaleMobile?: number;        // Height multiplier for mobile (< md): 1, 1.5, or 2
  rowScaleDesktop?: number;       // Height multiplier for desktop (>= md): 1, 1.5, or 2
  isPublished: boolean;           // Draft vs live
}

/**
 * Input type for creating new experiences (omits server-generated fields)
 */
export interface JMExperienceInput {
  title: string;
  description?: string;
  rowKind?: "content" | "feature";
  contentType?: JMContentType | "auction";
  contentIds?: string[];
  autoPopulate?: boolean;
  order?: number;
  rowScaleMobile?: number;
  rowScaleDesktop?: number;
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

/** Item displayed in a feature row (content with rowBannerURL) */
export interface JMFeatureRowItem {
  id: string;
  name: string;
  slug?: string;
  rowBannerURL: string;
  contentType: "auction" | "game";
}

/**
 * Experience with resolved content items (for UI display)
 * Used when fetching an experience row with all its content
 */
export interface JMExperienceWithContent extends JMExperience {
  content: JMContent[];
  /** Set when rowKind is "feature" and content has rowBannerURL */
  featureItem?: JMFeatureRowItem;
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
// BRAND TYPES
// ─────────────────────────────────────────────────────────────

/**
 * Brand - top-level container for grouping related content
 * Multiple series, games, stories can belong to one brand
 * Stored in Firestore: /brands/{brandId}
 */
export interface JMBrand {
  id: string;
  name: string;
  description: string;
  logoURL: string;                // 1:1 square logo
  creatorId: string;              // User UID of creator
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isPublished: boolean;           // Draft vs live
}

/**
 * Input for creating a new brand
 */
export interface JMBrandInput {
  name: string;
  description: string;
  logoURL: string;
  isPublished?: boolean;
}

/**
 * Input for updating a brand
 */
export type JMBrandUpdate = Partial<Omit<JMBrand, "id" | "creatorId" | "createdAt">>;

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

// ─────────────────────────────────────────────────────────────
// AI ARTIST TYPES
// ─────────────────────────────────────────────────────────────

/**
 * Music video orientation options
 */
export type JMMusicVideoOrientation = "landscape" | "portrait";

/**
 * Music video orientation display labels
 */
export const JMMusicVideoOrientationLabels: Record<JMMusicVideoOrientation, string> = {
  landscape: "Landscape (16:9)",
  portrait: "Portrait (9:16)",
};

/**
 * AI Artist - represents an AI performing artist
 * Stored in Firestore: /artists/{artistId}
 */
export interface JMArtist {
  id: string;
  name: string;
  slug: string;                   // URL-safe identifier (e.g., "neon-nova")
  description: string;            // Short description for carousels/cards
  fullDescription?: string;       // Full bio for artist detail page
  avatarURL?: string;             // Artist profile image (small, for headers)
  coverURL: string;               // Cover image for home rows (2:1 wide)
  bannerURL?: string;             // Banner for featured carousel (16:9 landscape)
  loginBgURL?: string;            // Custom background for auth page when accessing this artist
  order: number;                  // Display order
  creatorId: string;              // User UID of creator
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isPublished: boolean;           // Draft vs live
}

/**
 * Input for creating a new artist
 */
export interface JMArtistInput {
  name: string;
  slug: string;
  description: string;            // Short description for carousels
  fullDescription?: string;       // Full bio for artist page
  coverURL: string;               // Required cover for home rows
  avatarURL?: string;
  bannerURL?: string;             // Optional banner for featured carousel
  loginBgURL?: string;            // Optional custom background for auth page
  order?: number;
  isPublished?: boolean;
}

/**
 * Input for updating an artist
 */
export type JMArtistUpdate = Partial<Omit<JMArtist, "id" | "creatorId" | "createdAt">>;

/**
 * Album - a collection of songs by an artist
 * Stored in Firestore: /albums/{albumId}
 */
export interface JMAlbum {
  id: string;
  artistId: string;               // Reference to parent artist
  name: string;
  description: string;
  coverImageURL: string;          // Static cover image (required)
  coverVideoURL?: string;         // Optional looping video cover (Firebase Storage)
  order: number;                  // Position within artist's albums
  creatorId: string;              // User UID of creator
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isPublished: boolean;           // Draft vs live
}

/**
 * Input for creating a new album
 */
export interface JMAlbumInput {
  artistId: string;
  name: string;
  description: string;
  coverImageURL: string;
  coverVideoURL?: string;
  order?: number;
  isPublished?: boolean;
}

/**
 * Input for updating an album
 */
export type JMAlbumUpdate = Partial<Omit<JMAlbum, "id" | "artistId" | "creatorId" | "createdAt">>;

/**
 * Song - an individual track on an album
 * Stored in Firestore: /songs/{songId}
 */
export interface JMSong {
  id: string;
  albumId: string;                // Reference to parent album
  title: string;
  description: string;
  duration: number;               // Duration in seconds
  lyrics?: string;                // Full lyrics text
  audioURL: string;               // Firebase Storage audio file URL
  trackNumber: number;            // Position on album (1, 2, 3...)
  creatorId: string;              // User UID of creator
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isPublished: boolean;           // Draft vs live
}

/**
 * Input for creating a new song
 */
export interface JMSongInput {
  albumId: string;
  title: string;
  description: string;
  duration: number;
  lyrics?: string;
  audioURL: string;
  trackNumber?: number;
  isPublished?: boolean;
}

/**
 * Input for updating a song
 */
export type JMSongUpdate = Partial<Omit<JMSong, "id" | "albumId" | "creatorId" | "createdAt">>;

/**
 * Music Video - a video by an artist (separate from albums)
 * Stored in Firestore: /musicVideos/{videoId}
 */
export interface JMMusicVideo {
  id: string;
  artistId: string;               // Reference to parent artist
  title: string;
  description: string;
  vimeoURL: string;               // Vimeo video URL
  orientation: JMMusicVideoOrientation; // Video orientation
  thumbnailURL?: string;          // Optional custom thumbnail
  order: number;                  // Display order
  creatorId: string;              // User UID of creator
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isPublished: boolean;           // Draft vs live
}

/**
 * Input for creating a new music video
 */
export interface JMMusicVideoInput {
  artistId: string;
  title: string;
  description: string;
  vimeoURL: string;
  orientation: JMMusicVideoOrientation;
  thumbnailURL?: string;
  order?: number;
  isPublished?: boolean;
}

/**
 * Input for updating a music video
 */
export type JMMusicVideoUpdate = Partial<Omit<JMMusicVideo, "id" | "artistId" | "creatorId" | "createdAt">>;

// ─────────────────────────────────────────────────────────────
// AUCTION TYPES
// ─────────────────────────────────────────────────────────────

/**
 * Video orientation for auction art preview
 */
export type JMAuctionVideoOrientation = "landscape" | "portrait" | "square";

export const JMAuctionVideoOrientationLabels: Record<JMAuctionVideoOrientation, string> = {
  landscape: "Landscape (16:9)",
  portrait: "Portrait (9:16)",
  square: "Square (1:1)",
};

/**
 * Auction - a named auction with its own items and countdown
 * Stored in Firestore: /auctions/{auctionId}
 */
export interface JMAuction {
  id: string;
  name: string;
  slug: string;                   // URL-safe identifier (e.g. "spring-2025")
  description?: string;           // For featured carousel card
  bannerURL?: string;             // 16:9 feature image for carousel
  rowBannerURL?: string;          // 1500×height px - for feature row on home (same height as row covers)
  pitchVideoURL?: string;         // Vimeo URL - "Pitch Video" telling the auction story
  endDate: Timestamp;             // When auction closes
  isActive: boolean;              // Whether auction is visible/active
  order: number;                  // Display order (for listing)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Input for creating an auction
 */
export interface JMAuctionInput {
  name: string;
  slug: string;
  description?: string;
  bannerURL?: string;
  rowBannerURL?: string;
  pitchVideoURL?: string;
  endDate: Timestamp;
  isActive?: boolean;
  order?: number;
}

/**
 * Input for updating an auction (partial)
 */
export type JMAuctionUpdate = Partial<Omit<JMAuction, "id" | "createdAt">>;

/**
 * Auction item - artwork available for silent auction
 * Stored in Firestore: /auction_items/{itemId}
 */
export interface JMAuctionItem {
  id: string;
  auctionId: string;              // Reference to parent auction
  title: string;
  subtitle: string;
  thumbnailURL: string;           // Square, for list display
  detailImageURL: string;         // Hi-res for detail view
  description: string;
  videoURL?: string;              // Vimeo preview
  videoOrientation?: JMAuctionVideoOrientation;
  videoStoryURL?: string;         // Vimeo "art story" video
  videoStoryOrientation?: JMAuctionVideoOrientation;
  minimumBid: number;             // Dollars
  currentBid: number;             // Highest bid so far (denormalized)
  currentBidWinnerName: string | null;  // Display name of leading bidder
  dimensions: string;             // e.g. "24\" x 36\""
  media: string;                  // e.g. "Acrylic on canvas"
  order: number;                  // Display order
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Bid on an auction item
 * Stored in Firestore: /auction_items/{itemId}/bids/{bidId}
 */
export interface JMAuctionBid {
  id: string;
  auctionItemId: string;
  userId: string;
  userName: string;               // Denormalized for display
  value: number;                  // Dollars
  bidAt: Timestamp;
}

/**
 * Input for creating an auction item
 */
export interface JMAuctionItemInput {
  auctionId: string;
  title: string;
  subtitle: string;
  thumbnailURL: string;
  detailImageURL: string;
  description: string;
  videoURL?: string;
  videoOrientation?: JMAuctionVideoOrientation;
  videoStoryURL?: string;
  videoStoryOrientation?: JMAuctionVideoOrientation;
  minimumBid: number;
  dimensions: string;
  media: string;
  order?: number;
}

/**
 * Input for updating an auction item (partial)
 */
export type JMAuctionItemUpdate = Partial<Omit<JMAuctionItem, "id" | "createdAt">>;

/**
 * Auction item with bids (for admin)
 */
export interface JMAuctionItemWithBids extends JMAuctionItem {
  bids: JMAuctionBid[];
}

/**
 * Artist with resolved albums, songs, and music videos (for UI display)
 */
export interface JMArtistWithContent extends JMArtist {
  albums: JMAlbumWithSongs[];
  musicVideos: JMMusicVideo[];
}

// ─────────────────────────────────────────────────────────────
// STORY TYPES (Reading Experience)
// ─────────────────────────────────────────────────────────────

/**
 * Per-book rendering rules applied inside the EPUB reader
 */
export interface JMStoryReaderConfig {
  [key: string]: unknown;
}

/**
 * A story (novel or short story) backed by an EPUB file
 * Stored in Firestore: /stories/{storyId}
 */
export interface JMStory {
  id: string;
  title: string;
  subtitle?: string;
  author: string;
  slug: string;
  description?: string;
  coverImageURL?: string;
  coverThumbnailURL?: string;
  coverVideoURL?: string;
  epubURL?: string;
  readerConfig?: JMStoryReaderConfig;
  creatorId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isPublished: boolean;
}

/**
 * Input for creating a new story
 */
export interface JMStoryInput {
  title: string;
  subtitle?: string;
  author: string;
  slug: string;
  description?: string;
  coverImageURL?: string;
  coverThumbnailURL?: string;
  coverVideoURL?: string;
  epubURL?: string;
  readerConfig?: JMStoryReaderConfig;
  isPublished?: boolean;
}

/**
 * Input for updating a story
 */
export type JMStoryUpdate = Partial<Omit<JMStory, "id" | "creatorId" | "createdAt">>;

/**
 * User reading preferences (applies to all stories)
 * Stored in Firestore: /users/{userId}/story-settings/preferences
 */
export interface JMStorySettings {
  fontSize: number;
  darkMode: boolean;
}

/**
 * Per-story reading progress using EPUB CFI location
 * Stored in Firestore: /users/{userId}/reading-progress/{storyId}
 */
export interface JMReadingProgress {
  storyId: string;
  location: string;
  lastReadAt: Timestamp;
}

/**
 * Album with resolved songs (for UI display)
 */
export interface JMAlbumWithSongs extends JMAlbum {
  songs: JMSong[];
}
