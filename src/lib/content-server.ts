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
import type { Firestore, DocumentData } from "firebase-admin/firestore";
import { unstable_cache } from "next/cache";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { normalizePageSlug } from "./pages";

/** A row/featured doc's owning page — absent pageId ⇒ the home page. */
const pageOf = (d: DocumentData): string =>
  (typeof d["pageId"] === "string" && d["pageId"]) || "home";

/** Cache tag for the home content (bust via `revalidateTag` on CMS publish). */
export const HOME_CONTENT_TAG = "home-content";

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
}

export interface HomeRowItem {
  id: string;
  name: string;
  coverURL: string;
  contentType: string;
  slug?: string;
  engineSlug?: string;
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
  const slug = optStr(d["slug"]);
  if (slug) item.slug = slug;
  const eng = optStr(d["engineSlug"]);
  if (eng) item.engineSlug = eng;
  return item;
}

function artistToItem(id: string, a: DocumentData): HomeRowItem {
  const item: HomeRowItem = { id, name: str(a["name"]), coverURL: str(a["coverURL"]), contentType: "artist" };
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
  const slug = optStr(s["slug"]);
  if (slug) item.slug = slug;
  return item;
}

/** Featured carousel items (published/active) for a carousel, game slugs resolved. */
export async function getFeaturedContentServer(
  carouselId = "",
): Promise<HomeFeatured[]> {
  const db = getAdminFirestore();
  const snap = await db
    .collection("featured")
    .where("isActive", "==", true)
    .orderBy("order", "asc")
    .get();

  const rows: HomeFeatured[] = snap.docs
    .filter((doc) => {
      // Absent carouselId ⇒ the home default carousel.
      const c = doc.data()["carouselId"];
      return (typeof c === "string" ? c : "") === carouselId;
    })
    .map((doc) => {
    const d = doc.data();
    const r: HomeFeatured = {
      id: doc.id,
      title: str(d["title"]),
      backdropURL: str(d["backdropURL"]),
      contentId: str(d["contentId"]),
      contentType: str(d["contentType"]),
    };
    const sub = optStr(d["subtitle"]);
    if (sub) r.subtitle = sub;
    const desc = optStr(d["description"]);
    if (desc) r.description = desc;
    const slug = optStr(d["slug"]);
    if (slug) r.slug = slug;
    return r;
  });

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

/** Resolve one experience's row content (mirrors getExperienceWithContent, published-only). */
async function resolveRow(db: Firestore, exp: DocumentData): Promise<{ items: HomeRowItem[]; featureItem?: HomeFeatureItem }> {
  const contentType = str(exp["contentType"]);
  const rowKind = str(exp["rowKind"]);
  const autoPopulate = exp["autoPopulate"] === true;
  const contentIds: string[] = Array.isArray(exp["contentIds"]) ? (exp["contentIds"] as string[]) : [];
  const firstId = contentIds[0];

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
      return { items: snap.docs.map((d) => artistToItem(d.id, d.data())) };
    }
    if (contentType === "story") {
      const snap = await db.collection("stories").where("isPublished", "==", true).orderBy("title", "asc").get();
      return { items: snap.docs.map((d) => storyToItem(d.id, d.data())) };
    }
    const snap = await db
      .collection("content")
      .where("isPublished", "==", true)
      .where("contentType", "==", contentType)
      .where("parentId", "==", null)
      .orderBy("order", "asc")
      .get();
    return { items: snap.docs.map((d) => contentToItem(d.id, d.data())) };
  }

  // Curated rows.
  if (contentType === "artist") return { items: await resolveCurated(db, "artists", contentIds, artistToItem) };
  if (contentType === "story") return { items: await resolveCurated(db, "stories", contentIds, storyToItem) };
  if (contentType !== "auction") return { items: await resolveCurated(db, "content", contentIds, contentToItem) };
  return { items: [] };
}

/** Published experience rows with resolved content, scoped to a page (default home). */
export async function getHomeRowsServer(pageId = "home"): Promise<HomeRow[]> {
  const db = getAdminFirestore();
  const expSnap = await db.collection("experiences").where("isPublished", "==", true).orderBy("order", "asc").get();

  const docs = expSnap.docs.filter((doc) => pageOf(doc.data()) === pageId);
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

/**
 * The home's content (featured + rows), cached in the Next data cache for 60s
 * and tagged so a CMS publish can invalidate it on demand (`revalidateTag`).
 * The home renders at runtime (where Admin creds exist) but reuses this cache
 * across requests, so the experiences graph isn't re-read every load.
 */
export const getHomeContent = unstable_cache(
  async (): Promise<{ featured: HomeFeatured[]; rows: HomeRow[] }> => {
    // Prefer the "home" Page (its carousel + rows). Fall back to the legacy
    // implicit home (default carousel + unscoped rows) if no published home
    // page exists, so `/` is never empty during the transition.
    const home = await getPageContent("home");
    if (home) return { featured: home.featured, rows: home.rows };
    const [featured, rows] = await Promise.all([getFeaturedContentServer(), getHomeRowsServer()]);
    return { featured, rows };
  },
  ["home-content-v2"],
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
}

export interface PageContent {
  page: PageMeta;
  featured: HomeFeatured[];
  rows: HomeRow[];
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
  return page;
}

/**
 * A published page's content (optional banner + rows), resolved server-side.
 * Returns null when no published page exists at that slug.
 */
export async function getPageContent(slug: string): Promise<PageContent | null> {
  const page = await getPageBySlugServer(slug);
  if (!page) return null;

  const [featured, rows] = await Promise.all([
    page.featuredCarouselId
      ? getFeaturedContentServer(page.featuredCarouselId)
      : Promise.resolve<HomeFeatured[]>([]),
    getHomeRowsServer(page.id),
  ]);
  return { page, featured, rows };
}
