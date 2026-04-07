"use client";

import { useState, useEffect } from "react";
import { GameLandingPage, type GameMode } from "../_gamecore";
import { getContentBySlug } from "@/lib/content";
import type { JMContent } from "@/lib/content-types";
import SweepTheLegGame from "./SweepTheLegGame";

export default function SweepTheLegPage() {
  const [mode, setMode] = useState<GameMode | null>(null);
  const [gameData, setGameData] = useState<JMContent | null>(null);
  const [debugError, setDebugError] = useState<string | null>(null);

  useEffect(() => {
    getContentBySlug("game", "sweeptheleg")
      .then((data) => {
        setGameData(data);
        if (!data) setDebugError("getContentBySlug returned null");
      })
      .catch((err) => {
        setDebugError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  if (mode === "ai") {
    return (
      <SweepTheLegGame
        mode={mode}
        {...(gameData?.splashLogoURL ? { splashLogoURL: gameData.splashLogoURL } : {})}
        {...(gameData?.splashBgURL ? { splashBgURL: gameData.splashBgURL } : {})}
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
    <>
      <GameLandingPage
        {...splashProps}
        gameSlug="sweeptheleg"
        enabledModes={["ai"]}
        onPlay={(m) => setMode(m)}
      />
      {debugError && (
        <div className="fixed bottom-4 left-4 right-4 z-50 rounded-lg bg-red-900/90 px-4 py-2 text-xs text-white">
          DEBUG: {debugError}
        </div>
      )}
    </>
  );
}
