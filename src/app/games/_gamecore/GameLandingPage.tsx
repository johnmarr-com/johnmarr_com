"use client";

import { useState, useId } from "react";
import Image from "next/image";
import Link from "next/link";
import { PointsManager, Activity } from "@/lib/points";
import type { CreateSessionInput, GameSession } from "@/lib/game-sessions";
import { GameMultiplayerFlow } from "./GameMultiplayerFlow";
import { PickAIOpponentModal } from "./PickAIOpponentModal";
import { useGameMusic } from "./useGameMusic";
import type { AIPersona } from "./aiPersonas";

export type GameMode = "solo" | "ai" | "friends";

export interface GameLandingPageProps {
  splashBgURL?: string;
  /** 0–100 overlay darkness on splash bg (0 = none, 100 = full black). Default 60. */
  splashBgDim?: number;
  splashIconURL?: string;
  splashLogoURL?: string;
  gameSlug?: string;
  backgroundMusicURL?: string;
  backgroundMusicVolume?: number;
  /** Reduce gap between logo and icon (default 25px padding around icon) */
  iconPadding?: number;
  /** Pulse the splash icon in scale */
  pulseIcon?: boolean;
  /** Rock the splash icon left/right (±4deg rotation) */
  rockIcon?: boolean;
  /** Game content info needed for multiplayer session creation */
  multiplayerInput?: CreateSessionInput;
  /** Side labels for multiplayer (e.g. ["red","white"] or ["p1","p2"]). Only used in versus mode. */
  sideLabels?: [string, string];
  /** "versus" = 2-player with sides (default). "party" = N-player, no sides. */
  multiplayerFlowMode?: "versus" | "party";
  /** Minimum players to enable start in multiplayer. */
  multiplayerMinPlayers?: number;
  /** If true, stop background music when leaving the landing page (game starts). */
  bgMusicLandingOnly?: boolean;
  /** Extra content injected into the host lobby (above Start button). Pass a function to receive the live session. */
  lobbyExtra?: React.ReactNode | ((ctx: { session: GameSession }) => React.ReactNode);
  /** Extra content rendered below the mode buttons on the landing page itself. */
  landingExtra?: React.ReactNode;
  /** Game subtitle displayed beneath the icon and above the mode buttons. */
  subtitle?: string | undefined;
  /** Min players for this game. Controls whether "Play Solo" appears in mode select. */
  minPlayers?: number;
  /** Max players for this game. Used in the "For X to Y players" label. */
  maxPlayers?: number;
  /** True = pure solo (no opponent). false/undefined = solo means vs AI. */
  trueSoloMode?: boolean;
  /** Show the "+ AI" column in the host lobby. */
  allowAI?: boolean;
  /** Additional start condition checked alongside player count. Receives the live session. */
  lobbyCanStart?: (ctx: { session: GameSession }) => boolean;
  /** Disable the Play button (shows "Coming Soon" instead). Music still starts on tap. */
  disabled?: boolean;
  /** Called when user selects "Play Solo" (true solo) from the mode select dialog. */
  onSoloPlay?: () => void;
  /** Called when user picks an AI opponent from the solo vs AI picker. */
  onSoloVsAI?: (persona: AIPersona) => void;
  onMultiplayerStart?: (sessionId: string) => void;
  /** Top-right “likeness” line (e.g. IP tagline). */
  gameLikeLabel?: string;
}

/** Top-right, mirrors EXIT: same type scale, right-aligned. Newlines in the string break lines; a literal `\\n` in source becomes a break too. */
function GameLikeLabel({ text }: { text: string }) {
  const t = text.replace(/\\n/g, "\n");
  return (
    <p
      className="fixed right-[25px] top-[25px] z-20 max-w-[min(200px,50vw)] whitespace-pre-line px-2 py-2 text-right text-sm font-bold text-white"
    >
      {t}
    </p>
  );
}

export function GameLandingPage({
  splashBgURL,
  splashBgDim,
  splashIconURL,
  splashLogoURL,
  gameSlug,
  backgroundMusicURL,
  backgroundMusicVolume = 0.3,
  iconPadding = 25,
  pulseIcon = false,
  rockIcon = false,
  multiplayerInput,
  sideLabels,
  multiplayerFlowMode,
  multiplayerMinPlayers,
  bgMusicLandingOnly = false,
  lobbyExtra,
  landingExtra,
  subtitle,
  minPlayers = 1,
  maxPlayers,
  trueSoloMode,
  allowAI,
  lobbyCanStart,
  disabled,
  onSoloPlay,
  onSoloVsAI,
  onMultiplayerStart,
  gameLikeLabel,
}: GameLandingPageProps) {
  const [mpOpen, setMpOpen] = useState(false);
  const [aiPickerOpen, setAiPickerOpen] = useState(false);
  /** New id each mount (each landing navigation) so the GIF is a new network/decoded instance, not a resumed frame. */
  const jmLogoInstanceId = useId();

  const likeLabelText = gameLikeLabel?.trim() ?? "";

  const musicURL = backgroundMusicURL || (gameSlug ? `/music/${gameSlug}.mp3` : null);
  const { ensurePlaying } = useGameMusic({
    url: musicURL,
    volume: backgroundMusicVolume,
    stopOnUnmount: bgMusicLandingOnly,
  });

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      {/* Background — aspect-fill cover, fades in on load */}
      {splashBgURL && (
        <Image
          src={splashBgURL}
          alt=""
          fill
          sizes="100vw"
          priority
          className="object-cover opacity-0 transition-opacity duration-700"
          style={{ zIndex: 0 }}
          onLoad={(e) => { (e.target as HTMLImageElement).classList.remove("opacity-0"); }}
        />
      )}
      {/* Dim overlay for legibility — driven by splashBgDim (0–100, default 60) */}
      <div className="absolute inset-0 z-1" style={{ backgroundColor: `rgba(0,0,0,${(splashBgDim ?? 60) / 100})` }} />

      {/* John Marr platform mark — on top of dim, under splash art (z-10); short viewports can overlap */}
      <div
        className="pointer-events-none absolute left-1/2 z-5 w-[100px] -translate-x-1/2"
        style={{ top: 110 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- animated GIF */}
        <img
          key={jmLogoInstanceId}
          src={`/images/logos/JM-LOGO.gif?i=${encodeURIComponent(jmLogoInstanceId)}`}
          alt=""
          className="h-auto w-[100px] max-w-none"
        />
      </div>

      <Link
        href="/"
        className="fixed left-[25px] top-[25px] z-20 flex items-center gap-1.5 px-2 py-2 text-sm font-bold text-white transition-transform active:scale-95"
      >
        <span className="text-xs leading-none">&#9664;</span>
        EXIT
      </Link>

      {likeLabelText ? <GameLikeLabel text={likeLabelText} /> : null}

      {/* Title div — centered, max 600px, 50px side padding */}
      <div
        className="relative z-10 flex flex-1 items-center justify-center overflow-y-auto"
      >
      <div
        className="flex w-full flex-col items-center"
        style={{ maxWidth: 600, padding: "0 50px" }}
      >
        {/* Splash Logo — always reserves 2:1 space, image fades in when available */}
        <div className="w-full animate-game-float -mb-6">
          <div className="relative w-full" style={{ aspectRatio: "2 / 1" }}>
            {splashLogoURL && (
              <Image
                src={splashLogoURL}
                alt=""
                fill
                sizes="(max-width: 640px) 80vw, 500px"
                className="animate-landing-fade-in object-contain"
                priority
              />
            )}
          </div>
        </div>

        {/* Splash Icon — always reserves 4:3 space, image fades in when available */}
        <div
          className={`w-full${pulseIcon ? " animate-icon-pulse" : ""}${rockIcon ? " animate-[rock_4.2s_ease-in-out_infinite]" : ""}`}
          style={{ padding: iconPadding }}
        >
          <div className="relative w-full overflow-hidden rounded-[12%]" style={{ aspectRatio: "4 / 3" }}>
            {splashIconURL && (
              <Image
                src={splashIconURL}
                alt=""
                fill
                sizes="(max-width: 640px) 70vw, 400px"
                className="animate-landing-fade-in object-cover"
                style={{ animationDelay: "100ms" }}
                priority
              />
            )}
          </div>
        </div>

        {/* Subtitle — supports <br> and \n for line breaks */}
        {subtitle && (
          <p className="mb-5 animate-landing-fade-in text-center text-lg font-bold tracking-wide text-white/70" style={{ animationDelay: "500ms" }}>
            {subtitle.split(/<br\s*\/?>|\\n|\n/).map((line, i, arr) => (
              <span key={i}>
                {line}
                {i < arr.length - 1 && <br />}
              </span>
            ))}
          </p>
        )}

        {/* Play button */}
        <div className="mt-2 flex w-full animate-landing-fade-in flex-col gap-3" style={{ padding: "0 25px", animationDelay: "650ms" }}>
          <button
            onClick={() => {
              ensurePlaying();
              if (!disabled) setMpOpen(true);
            }}
            className={`w-full rounded-xl py-4 text-lg font-bold uppercase tracking-wider transition-all duration-150 ${
              disabled
                ? "bg-white/20 text-white/40"
                : "bg-white text-black shadow-lg shadow-white/20 hover:scale-[1.03] active:scale-95"
            }`}
          >
            {disabled ? "Coming Soon" : "Play"}
          </button>
          {maxPlayers != null && (
            <p className="mt-1 text-center text-sm font-medium tracking-wide text-white/50">
              For {minPlayers} to {maxPlayers} players
            </p>
          )}
        </div>
      </div>
      </div>

      {/* Landing extras (e.g. Create Missions) — top-right corner */}
      {landingExtra && (
        <div className="absolute right-4 top-4 z-15">
          {landingExtra}
        </div>
      )}

      {/* Play flow dialog (mode select → host lobby / join / solo) */}
      {multiplayerInput && (
        <GameMultiplayerFlow
          open={mpOpen}
          onOpenChange={setMpOpen}
          gameInput={multiplayerInput}
          {...(sideLabels ? { sideLabels } : {})}
          {...(multiplayerFlowMode ? { flowMode: multiplayerFlowMode } : {})}
          {...(multiplayerMinPlayers != null ? { minPlayers: multiplayerMinPlayers } : {})}
          lobbyExtra={lobbyExtra}
          {...(lobbyCanStart ? { lobbyCanStart } : {})}
          showSolo={minPlayers <= 1 && !!(onSoloPlay || onSoloVsAI)}
          {...(trueSoloMode != null ? { trueSoloMode } : {})}
          {...(allowAI != null ? { allowAI } : {})}
          onSoloPlay={
            trueSoloMode && onSoloPlay
              ? () => {
                  setMpOpen(false);
                  PointsManager.award(Activity.PLAY_GAME);
                  onSoloPlay();
                }
              : onSoloVsAI
                ? () => {
                    setMpOpen(false);
                    setAiPickerOpen(true);
                  }
                : onSoloPlay
                  ? () => {
                      setMpOpen(false);
                      PointsManager.award(Activity.PLAY_GAME);
                      onSoloPlay();
                    }
                  : undefined
          }
          onGameStart={(sessionId) => {
            setMpOpen(false);
            PointsManager.award(Activity.PLAY_GAME);
            onMultiplayerStart?.(sessionId);
          }}
        />
      )}

      {/* AI Opponent Picker (solo vs AI flow) */}
      {onSoloVsAI && (
        <PickAIOpponentModal
          open={aiPickerOpen}
          onOpenChange={setAiPickerOpen}
          onSelect={(persona) => {
            setAiPickerOpen(false);
            PointsManager.award(Activity.PLAY_GAME);
            onSoloVsAI(persona);
          }}
        />
      )}

      {/* Float + fade animation keyframes */}
      <style jsx global>{`
        @keyframes game-float {
          0%, 100% { transform: translateY(14px); }
          50% { transform: translateY(-14px); }
        }
        .animate-game-float {
          animation: game-float 3s ease-in-out infinite;
        }
        @keyframes landing-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-landing-fade-in {
          opacity: 0;
          animation: landing-fade-in 500ms ease-out forwards;
        }
      `}</style>
    </div>
  );
}
