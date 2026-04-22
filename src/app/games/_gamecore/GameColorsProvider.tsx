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
}

/** Fallback palette — Wordonkulous defaults for backwards compatibility. */
const FALLBACK: GameColors = {
  primary: "#8eff0e",
  secondary: "#00fffc",
  tertiary: "#2563eb",
  danger: "#ff4444",
};

const GameColorsContext = createContext<GameColors>(FALLBACK);

/** Extract the 4-color palette from a JMContent game document. */
export function colorsFromGameData(gameData: JMContent): GameColors {
  return {
    primary: gameData.primaryColor || FALLBACK.primary,
    secondary: gameData.secondaryColor || FALLBACK.secondary,
    tertiary: gameData.tertiaryColor || FALLBACK.tertiary,
    danger: gameData.dangerColor || FALLBACK.danger,
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
