/**
 * Ideogram 3.0 Generate v3 — subset we expose in Bluff Box.
 * Note: OpenAPI lists `FICTION` on `StyleTypeV3`, but the live Generate v3 endpoint rejects it (400).
 * We do not offer FICTION; legacy saves map to GENERAL in `ideogramStyleRules`.
 */

export type IdeogramRenderingSpeed = "FLASH" | "TURBO" | "DEFAULT" | "QUALITY";

export type IdeogramStyleType = "AUTO" | "GENERAL" | "REALISTIC" | "DESIGN";

export type IdeogramMagicPrompt = "AUTO" | "ON" | "OFF";

/** Optional; when set, sent as `style_preset`. */
export type IdeogramStylePresetV3 =
  | ""
  | "80S_ILLUSTRATION"
  | "90S_NOSTALGIA"
  | "ABSTRACT_ORGANIC"
  | "ANALOG_NOSTALGIA"
  | "ART_BRUT"
  | "ART_DECO"
  | "ART_POSTER"
  | "AURA"
  | "AVANT_GARDE"
  | "BAUHAUS"
  | "BLUEPRINT"
  | "BLURRY_MOTION"
  | "BRIGHT_ART"
  | "C4D_CARTOON"
  | "CHILDRENS_BOOK"
  | "COLLAGE"
  | "COLORING_BOOK_I"
  | "COLORING_BOOK_II"
  | "CUBISM"
  | "DARK_AURA"
  | "DOODLE"
  | "DOUBLE_EXPOSURE"
  | "DRAMATIC_CINEMA"
  | "EDITORIAL"
  | "EMOTIONAL_MINIMAL"
  | "ETHEREAL_PARTY"
  | "EXPIRED_FILM"
  | "FLAT_ART"
  | "FLAT_VECTOR"
  | "FOREST_REVERIE"
  | "GEO_MINIMALIST"
  | "GLASS_PRISM"
  | "GOLDEN_HOUR"
  | "GRAFFITI_I"
  | "GRAFFITI_II"
  | "HALFTONE_PRINT"
  | "HIGH_CONTRAST"
  | "HIPPIE_ERA"
  | "ICONIC"
  | "JAPANDI_FUSION"
  | "JAZZY"
  | "LONG_EXPOSURE"
  | "MAGAZINE_EDITORIAL"
  | "MINIMAL_ILLUSTRATION"
  | "MIXED_MEDIA"
  | "MONOCHROME"
  | "NIGHTLIFE"
  | "OIL_PAINTING"
  | "OLD_CARTOONS"
  | "PAINT_GESTURE"
  | "POP_ART"
  | "RETRO_ETCHING"
  | "RIVIERA_POP"
  | "SPOTLIGHT_80S"
  | "STYLIZED_RED"
  | "SURREAL_COLLAGE"
  | "TRAVEL_POSTER"
  | "VINTAGE_GEO"
  | "VINTAGE_POSTER"
  | "WATERCOLOR"
  | "WEIRD"
  | "WOODBLOCK_PRINT";

export interface IdeogramImageOptions {
  rendering_speed: IdeogramRenderingSpeed;
  style_type: IdeogramStyleType;
  magic_prompt: IdeogramMagicPrompt;
  /** Cards and pack art are square in-app; keep `1x1` unless we add other ratios later. */
  aspect_ratio: "1x1";
  negative_prompt: string;
  /** Empty string = random / omit. */
  seed: string;
  style_preset: IdeogramStylePresetV3;
}

export const DEFAULT_IDEOGRAM_IMAGE_OPTIONS: IdeogramImageOptions = {
  rendering_speed: "QUALITY",
  style_type: "REALISTIC",
  magic_prompt: "ON",
  aspect_ratio: "1x1",
  negative_prompt: "",
  seed: "",
  style_preset: "",
};
