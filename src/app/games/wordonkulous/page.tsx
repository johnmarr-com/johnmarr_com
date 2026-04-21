"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { GameLandingPage } from "../_gamecore";
import { useAuth } from "@/lib/AuthProvider";
import { getContentBySlug } from "@/lib/content";
import type { JMContent } from "@/lib/content-types";
import type { CreateSessionInput } from "@/lib/game-sessions";
import { joinGameSessionById } from "@/lib/game-sessions";
import { JMProButton } from "@/JMKit";
import WordonkulousGame from "./WordonkulousGame";
import WordonkulousPackLobbySelector from "./WordonkulousPackLobbySelector";

export default function WordonkulousPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, gamertag, avatarName, isLoading: authLoading, isAdmin, userTier } = useAuth();
  const initialSessionId = searchParams.get("sessionId");
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [gameData, setGameData] = useState<JMContent | null>(null);
  const autoJoinRef = useRef(false);

  const canCreate = isAdmin || userTier === "pro";

  useEffect(() => {
    getContentBySlug("game", "wordonkulous").then(setGameData);
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
      gameSlug: gameData.slug ?? "wordonkulous",
      gameLogoURL: gameData.splashLogoURL ?? gameData.coverURL,
      maxPlayers: gameData.maxPlayers ?? 30,
      ...(gameData.retentionDays != null ? { retentionDays: gameData.retentionDays } : {}),
    };
  }, [gameData]);

  const bgMusicLandingOnly = gameData?.bgMusicLandingOnly ?? false;

  // Prefer URL sessionId (handles client-side nav from My Games while already on this page)
  const activeSessionId = initialSessionId ?? sessionId;

  if (activeSessionId) {
    return (
      <WordonkulousGame
        sessionId={activeSessionId}
        {...(gameData?.splashBgURL ? { splashBgURL: gameData.splashBgURL } : {})}
        {...(gameData?.splashLogoURL || gameData?.coverURL
          ? { gameLogoURL: gameData.splashLogoURL ?? gameData.coverURL }
          : {})}
        {...(gameData?.splashIconURL ? { splashIconURL: gameData.splashIconURL } : {})}
      />
    );
  }

  if (!gameData) return null;

  const splashProps = {
    ...(gameData.splashBgURL ? { splashBgURL: gameData.splashBgURL } : {}),
    ...(gameData.splashIconURL ? { splashIconURL: gameData.splashIconURL } : {}),
    ...(gameData.splashLogoURL ? { splashLogoURL: gameData.splashLogoURL } : {}),
    ...(gameData.backgroundMusicURL ? { backgroundMusicURL: gameData.backgroundMusicURL } : {}),
    ...(gameData.backgroundMusicVolume != null ? { backgroundMusicVolume: gameData.backgroundMusicVolume } : {}),
  };

  const landingExtra = canCreate ? (
    <JMProButton
      title="Create Word Packs"
      onClick={() => router.push("/games/wordonkulous/packs")}
    />
  ) : null;

  const minPlayers = gameData.minPlayers ?? 2;

  return (
    <GameLandingPage
      {...splashProps}
      gameSlug="wordonkulous"
      subtitle={gameData.subtitle}
      minPlayers={minPlayers}
      multiplayerMinPlayers={minPlayers}
      maxPlayers={gameData.maxPlayers ?? 30}
      multiplayerFlowMode="party"
      allowAI
      bgMusicLandingOnly={bgMusicLandingOnly}
      {...(multiplayerInput ? { multiplayerInput } : {})}
      lobbyExtra={({ session }) => <WordonkulousPackLobbySelector sessionId={session.id} />}
      landingExtra={landingExtra}
      onMultiplayerStart={(sid) => {
        setSessionId(sid);
      }}
    />
  );
}
