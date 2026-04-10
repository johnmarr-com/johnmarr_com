"use client";

import { useState, useEffect, useMemo } from "react";
import { GameLandingPage, type GameMode } from "../_gamecore";
import { getContentBySlug } from "@/lib/content";
import type { JMContent } from "@/lib/content-types";
import type { CreateSessionInput } from "@/lib/game-sessions";
import TapSmashArenaGame from "./TapSmashArenaGame";

export default function TapSmashArenaPage() {
  const [mode, setMode] = useState<GameMode | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [gameData, setGameData] = useState<JMContent | null>(null);
  useEffect(() => {
    getContentBySlug("game", "tapsmasharena").then(setGameData);
  }, []);

  const multiplayerInput: CreateSessionInput | undefined = useMemo(() => {
    if (!gameData) return undefined;
    return {
      gameId: gameData.id,
      gameName: gameData.name,
      gameSlug: gameData.slug ?? "tapsmasharena",
      gameLogoURL: gameData.splashLogoURL ?? gameData.coverURL,
      maxPlayers: gameData.maxPlayers ?? 2,
    };
  }, [gameData]);

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

  if (mode === "friends" && sessionId) {
    return (
      <TapSmashArenaGame
        mode={mode}
        sessionId={sessionId}
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
      enabledModes={["ai", "friends"]}
      {...(gameData?.minPlayers != null ? { minPlayers: gameData.minPlayers } : {})}
      iconPadding={10}
      pulseIcon
      {...(multiplayerInput ? { multiplayerInput } : {})}
      sideLabels={["p1", "p2"]}
      onPlay={(m) => setMode(m)}
      onMultiplayerStart={(sid) => {
        setSessionId(sid);
        setMode("friends");
      }}
    />
  );
}
