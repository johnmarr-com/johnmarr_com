"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { SevynRevealResult, SevynTeam, CardType } from "../sevynTypes";
import { SEVYN_COLORS } from "../SevynGame";
import { bgMusic } from "@/app/games/_gamecore";

interface CardRevealOverlayProps {
  result: SevynRevealResult;
  activeTeam: SevynTeam;
  /** The word shown on the card front (unrevealed side) */
  boardWord: string;
  bombSoundUrl?: string | null;
  onDismiss: () => void;
  /** Bomb game-over props — when present, overlay enters loss phase instead of fly-back */
  bombLoss?: {
    losingTeamName: string;
    losingTeamColor: string;
    losingTeamLogoUrl: string;
    bombMessage: string;
  } | null;
  /** Called when the loss display is nearly done, so SevynGame can start rendering VictoryOverlay beneath */
  onStartVictoryTransition?: () => void;
}

function getRevealColor(type: CardType): string {
  switch (type) {
    case "T1": return "#dc2626"; // true red (not brand orange)
    case "T2": return SEVYN_COLORS.t2;
    case "N": return SEVYN_COLORS.neutral;
    case "BOMB": return "#ef4444";
  }
}

function getRevealLabel(type: CardType, activeTeam: SevynTeam): string {
  const isOwn =
    (activeTeam === "syndicate1" && type === "T1") ||
    (activeTeam === "syndicate2" && type === "T2");
  const isOpponent =
    (activeTeam === "syndicate1" && type === "T2") ||
    (activeTeam === "syndicate2" && type === "T1");
  if (isOwn) return "YOUR ASSET";
  if (isOpponent) return "OPPONENT'S ASSET";
  if (type === "N") return "CIVILIAN";
  if (type === "BOMB") return "THE BOMB";
  return "";
}

// Normal: init → fly-out → show → fly-back → done
// Bomb loss: init → fly-out → show → bomb-loss → fade-out → done
type Phase = "init" | "fly-out" | "show" | "fly-back" | "done" | "bomb-loss" | "fade-out";

// Enlarged card dimensions
const TARGET_W = 260;
const TARGET_H = 260;

export default function CardRevealOverlay({
  result,
  activeTeam,
  boardWord,
  bombSoundUrl,
  onDismiss,
  bombLoss,
  onStartVictoryTransition,
}: CardRevealOverlayProps) {
  const [phase, setPhase] = useState<Phase>("init");
  const dismissedRef = useRef(false);
  const soundStartRef = useRef(0);

  // Capture grid card position once on mount
  const [gridRect] = useState<DOMRect | null>(() => {
    if (typeof document === "undefined") return null;
    const el = document.querySelector(`[data-card-index="${result.cardIndex}"]`);
    return el ? el.getBoundingClientRect() : null;
  });

  const color = getRevealColor(result.cardType);
  const label = getRevealLabel(result.cardType, activeTeam);
  const isBomb = result.cardType === "BOMB";
  const isBombLoss = isBomb && !!bombLoss;

  // Preload image, THEN kick off animation
  useEffect(() => {
    let started = false;
    const startAnim = () => {
      if (started) return;
      started = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setPhase("fly-out"));
      });
    };

    if (result.imageUrl) {
      const img = new Image();
      img.onload = startAnim;
      img.onerror = startAnim;
      img.src = result.imageUrl;
      const timeout = setTimeout(startAnim, 3000);
      return () => { started = true; clearTimeout(timeout); };
    } else {
      startAnim();
    }
    return () => { started = true; };
  }, [result.cardIndex, result.imageUrl]);

  // Play reveal sound when fly-out begins
  const isOwnAsset =
    (activeTeam === "syndicate1" && result.cardType === "T1") ||
    (activeTeam === "syndicate2" && result.cardType === "T2");

  useEffect(() => {
    if (phase !== "fly-out") return;
    soundStartRef.current = Date.now();
    if (isBomb && bombSoundUrl) {
      bgMusic.playSfx(bombSoundUrl);
    } else if (isOwnAsset) {
      bgMusic.playSfx("/music/Sound-Success.mp3");
    } else {
      bgMusic.playSfx("/music/Sound-Fail.mp3");
    }
  }, [phase, isBomb, bombSoundUrl, isOwnAsset]);

  // Phase timeline
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    switch (phase) {
      case "fly-out":
        timer = setTimeout(() => setPhase("show"), 700);
        break;
      case "show":
        if (isBombLoss) {
          // Shorter show for bombs — move to loss info quickly
          timer = setTimeout(() => setPhase("bomb-loss"), 2000);
        } else {
          timer = setTimeout(() => setPhase("fly-back"), 4500);
        }
        break;
      case "bomb-loss": {
        // Stay until bomb sound finishes (or minimum 3s for readability)
        const elapsed = Date.now() - soundStartRef.current;
        const soundDuration = (bombSoundUrl ? bgMusic.getBufferDuration(bombSoundUrl) : null) ?? 6;
        const soundMs = soundDuration * 1000;
        const remaining = Math.max(0, soundMs - elapsed);
        const lossDisplayTime = Math.max(3000, remaining + 500);
        timer = setTimeout(() => {
          onStartVictoryTransition?.();
          setPhase("fade-out");
        }, lossDisplayTime);
        break;
      }
      case "fade-out":
        timer = setTimeout(() => {
          setPhase("done");
          if (!dismissedRef.current) {
            dismissedRef.current = true;
            onDismiss();
          }
        }, 800);
        break;
      case "fly-back":
        timer = setTimeout(() => {
          setPhase("done");
          if (!dismissedRef.current) {
            dismissedRef.current = true;
            onDismiss();
          }
        }, 700);
        break;
    }
    return () => clearTimeout(timer!);
  }, [phase, onDismiss, isBombLoss, bombSoundUrl, onStartVictoryTransition]);

  // Tap to skip
  const handleTap = useCallback(() => {
    if (phase === "show" && !isBombLoss) setPhase("fly-back");
    if (phase === "bomb-loss") {
      onStartVictoryTransition?.();
      setPhase("fade-out");
    }
  }, [phase, isBombLoss, onStartVictoryTransition]);

  // Viewport dimensions
  const vw = typeof window !== "undefined" ? window.innerWidth : 375;
  const vh = typeof window !== "undefined" ? window.innerHeight : 812;

  // Center target for enlarged card
  const centerX = vw / 2;
  const centerY = vh / 2 - 50;

  // Grid card metrics
  const gridCX = gridRect ? gridRect.left + gridRect.width / 2 : centerX;
  const gridCY = gridRect ? gridRect.top + gridRect.height / 2 : centerY;
  const gridScale = gridRect ? gridRect.width / TARGET_W : 0.3;

  const dx = gridCX - centerX;
  const dy = gridCY - centerY;

  // Phase-driven styles
  const atGrid = phase === "init" || phase === "fly-back" || phase === "done";
  const shouldTransition = phase !== "init";
  const flyingBack = phase === "fly-back" || phase === "done";
  const isNeutral = result.cardType === "N";
  const inBombLoss = phase === "bomb-loss" || phase === "fade-out";

  // Tint overlay color when flying back to grid
  const tintColor = isNeutral
    ? "rgba(0, 0, 0, 0.55)"
    : result.cardType === "T1"
      ? "rgba(220, 38, 38, 0.35)"
      : result.cardType === "T2"
        ? "rgba(59, 130, 246, 0.35)"
        : "rgba(220, 38, 38, 0.4)";

  const backBorderColor = flyingBack && isNeutral ? "#444" : color;

  // For bomb loss, card stays at center; otherwise normal grid ↔ center
  const posTransform = isBombLoss
    ? (phase === "init" ? `translate(${dx}px, ${dy}px) scale(${gridScale})` : "translate(0, 0) scale(1)")
    : (atGrid ? `translate(${dx}px, ${dy}px) scale(${gridScale})` : "translate(0, 0) scale(1)");

  const flipDeg = phase === "init" ? 0 : 180;

  // Backdrop: for bomb loss, use losing team's dark color; fade-out phase fades everything
  const backdropVisible = phase === "fly-out" || phase === "show" || phase === "bomb-loss";
  const backdropOpacity = backdropVisible ? 1 : phase === "fade-out" ? 0 : 0;
  const backdropColor = isBombLoss && bombLoss
    ? bombLoss.losingTeamColor
    : isBomb
      ? "rgba(220, 38, 38, 0.9)"
      : "rgba(0, 0, 0, 0.85)";

  const infoOpacity = phase === "show" || inBombLoss ? 1 : 0;
  const lossInfoOpacity = inBombLoss ? 1 : 0;
  const ease = "cubic-bezier(0.4, 0, 0.2, 1)";

  // Whole overlay opacity for fade-out phase
  const overlayOpacity = phase === "fade-out" ? 0 : 1;

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={handleTap}
      style={{
        opacity: overlayOpacity,
        transition: phase === "fade-out" ? "opacity 800ms ease-out" : "none",
      }}
    >
      {/* Hide the grid cell while animating */}
      {phase !== "done" && (
        <style>{`[data-card-index="${result.cardIndex}"] { opacity: 0 !important; }`}</style>
      )}

      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: backdropColor,
          opacity: isBombLoss ? (backdropVisible || phase === "fade-out" ? 0.85 : 0) : backdropOpacity,
          backdropFilter: isBombLoss && (backdropVisible || phase === "fade-out") ? "blur(16px)" : "none",
          WebkitBackdropFilter: isBombLoss && (backdropVisible || phase === "fade-out") ? "blur(16px)" : "none",
          transition: shouldTransition ? "opacity 500ms ease-out" : "none",
        }}
      />

      {/* Losing team icon — above the card (bomb loss only) */}
      {isBombLoss && bombLoss && (
        <div
          style={{
            position: "absolute",
            left: centerX - 60,
            top: centerY - TARGET_H / 2 - 140,
            width: 120,
            height: 120,
            opacity: lossInfoOpacity,
            transform: lossInfoOpacity ? "scale(1)" : "scale(0.8)",
            transition: "opacity 500ms ease-out, transform 500ms ease-out",
          }}
        >
          <div
            className="h-full w-full overflow-hidden rounded-full"
            style={{ backgroundColor: `${bombLoss.losingTeamColor}20` }}
          >
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${bombLoss.losingTeamLogoUrl})` }}
            />
            <div
              className="absolute inset-0"
              style={{ backgroundColor: bombLoss.losingTeamColor, mixBlendMode: "color" }}
            />
          </div>
        </div>
      )}

      {/* Card wrapper */}
      <div
        style={{
          position: "absolute",
          left: centerX - TARGET_W / 2,
          top: centerY - TARGET_H / 2,
          width: TARGET_W,
          height: TARGET_H,
          transform: posTransform,
          transition: shouldTransition ? `transform 600ms ${ease}` : "none",
        }}
      >
        <div style={{ perspective: 1200, width: "100%", height: "100%" }}>
          <div
            style={{
              width: "100%",
              height: "100%",
              position: "relative",
              transformStyle: "preserve-3d",
              transform: `rotateY(${flipDeg}deg)`,
              transition: shouldTransition ? `transform 600ms ${ease}` : "none",
            }}
          >
            {/* Front face: word card */}
            <div
              className="absolute inset-0 flex items-center justify-center rounded-xl border-2"
              style={{
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                borderColor: "rgba(255, 255, 255, 0.15)",
              }}
            >
              <span className="px-3 text-center text-lg font-bold text-white/80">
                {boardWord}
              </span>
            </div>

            {/* Back face: revealed image */}
            <div
              className="absolute inset-0 overflow-hidden rounded-xl"
              style={{
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
                border: `6px solid ${backBorderColor}`,
                transition: shouldTransition ? "border-color 600ms ease-out" : "none",
              }}
            >
              {result.imageUrl ? (
                <div
                  className="h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${result.imageUrl})` }}
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center"
                  style={{ backgroundColor: `${color}20` }}
                >
                  <span className="text-5xl font-black" style={{ color }}>
                    {isBomb ? "💣" : "?"}
                  </span>
                </div>
              )}
              {/* Team tint overlay — fades in as card flies back to grid */}
              {!isBombLoss && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundColor: tintColor,
                    opacity: flyingBack ? 1 : 0,
                    transition: "opacity 600ms ease-out",
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Info panel below card — normal reveals */}
      {!isBombLoss && (
        <div
          style={{
            position: "absolute",
            left: centerX - TARGET_W / 2 - 20,
            top: centerY + TARGET_H / 2 + 16,
            width: TARGET_W + 40,
            opacity: infoOpacity,
            transition: "opacity 300ms ease-out",
            pointerEvents: "none",
          }}
        >
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color }}>
              {label}
            </p>
            <p className="mt-1 text-xl font-black text-white">{result.name}</p>
            {result.description && (
              <p className="mt-1 text-sm leading-relaxed text-white/70">
                {result.description}
              </p>
            )}
            {result.assetNumber != null && (
              <p className="mt-1 text-xl font-black" style={{ color }}>
                {result.assetNumber}/7
              </p>
            )}
            <p className="mt-4 text-xs text-white/30">Tap to continue</p>
          </div>
        </div>
      )}

      {/* Bomb loss info panel — below the card */}
      {isBombLoss && bombLoss && (
        <div
          style={{
            position: "absolute",
            left: centerX - TARGET_W / 2 - 20,
            top: centerY + TARGET_H / 2 + 16,
            width: TARGET_W + 40,
            opacity: lossInfoOpacity,
            transition: "opacity 500ms ease-out",
            pointerEvents: "none",
          }}
        >
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-red-400">
              {result.name}
            </p>
            {bombLoss.bombMessage && (
              <p className="mt-1 text-sm leading-relaxed text-white/70">
                {bombLoss.bombMessage}
              </p>
            )}
            <p className="mt-4 text-3xl font-black" style={{ color: bombLoss.losingTeamColor }}>
              {bombLoss.losingTeamName} Loses!
            </p>
            {inBombLoss && (
              <p className="mt-4 text-xs text-white/30">Tap to continue</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
