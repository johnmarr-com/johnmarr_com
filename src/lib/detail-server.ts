/**
 * Server-only detail-page reads (Admin SDK) for shows, stories, and artists.
 *
 * These pages were client components doing client-Firestore reads, which meant
 * (a) crawlers/social scrapers saw an empty spinner and no metadata, and
 * (b) first paint waited on a client round-trip (see DATA-ACCESS.md).
 * Each fetcher returns a SLIM, JSON-serializable shape (no Firestore
 * Timestamps) tailored to what the page renders, mirroring the published-only
 * read paths of the client `content.ts` / `stories.ts` functions.
 *
 * Every fetcher is wrapped in React `cache()` so `generateMetadata` and the
 * page component share one read per request.
 */
import { cache } from "react";
import type { DocumentData } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { JMReleaseDay, JMMusicVideoOrientation } from "@/lib/content-types";

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const optStr = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined;

const RELEASE_DAYS: readonly JMReleaseDay[] = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
];
const optReleaseDay = (v: unknown): JMReleaseDay | undefined =>
  RELEASE_DAYS.includes(v as JMReleaseDay) ? (v as JMReleaseDay) : undefined;

const optMillis = (v: unknown): number | undefined =>
  v instanceof Timestamp ? v.toMillis() : undefined;

// ─────────────────────────────────────────────────────────────
// SHOW (content tree: show → seasons → episodes)
// ─────────────────────────────────────────────────────────────

/** A serialized node of the show tree (dates as epoch ms). */
export interface ShowNode {
  id: string;
  name: string;
  contentLevel?: string;
  description?: string;
  coverURL?: string;
  backdropURL?: string;
  mediaURL?: string;
  videoOrientation?: "landscape" | "portrait";
  releaseDay?: JMReleaseDay;
  releaseDateMs?: number;
  children: ShowNode[];
}

function toShowNode(id: string, d: DocumentData, children: ShowNode[]): ShowNode {
  const node: ShowNode = { id, name: str(d["name"]), children };
  const level = optStr(d["contentLevel"]);
  if (level) node.contentLevel = level;
  const desc = optStr(d["description"]);
  if (desc) node.description = desc;
  const cover = optStr(d["coverURL"]);
  if (cover) node.coverURL = cover;
  const backdrop = optStr(d["backdropURL"]);
  if (backdrop) node.backdropURL = backdrop;
  const media = optStr(d["mediaURL"]);
  if (media) node.mediaURL = media;
  const orientation = d["videoOrientation"];
  if (orientation === "landscape" || orientation === "portrait") {
    node.videoOrientation = orientation;
  }
  const day = optReleaseDay(d["releaseDay"]);
  if (day) node.releaseDay = day;
  const rel = optMillis(d["releaseDate"]);
  if (rel != null) node.releaseDateMs = rel;
  return node;
}

/** Published children of a content doc, ordered (mirrors getContentChildren). */
async function getChildrenServer(parentId: string, depth: number): Promise<ShowNode[]> {
  if (depth <= 0) return [];
  const db = getAdminFirestore();
  const snap = await db
    .collection("content")
    .where("isPublished", "==", true)
    .where("parentId", "==", parentId)
    .orderBy("order", "asc")
    .get();
  return Promise.all(
    snap.docs.map(async (doc) =>
      toShowNode(doc.id, doc.data(), await getChildrenServer(doc.id, depth - 1)),
    ),
  );
}

/**
 * A published show (or standalone video) with its season/episode tree,
 * mirroring the client `getContentWithChildren(id, true)`.
 */
export const getShowServer = cache(async (id: string): Promise<ShowNode | null> => {
  if (!id) return null;
  const db = getAdminFirestore();
  const snap = await db.doc(`content/${id}`).get();
  if (!snap.exists) return null;
  const d = snap.data() ?? {};
  if (d["isPublished"] !== true) return null;
  return toShowNode(snap.id, d, await getChildrenServer(snap.id, 2));
});

// ─────────────────────────────────────────────────────────────
// STORY
// ─────────────────────────────────────────────────────────────

export interface StoryPageData {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  author: string;
  description?: string;
  coverImageURL?: string;
  epubURL?: string;
}

/** A published story by slug (mirrors the client `getStoryBySlug`). */
export const getStoryServer = cache(async (slug: string): Promise<StoryPageData | null> => {
  if (!slug) return null;
  const db = getAdminFirestore();
  const snap = await db
    .collection("stories")
    .where("isPublished", "==", true)
    .where("slug", "==", slug)
    .limit(1)
    .get();
  const doc = snap.docs[0];
  if (!doc) return null;
  const d = doc.data();
  const story: StoryPageData = {
    id: doc.id,
    slug: str(d["slug"]),
    title: str(d["title"]),
    author: str(d["author"]),
  };
  const subtitle = optStr(d["subtitle"]);
  if (subtitle) story.subtitle = subtitle;
  const desc = optStr(d["description"]);
  if (desc) story.description = desc;
  const cover = optStr(d["coverImageURL"]);
  if (cover) story.coverImageURL = cover;
  const epub = optStr(d["epubURL"]);
  if (epub) story.epubURL = epub;
  return story;
});

// ─────────────────────────────────────────────────────────────
// ARTIST (artist + albums-with-songs + music videos)
// ─────────────────────────────────────────────────────────────

export interface ArtistSongData {
  id: string;
  title: string;
  trackNumber: number;
  duration: number;
  audioURL: string;
  lyrics?: string;
  tease?: boolean;
}

export interface ArtistAlbumData {
  id: string;
  name: string;
  description?: string;
  coverImageURL: string;
  coverVideoURL?: string;
  /** Album page shows the "Download Songs" (zip) button. */
  downloadable?: boolean;
  songs: ArtistSongData[];
}

export interface ArtistVideoData {
  id: string;
  title: string;
  description?: string;
  vimeoURL: string;
  orientation: JMMusicVideoOrientation;
  thumbnailURL?: string;
  tease?: boolean;
}

export interface ArtistPageData {
  artist: {
    id: string;
    slug: string;
    name: string;
    description?: string;
    fullDescription?: string;
    coverURL?: string;
    openAccess: boolean;
  };
  albums: ArtistAlbumData[];
  musicVideos: ArtistVideoData[];
}

/**
 * A published artist with albums (each with published songs, by trackNumber)
 * and music videos — mirrors the client page's three-step load.
 */
export const getArtistServer = cache(async (slug: string): Promise<ArtistPageData | null> => {
  if (!slug) return null;
  const db = getAdminFirestore();
  const artistSnap = await db
    .collection("artists")
    .where("isPublished", "==", true)
    .where("slug", "==", slug)
    .limit(1)
    .get();
  const artistDoc = artistSnap.docs[0];
  if (!artistDoc) return null;
  const a = artistDoc.data();

  const artist: ArtistPageData["artist"] = {
    id: artistDoc.id,
    slug: str(a["slug"]),
    name: str(a["name"]),
    openAccess: a["openAccess"] === true,
  };
  const desc = optStr(a["description"]);
  if (desc) artist.description = desc;
  const full = optStr(a["fullDescription"]);
  if (full) artist.fullDescription = full;
  const cover = optStr(a["coverURL"]);
  if (cover) artist.coverURL = cover;

  const [albumsSnap, videosSnap] = await Promise.all([
    db
      .collection("albums")
      .where("isPublished", "==", true)
      .where("artistId", "==", artistDoc.id)
      .orderBy("order", "asc")
      .get(),
    db
      .collection("musicVideos")
      .where("isPublished", "==", true)
      .where("artistId", "==", artistDoc.id)
      .orderBy("order", "asc")
      .get(),
  ]);

  const albums: ArtistAlbumData[] = await Promise.all(
    albumsSnap.docs.map(async (albumDoc) => {
      const al = albumDoc.data();
      const songsSnap = await db
        .collection("songs")
        .where("isPublished", "==", true)
        .where("albumId", "==", albumDoc.id)
        .orderBy("trackNumber", "asc")
        .get();
      const songs: ArtistSongData[] = songsSnap.docs.map((songDoc) => {
        const s = songDoc.data();
        const song: ArtistSongData = {
          id: songDoc.id,
          title: str(s["title"]),
          trackNumber: typeof s["trackNumber"] === "number" ? s["trackNumber"] : 0,
          duration: typeof s["duration"] === "number" ? s["duration"] : 0,
          audioURL: str(s["audioURL"]),
        };
        const lyrics = optStr(s["lyrics"]);
        if (lyrics) song.lyrics = lyrics;
        if (s["tease"] === true) song.tease = true;
        return song;
      });
      const album: ArtistAlbumData = {
        id: albumDoc.id,
        name: str(al["name"]),
        coverImageURL: str(al["coverImageURL"]),
        songs,
      };
      const albumDesc = optStr(al["description"]);
      if (albumDesc) album.description = albumDesc;
      const coverVideo = optStr(al["coverVideoURL"]);
      if (coverVideo) album.coverVideoURL = coverVideo;
      if (al["downloadable"] === true) album.downloadable = true;
      return album;
    }),
  );

  const musicVideos: ArtistVideoData[] = videosSnap.docs.map((videoDoc) => {
    const v = videoDoc.data();
    const orientationRaw = v["orientation"];
    const video: ArtistVideoData = {
      id: videoDoc.id,
      title: str(v["title"]),
      vimeoURL: str(v["vimeoURL"]),
      orientation: orientationRaw === "portrait" ? "portrait" : "landscape",
    };
    const videoDesc = optStr(v["description"]);
    if (videoDesc) video.description = videoDesc;
    const thumb = optStr(v["thumbnailURL"]);
    if (thumb) video.thumbnailURL = thumb;
    if (v["tease"] === true) video.tease = true;
    return video;
  });

  return { artist, albums, musicVideos };
});
