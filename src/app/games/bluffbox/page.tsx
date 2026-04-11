"use client";

import { useState, useEffect } from "react";
import { GameLandingPage } from "../_gamecore";
import { getContentBySlug } from "@/lib/content";
import type { JMContent } from "@/lib/content-types";

export default function BluffBoxPage() {
  const [gameData, setGameData] = useState<JMContent | null>(null);

  useEffect(() => {
    getContentBySlug("game", "bluffbox").then(setGameData);
  }, []);

  if (!gameData) return null;

  const splashProps = {
    ...(gameData.splashBgURL ? { splashBgURL: gameData.splashBgURL } : {}),
    ...(gameData.splashIconURL ? { splashIconURL: gameData.splashIconURL } : {}),
    ...(gameData.splashLogoURL ? { splashLogoURL: gameData.splashLogoURL } : {}),
    ...(gameData.backgroundMusicURL ? { backgroundMusicURL: gameData.backgroundMusicURL } : {}),
    ...(gameData.backgroundMusicVolume != null ? { backgroundMusicVolume: gameData.backgroundMusicVolume } : {}),
  };

  return (
    <GameLandingPage
      {...splashProps}
      gameSlug="bluffbox"
      subtitle={gameData.subtitle}
      disabled
    />
  );
}
