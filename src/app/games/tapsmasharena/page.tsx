"use client";

import { useState, useEffect } from "react";
import { GameLandingPage, type GameMode } from "../_gamecore";
import { getContentBySlug } from "@/lib/content";
import type { JMContent } from "@/lib/content-types";
import TapSmashArenaGame from "./TapSmashArenaGame";

export default function TapSmashArenaPage() {
  const [mode, setMode] = useState<GameMode | null>(null);
  const [gameData, setGameData] = useState<JMContent | null>(null);
  useEffect(() => {
    getContentBySlug("game", "tapsmasharena").then(setGameData);
  }, []);

  if (mode === "ai") {
    return (
      <TapSmashArenaGame
        mode={mode}
        gameSlug="tapsmasharena"
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
      gameSlug="tapsmasharena"
      enabledModes={["ai"]}
      iconPadding={10}
      pulseIcon
      onPlay={(m) => setMode(m)}
    />
  );
}
