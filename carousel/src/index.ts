/**
 * Carousel — a complete feature-banner system.
 *
 *   <FeaturedCarousel />  renders the banners
 *   <BannerManager />     authors them
 *   BannerStore           is the seam between the two
 *
 * The Firebase adapters are deliberately NOT re-exported here, so an app that
 * is not on Firebase never pulls the SDK into its bundle. Import them
 * directly from ./data/firebase-store and ./data/firebase-server.
 */

export { FeaturedCarousel, DEFAULT_SLIDE_WIDTHS } from "./FeaturedCarousel";
export type {
  FeaturedCarouselProps,
  SlideWidths,
  BannerImageProps,
  BannerImageComponent,
} from "./FeaturedCarousel";

export { BannerManager } from "./admin/BannerManager";
export type { BannerManagerProps } from "./admin/BannerManager";
export { ButtonStylePicker } from "./admin/ButtonStylePicker";
export type { ButtonStylePickerProps } from "./admin/ButtonStylePicker";
export { ImageUpload } from "./admin/ImageUpload";
export type { ImageUploadProps } from "./admin/ImageUpload";

export { resolveBanner, resolveBanners, selectBanners } from "./banners";

export {
  BUILTIN_BUTTON_OPTIONS,
  DEFAULT_BUTTON_STYLE,
  GOLD_BUTTON_STYLE,
  buttonGradient,
  resolveBuiltinStyle,
  resolveButtonStyle,
  resolveStyleFromList,
} from "./button-styles";

export { DEFAULT_CAROUSEL_THEME, mergeTheme } from "./theme";
export type { CarouselTheme } from "./theme";

export type {
  BannerInput,
  BannerPatch,
  BannerRecord,
  BannerStore,
  ButtonStyleInput,
  ButtonStyleRecord,
  CarouselInput,
  CarouselPatch,
  CarouselRecord,
  FeaturedItem,
  ResolvedButtonStyle,
} from "./types";
