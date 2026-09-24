/**
 * Server-side banner reader (firebase-admin).
 *
 * Read banners here, not in the browser: the Admin SDK talks plain HTTPS, so
 * the page can be server-rendered/cached and the client never opens a
 * Firestore realtime stream for content that does not change per user.
 * (On johnmarr.com that stream was also what wedged the home banner on iOS.)
 *
 * Returns slides with CTA colors already resolved, ready to hand to
 * <FeaturedCarousel items={...} />.
 */

import type { Firestore } from "firebase-admin/firestore";

import { resolveBuiltinStyle, resolveButtonStyle } from "../button-styles";
import type { FeaturedItem, ResolvedButtonStyle } from "../types";

export interface ServerReadOptions {
  banners?: string;
  carousels?: string;
  buttonStyles?: string;
}

export interface CarouselPayload {
  items: FeaturedItem[];
  /** The carousel's dot color, if it sets one. */
  dotColor?: string;
  autoplayDelay?: number;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function optStr(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/**
 * Per-request resolver from a style id to pill colors. Built-ins resolve with
 * no read; saved ids are fetched once and reused for the rest of the request.
 */
function makeButtonResolver(
  db: Firestore,
  stylesCollection: string,
): (id: string | undefined) => Promise<ResolvedButtonStyle> {
  const cache = new Map<string, ResolvedButtonStyle>();
  return async (id) => {
    const builtin = resolveBuiltinStyle(id ?? "");
    if (builtin) return builtin;
    const key = id as string;
    const cached = cache.get(key);
    if (cached) return cached;
    const snap = await db.doc(`${stylesCollection}/${key}`).get();
    const resolved = resolveButtonStyle(snap.exists ? snap.data() : null);
    cache.set(key, resolved);
    return resolved;
  };
}

/**
 * Active banners for one carousel, ordered, with CTA colors resolved.
 * Pass "" (the default) for the implicit default carousel.
 */
export async function getCarouselItems(
  db: Firestore,
  carouselId = "",
  collections: ServerReadOptions = {},
): Promise<FeaturedItem[]> {
  const BANNERS = collections.banners ?? "featured";
  const STYLES = collections.buttonStyles ?? "buttonStyles";

  const snap = await db
    .collection(BANNERS)
    .where("isActive", "==", true)
    .orderBy("order", "asc")
    .get();

  // Filtered in memory, not in the query: an absent carouselId field cannot be
  // matched by a `where`, and it is what marks the default carousel.
  const docs = snap.docs.filter(
    (d) => str(d.data()["carouselId"]) === carouselId,
  );

  const resolveBtn = makeButtonResolver(db, STYLES);

  return Promise.all(
    docs.map(async (d) => {
      const data = d.data();
      const item: FeaturedItem = {
        id: d.id,
        title: str(data["title"]),
        backdropURL: str(data["backdropURL"]),
        ctaButton: await resolveBtn(str(data["ctaButtonStyleId"])),
      };
      const subtitle = optStr(data["subtitle"]);
      if (subtitle) item.subtitle = subtitle;
      const description = optStr(data["description"]);
      if (description) item.description = description;
      const href = optStr(data["href"]);
      if (href) item.href = href;
      const contentId = optStr(data["contentId"]);
      if (contentId) item.contentId = contentId;
      const contentType = optStr(data["contentType"]);
      if (contentType) item.contentType = contentType;
      const slug = optStr(data["slug"]);
      if (slug) item.slug = slug;
      const ctaLabel = optStr(data["ctaLabel"]);
      if (ctaLabel) item.ctaLabel = ctaLabel;
      return item;
    }),
  );
}

/** Items plus the carousel's own presentation settings, in one call. */
export async function getCarousel(
  db: Firestore,
  carouselId = "",
  collections: ServerReadOptions = {},
): Promise<CarouselPayload> {
  const CAROUSELS = collections.carousels ?? "featuredCarousels";

  const [items, settings] = await Promise.all([
    getCarouselItems(db, carouselId, collections),
    carouselId
      ? db.doc(`${CAROUSELS}/${carouselId}`).get()
      : Promise.resolve(null),
  ]);

  const payload: CarouselPayload = { items };
  const data = settings?.exists ? settings.data() : undefined;
  const dotColor = optStr(data?.["dotColor"]);
  if (dotColor) payload.dotColor = dotColor;
  const delay = data?.["autoplayDelay"];
  if (typeof delay === "number") payload.autoplayDelay = delay;
  return payload;
}
