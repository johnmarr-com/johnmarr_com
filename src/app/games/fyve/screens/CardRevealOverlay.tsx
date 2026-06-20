"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { FyveRevealResult, FyveTeam, CardType } from "../fyveTypes";
import { FYVE_COLORS } from "../FyveGame";
import { bgMusic, SFX } from "@/app/games/_gamecore";
import { useGridCardRect, useImagePreload } from "./overlayHooks";

interface CardRevealOverlayProps {
  result: FyveRevealResult;
  /** The team that TAPPED this card — drives the success/fail sound. Not the
   *  live activeTeam, which the engine may have switched in the same write. */
  revealedByTeam: FyveTeam;
  /** The word shown on the card front (unrevealed side) */
  boardWord: string;
  /** If true, skip fly-back — dismiss so the win overlay can appear on top. */
  isGameEnding?: boolean;
  onDismiss: () => void;
}

function getRevealColor(type: CardType): string {
  switch (type) {
    case "T1": return FYVE_COLORS.t1;
    case "T2": return FYVE_COLORS.t2;
    case "N": return FYVE_COLORS.neutral;
    case "BOMB": return FYVE_COLORS.t1; // shouldn't reach here — bombs use BombFailOverlay
  }
}

type Phase = "init" | "fly-out" | "show" | "fly-back" | "done";

const TARGET_W = 260;
const TARGET_H = 260;
const FLY_DURATION = 700;
const SHOW_DURATION = 4500;
const FLYBACK_DURATION = 700;

export default function CardRevealOverlay({
  result,
  revealedByTeam,
  boardWord,
  isGameEnding = false,
  onDismiss,
}: CardRevealOverlayProps) {
  const [phase, setPhase] = useState<Phase>("init");
  const dismissedRef = useRef(false);

  const gridRect = useGridCardRect(result.cardIndex);
  const color = getRevealColor(result.cardType);

  // Preload image, THEN kick off animation
  useImagePreload(result.imageUrl, () => setPhase("fly-out"));

  // Play reveal sound when fly-out begins. Success = the team that tapped
  // revealed their OWN asset — judged by who tapped, not the live activeTeam
  // (the engine switches activeTeam atomically with a turn-ending reveal, so
  // using it here made a correct final guess play the FAIL sound).
  const isOwnAsset =
    (revealedByTeam === "syndicate1" && result.cardType === "T1") ||
    (revealedByTeam === "syndicate2" && result.cardType === "T2");

  useEffect(() => {
    if (phase !== "fly-out") return;
    bgMusic.playSfx(isOwnAsset ? SFX.SUCCESS : SFX.FAIL);
  }, [phase, isOwnAsset]);

  // Phase timeline
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    switch (phase) {
      case "fly-out":
        timer = setTimeout(() => setPhase("show"), FLY_DURATION);
        break;
      case "show":
        if (isGameEnding) {
          // 5th card win: dismiss after timeout (no fly-back)
          timer = setTimeout(() => {
            if (!dismissedRef.current) {
              dismissedRef.current = true;
              onDismiss();
            }
          }, SHOW_DURATION);
        } else {
          timer = setTimeout(() => setPhase("fly-back"), SHOW_DURATION);
        }
        break;
      case "fly-back":
        timer = setTimeout(() => {
          setPhase("done");
          if (!dismissedRef.current) {
            dismissedRef.current = true;
            onDismiss();
          }
        }, FLYBACK_DURATION);
        break;
    }
    return () => clearTimeout(timer!);
  }, [phase, onDismiss, isGameEnding]);

  // Tap to skip during "show"
  const handleTap = useCallback(() => {
    if (phase !== "show") return;
    if (isGameEnding) {
      if (!dismissedRef.current) {
        dismissedRef.current = true;
        onDismiss();
      }
    } else {
      setPhase("fly-back");
    }
  }, [phase, isGameEnding, onDismiss]);

  // Layout
  const vw = typeof window !== "undefined" ? window.innerWidth : 375;
  const vh = typeof window !== "undefined" ? window.innerHeight : 812;
  const centerX = vw / 2;
  const centerY = vh / 2 - 50;

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

  const tintColor = isNeutral
    ? "rgba(0, 0, 0, 0.55)"
    : result.cardType === "T1"
      ? "rgba(220, 38, 38, 0.35)"
      : result.cardType === "T2"
        ? "rgba(59, 130, 246, 0.35)"
        : "rgba(0, 0, 0, 0.4)";

  const backBorderColor = flyingBack && isNeutral ? "#444" : color;

  const posTransform = atGrid
    ? `translate(${dx}px, ${dy}px) scale(${gridScale})`
    : "translate(0, 0) scale(1)";

  const flipDeg = phase === "init" ? 0 : 180;
  const backdropOpacity = phase === "fly-out" || phase === "show" ? 1 : 0;
  const infoOpacity = phase === "show" ? 1 : 0;
  const ease = "cubic-bezier(0.4, 0, 0.2, 1)";

  return (
    <div className="fixed inset-0 z-50" onClick={handleTap}>
      {phase !== "done" && (
        <style>{`[data-card-index="${result.cardIndex}"] { opacity: 0 !important; }`}</style>
      )}

      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.85)",
          backdropFilter: `blur(${backdropOpacity ? 8 : 0}px)`,
          WebkitBackdropFilter: `blur(${backdropOpacity ? 8 : 0}px)`,
          opacity: backdropOpacity,
          transition: shouldTransition ? "opacity 500ms ease-out, backdrop-filter 500ms ease-out, -webkit-backdrop-filter 500ms ease-out" : "none",
        }}
      />

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
                  <span className="text-5xl font-black" style={{ color }}>?</span>
                </div>
              )}
              {/* Team tint overlay — fades in when flying back to grid */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundColor: tintColor,
                  opacity: flyingBack ? 1 : 0,
                  transition: "opacity 600ms ease-out",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Info panel below card */}
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
          {result.description && (
            <p className="text-base leading-relaxed text-white">
              {result.description}
            </p>
          )}
          <p className="mt-4 text-xs text-white/30">Tap to continue</p>
        </div>
      </div>
    </div>
  );
}
