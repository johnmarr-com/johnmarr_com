/**
 * Server-only home content reads (Admin SDK).
 *
 * The home is a Server Component; it fetches its content HERE, on the server,
 * via the Admin SDK — NOT through the client Firestore SDK (`content.ts`),
 * which wedges on iOS. The result is serialized into the page and rendered
 * without any client read, so the home is instant + reliable on every device.
 *
 * Returns SLIM, JSON-serializable shapes (no Firestore Timestamps) tailored to
 * what the home renders. Mirrors the published-only read paths of
 * `content.ts:getFeaturedContent` / `getExperiencesWithContent`.
 */
import type { Firestore, DocumentData, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { unstable_cache } from "next/cache";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { normalizePageSlug } from "./pages";
import type {
  PageSegment,
  GridCellAspect,
  GridTextAlign,
  GridColumns,
} from "./content-types";
import { resolveStyle, toCss, fontStack } from "./scrollyfox-style";
import type { DeviceStyleLayers, ResolvedStyle } from "./scrollyfox-style";
import type { ScrollyFoxSegment } from "./scrollyfox";
import type { HeroContent, HeroLayout } from "@/app/scrollyfox/segments/HeroSegment";
import {
  resolveButtonStyle,
  resolveBuiltinStyle,
  type ResolvedButtonStyle,
} from "./button-styles";

/** A row/featured doc's owning page — absent pageId ⇒ the home page. */
const pageOf = (d: DocumentData): string =>
  (typeof d["pageId"] === "string" && d["pageId"]) || "home";

/** Cache tag for the home content (bust via `revalidateTag` on CMS publish). */
export const HOME_CONTENT_TAG = "home-content";

/** Cache tag for standalone CMS pages (bust via `revalidateTag` on publish). */
export const PAGE_CONTENT_TAG = "page-content";

export interface HomeFeatured {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  backdropURL: string;
  contentId: string;
  contentType: string;
  slug?: string;
  engineSlug?: string;
  /** Resolved CTA pill colors (Pink-Purple default). */
  ctaButton: ResolvedButtonStyle;
}

export interface HomeRowItem {
  id: string;
  name: string;
  /** Optional secondary line (used by grid captions). */
  subtitle?: string;
  coverURL: string;
  contentType: string;
  slug?: string;
  engineSlug?: string;
  /** Optional resolved attribution banner (row items). */
  attribution?: {
    title: string;
    color: string;
    textColor: string;
    fontFamily: string;
    size: number;
  };
}

export interface HomeFeatureItem {
  id: string;
  name: string;
  slug?: string;
  engineSlug?: string;
  rowBannerURL: string;
  contentType: "auction" | "game";
}

export interface HomeRow {
  id: string;
  title: string;
  fastCasual: boolean;
  rowScaleMobile?: number;
  rowScaleDesktop?: number;
  items: HomeRowItem[];
  featureItem?: HomeFeatureItem;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const optStr = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined;

function contentToItem(id: string, d: DocumentData): HomeRowItem {
  const item: HomeRowItem = {
    id,
    name: str(d["name"]),
    coverURL: str(d["coverURL"]),
    contentType: str(d["contentType"]),
  };
  const subtitle = optStr(d["subtitle"]) ?? optStr(d["description"]);
  if (subtitle) item.subtitle = subtitle;
  const slug = optStr(d["slug"]);
  if (slug) item.slug = slug;
  const eng = optStr(d["engineSlug"]);
  if (eng) item.engineSlug = eng;
  return item;
}

function artistToItem(id: string, a: DocumentData): HomeRowItem {
  const item: HomeRowItem = { id, name: str(a["name"]), coverURL: str(a["coverURL"]), contentType: "artist" };
  const subtitle = optStr(a["description"]);
  if (subtitle) item.subtitle = subtitle;
  const slug = optStr(a["slug"]);
  if (slug) item.slug = slug;
  return item;
}

function storyToItem(id: string, s: DocumentData): HomeRowItem {
  const item: HomeRowItem = {
    id,
    name: str(s["title"]),
    coverURL: optStr(s["coverThumbnailURL"]) ?? optStr(s["coverImageURL"]) ?? "",
    contentType: "story",
  };
  const subtitle = optStr(s["subtitle"]) ?? optStr(s["description"]);
  if (subtitle) item.subtitle = subtitle;
  const slug = optStr(s["slug"]);
  if (slug) item.slug = slug;
  return item;
}

/** Featured carousel items (published/active) for a carousel, game slugs resolved. */
/**
 * A per-request resolver from a CTA button-style id to its pill colors.
 * Built-ins ("" / "pink-purple" / "gold") resolve without a read; saved-doc
 * ids are fetched once and cached for the rest of the request.
 */
function makeButtonResolver(
  db: Firestore,
): (id: string | undefined) => Promise<ResolvedButtonStyle> {
  const cache = new Map<string, ResolvedButtonStyle>();
  return async (id) => {
    const builtin = resolveBuiltinStyle(id ?? "");
    if (builtin) return builtin;
    const key = id as string;
    const cached = cache.get(key);
    if (cached) return cached;
    const bs = await db.doc(`buttonStyles/${key}`).get();
    const resolved = resolveButtonStyle(bs.exists ? bs.data() : null);
    cache.set(key, resolved);
    return resolved;
  };
}

export async function getFeaturedContentServer(
  carouselId = "",
): Promise<HomeFeatured[]> {
  const db = getAdminFirestore();
  const snap = await db
    .collection("featured")
    .where("isActive", "==", true)
    .orderBy("order", "asc")
    .get();

  const docs = snap.docs.filter((doc) => {
    // Absent carouselId ⇒ the home default carousel.
    const c = doc.data()["carouselId"];
    return (typeof c === "string" ? c : "") === carouselId;
  });

  const resolveBtn = makeButtonResolver(db);

  const rows: HomeFeatured[] = await Promise.all(
    docs.map(async (doc) => {
      const d = doc.data();
      const styleId =
        typeof d["ctaButtonStyleId"] === "string" ? d["ctaButtonStyleId"] : "";
      const r: HomeFeatured = {
        id: doc.id,
        title: str(d["title"]),
        backdropURL: str(d["backdropURL"]),
        contentId: str(d["contentId"]),
        contentType: str(d["contentType"]),
        ctaButton: await resolveBtn(styleId),
      };
      const sub = optStr(d["subtitle"]);
      if (sub) r.subtitle = sub;
      const desc = optStr(d["description"]);
      if (desc) r.description = desc;
      const slug = optStr(d["slug"]);
      if (slug) r.slug = slug;
      return r;
    }),
  );

  await Promise.all(
    rows.map(async (row) => {
      if (row.contentType !== "game" || !row.contentId) return;
      const c = await db.doc(`content/${row.contentId}`).get();
      if (!c.exists) return;
      const cd = c.data() ?? {};
      const slug = optStr(cd["slug"]);
      if (slug) row.slug = slug;
      const eng = optStr(cd["engineSlug"]);
      if (eng) row.engineSlug = eng;
    }),
  );

  return rows;
}

async function resolveCurated(
  db: Firestore,
  collection: string,
  ids: string[],
  mapper: (id: string, d: DocumentData) => HomeRowItem,
): Promise<HomeRowItem[]> {
  const results = await Promise.allSettled(ids.map((id) => db.doc(`${collection}/${id}`).get()));
  const items: HomeRowItem[] = [];
  for (const r of results) {
    if (r.status !== "fulfilled" || !r.value.exists) continue;
    const d = r.value.data() ?? {};
    if (d["isPublished"] !== true) continue; // published-only
    items.push(mapper(r.value.id, d));
  }
  return items;
}

/**
 * Album-grid items: all published albums by one artist, or by every artist —
 * grouped by artist (artist name asc, then album order). Item shape routes
 * to `/artist/{slug}?album={albumId}` (see PageSegments), with the artist
 * name as the subtitle.
 */
async function resolveAlbumItems(
  db: Firestore,
  albumArtistId: string,
): Promise<HomeRowItem[]> {
  // Published artists, keyed by id (also drives the grouping order).
  const artistsSnap = await db
    .collection("artists")
    .where("isPublished", "==", true)
    .orderBy("name", "asc")
    .get();
  const artists = new Map<string, { name: string; slug: string }>();
  for (const doc of artistsSnap.docs) {
    const a = doc.data();
    artists.set(doc.id, { name: str(a["name"]), slug: str(a["slug"]) });
  }

  let albumsQuery = db
    .collection("albums")
    .where("isPublished", "==", true);
  if (albumArtistId) {
    albumsQuery = albumsQuery.where("artistId", "==", albumArtistId);
  }
  const albumsSnap = await albumsQuery.get();

  const rows = albumsSnap.docs
    .map((doc) => {
      const d = doc.data();
      const artist = artists.get(str(d["artistId"]));
      if (!artist?.slug) return null; // unpublished/missing artist
      const item: HomeRowItem = {
        id: doc.id,
        name: str(d["name"]),
        subtitle: artist.name,
        coverURL: str(d["coverImageURL"]),
        contentType: "album",
        slug: artist.slug,
      };
      return {
        item,
        artistName: artist.name,
        order: typeof d["order"] === "number" ? d["order"] : 0,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  rows.sort(
    (a, b) => a.artistName.localeCompare(b.artistName) || a.order - b.order,
  );
  return rows.map((r) => r.item);
}

/**
 * Resolve a content selection (contentType + auto/curated ids) into items —
 * the shared model behind both content rows and grids. Published-only.
 */
async function resolveSelectionItems(
  db: Firestore,
  contentType: string,
  autoPopulate: boolean,
  contentIds: string[],
  albumArtistId = "",
): Promise<HomeRowItem[]> {
  if (!contentType) return [];
  if (contentType === "album") return resolveAlbumItems(db, albumArtistId);
  if (autoPopulate) {
    if (contentType === "artist") {
      const snap = await db.collection("artists").where("isPublished", "==", true).orderBy("name", "asc").get();
      return snap.docs.map((d) => artistToItem(d.id, d.data()));
    }
    if (contentType === "story") {
      const snap = await db.collection("stories").where("isPublished", "==", true).orderBy("title", "asc").get();
      return snap.docs.map((d) => storyToItem(d.id, d.data()));
    }
    const snap = await db
      .collection("content")
      .where("isPublished", "==", true)
      .where("contentType", "==", contentType)
      .where("parentId", "==", null)
      .orderBy("order", "asc")
      .get();
    return snap.docs.map((d) => contentToItem(d.id, d.data()));
  }
  if (contentType === "artist") return resolveCurated(db, "artists", contentIds, artistToItem);
  if (contentType === "story") return resolveCurated(db, "stories", contentIds, storyToItem);
  return resolveCurated(db, "content", contentIds, contentToItem);
}

/** Resolve a raw attribution entry into render values, or undefined if no title. */
function resolveAttribution(raw: unknown): HomeRowItem["attribution"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const a = raw as DocumentData;
  const title = typeof a["title"] === "string" ? a["title"].trim() : "";
  if (!title) return undefined; // hide when no title
  return {
    title,
    color: typeof a["color"] === "string" ? a["color"] : "#8B35FF",
    textColor: typeof a["textColor"] === "string" ? a["textColor"] : "#FFFFFF",
    fontFamily: fontStack(typeof a["fontId"] === "string" ? a["fontId"] : "helvetica"),
    size: typeof a["size"] === "number" && a["size"] > 0 ? a["size"] : 12,
  };
}

/** Resolve one experience's row content (mirrors getExperienceWithContent, published-only). */
async function resolveRow(db: Firestore, exp: DocumentData): Promise<{ items: HomeRowItem[]; featureItem?: HomeFeatureItem }> {
  const contentType = str(exp["contentType"]);
  const rowKind = str(exp["rowKind"]);
  const autoPopulate = exp["autoPopulate"] === true;
  const contentIds: string[] = Array.isArray(exp["contentIds"]) ? (exp["contentIds"] as string[]) : [];
  const firstId = contentIds[0];

  // Per-item attribution overlays, keyed by contentId.
  const attrMap = (exp["attributions"] ?? {}) as Record<string, unknown>;
  const withAttr = (items: HomeRowItem[]): HomeRowItem[] =>
    items.map((it) => {
      const attribution = resolveAttribution(attrMap[it.id]);
      return attribution ? { ...it, attribution } : it;
    });

  // Feature row: auction row-banner.
  if (rowKind === "feature" && contentType === "auction" && firstId) {
    const aSnap = await db.doc(`auctions/${firstId}`).get();
    if (aSnap.exists) {
      const a = aSnap.data() ?? {};
      const banner = optStr(a["rowBannerURL"]);
      if (banner && a["isActive"] === true) {
        const fi: HomeFeatureItem = { id: aSnap.id, name: str(a["name"]), rowBannerURL: banner, contentType: "auction" };
        const slug = optStr(a["slug"]);
        if (slug) fi.slug = slug;
        return { items: [], featureItem: fi };
      }
    }
    return { items: [] };
  }

  // Auto-populate rows.
  if (autoPopulate && contentType && contentType !== "auction") {
    if (contentType === "artist") {
      const snap = await db.collection("artists").where("isPublished", "==", true).orderBy("name", "asc").get();
      return { items: withAttr(snap.docs.map((d) => artistToItem(d.id, d.data()))) };
    }
    if (contentType === "story") {
      const snap = await db.collection("stories").where("isPublished", "==", true).orderBy("title", "asc").get();
      return { items: withAttr(snap.docs.map((d) => storyToItem(d.id, d.data()))) };
    }
    const snap = await db
      .collection("content")
      .where("isPublished", "==", true)
      .where("contentType", "==", contentType)
      .where("parentId", "==", null)
      .orderBy("order", "asc")
      .get();
    return { items: withAttr(snap.docs.map((d) => contentToItem(d.id, d.data()))) };
  }

  // Curated rows.
  if (contentType === "artist") return { items: withAttr(await resolveCurated(db, "artists", contentIds, artistToItem)) };
  if (contentType === "story") return { items: withAttr(await resolveCurated(db, "stories", contentIds, storyToItem)) };
  if (contentType !== "auction") return { items: withAttr(await resolveCurated(db, "content", contentIds, contentToItem)) };
  return { items: [] };
}

/** Resolve a set of experience docs (already filtered + order-sorted) into rows. */
async function resolveExperienceDocs(
  db: Firestore,
  docs: QueryDocumentSnapshot[],
): Promise<HomeRow[]> {
  return Promise.all(
    docs.map(async (doc) => {
      const exp = doc.data();
      const { items, featureItem } = await resolveRow(db, exp);
      const row: HomeRow = {
        id: doc.id,
        title: str(exp["title"]),
        fastCasual: exp["fastCasual"] === true,
        items,
      };
      const rsm = exp["rowScaleMobile"];
      if (typeof rsm === "number") row.rowScaleMobile = rsm;
      const rsd = exp["rowScaleDesktop"];
      if (typeof rsd === "number") row.rowScaleDesktop = rsd;
      if (featureItem) row.featureItem = featureItem;
      return row;
    }),
  );
}

/** Published rows scoped to a page (legacy pageId scoping; default home). */
export async function getHomeRowsServer(pageId = "home"): Promise<HomeRow[]> {
  const db = getAdminFirestore();
  const expSnap = await db.collection("experiences").where("isPublished", "==", true).orderBy("order", "asc").get();
  const docs = expSnap.docs.filter((doc) => pageOf(doc.data()) === pageId);
  return resolveExperienceDocs(db, docs);
}

/** A grid resolved to its items + render settings (fonts resolved to stacks). */
export interface ResolvedGrid {
  items: HomeRowItem[];
  /** Optional display title rendered top-left above the grid. */
  heading?: string;
  cellAspect: GridCellAspect;
  cellRadius: number;
  textAlign: GridTextAlign;
  showTitle: boolean;
  showSubtitle: boolean;
  title: { fontFamily: string; size: number };
  subtitle: { fontFamily: string; size: number };
  columns: GridColumns;
  /** Vertical padding in px (top AND bottom) per device tier. */
  paddingY: GridColumns;
  gap: number;
  maxWidth: number;
  maxWidthPercent: number;
}

/** Resolve a named grid collection: its content items + display settings. */
export async function getGridContentServer(
  gridId: string,
): Promise<ResolvedGrid | null> {
  const db = getAdminFirestore();
  const snap = await db.doc(`gridCollections/${gridId}`).get();
  if (!snap.exists) return null;
  const d = snap.data() ?? {};

  const contentType = str(d["contentType"]);
  const autoPopulate = d["autoPopulate"] === true;
  const contentIds = Array.isArray(d["contentIds"]) ? (d["contentIds"] as string[]) : [];
  const albumArtistId = str(d["albumArtistId"]);
  const items = await resolveSelectionItems(
    db,
    contentType,
    autoPopulate,
    contentIds,
    albumArtistId,
  );

  const aspect = d["cellAspect"];
  const cellAspect: GridCellAspect =
    aspect === "landscape" || aspect === "square" ? aspect : "portrait";
  const align = d["textAlign"];
  const textAlign: GridTextAlign =
    align === "left" || align === "right" ? align : "center";

  const titleRaw = (d["title"] ?? {}) as DocumentData;
  const subRaw = (d["subtitle"] ?? {}) as DocumentData;
  const colsRaw = (d["columns"] ?? {}) as DocumentData;
  const padRaw = (d["paddingY"] ?? {}) as DocumentData;
  const num = (v: unknown, fallback: number): number =>
    typeof v === "number" && v > 0 ? v : fallback;
  const pad = (v: unknown): number => (typeof v === "number" && v >= 0 ? v : 0);
  const heading = optStr(d["heading"]);

  const radiusRaw = d["cellRadius"];
  const cellRadius =
    typeof radiusRaw === "number" && radiusRaw >= 0 ? radiusRaw : 12;

  return {
    items,
    cellAspect,
    cellRadius,
    textAlign,
    showTitle: d["showTitle"] !== false,
    showSubtitle: d["showSubtitle"] === true,
    title: {
      fontFamily: fontStack(typeof titleRaw["fontId"] === "string" ? titleRaw["fontId"] : "helvetica"),
      size: num(titleRaw["size"], 16),
    },
    subtitle: {
      fontFamily: fontStack(typeof subRaw["fontId"] === "string" ? subRaw["fontId"] : "helvetica"),
      size: num(subRaw["size"], 13),
    },
    columns: {
      desktop: num(colsRaw["desktop"], 4),
      tablet: num(colsRaw["tablet"], 3),
      mobile: num(colsRaw["mobile"], 2),
    },
    paddingY: {
      desktop: pad(padRaw["desktop"]),
      tablet: pad(padRaw["tablet"]),
      mobile: pad(padRaw["mobile"]),
    },
    ...(heading ? { heading } : {}),
    gap: typeof d["gap"] === "number" && d["gap"] >= 0 ? d["gap"] : 16,
    maxWidth: typeof d["maxWidth"] === "number" && d["maxWidth"] >= 0 ? d["maxWidth"] : 0,
    maxWidthPercent:
      typeof d["maxWidthPercent"] === "number" &&
      d["maxWidthPercent"] > 0 &&
      d["maxWidthPercent"] < 100
        ? d["maxWidthPercent"]
        : 0,
  };
}

/** Published rows scoped to a named row collection (segment model). */
export async function getRowsForCollectionServer(rowCollectionId: string): Promise<HomeRow[]> {
  const db = getAdminFirestore();
  const expSnap = await db.collection("experiences").where("isPublished", "==", true).orderBy("order", "asc").get();
  const docs = expSnap.docs.filter((doc) => {
    const c = doc.data()["rowCollectionId"];
    return (typeof c === "string" ? c : "") === rowCollectionId;
  });
  return resolveExperienceDocs(db, docs);
}

/**
 * The home's content (featured + rows), cached in the Next data cache for 60s
 * and tagged so a CMS publish can invalidate it on demand (`revalidateTag`).
 * The home renders at runtime (where Admin creds exist) but reuses this cache
 * across requests, so the experiences graph isn't re-read every load.
 */
export const getHomeContent = unstable_cache(
  async (): Promise<{ segments: ResolvedSegment[] }> => {
    // The home renders its full segment stack (carousels, rows, scrollyfoxes, …).
    const home = await getPageContent("home");
    if (home) return { segments: home.segments };

    // Fallback (no published home page): synthesize [carousel?, rows].
    const [featured, rows] = await Promise.all([getFeaturedContentServer(), getHomeRowsServer()]);
    const segments: ResolvedSegment[] = [];
    if (featured.length > 0) segments.push({ type: "carousel", id: "home-carousel", featured });
    segments.push({ type: "rows", id: "home-rows", rows });
    return { segments };
  },
  ["home-content-v3"],
  { revalidate: 60, tags: [HOME_CONTENT_TAG] },
);

// ─────────────────────────────────────────────────────────────
// STANDALONE PAGES (slug-addressed)
// ─────────────────────────────────────────────────────────────

/** Slim, JSON-serializable page metadata for the client renderer. */
export interface PageMeta {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  featuredCarouselId?: string;
  hideHeader?: boolean;
  segments?: PageSegment[];
}

/** A page segment resolved to its render data. */
export type ResolvedSegment =
  | { type: "carousel"; id: string; featured: HomeFeatured[]; dotColor?: string }
  | { type: "rows"; id: string; rows: HomeRow[] }
  | { type: "grid"; id: string; grid: ResolvedGrid }
  | {
      type: "scrollyfox";
      id: string;
      heroes: {
        content: HeroContent;
        styles: {
          desktop: ResolvedStyle;
          tablet: ResolvedStyle;
          mobile: ResolvedStyle;
        };
        ctaButton: ResolvedButtonStyle;
        layouts?: { tablet?: HeroLayout; mobile?: HeroLayout };
        /** Split image-column width % (rest is text). */
        splitRatio?: number;
      }[];
      /** Doc-wide max content width in px (caps + centers each hero). */
      maxWidth?: number;
      /** Doc-wide width as a % of available (capped by maxWidth). */
      maxWidthPercent?: number;
    };

export interface PageContent {
  page: PageMeta;
  segments: ResolvedSegment[];
}

/** Resolve a published page by its canonical slug (Admin SDK). */
async function getPageBySlugServer(slug: string): Promise<PageMeta | null> {
  const db = getAdminFirestore();
  const snap = await db
    .collection("pages")
    .where("slug", "==", normalizePageSlug(slug))
    .limit(1)
    .get();

  const doc = snap.docs[0];
  if (!doc) return null;
  const d = doc.data();
  if (d["isPublished"] !== true) return null;

  const page: PageMeta = {
    id: doc.id,
    slug: str(d["slug"]),
    title: str(d["title"]),
  };
  const sub = optStr(d["subtitle"]);
  if (sub) page.subtitle = sub;
  const car = optStr(d["featuredCarouselId"]);
  if (car) page.featuredCarouselId = car;
  if (d["hideHeader"] === true) page.hideHeader = true;
  const segs = d["segments"];
  if (Array.isArray(segs)) page.segments = segs as PageSegment[];
  return page;
}

/**
 * A published page's content (optional banner + rows), resolved server-side.
 * Returns null when no published page exists at that slug.
 *
 * Cached per slug for 60s in the Next data cache (the `[...slug]` catch-all is
 * force-dynamic, so without this every hit on a CMS/landing page re-read the
 * whole experiences graph — slow TTFB on exactly the pages campaigns land on).
 * CMS publish busts the tag via /api/revalidate.
 */
export async function getPageContent(slug: string): Promise<PageContent | null> {
  const cached = unstable_cache(
    async (): Promise<PageContent | null> => {
      const page = await getPageBySlugServer(slug);
      if (!page) return null;
      return { page, segments: await resolveSegments(page) };
    },
    ["page-content-v1", slug],
    { revalidate: 60, tags: [PAGE_CONTENT_TAG] },
  );
  return cached();
}

/** Pagination-dot color for a named carousel ("" / unknown ⇒ undefined). */
async function getCarouselDotColor(
  carouselId: string,
): Promise<string | undefined> {
  if (!carouselId) return undefined;
  const db = getAdminFirestore();
  const c = await db.doc(`featuredCarousels/${carouselId}`).get();
  const v = c.exists ? c.data()?.["dotColor"] : undefined;
  return typeof v === "string" ? v : undefined;
}

/** Resolve a page's segment stack, or synthesize the legacy [carousel?, rows]. */
async function resolveSegments(page: PageMeta): Promise<ResolvedSegment[]> {
  if (page.segments && page.segments.length > 0) {
    const resolved = await Promise.all(
      page.segments.map(async (seg): Promise<ResolvedSegment | null> => {
        if (seg.type === "carousel") {
          const [featured, dotColor] = await Promise.all([
            getFeaturedContentServer(seg.refId),
            getCarouselDotColor(seg.refId),
          ]);
          return {
            type: "carousel",
            id: seg.id,
            featured,
            ...(dotColor ? { dotColor } : {}),
          };
        }
        if (seg.type === "rows") {
          return { type: "rows", id: seg.id, rows: await getRowsForCollectionServer(seg.refId) };
        }
        if (seg.type === "grid") {
          const grid = await getGridContentServer(seg.refId);
          if (!grid) return null;
          return { type: "grid", id: seg.id, grid };
        }
        if (seg.type === "scrollyfox") {
          const db = getAdminFirestore();
          const sf = await db.doc(`scrollyfoxes/${seg.refId}`).get();
          if (!sf.exists) return null;
          const data = sf.data() ?? {};
          const docStyle = data["style"] as DeviceStyleLayers | undefined;
          const sfSegs = Array.isArray(data["segments"])
            ? (data["segments"] as ScrollyFoxSegment[])
            : [];

          // Resolve CTA pill styles once per distinct id (heroes often share one).
          const resolveBtn = makeButtonResolver(db);
          const heroes = await Promise.all(
            sfSegs.map(async (s) => ({
              content: s.content,
              styles: {
                desktop: toCss(resolveStyle(docStyle, s.style, "desktop")),
                tablet: toCss(resolveStyle(docStyle, s.style, "tablet")),
                mobile: toCss(resolveStyle(docStyle, s.style, "mobile")),
              },
              ctaButton: await resolveBtn(s.content.ctaButtonStyleId),
              ...(s.layouts ? { layouts: s.layouts } : {}),
              ...(typeof s.splitRatio === "number" &&
              s.splitRatio > 0 &&
              s.splitRatio < 100
                ? { splitRatio: s.splitRatio }
                : {}),
            })),
          );
          const dw = data["maxWidth"];
          const maxWidth = typeof dw === "number" && dw > 0 ? dw : 0;
          const dp = data["maxWidthPercent"];
          const maxWidthPercent =
            typeof dp === "number" && dp > 0 && dp < 100 ? dp : 0;
          return {
            type: "scrollyfox",
            id: seg.id,
            heroes,
            ...(maxWidth ? { maxWidth } : {}),
            ...(maxWidthPercent ? { maxWidthPercent } : {}),
          };
        }
        return null;
      }),
    );
    return resolved.filter((s): s is ResolvedSegment => s !== null);
  }

  // Legacy fallback: synthesize [carousel?, rows] from the old page fields.
  const out: ResolvedSegment[] = [];
  if (page.featuredCarouselId) {
    const dotColor = await getCarouselDotColor(page.featuredCarouselId);
    out.push({
      type: "carousel",
      id: "legacy-carousel",
      featured: await getFeaturedContentServer(page.featuredCarouselId),
      ...(dotColor ? { dotColor } : {}),
    });
  }
  out.push({ type: "rows", id: "legacy-rows", rows: await getHomeRowsServer(page.id) });
  return out;
}
