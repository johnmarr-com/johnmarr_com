"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { GameLandingPage, type GameMode } from "../_gamecore";
import { JMProButton } from "@/JMKit";
import { useAuth } from "@/lib/AuthProvider";
import { getContentBySlug } from "@/lib/content";
import type { JMContent } from "@/lib/content-types";
import type { CreateSessionInput } from "@/lib/game-sessions";
import SketchinessGame from "./SketchinessGame";

export default function SketchinessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { userTier, isAdmin } = useAuth();
  const initialSessionId = searchParams.get("sessionId");
  const [mode, setMode] = useState<GameMode | null>(initialSessionId ? "friends" : null);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [gameData, setGameData] = useState<JMContent | null>(null);

  const canCreateMissions = isAdmin || userTier === "pro";

  useEffect(() => {
    getContentBySlug("game", "sketchiness").then(setGameData);
  }, []);

  const multiplayerInput: CreateSessionInput | undefined = useMemo(() => {
    if (!gameData) return undefined;
    return {
      gameId: gameData.id,
      gameName: gameData.name,
      gameSlug: gameData.slug ?? "sketchiness",
      gameLogoURL: gameData.splashLogoURL ?? gameData.coverURL,
      maxPlayers: gameData.maxPlayers ?? 15,
    };
  }, [gameData]);

  const bgMusicLandingOnly = gameData?.bgMusicLandingOnly ?? false;

  if (mode === "friends" && sessionId) {
    return (
      <SketchinessGame
        sessionId={sessionId}
        gameSlug="sketchiness"
        bgMusicLandingOnly={bgMusicLandingOnly}
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

  const landingExtra = canCreateMissions ? (
    <JMProButton
      title="Create Mission"
      onClick={() => router.push("/games/sketchiness/missions")}
    />
  ) : null;

  return (
    <GameLandingPage
      {...splashProps}
      gameSlug="sketchiness"
      enabledModes={["friends"]}
      minPlayers={gameData?.minPlayers ?? 3}
      multiplayerFlowMode="party"
      multiplayerMinPlayers={3}
      bgMusicLandingOnly={bgMusicLandingOnly}
      landingExtra={landingExtra}
      {...(multiplayerInput ? { multiplayerInput } : {})}
      onPlay={(m) => setMode(m)}
      onMultiplayerStart={(sid) => {
        setSessionId(sid);
        setMode("friends");
      }}
    />
  );
}
