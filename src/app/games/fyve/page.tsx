"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { GameLandingPage, type GameMode } from "../_gamecore";
import { useAuth } from "@/lib/AuthProvider";
import { getContentBySlug } from "@/lib/content";
import type { JMContent } from "@/lib/content-types";
import type { CreateSessionInput } from "@/lib/game-sessions";
import { joinGameSessionById } from "@/lib/game-sessions";
import { JMProButton } from "@/JMKit";
import type { GameSession } from "@/lib/game-sessions";
import FyveGame from "./FyveGame";
import HeistLobbySelector from "./HeistLobbySelector";

export default function FyvePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, gamertag, avatarName, isLoading: authLoading, isAdmin, userTier } = useAuth();
  const initialSessionId = searchParams.get("sessionId");
  const [mode, setMode] = useState<GameMode | null>(initialSessionId ? "friends" : null);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [gameData, setGameData] = useState<JMContent | null>(null);
  const autoJoinRef = useRef(false);

  const canCreate = isAdmin || userTier === "pro";

  useEffect(() => {
    getContentBySlug("game", "fyve").then(setGameData);
  }, []);

  // Auto-join via invite link
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
      gameSlug: gameData.slug ?? "fyve",
      gameLogoURL: gameData.splashLogoURL ?? gameData.coverURL,
      maxPlayers: gameData.maxPlayers ?? 30,
      ...(gameData.retentionDays != null ? { retentionDays: gameData.retentionDays } : {}),
    };
  }, [gameData]);

  const bgMusicLandingOnly = gameData?.bgMusicLandingOnly ?? false;

  // In-game view
  if (mode === "friends" && sessionId) {
    return (
      <FyveGame
        sessionId={sessionId}
        {...(gameData?.splashBgURL ? { splashBgURL: gameData.splashBgURL } : {})}
        {...(gameData?.splashLogoURL || gameData?.coverURL
          ? { gameLogoURL: gameData.splashLogoURL ?? gameData.coverURL }
          : {})}
        {...(gameData?.backgroundMusicURL ? { musicUrl: gameData.backgroundMusicURL } : {})}
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
      title="Build Heists"
      onClick={() => router.push("/games/fyve/heists")}
    />
  ) : null;

  // FYVE is 4+ players (2 teams of 2+ each)
  const minPlayers = gameData.minPlayers ?? 4;
  const accentColor = gameData.primaryColor ?? "#E84C1E";

  return (
    <GameLandingPage
      {...splashProps}
      gameSlug="fyve"
      subtitle={gameData.subtitle}
      minPlayers={minPlayers}
      multiplayerMinPlayers={minPlayers}
      maxPlayers={gameData.maxPlayers ?? 30}
      multiplayerFlowMode="party"
      bgMusicLandingOnly={bgMusicLandingOnly}
      {...(multiplayerInput ? { multiplayerInput } : {})}
      landingExtra={landingExtra}
      lobbyExtra={({ session }: { session: GameSession }) => (
        <HeistLobbySelector sessionId={session.id} accentColor={accentColor} />
      )}
      lobbyCanStart={({ session }: { session: GameSession }) =>
        !!(session as unknown as Record<string, unknown>)["fyveLobbyHeistId"]
      }
      onMultiplayerStart={(sid) => {
        setSessionId(sid);
        setMode("friends");
      }}
    />
  );
}
