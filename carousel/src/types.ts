/**
 * Carousel — shared types.
 *
 * Two shapes matter:
 *   BannerRecord  — what is stored (admin-authored, one doc per banner)
 *   FeaturedItem  — what is rendered (CTA colors already resolved to hex)
 *
 * `resolveBanners()` in ./banners.ts converts the first into the second.
 */

/** Concrete values a CTA pill renders with. */
export interface ResolvedButtonStyle {
  /** Gradient start color (hex). */
  from: string;
  /** Gradient end color (hex). Same as `from` ⇒ a solid pill. */
  to: string;
  /** Gradient angle in degrees. */
  angle: number;
  /** Label color (hex). */
  textColor: string;
}

/** A saved, reusable CTA pill style. */
export interface ButtonStyleRecord {
  id: string;
  name: string;
  from: string;
  to: string;
  /** Defaults to 135 when absent. */
  angle?: number;
  textColor: string;
}

export type ButtonStyleInput = Omit<ButtonStyleRecord, "id">;

/**
 * A named carousel. Banners join to it by `carouselId`; banners with no
 * `carouselId` belong to the implicit default carousel (id `""`).
 */
export interface CarouselRecord {
  id: string;
  name: string;
  /** Pagination-dot color (hex). Absent ⇒ the theme accent. */
  dotColor?: string;
  /** ms between auto-advances. Absent ⇒ 6000. 0 disables autoplay. */
  autoplayDelay?: number;
}

export type CarouselInput = Omit<CarouselRecord, "id">;
export type CarouselPatch = Partial<CarouselInput>;

/** A stored banner (one slide). */
export interface BannerRecord {
  id: string;
  /** Owning carousel. Absent/"" ⇒ the default carousel. */
  carouselId?: string;
  title: string;
  subtitle?: string;
  description?: string;
  /** 16:9 backdrop image URL. */
  backdropURL: string;
  /** Where the slide navigates on click. */
  href?: string;
  /** Optional link back to a record in the host app's own content model. */
  contentId?: string;
  contentType?: string;
  slug?: string;
  /** CTA label. Absent ⇒ the carousel's `ctaLabel` prop, else "View". */
  ctaLabel?: string;
  /** Named CTA style id; "" / "pink-purple" / "gold" are built-ins. */
  ctaButtonStyleId?: string;
  /** Sort position, ascending. */
  order: number;
  /** Hidden banners stay stored but are not rendered. */
  isActive: boolean;
}

export type BannerInput = Omit<BannerRecord, "id">;
export type BannerPatch = Partial<BannerInput>;

/** A slide, ready to render. */
export interface FeaturedItem {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  backdropURL: string;
  href?: string;
  contentId?: string;
  contentType?: string;
  slug?: string;
  ctaLabel?: string;
  /** Resolved CTA pill colors. Absent ⇒ DEFAULT_BUTTON_STYLE. */
  ctaButton?: ResolvedButtonStyle;
}

/**
 * Everything the admin UI needs to read and write. Implement it against any
 * backend; ./data/firebase-store.ts is the reference implementation.
 */
export interface BannerStore {
  listCarousels(): Promise<CarouselRecord[]>;
  createCarousel(input: CarouselInput): Promise<CarouselRecord>;
  updateCarousel(id: string, patch: CarouselPatch): Promise<void>;
  deleteCarousel(id: string): Promise<void>;

  /** Banners in one carousel, ordered by `order`. Pass "" for the default. */
  listBanners(carouselId: string): Promise<BannerRecord[]>;
  createBanner(input: BannerInput): Promise<string>;
  updateBanner(id: string, patch: BannerPatch): Promise<void>;
  deleteBanner(id: string): Promise<void>;
  /** Rewrite `order` to match the given sequence. */
  reorderBanners(orderedIds: string[]): Promise<void>;
  /** Upload a backdrop and return its public URL. */
  uploadBackdrop(file: File, bannerId: string): Promise<string>;

  listButtonStyles(): Promise<ButtonStyleRecord[]>;
  createButtonStyle(input: ButtonStyleInput): Promise<ButtonStyleRecord>;
  deleteButtonStyle(id: string): Promise<void>;
}
