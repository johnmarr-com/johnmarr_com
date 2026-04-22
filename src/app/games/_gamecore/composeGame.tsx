"use client";

/**
 * composeGame — Game Factory
 *
 * Returns a Next.js page component that orchestrates the full game flow:
 *   Landing (GC0) → Gate+Lobby (GC1+GC2) → Game (GC3) → Result (GC4) → Replay (GC5)
 *
 * For V1, the landing/gate/lobby phases delegate to the existing
 * GameLandingPage + GameMultiplayerFlow components. The result phase
 * resolves the GC4 variant from the registry. Replay resets session
 * fields and re-enters the game.
 *
 * Usage:
 *   export default composeGame({ slug: "blarf", GameComponent: BlarfGame, ... });
 */

import { useMemo, Suspense } from "react";
import type { ComponentType } from "react";
import type { CreateSessionInput } from "@/lib/game-sessions";
import { resolveVariant } from "./registry/registry";
import type { ComposeGameInput, GC3Props, GC4Props, GameAssembly } from "./registry/types";
import { useGameFlow } from "./useGameFlow";
import { GameLandingPage } from "./GameLandingPage";
import { GameColorsProvider } from "./GameColorsProvider";

// Import the registry index to auto-register all built-in variants
import "./registry";

/** Default assembly — used when a game has no assembly config in Firestore. */
const DEFAULT_ASSEMBLY: GameAssembly = {
  gc0: { variantId: "splash-cinematic" },
  gc1: { variantId: "gate-modal" },
  gc2: { variantId: "lobby-party-packs" },
  gc4: { variantId: "result-leaderboard" },
  gc5: { variantId: "replay-standard" },
};

/**
 * Create a Next.js page component for a composed game.
 */
export function composeGame(config: ComposeGameInput): ComponentType {
  // Create a named component for React DevTools
  function ComposedGamePage() {
    return (
      <Suspense fallback={null}>
        <ComposedGameInner config={config} />
      </Suspense>
    );
  }
  ComposedGamePage.displayName = `ComposedGame(${config.slug})`;
  return ComposedGamePage;
}

// ─── GC4 renderer — resolves variant at its own component boundary ───

/* eslint-disable react-hooks/static-components -- resolveVariant returns a stable ref from the registry Map, not a new component */
function GC4ResultRenderer({
  variantId,
  gameData,
  session,
  result,
  isHost,
  onPlayAgain,
  onExit,
  resultOptions,
}: { variantId: string } & GC4Props) {
  const GC4Component = useMemo(
    () => resolveVariant("gc4", variantId),
    [variantId],
  );
  return (
    <GC4Component
      gameData={gameData}
      session={session}
      result={result}
      isHost={isHost}
      onPlayAgain={onPlayAgain}
      onExit={onExit}
      {...(resultOptions ? { resultOptions } : {})}
    />
  );
}
/* eslint-enable react-hooks/static-components */

// ─── Inner component (needs Suspense boundary for useSearchParams) ───

function ComposedGameInner({ config }: { config: ComposeGameInput }) {
  const flow = useGameFlow(config);
  const {
    phase,
    gameData,
    activeSessionId,
    session,
    isHost,
    gameResult,
    isLoading,
    handleMultiplayerStart,
    handleGameEnd,
    handlePlayAgain,
    handleExit,
  } = flow;

  // Resolve the assembly config from the game's CMS data
  const rawAssembly = gameData ? (gameData as unknown as Record<string, unknown>)["assembly"] : undefined;
  const assembly: GameAssembly = (rawAssembly as GameAssembly | undefined) ?? DEFAULT_ASSEMBLY;

  // Build the multiplayer session input from game data
  const multiplayerInput: CreateSessionInput | undefined = useMemo(() => {
    if (!gameData) return undefined;
    return {
      gameId: gameData.id,
      gameName: gameData.name,
      gameSlug: gameData.slug ?? config.slug,
      gameLogoURL: gameData.splashLogoURL ?? gameData.coverURL,
      maxPlayers: gameData.maxPlayers ?? 30,
      ...(gameData.retentionDays != null ? { retentionDays: gameData.retentionDays } : {}),
    };
  }, [gameData, config.slug]);

  // ─── Loading ─────────────────────────────────────────────
  if (isLoading || !gameData) return null;

  // ─── GC3: Game ───────────────────────────────────────────
  if (phase === "game" && activeSessionId) {
    const GameComponent = config.GameComponent as ComponentType<GC3Props>;
    return (
      <GameColorsProvider gameData={gameData}>
        <GameComponent
          sessionId={activeSessionId}
          gameData={gameData}
          onGameEnd={handleGameEnd}
        />
      </GameColorsProvider>
    );
  }

  // ─── GC4: Result ─────────────────────────────────────────
  if (phase === "result" && gameResult && session) {
    return (
      <GameColorsProvider gameData={gameData}>
        <GC4ResultRenderer
          variantId={assembly.gc4.variantId}
          gameData={gameData}
          session={session}
          result={gameResult}
          isHost={isHost}
          onPlayAgain={handlePlayAgain}
          onExit={handleExit}
          {...(config.resultOptions ? { resultOptions: config.resultOptions } : {})}
        />
      </GameColorsProvider>
    );
  }

  // ─── GC0 + GC1 + GC2: Landing / Gate / Lobby ────────────
  // For V1, GameLandingPage handles all three phases: the splash screen
  // (GC0) plus the dialog flow (GC1 gate + GC2 lobby) via GameMultiplayerFlow.
  return (
    <GameLandingPage
      {...(gameData.splashBgURL ? { splashBgURL: gameData.splashBgURL } : {})}
      {...(gameData.splashBgDim != null ? { splashBgDim: gameData.splashBgDim } : {})}
      {...(gameData.splashIconURL ? { splashIconURL: gameData.splashIconURL } : {})}
      {...(gameData.splashLogoURL ? { splashLogoURL: gameData.splashLogoURL } : {})}
      {...(gameData.backgroundMusicURL ? { backgroundMusicURL: gameData.backgroundMusicURL } : {})}
      {...(gameData.backgroundMusicVolume != null ? { backgroundMusicVolume: gameData.backgroundMusicVolume } : {})}
      {...(gameData.bgMusicLandingOnly != null ? { bgMusicLandingOnly: gameData.bgMusicLandingOnly } : {})}
      gameSlug={gameData.slug ?? config.slug}
      {...(gameData.subtitle ? { subtitle: gameData.subtitle } : {})}
      minPlayers={gameData.minPlayers ?? 1}
      {...(gameData.maxPlayers != null ? { maxPlayers: gameData.maxPlayers } : {})}
      multiplayerFlowMode={config.multiplayerFlowMode ?? "party"}
      {...(gameData.minPlayers != null ? { multiplayerMinPlayers: gameData.minPlayers } : {})}
      {...(config.allowAI != null ? { allowAI: config.allowAI } : {})}
      disabled={!gameData.isPublished}
      {...(multiplayerInput ? { multiplayerInput } : {})}
      {...(config.lobbyExtra != null ? { lobbyExtra: config.lobbyExtra } : {})}
      {...(config.lobbyCanStart ? { lobbyCanStart: config.lobbyCanStart } : {})}
      {...(config.pulseIcon != null ? { pulseIcon: config.pulseIcon } : {})}
      {...(config.rockIcon != null ? { rockIcon: config.rockIcon } : {})}
      {...(config.sideLabels ? { sideLabels: config.sideLabels } : {})}
      onMultiplayerStart={handleMultiplayerStart}
    />
  );
}
