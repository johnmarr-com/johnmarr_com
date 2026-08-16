import type {
  AZVCardType,
  AZVWeaponType,
  AZVGoodStuffType,
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

/** Optional inputs a card exposes (title + background are universal). */
export interface AZVFieldFlags {
  goodStuffType?: boolean;
  weaponType?: boolean;
  level?: boolean;
  hits?: boolean;
  hunger?: boolean;
  hope?: boolean;
  conditions?: boolean;
  description?: boolean;
  oneTimePower?: boolean;
}

/** What a card's fields/overlay depend on beyond its CardType. */
export interface AZVCardContext {
  level?: number | undefined;
  goodStuffType?: AZVGoodStuffType | undefined;
}

export interface AZVTypeSpec {
  fields: AZVFieldFlags | ((ctx: AZVCardContext) => AZVFieldFlags);
  /** Overlay path, null for none — BadStuff resolves by level, Good Stuff by
   * sub-kind. */
  overlay: string | null | ((ctx: AZVCardContext) => string | null);
  /** Highest level this type uses. Mall floors go to 5; loot stops at 4
   * (nothing is looted on the Helipad). */
  maxLevel?: number;
}

const HUMAN = "/games/azv/Human-Overlay.png";
const MEGA = "/games/azv/Mega-Stuff-Overlay.png";

/** Good Stuff overlays by sub-kind. */
const GOOD_STUFF_OVERLAYS: Record<AZVGoodStuffType, string> = {
  Weapon: "/games/azv/AZV-GS-W-Overlay.png",
  Armor: "/games/azv/AZV-GS-A-Overlay.png",
  Energy: "/games/azv/AZV-GS-E-Overlay.png",
};

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
    overlay: ({ level }) => BAD_STUFF_OVERLAYS[level ?? 1] ?? BAD_STUFF_OVERLAYS[1]!,
  },
  GoodStuff: {
    // Weapons carry a damage type and Hope; armor and energy are title + text.
    fields: ({ goodStuffType }) =>
      goodStuffType === "Armor" || goodStuffType === "Energy"
        ? { goodStuffType: true, level: true, description: true }
        : { goodStuffType: true, level: true, weaponType: true, hope: true, description: true },
    overlay: ({ goodStuffType }) => GOOD_STUFF_OVERLAYS[goodStuffType ?? "Weapon"],
    maxLevel: 4,
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
  /** Description block — wraps + shrinks to fit. Conditions share this box
   * (a card has description OR conditions, never both). */
  description: { x: 150, y: 1150, w: 600, h: 170 },
  /** One condition row: bold "Type:" + 70×70 weapon icon + note, centered. */
  conditionRow: { height: 80, iconSize: 70, gap: 12 },
} as const;

/** A text role's style with every field resolved to a concrete value. */
export interface AZVResolvedTextStyle {
  font: string | undefined;
  size: number;
  weight: AZVTextWeight;
  color: AZVTextColor;
  align: AZVTextAlign;
  /** Vertical nudge in card pixels (+down / −up). */
  offsetY: number;
}

const ROLE_DEFAULTS: Record<keyof AZVTextStyles, AZVResolvedTextStyle> = {
  title: { font: undefined, size: AZV_LAYOUT.title.maxFontSize, weight: "bold", color: "white", align: "center", offsetY: 0 },
  description: { font: undefined, size: 32, weight: "normal", color: "black", align: "center", offsetY: 0 },
  numbers: { font: undefined, size: AZV_LAYOUT.hits.maxFontSize, weight: "bold", color: "white", align: "center", offsetY: 0 },
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
    offsetY: s.offsetY ?? d.offsetY,
  };
}

/** Weapon type badge graphic (125×125 slot). */
export function weaponIconPath(weapon: AZVWeaponType): string {
  return `/games/azv/Type-${weapon}.png`;
}

/** Resolve the overlay path for a card (null = no overlay). */
export function overlayForCard(cardType: AZVCardType, ctx: AZVCardContext = {}): string | null {
  const spec = AZV_TYPE_SPEC[cardType];
  return typeof spec.overlay === "function" ? spec.overlay(ctx) : spec.overlay;
}

/** Resolve which inputs a card exposes. */
export function fieldsForCard(cardType: AZVCardType, ctx: AZVCardContext = {}): AZVFieldFlags {
  const spec = AZV_TYPE_SPEC[cardType];
  return typeof spec.fields === "function" ? spec.fields(ctx) : spec.fields;
}

/** Highest selectable level for a card type (default 5). */
export function maxLevelForCard(cardType: AZVCardType): number {
  return AZV_TYPE_SPEC[cardType].maxLevel ?? 5;
}
