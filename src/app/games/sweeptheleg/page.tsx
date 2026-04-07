"use client";

import { useState, useEffect } from "react";
import { GameLandingPage, type GameMode } from "../_gamecore";
import { getContentBySlug } from "@/lib/content";
import type { JMContent } from "@/lib/content-types";
import SweepTheLegGame from "./SweepTheLegGame";

export default function SweepTheLegPage() {
  const [mode, setMode] = useState<GameMode | null>(null);
  const [gameData, setGameData] = useState<JMContent | null>(null);
  useEffect(() => {
    getContentBySlug("game", "sweeptheleg").then(setGameData);
  }, []);

  if (mode === "ai") {
    return (
      <SweepTheLegGame
        mode={mode}
        gameSlug="sweeptheleg"
        {...(gameData?.splashLogoURL ? { splashLogoURL: gameData.splashLogoURL } : {})}
        {...(gameData?.splashBgURL ? { splashBgURL: gameData.splashBgURL } : {})}
        {...(gameData?.backgroundMusicURL ? { backgroundMusicURL: gameData.backgroundMusicURL } : {})}
        {...(gameData?.backgroundMusicVolume != null ? { backgroundMusicVolume: gameData.backgroundMusicVolume } : {})}
      />
    );
  }

  const splashProps = {
    ...(gameData?.splashBgURL ? { splashBgURL: gameData.splashBgURL } : {}),
    ...(gameData?.splashIconURL ? { splashIconURL: gameData.splashIconURL } : {}),
    ...(gameData?.splashLogoURL ? { splashLogoURL: gameData.splashLogoURL } : {}),
    ...(gameData?.backgroundMusicURL ? { backgroundMusicURL: gameData.backgroundMusicURL } : {}),
    ...(gameData?.backgroundMusicVolume != null ? { backgroundMusicVolume: gameData.backgroundMusicVolume } : {}),
  };

  return (
    <GameLandingPage
      {...splashProps}
      gameSlug="sweeptheleg"
      enabledModes={["ai"]}
      onPlay={(m) => setMode(m)}
    />
  );
}
