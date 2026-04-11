"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { GameLandingPage, type GameMode } from "../_gamecore";
import { JMProButton } from "@/JMKit";
import { useAuth } from "@/lib/AuthProvider";
import { getContentBySlug } from "@/lib/content";
import type { JMContent } from "@/lib/content-types";
import type { CreateSessionInput } from "@/lib/game-sessions";
import { joinGameSessionById, createGameSession, startGame } from "@/lib/game-sessions";
import MegaSketchyGame from "./MegaSketchyGame";

export default function MegaSketchyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, gamertag, avatarName, userTier, isAdmin, isLoading: authLoading } = useAuth();
  const initialSessionId = searchParams.get("sessionId");
  const [mode, setMode] = useState<GameMode | null>(initialSessionId ? "friends" : null);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [gameData, setGameData] = useState<JMContent | null>(null);
  const autoJoinRef = useRef(false);

  const canCreateMissions = isAdmin || userTier === "pro";

  useEffect(() => {
    getContentBySlug("game", "megasketchy").then(setGameData);
  }, []);

  // Auto-join session when arriving via invite link
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
      gameSlug: gameData.slug ?? "megasketchy",
      gameLogoURL: gameData.splashLogoURL ?? gameData.coverURL,
      maxPlayers: gameData.maxPlayers ?? 15,
    };
  }, [gameData]);

  const bgMusicLandingOnly = gameData?.bgMusicLandingOnly ?? false;

  if (mode === "friends" && sessionId) {
    return (
      <MegaSketchyGame
        sessionId={sessionId}
        gameSlug="megasketchy"
        bgMusicLandingOnly={bgMusicLandingOnly}
        {...(gameData?.splashBgURL ? { splashBgURL: gameData.splashBgURL } : {})}
        {...(gameData?.splashLogoURL ? { splashLogoURL: gameData.splashLogoURL } : {})}
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

  const landingExtra = canCreateMissions ? (
    <JMProButton
      title="Create Mission"
      onClick={() => router.push("/games/megasketchy/missions")}
    />
  ) : null;

  const handleSoloPlay = async () => {
    if (!user || !gamertag || !multiplayerInput) return;
    const sess = await createGameSession(multiplayerInput, user.uid, gamertag, avatarName ?? undefined);
    const sides: Record<string, string> = { [user.uid]: "player-1" };
    await startGame(sess.id, sides);
    setSessionId(sess.id);
    setMode("friends");
    router.replace(`/games/megasketchy?sessionId=${sess.id}`);
  };

  return (
    <GameLandingPage
      {...splashProps}
      gameSlug="megasketchy"
      minPlayers={gameData?.minPlayers ?? 4}
      maxPlayers={gameData?.maxPlayers ?? 14}
      subtitle={gameData?.subtitle}
      multiplayerFlowMode="party"
      multiplayerMinPlayers={4}
      bgMusicLandingOnly={bgMusicLandingOnly}
      allowAI
      landingExtra={landingExtra}
      {...(multiplayerInput ? { multiplayerInput } : {})}
      onSoloPlay={handleSoloPlay}
      onMultiplayerStart={(sid) => {
        setSessionId(sid);
        setMode("friends");
        router.replace(`/games/megasketchy?sessionId=${sid}`);
      }}
    />
  );
}
