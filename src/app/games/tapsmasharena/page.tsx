"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { GameLandingPage, type GameMode, type AIPersona } from "../_gamecore";
import { useAuth } from "@/lib/AuthProvider";
import { getContentBySlug } from "@/lib/content";
import type { JMContent } from "@/lib/content-types";
import type { CreateSessionInput } from "@/lib/game-sessions";
import { joinGameSessionById } from "@/lib/game-sessions";
import TapSmashArenaGame from "./TapSmashArenaGame";

export default function TapSmashArenaPage() {
  const searchParams = useSearchParams();
  const { user, gamertag, avatarName, isLoading: authLoading } = useAuth();
  const initialSessionId = searchParams.get("sessionId");
  const [mode, setMode] = useState<GameMode | null>(initialSessionId ? "friends" : null);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [gameData, setGameData] = useState<JMContent | null>(null);
  const [aiOpponent, setAiOpponent] = useState<AIPersona | null>(null);
  const autoJoinRef = useRef(false);

  useEffect(() => {
    getContentBySlug("game", "tapsmasharena").then(setGameData);
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
      gameSlug: gameData.slug ?? "tapsmasharena",
      gameLogoURL: gameData.splashLogoURL ?? gameData.coverURL,
      maxPlayers: gameData.maxPlayers ?? 2,
      ...(gameData.retentionDays != null ? { retentionDays: gameData.retentionDays } : {}),
    };
  }, [gameData]);

  if (mode === "ai") {
    return (
      <TapSmashArenaGame
        mode={mode}
        gameSlug="tapsmasharena"
        {...(aiOpponent ? { aiPersona: aiOpponent } : {})}
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
    ...(gameData?.gameLikeLabel?.trim() ? { gameLikeLabel: gameData.gameLikeLabel.trim() } : {}),
  };

  return (
    <GameLandingPage
      {...splashProps}
      gameSlug="tapsmasharena"
      subtitle={gameData?.subtitle}
      {...(gameData?.minPlayers != null ? { minPlayers: gameData.minPlayers } : {})}
      maxPlayers={gameData?.maxPlayers ?? 2}
      iconPadding={10}
      pulseIcon
      allowAI
      {...(multiplayerInput ? { multiplayerInput } : {})}
      sideLabels={["p1", "p2"]}
      onSoloVsAI={(persona) => {
        setAiOpponent(persona);
        setMode("ai");
      }}
      onMultiplayerStart={(sid) => {
        setSessionId(sid);
        setMode("friends");
      }}
    />
  );
}
