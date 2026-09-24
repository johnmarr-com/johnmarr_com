/**
 * Carousel theme tokens.
 *
 * The package ships with no styling-framework dependency: every color the
 * carousel and its admin UI paint comes from this object. Pass a partial
 * override to `<FeaturedCarousel theme={...}>` or `<BannerManager theme={...}>`
 * to reskin it; anything you leave out falls back to the default below.
 */

export interface CarouselTheme {
  /** Page/base background behind the carousel. */
  base: string;
  /** Card / panel background. */
  elevated1: string;
  /** Secondary surface — inputs, thumbnails. */
  elevated2: string;
  /** Tertiary surface — input borders. */
  elevated3: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  /** Accent — active pagination dot, admin primary action. */
  accent: string;
  /** Secondary accent — admin "add" action. */
  accentAlt: string;
  success: string;
  error: string;
}

/** johnmarr.com's dark palette — the look the carousel was designed against. */
export const DEFAULT_CAROUSEL_THEME: CarouselTheme = {
  base: "#000000",
  elevated1: "#0A0A0A",
  elevated2: "#141414",
  elevated3: "#1E1E1E",
  textPrimary: "#FFFFFF",
  textSecondary: "#B8B8B8",
  textTertiary: "#808080",
  accent: "#FF36AB",
  accentAlt: "#FFD700",
  success: "#00E676",
  error: "#FF3D71",
};

export function mergeTheme(
  overrides?: Partial<CarouselTheme> | undefined,
): CarouselTheme {
  return overrides
    ? { ...DEFAULT_CAROUSEL_THEME, ...overrides }
    : DEFAULT_CAROUSEL_THEME;
}
