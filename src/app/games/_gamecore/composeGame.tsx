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
import Link from "next/link";
import { resolveBackgroundMusicURL } from "@/lib/game-engine-audio";
import type { CreateSessionInput } from "@/lib/game-sessions";
import { resolveVariant } from "./registry/registry";
import type {
  ComposeGameInput,
  GC3Props,
  GC4Props,
  GameAssembly,
  EngineSkinLoadError,
} from "./registry/types";
import { useGameFlow } from "./useGameFlow";
import { GameLandingPage } from "./GameLandingPage";
import { GameColorsProvider } from "./GameColorsProvider";

// Import the registry index to auto-register all built-in variants
import "./registry";

function EngineSkinErrorMessage({
  error,
  engineSlug,
  paramName,
}: {
  error: EngineSkinLoadError;
  engineSlug: string;
  paramName: string | undefined;
}) {
  const q = paramName ?? "game";
  const example = `/games/${engineSlug}?${q}=your_skin`;
  if (error === "missing_game_param") {
    return (
      <div className="fixed inset-0 z-10 flex flex-col items-center justify-center bg-black p-6 text-center text-white">
        <p className="mb-2 max-w-md text-lg font-bold">Missing game</p>
        <p className="mb-4 max-w-md text-sm text-white/70">
          Set <code className="rounded bg-white/10 px-1.5 py-0.5">{q}</code> to this game’s
          normal <strong>slug</strong> in the CMS (same as a standalone game, e.g.{" "}
          <code className="rounded bg-white/10 px-1">popwow</code>).
        </p>
        <p className="mb-1 font-mono text-xs text-amber-200/90">{example}</p>
        <Link href="/" className="mt-6 text-sm font-bold text-amber-400 underline">
          Home
        </Link>
      </div>
    );
  }
  if (error === "game_wrong_engine") {
    return (
      <div className="fixed inset-0 z-10 flex flex-col items-center justify-center bg-black p-6 text-center text-white">
        <p className="mb-2 max-w-md text-lg font-bold">Wrong game page</p>
        <p className="mb-4 max-w-md text-sm text-white/70">
          This game’s <code className="rounded bg-white/10 px-1">engineSlug</code> in the CMS
          does not match <code className="rounded bg-white/10 px-1">/games/{engineSlug}</code>.
        </p>
        <Link href="/" className="text-sm font-bold text-amber-400 underline">
          Home
        </Link>
      </div>
    );
  }
  return (
    <div className="fixed inset-0 z-10 flex flex-col items-center justify-center bg-black p-6 text-center text-white">
      <p className="mb-2 max-w-md text-lg font-bold">Game not found</p>
      <p className="mb-4 max-w-md text-sm text-white/70">
        No published game with that slug, or the game is still a draft. For engine games,
        <code className="mx-1 rounded bg-white/10 px-1.5 py-0.5">{q}</code> is the
        content <code className="rounded bg-white/10 px-1">slug</code> (e.g.{" "}
        <code className="rounded bg-white/10 px-1">popwow</code>).
      </p>
      <Link href="/" className="text-sm font-bold text-amber-400 underline">
        Home
      </Link>
    </div>
  );
}

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
    engineThemeMusicURL,
    skinLoadError,
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

  const playbackGameData = useMemo(() => {
    if (!gameData) return null;
    const resolved = resolveBackgroundMusicURL(gameData, engineThemeMusicURL);
    if (!resolved || resolved === gameData.backgroundMusicURL?.trim()) {
      return gameData;
    }
    return { ...gameData, backgroundMusicURL: resolved };
  }, [gameData, engineThemeMusicURL]);

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
      ...(gameData.engineSlug != null && gameData.engineSlug !== ""
        ? { engineSlug: gameData.engineSlug }
        : {}),
      ...(config.round?.resolverKey ? { resolverKey: config.round.resolverKey } : {}),
    };
  }, [gameData, config.slug, config.round]);

  // ─── Loading & engine skin resolution ────────────────────
  if (isLoading) return null;
  if (skinLoadError) {
    return <EngineSkinErrorMessage error={skinLoadError} engineSlug={config.slug} paramName={config.contentSlugFromQueryParam} />;
  }
  if (!gameData || !playbackGameData) return null;

  // ─── GC3: Game ───────────────────────────────────────────
  if (phase === "game" && activeSessionId) {
    const GameComponent = config.GameComponent as ComponentType<GC3Props>;
    return (
      <GameColorsProvider gameData={playbackGameData}>
        <GameComponent
          sessionId={activeSessionId}
          gameData={playbackGameData}
          onGameEnd={handleGameEnd}
        />
      </GameColorsProvider>
    );
  }

  // ─── GC4: Result ─────────────────────────────────────────
  if (phase === "result" && gameResult && session) {
    return (
      <GameColorsProvider gameData={playbackGameData}>
        <GC4ResultRenderer
          variantId={assembly.gc4.variantId}
          gameData={playbackGameData}
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
      {...(playbackGameData.splashBgURL ? { splashBgURL: playbackGameData.splashBgURL } : {})}
      {...(playbackGameData.splashBgDim != null ? { splashBgDim: playbackGameData.splashBgDim } : {})}
      {...(playbackGameData.splashIconURL ? { splashIconURL: playbackGameData.splashIconURL } : {})}
      {...(playbackGameData.splashLogoURL ? { splashLogoURL: playbackGameData.splashLogoURL } : {})}
      {...(playbackGameData.backgroundMusicURL ? { backgroundMusicURL: playbackGameData.backgroundMusicURL } : {})}
      {...(playbackGameData.backgroundMusicVolume != null ? { backgroundMusicVolume: playbackGameData.backgroundMusicVolume } : {})}
      {...(playbackGameData.bgMusicLandingOnly != null ? { bgMusicLandingOnly: playbackGameData.bgMusicLandingOnly } : {})}
      gameSlug={playbackGameData.slug ?? config.slug}
      {...(playbackGameData.subtitle ? { subtitle: playbackGameData.subtitle } : {})}
      {...(playbackGameData.gameLikeLabel?.trim() ? { gameLikeLabel: playbackGameData.gameLikeLabel.trim() } : {})}
      minPlayers={playbackGameData.minPlayers ?? 1}
      {...(playbackGameData.maxPlayers != null ? { maxPlayers: playbackGameData.maxPlayers } : {})}
      multiplayerFlowMode={config.multiplayerFlowMode ?? "party"}
      {...(playbackGameData.minPlayers != null ? { multiplayerMinPlayers: playbackGameData.minPlayers } : {})}
      {...(config.allowAI != null ? { allowAI: config.allowAI } : {})}
      disabled={!playbackGameData.isPublished}
      {...(multiplayerInput ? { multiplayerInput } : {})}
      {...(config.lobbyExtra != null ? { lobbyExtra: config.lobbyExtra } : {})}
      {...(config.landingExtra != null ? { landingExtra: config.landingExtra } : {})}
      {...(config.lobbyCanStart ? { lobbyCanStart: config.lobbyCanStart } : {})}
      {...(config.pulseIcon != null ? { pulseIcon: config.pulseIcon } : {})}
      {...(config.rockIcon != null ? { rockIcon: config.rockIcon } : {})}
      {...(config.sideLabels ? { sideLabels: config.sideLabels } : {})}
      onMultiplayerStart={handleMultiplayerStart}
    />
  );
}
