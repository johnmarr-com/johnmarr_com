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
import BluffBoxGame from "./BluffBoxGame";
import BluffPackLobbySelector from "./BluffPackLobbySelector";

export default function BluffBoxPage() {
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
    getContentBySlug("game", "bluffbox").then(setGameData);
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
      gameSlug: gameData.slug ?? "bluffbox",
      gameLogoURL: gameData.splashLogoURL ?? gameData.coverURL,
      maxPlayers: gameData.maxPlayers ?? 30,
      ...(gameData.retentionDays != null ? { retentionDays: gameData.retentionDays } : {}),
    };
  }, [gameData]);

  const bgMusicLandingOnly = gameData?.bgMusicLandingOnly ?? false;

  if (mode === "friends" && sessionId) {
    return (
      <BluffBoxGame
        sessionId={sessionId}
        {...(gameData?.splashBgURL ? { splashBgURL: gameData.splashBgURL } : {})}
        {...(gameData?.splashLogoURL || gameData?.coverURL
          ? { gameLogoURL: gameData.splashLogoURL ?? gameData.coverURL }
          : {})}
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
      title="Create Bluff Packs"
      onClick={() => router.push("/games/bluffbox/packs")}
    />
  ) : null;

  /** CMS `minPlayers`; lobby Start uses `multiplayerMinPlayers` → {@link GameMultiplayerFlow} (party default is 3 if omitted). */
  const minPlayers = gameData.minPlayers ?? 2;

  return (
    <GameLandingPage
      {...splashProps}
      gameSlug="bluffbox"
      subtitle={gameData.subtitle}
      minPlayers={minPlayers}
      multiplayerMinPlayers={minPlayers}
      maxPlayers={gameData.maxPlayers ?? 30}
      multiplayerFlowMode="party"
      allowAI
      bgMusicLandingOnly={bgMusicLandingOnly}
      {...(multiplayerInput ? { multiplayerInput } : {})}
      lobbyExtra={({ session }) => <BluffPackLobbySelector sessionId={session.id} />}
      landingExtra={landingExtra}
      onMultiplayerStart={(sid) => {
        setSessionId(sid);
        setMode("friends");
      }}
    />
  );
}
