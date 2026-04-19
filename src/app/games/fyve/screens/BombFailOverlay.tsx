"use client";

/**
 * BombFailOverlay — single unified bomb-loss experience.
 *
 * Owns the entire sequence: card fly-from-grid → flip → dark team backdrop →
 * team logo + "Loses!" title + description + countdown bar → onDismiss.
 *
 * Replaces the old CardRevealOverlay→JMGameResultOverlay handoff for bombs.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { FyveTeam } from "../fyveTypes";
import { FYVE_COLORS } from "../FyveGame";
import { bgMusic } from "@/app/games/_gamecore";
import { useGridCardRect, useImagePreload } from "./overlayHooks";

// ─── Constants ─────────────────────────────────────────────

const CARD_SIZE = 260;
const CARD_OFFSET_Y = -50; // match CardRevealOverlay / JMGameResultOverlay
const FLY_DURATION = 650; // ms — card flies to center + flips
const LOSS_DURATION = 10_000; // ms — countdown before auto-dismiss

type Phase = "init" | "fly" | "reveal" | "done";

// ─── Props ─────────────────────────────────────────────────

export interface BombFailOverlayProps {
  /** Index of the bomb card in the grid (for capturing position + hiding cell) */
  cardIndex: number;
  /** Word shown on the card front */
  boardWord: string;
  /** Bomb card image URL */
  bombImageUrl: string;
  /** Bomb audio URL */
  bombAudioUrl: string | null;
  /** Bomb description text */
  bombDescription: string;
  /** The team that tapped the bomb (the losing team) */
  losingTeam: FyveTeam;
  /** Display name of the losing team */
  losingTeamName: string;
  /** Logo URL for the losing team */
  losingTeamLogoUrl: string;
  /** Called when the loss sequence is over (timer or tap) → show win screen */
  onDismiss: () => void;
}

export default function BombFailOverlay({
  cardIndex,
  boardWord,
  bombImageUrl,
  bombAudioUrl,
  bombDescription,
  losingTeam,
  losingTeamName,
  losingTeamLogoUrl,
  onDismiss,
}: BombFailOverlayProps) {
  const [phase, setPhase] = useState<Phase>("init");
  const [barStarted, setBarStarted] = useState(false);
  const dismissedRef = useRef(false);

  const teamColor = losingTeam === "syndicate1" ? FYVE_COLORS.t1 : FYVE_COLORS.t2;

  const gridRect = useGridCardRect(cardIndex);

  // ─── Preload bomb image, then start ────────────────────────
  useImagePreload(bombImageUrl, () => setPhase("fly"));

  // ─── Phase timeline ────────────────────────────────────────
  useEffect(() => {
    let tA: ReturnType<typeof setTimeout>;
    let tB: ReturnType<typeof setTimeout>;
    if (phase === "fly") {
      tA = setTimeout(() => setPhase("reveal"), FLY_DURATION);
    } else if (phase === "reveal") {
      tA = setTimeout(() => setBarStarted(true), 400);
      tB = setTimeout(() => {
        if (!dismissedRef.current) {
          dismissedRef.current = true;
          onDismiss();
        }
      }, 400 + LOSS_DURATION);
    }
    return () => { clearTimeout(tA); clearTimeout(tB); };
  }, [phase, onDismiss]);

  // ─── Play bomb audio when reveal phase begins ──────────────
  useEffect(() => {
    if (phase !== "reveal" || !bombAudioUrl) return;
    bgMusic.playSfx(bombAudioUrl);
  }, [phase, bombAudioUrl]);

  // ─── Tap to skip ──────────────────────────────────────────
  const handleTap = useCallback(() => {
    if (phase !== "reveal") return;
    if (!dismissedRef.current) {
      dismissedRef.current = true;
      onDismiss();
    }
  }, [phase, onDismiss]);

  // ─── Layout calculations ──────────────────────────────────
  const vw = typeof window !== "undefined" ? window.innerWidth : 375;
  const vh = typeof window !== "undefined" ? window.innerHeight : 812;
  const centerX = vw / 2;
  const centerY = vh / 2 + CARD_OFFSET_Y;

  const gridCX = gridRect ? gridRect.left + gridRect.width / 2 : centerX;
  const gridCY = gridRect ? gridRect.top + gridRect.height / 2 : centerY;
  const gridScale = gridRect ? gridRect.width / CARD_SIZE : 0.3;

  const dx = gridCX - centerX;
  const dy = gridCY - centerY;

  // ─── Phase-driven styles ──────────────────────────────────
  const atGrid = phase === "init";
  const isFlying = phase === "fly" || phase === "reveal" || phase === "done";
  const isRevealed = phase === "reveal" || phase === "done";
  const shouldTransition = phase !== "init";
  const ease = "cubic-bezier(0.4, 0, 0.2, 1)";

  const posTransform = atGrid
    ? `translate(${dx}px, ${dy}px) scale(${gridScale})`
    : "translate(0, 0) scale(1)";
  const flipDeg = atGrid ? 0 : 180;
  const backdropOpacity = isFlying ? 1 : 0;

  const verbLose = losingTeamName.endsWith("s") ? "Lose!" : "Loses!";

  return (
    <div className="fixed inset-0 z-60" onClick={handleTap}>
      {/* Hide the grid cell */}
      <style>{`[data-card-index="${cardIndex}"] { opacity: 0 !important; }`}</style>

      {/* Dark team-colored backdrop (two layers — matches JMGameResultOverlay loss) */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: teamColor,
          opacity: backdropOpacity,
          transition: shouldTransition ? `opacity ${FLY_DURATION}ms ease-out` : "none",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "rgba(0,0,0,0.7)",
          backdropFilter: isFlying ? "blur(16px)" : "blur(0px)",
          WebkitBackdropFilter: isFlying ? "blur(16px)" : "blur(0px)",
          opacity: backdropOpacity,
          transition: shouldTransition
            ? `opacity ${FLY_DURATION}ms ease-out, backdrop-filter ${FLY_DURATION}ms ease-out, -webkit-backdrop-filter ${FLY_DURATION}ms ease-out`
            : "none",
        }}
      />

      {/* ── Card: flies from grid to center + flips ── */}
      <div
        style={{
          position: "absolute",
          left: centerX - CARD_SIZE / 2,
          top: centerY - CARD_SIZE / 2,
          width: CARD_SIZE,
          height: CARD_SIZE,
          transform: posTransform,
          transition: shouldTransition ? `transform ${FLY_DURATION}ms ${ease}` : "none",
          zIndex: 10,
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
              transition: shouldTransition ? `transform ${FLY_DURATION}ms ${ease}` : "none",
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

            {/* Back face: bomb image with team-color border */}
            <div
              className="absolute inset-0 overflow-hidden rounded-xl"
              style={{
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                transform: "rotateY(180deg)",
                border: `6px solid ${teamColor}`,
              }}
            >
              {bombImageUrl ? (
                <div
                  className="h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${bombImageUrl})` }}
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center"
                  style={{ backgroundColor: `${teamColor}20` }}
                >
                  <span className="text-5xl font-black">💣</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Loss UI: animates in above the card after fly completes ── */}
      <div
        className="absolute left-0 right-0 flex flex-col items-center"
        style={{
          bottom: `calc(50% - ${CARD_OFFSET_Y}px + ${CARD_SIZE / 2 + 20}px)`,
          zIndex: 10,
          opacity: isRevealed ? 1 : 0,
          transform: isRevealed ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 500ms ease-out, transform 500ms ease-out",
        }}
      >
        {/* Team logo */}
        <div
          className="relative h-[100px] w-[100px] shrink-0 overflow-hidden rounded-full"
          style={{ backgroundColor: `${teamColor}20` }}
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${losingTeamLogoUrl})` }}
          />
          <div
            className="absolute inset-0"
            style={{ backgroundColor: teamColor, mixBlendMode: "color" }}
          />
        </div>

        {/* Title */}
        <p className="mt-3 text-3xl font-black" style={{ color: teamColor }}>
          {losingTeamName} {verbLose}
        </p>
      </div>

      {/* ── Loss info below the card ── */}
      <div
        className="absolute left-0 right-0 flex flex-col items-center px-4"
        style={{
          top: `calc(50% + ${CARD_OFFSET_Y + CARD_SIZE / 2 + 16}px)`,
          zIndex: 10,
          opacity: isRevealed ? 1 : 0,
          transition: "opacity 500ms ease-out 200ms",
        }}
      >
        {bombDescription && (
          <p className="max-w-xs whitespace-pre-line text-center text-sm leading-relaxed text-white">
            {bombDescription.replace(/\\n/g, "\n")}
          </p>
        )}

        {/* Countdown bar */}
        <div
          className="mt-4 h-1 w-48 overflow-hidden rounded-full bg-black/50"
          style={{
            opacity: isRevealed ? 1 : 0,
            transition: "opacity 500ms ease-out 400ms",
          }}
        >
          <div
            className="h-full rounded-full"
            style={{
              backgroundColor: teamColor,
              width: barStarted ? "100%" : "0%",
              transition: barStarted ? `width ${LOSS_DURATION}ms linear` : "none",
            }}
          />
        </div>
      </div>
    </div>
  );
}
