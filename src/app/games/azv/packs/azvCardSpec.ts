import type { AZVCardType } from "@/lib/azv-packs";

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

const GENERAL = "/games/azv/General-Overlay.png";
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
    overlay: GENERAL,
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
    overlay: GENERAL,
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

/** Resolve the overlay path for a card (null = no overlay). */
export function overlayForCard(cardType: AZVCardType, level: number | undefined): string | null {
  const spec = AZV_TYPE_SPEC[cardType];
  if (typeof spec.overlay === "function") return spec.overlay(level ?? 1);
  return spec.overlay;
}
