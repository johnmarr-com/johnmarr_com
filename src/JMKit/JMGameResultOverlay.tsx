"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { bgMusic, SFX } from "@/app/games/_gamecore";
import { JMConfettiOverlay } from "./JMConfettiOverlay";

export interface JMGameResultOverlayProps {
  /** "win" shows confetti and success audio; "loss" uses bomb styling */
  variant: "win" | "loss";
  /** Team name displayed in the title ("{name} Wins!" / "{name} Loses!") */
  teamName: string;
  /** Hex color for the team (used for tint, border, title text, background) */
  teamColor: string;
  /** Grayscale team logo URL — will be tinted with teamColor */
  teamLogoUrl: string;
  /** Large card image (target for win, bomb for loss) */
  cardImageUrl: string;
  /** Small heading text above the message (e.g. heist title) */
  heading?: string;
  /** Explainer text below the card */
  message?: string;
  /** Audio URL to play when this overlay appears */
  audioUrl?: string | null | undefined;
  /** Whether this viewer is the host (shows Play Again) */
  isHost?: boolean;
  /** Called when host taps Play Again */
  onPlayAgain?: () => void;
  /** Called when the overlay is tapped to dismiss (e.g. loss screen) */
  onDismiss?: () => void;
  /** Duration in ms for the loss countdown bar (default: 10000) */
  lossDuration?: number;
}

const CARD_SIZE = 260;
// Match CardRevealOverlay: centerY = vh/2 - 50
const CARD_OFFSET_Y = -50;

export function JMGameResultOverlay({
  variant,
  teamName,
  teamColor,
  teamLogoUrl,
  cardImageUrl,
  heading,
  message,
  audioUrl,
  isHost,
  onPlayAgain,
  onDismiss,
  lossDuration = 10000,
}: JMGameResultOverlayProps) {
  const [show, setShow] = useState(false);
  const [barStarted, setBarStarted] = useState(false);
  const isWin = variant === "win";

  // Fade in on mount
  useEffect(() => {
    const t = requestAnimationFrame(() => {
      requestAnimationFrame(() => setShow(true));
    });
    return () => cancelAnimationFrame(t);
  }, []);

  // Start loss countdown bar after fade-in completes
  useEffect(() => {
    if (!show || isWin) return;
    const t = setTimeout(() => setBarStarted(true), 700);
    return () => clearTimeout(t);
  }, [show, isWin]);

  // Play audio on mount
  useEffect(() => {
    if (audioUrl) {
      if (isWin) {
        bgMusic.play(audioUrl, 0.3);
      } else {
        bgMusic.playSfx(audioUrl);
      }
    } else if (isWin) {
      bgMusic.playSfx(SFX.SUCCESS);
    }
  }, [audioUrl, isWin]);

  const verbWin = teamName.endsWith("s") ? "Win!" : "Wins!";
  const verbLose = teamName.endsWith("s") ? "Lose!" : "Loses!";

  return (
    <div
      className="fixed inset-0 z-60"
      style={{
        opacity: show ? 1 : 0,
        transition: "opacity 600ms ease-out",
        cursor: onDismiss ? "pointer" : undefined,
      }}
      onClick={onDismiss}
      role={onDismiss ? "button" : undefined}
    >
      {/* Dark team-colored backdrop */}
      <div className="absolute inset-0" style={{ backgroundColor: teamColor }} />
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      />

      {/* Exit button — win screen, top left */}
      {isWin && (
        <Link
          href="/"
          className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-2 py-2 text-sm font-bold text-white active:scale-95 transition-transform"
          style={{
            opacity: show ? 1 : 0,
            transition: "opacity 600ms ease-out 800ms",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-xs leading-none">&#9664;</span>
          EXIT
        </Link>
      )}

      {/* Confetti — win only, single play */}
      {isWin && show && <JMConfettiOverlay />}

      {/* Card image — absolutely centered to match CardRevealOverlay */}
      <div
        className="absolute left-1/2 top-1/2 overflow-hidden rounded-2xl"
        style={{
          width: CARD_SIZE,
          height: CARD_SIZE,
          marginLeft: -CARD_SIZE / 2,
          marginTop: -CARD_SIZE / 2 + CARD_OFFSET_Y,
          border: `6px solid ${teamColor}`,
          opacity: show ? 1 : 0,
          transform: show ? "scale(1)" : "scale(0.9)",
          transition: "opacity 600ms ease-out 350ms, transform 600ms ease-out 350ms",
          zIndex: 10,
        }}
      >
        {cardImageUrl ? (
          <div
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${cardImageUrl})` }}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ backgroundColor: `${teamColor}20` }}
          >
            <span className="text-6xl">{isWin ? "🏆" : "💣"}</span>
          </div>
        )}
      </div>

      {/* Content above the card: logo + title */}
      <div
        className="absolute left-0 right-0 flex flex-col items-center"
        style={{
          bottom: `calc(50% - ${CARD_OFFSET_Y}px + ${CARD_SIZE / 2 + 20}px)`,
          zIndex: 10,
        }}
      >
        {/* Team logo */}
        <div
          className="relative h-[100px] w-[100px] shrink-0 overflow-hidden rounded-full"
          style={{
            backgroundColor: `${teamColor}20`,
            opacity: show ? 1 : 0,
            transform: show ? "scale(1)" : "scale(0.7)",
            transition: "opacity 600ms ease-out 200ms, transform 600ms ease-out 200ms",
          }}
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${teamLogoUrl})` }}
          />
          <div
            className="absolute inset-0"
            style={{ backgroundColor: teamColor, mixBlendMode: "color" }}
          />
        </div>

        {/* Title: Wins! or Loses! */}
        <p
          className="mt-3 text-3xl font-black"
          style={{
            color: teamColor,
            opacity: show ? 1 : 0,
            transform: show ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 600ms ease-out 250ms, transform 600ms ease-out 250ms",
          }}
        >
          {teamName} {isWin ? verbWin : verbLose}
        </p>
      </div>

      {/* Content below the card: heading + message + play again */}
      <div
        className="absolute left-0 right-0 flex flex-col items-center px-4"
        style={{
          top: `calc(50% + ${CARD_OFFSET_Y + CARD_SIZE / 2 + 16}px)`,
          zIndex: 10,
        }}
      >
        {/* Heading (heist title) — bold, team colored */}
        {heading && (
          <p
            className="text-sm font-black uppercase tracking-wider"
            style={{
              color: teamColor,
              opacity: show ? 1 : 0,
              transition: "opacity 600ms ease-out 450ms",
            }}
          >
            {heading}
          </p>
        )}

        {/* Message (win/loss description) — white */}
        {message && (
          <p
            className="mt-2 max-w-xs whitespace-pre-line text-center text-sm leading-relaxed text-white"
            style={{
              opacity: show ? 1 : 0,
              transition: "opacity 600ms ease-out 500ms",
            }}
          >
            {message.replace(/\\n/g, "\n")}
          </p>
        )}

        {/* Loss countdown bar */}
        {!isWin && (
          <div
            className="mt-4 h-1 w-48 overflow-hidden rounded-full bg-black/50"
            style={{
              opacity: show ? 1 : 0,
              transition: "opacity 600ms ease-out 600ms",
            }}
          >
            <div
              className="h-full rounded-full"
              style={{
                backgroundColor: teamColor,
                width: barStarted ? "100%" : "0%",
                transition: barStarted ? `width ${lossDuration}ms linear` : "none",
              }}
            />
          </div>
        )}

        {/* Play Again — host only */}
        {isHost && onPlayAgain && (
          <button
            type="button"
            className="mt-6 rounded-xl px-8 py-3 text-sm font-bold text-white"
            style={{
              backgroundColor: teamColor,
              opacity: show ? 1 : 0,
              transition: "opacity 600ms ease-out 700ms",
            }}
            onClick={(e) => {
              e.stopPropagation();
              onPlayAgain();
            }}
          >
            Play Again
          </button>
        )}
      </div>
    </div>
  );
}
