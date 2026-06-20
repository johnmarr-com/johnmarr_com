"use client";

/**
 * GameColorsProvider — provides the game's 4-color palette to all child components.
 *
 * Colors flow from CMS (gameData) → composeGame → this context → any screen/component
 * via the useGameColors() hook. Games no longer need to hardcode hex values.
 */

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import type { JMContent } from "@/lib/content-types";

export interface GameColors {
  /** Titles, headers, highlights, action buttons. */
  primary: string;
  /** Player names, accents, complementary UI. */
  secondary: string;
  /** Backgrounds, secondary actions, modals. */
  tertiary: string;
  /** Alerts, enemy labels, destructive/warning elements. */
  danger: string;
  // ── Pack/selector popup ("game modal") colors (CMS-controlled) ──
  // Empty string = unset; each game's picker supplies its own fallback.
  /** Modal background fill. */
  modalBg: string;
  /** Modal accent — title, selected checkmark, Play button. */
  modalAccent: string;
  /** Active tab highlight. */
  modalTab: string;
  /** Modal frame/border (empty = subtle default border). */
  modalBorder: string;
}

/** Fallback palette — Wordonkulous defaults for backwards compatibility. */
const FALLBACK: GameColors = {
  primary: "#8eff0e",
  secondary: "#00fffc",
  tertiary: "#2563eb",
  danger: "#ff4444",
  modalBg: "",
  modalAccent: "",
  modalTab: "",
  modalBorder: "",
};

const GameColorsContext = createContext<GameColors>(FALLBACK);

/** Extract the palette from a JMContent game document. */
export function colorsFromGameData(gameData: JMContent): GameColors {
  return {
    primary: gameData.primaryColor || FALLBACK.primary,
    secondary: gameData.secondaryColor || FALLBACK.secondary,
    tertiary: gameData.tertiaryColor || FALLBACK.tertiary,
    danger: gameData.dangerColor || FALLBACK.danger,
    modalBg: gameData.modalBgColor || "",
    modalAccent: gameData.modalAccentColor || "",
    modalTab: gameData.modalTabColor || "",
    modalBorder: gameData.modalBorderColor || "",
  };
}

/** The 6-field color shape consumed by JMAssetPicker (structurally compatible). */
export interface PickerColors {
  background: string;
  title: string;
  activeTab: string;
  accent: string;
  buttonText: string;
  border?: string;
}

/** Perceived-luminance test so the action-button text stays legible on its accent. */
function isLightColor(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length < 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Rec. 601 luma
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

/**
 * Map a game's modal palette (background / accent / tab / optional border) onto
 * the JMAssetPicker color shape. Title follows the accent and the button text
 * auto-contrasts, so each game only chooses the meaningful colors.
 */
export function toPickerColors(m: {
  background: string;
  accent: string;
  tab: string;
  border?: string | undefined;
}): PickerColors {
  return {
    background: m.background,
    title: m.accent,
    activeTab: m.tab,
    accent: m.accent,
    buttonText: isLightColor(m.accent) ? "#000000" : "#ffffff",
    ...(m.border ? { border: m.border } : {}),
  };
}

export function GameColorsProvider({
  gameData,
  children,
}: {
  gameData: JMContent;
  children: ReactNode;
}) {
  const colors = useMemo(() => colorsFromGameData(gameData), [gameData]);
  return (
    <GameColorsContext.Provider value={colors}>
      {children}
    </GameColorsContext.Provider>
  );
}

/** Access the game's 4-color palette from any child component. */
export function useGameColors(): GameColors {
  return useContext(GameColorsContext);
}
