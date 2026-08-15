import type {
  AZVCardType,
  AZVWeaponType,
  AZVTextStyle,
  AZVTextStyles,
  AZVTextAlign,
  AZVTextColor,
  AZVTextWeight,
} from "@/lib/azv-packs";

/**
 * Per-CardType authoring spec: which optional inputs each type shows, and
 * which foreground overlay (public/games/azv/…) is auto-composited over the
 * background. Shared by the builder form, the live preview, and the renderer.
 */

export interface AZVTypeSpec {
  /** Optional inputs this type exposes (title + background are universal). */
  fields: {
    weaponType?: boolean;
    level?: boolean;
    hits?: boolean;
    hunger?: boolean;
    hope?: boolean;
    conditions?: boolean;
    description?: boolean;
    oneTimePower?: boolean;
  };
  /** Foreground overlay path, or null for none. BadStuff resolves by level. */
  overlay: string | null | ((level: number) => string);
}

const HUMAN = "/games/azv/Human-Overlay.png";
const GOOD_STUFF = "/games/azv/GoodStuff-Overlay.png";
const MEGA = "/games/azv/Mega-Stuff-Overlay.png";

/** BadStuff mall floors, level 1–5. */
const BAD_STUFF_OVERLAYS: Record<number, string> = {
  1: "/games/azv/1-ParkingLot-Overlay.png",
  2: "/games/azv/2-FoodCourt-Overlay.png",
  3: "/games/azv/3-CoolShops-Overlay.png",
  4: "/games/azv/4-PremiumBrands-Overlay.png",
  5: "/games/azv/5-Helipad-Overlay.png",
};

export const AZV_TYPE_SPEC: Record<AZVCardType, AZVTypeSpec> = {
  Humans: {
    fields: { hope: true, hits: true, description: true, oneTimePower: true },
    overlay: HUMAN,
  },
  Targets: {
    fields: {},
    overlay: null,
  },
  BadStuff: {
    fields: { level: true, hits: true, hunger: true, description: true, conditions: true },
    overlay: (level) => BAD_STUFF_OVERLAYS[level] ?? BAD_STUFF_OVERLAYS[1]!,
  },
  GoodStuff: {
    fields: { weaponType: true, hope: true, description: true },
    overlay: GOOD_STUFF,
  },
  MegaStuff: {
    fields: { weaponType: true, hope: true, description: true },
    overlay: MEGA,
  },
  GoodRoll: { fields: { level: true }, overlay: null },
  BadRoll: { fields: { level: true }, overlay: null },
  Levels: { fields: { level: true }, overlay: null },
  RoundCounter: { fields: { level: true }, overlay: null },
};

/** Text/stat placement on the 900×1500 card (shared by preview + renderer). */
export const AZV_LAYOUT = {
  /** Transparent title box — horizontally centered, center Y = 212. Bold. */
  title: { x: 165, y: 167, w: 570, h: 90, maxFontSize: 90 },
  /** Hits number (or weapon icon) — 125×125 centered at (212, 985). Bold. */
  hits: { cx: 212, cy: 985, size: 125, maxFontSize: 90 },
  /** Hope / Hunger number — 125×125 centered at (684, 985). Bold. */
  hopeHunger: { cx: 684, cy: 985, size: 125, maxFontSize: 90 },
} as const;

/** A text role's style with every field resolved to a concrete value. */
export interface AZVResolvedTextStyle {
  font: string | undefined;
  size: number;
  weight: AZVTextWeight;
  color: AZVTextColor;
  align: AZVTextAlign;
}

const ROLE_DEFAULTS: Record<keyof AZVTextStyles, AZVResolvedTextStyle> = {
  title: { font: undefined, size: AZV_LAYOUT.title.maxFontSize, weight: "bold", color: "white", align: "center" },
  description: { font: undefined, size: 40, weight: "normal", color: "white", align: "center" },
  numbers: { font: undefined, size: AZV_LAYOUT.hits.maxFontSize, weight: "bold", color: "white", align: "center" },
};

/** Resolve a role's style against its defaults. */
export function resolveAZVTextStyle(
  role: keyof AZVTextStyles,
  styles: AZVTextStyles | undefined,
): AZVResolvedTextStyle {
  const d = ROLE_DEFAULTS[role];
  const s: AZVTextStyle = styles?.[role] ?? {};
  return {
    font: s.font ?? d.font,
    size: s.size ?? d.size,
    weight: s.weight ?? d.weight,
    color: s.color ?? d.color,
    align: s.align ?? d.align,
  };
}

/** Weapon type badge graphic (125×125 slot). */
export function weaponIconPath(weapon: AZVWeaponType): string {
  return `/games/azv/Type-${weapon}.png`;
}

/** Resolve the overlay path for a card (null = no overlay). */
export function overlayForCard(cardType: AZVCardType, level: number | undefined): string | null {
  const spec = AZV_TYPE_SPEC[cardType];
  if (typeof spec.overlay === "function") return spec.overlay(level ?? 1);
  return spec.overlay;
}
