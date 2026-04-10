"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { GameLandingPage, type GameMode } from "../_gamecore";
import { useAuth } from "@/lib/AuthProvider";
import { getContentBySlug } from "@/lib/content";
import type { JMContent } from "@/lib/content-types";
import type { CreateSessionInput } from "@/lib/game-sessions";
import { joinGameSessionById } from "@/lib/game-sessions";
import SweepTheLegGame from "./SweepTheLegGame";

export default function SweepTheLegPage() {
  const searchParams = useSearchParams();
  const { user, gamertag, avatarName, isLoading: authLoading } = useAuth();
  const initialSessionId = searchParams.get("sessionId");
  const [mode, setMode] = useState<GameMode | null>(initialSessionId ? "friends" : null);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [gameData, setGameData] = useState<JMContent | null>(null);
  const autoJoinRef = useRef(false);

  useEffect(() => {
    getContentBySlug("game", "sweeptheleg").then(setGameData);
  }, []);

  useEffect(() => {
    if (!initialSessionId || autoJoinRef.current || authLoading || !user || !gamertag) return;
    autoJoinRef.current = true;
    joinGameSessionById(initialSessionId, user.uid, gamertag, avatarName ?? undefined).catch(() => {});
  }, [initialSessionId, authLoading, user, gamertag, avatarName]);

  const multiplayerInput: CreateSessionInput | undefined = useMemo(() => {
    if (!gameData) return undefined;
    return {
      gameId: gameData.id,
      gameName: gameData.name,
      gameSlug: gameData.slug ?? "sweeptheleg",
      gameLogoURL: gameData.splashLogoURL ?? gameData.coverURL,
      maxPlayers: gameData.maxPlayers ?? 2,
    };
  }, [gameData]);

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

  if (mode === "friends" && sessionId) {
    return (
      <SweepTheLegGame
        mode={mode}
        sessionId={sessionId}
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
      enabledModes={["ai", "friends"]}
      subtitle={gameData?.subtitle}
      {...(gameData?.minPlayers != null ? { minPlayers: gameData.minPlayers } : {})}
      {...(multiplayerInput ? { multiplayerInput } : {})}
      onPlay={(m) => setMode(m)}
      onMultiplayerStart={(sid) => {
        setSessionId(sid);
        setMode("friends");
      }}
    />
  );
}
