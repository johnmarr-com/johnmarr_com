/**
 * Stored banners → renderable slides.
 *
 * The carousel never reads a style id; it only paints colors. Resolution
 * happens once, wherever the banners are loaded (ideally on the server, so
 * the browser is handed finished hex values).
 */

import { resolveStyleFromList } from "./button-styles";
import type {
  BannerRecord,
  ButtonStyleRecord,
  FeaturedItem,
} from "./types";

/** Active banners for one carousel, in order. Pass "" for the default. */
export function selectBanners(
  records: readonly BannerRecord[],
  carouselId = "",
): BannerRecord[] {
  return records
    .filter((b) => b.isActive && (b.carouselId ?? "") === carouselId)
    .sort((a, b) => a.order - b.order);
}

/** Resolve one stored banner into a slide. */
export function resolveBanner(
  record: BannerRecord,
  styles: readonly ButtonStyleRecord[] = [],
): FeaturedItem {
  const item: FeaturedItem = {
    id: record.id,
    title: record.title,
    backdropURL: record.backdropURL,
    ctaButton: resolveStyleFromList(record.ctaButtonStyleId ?? "", styles),
  };
  // Assigned conditionally so optional keys stay absent rather than undefined.
  if (record.subtitle) item.subtitle = record.subtitle;
  if (record.description) item.description = record.description;
  if (record.href) item.href = record.href;
  if (record.contentId) item.contentId = record.contentId;
  if (record.contentType) item.contentType = record.contentType;
  if (record.slug) item.slug = record.slug;
  if (record.ctaLabel) item.ctaLabel = record.ctaLabel;
  return item;
}

/** Select + resolve in one step — the usual entry point. */
export function resolveBanners(
  records: readonly BannerRecord[],
  styles: readonly ButtonStyleRecord[] = [],
  carouselId = "",
): FeaturedItem[] {
  return selectBanners(records, carouselId).map((r) => resolveBanner(r, styles));
}
