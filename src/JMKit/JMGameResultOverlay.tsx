"use client";

import { useState, useEffect } from "react";
import { bgMusic } from "@/app/games/_gamecore";
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
}

const CARD_SIZE = 260;

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
}: JMGameResultOverlayProps) {
  const [show, setShow] = useState(false);
  const isWin = variant === "win";

  // Fade in on mount
  useEffect(() => {
    const t = requestAnimationFrame(() => {
      requestAnimationFrame(() => setShow(true));
    });
    return () => cancelAnimationFrame(t);
  }, []);

  // Play audio on mount
  useEffect(() => {
    if (audioUrl) {
      if (isWin) {
        bgMusic.play(audioUrl, 0.3);
      } else {
        bgMusic.playSfx(audioUrl);
      }
    } else if (isWin) {
      bgMusic.playSfx("/music/Sound-Success.mp3");
    }
  }, [audioUrl, isWin]);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center"
      style={{
        opacity: show ? 1 : 0,
        transition: "opacity 600ms ease-out",
        cursor: onDismiss ? "pointer" : undefined,
      }}
      onClick={onDismiss}
      role={onDismiss ? "button" : undefined}
    >
      {/* Dark team-colored backdrop */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: teamColor,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      />

      {/* Confetti — win only, single play */}
      {isWin && show && <JMConfettiOverlay />}

      <div className="relative z-10 flex flex-col items-center px-4">
        {/* Team logo */}
        <div
          className="relative h-[120px] w-[120px] shrink-0 overflow-hidden rounded-full"
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

        {/* Title: Wins! or Loses! — below logo, above card */}
        <p
          className="mt-4 text-4xl font-black"
          style={{
            color: teamColor,
            opacity: show ? 1 : 0,
            transform: show ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 600ms ease-out 250ms, transform 600ms ease-out 250ms",
          }}
        >
          {teamName} {isWin
            ? (teamName.endsWith("s") ? "Win!" : "Wins!")
            : (teamName.endsWith("s") ? "Lose!" : "Loses!")}
        </p>

        {/* Card image (target or bomb) */}
        <div
          className="mt-5 overflow-hidden rounded-2xl"
          style={{
            width: CARD_SIZE,
            height: CARD_SIZE,
            border: `6px solid ${teamColor}`,
            opacity: show ? 1 : 0,
            transform: show ? "scale(1)" : "scale(0.9)",
            transition: "opacity 600ms ease-out 350ms, transform 600ms ease-out 350ms",
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

        {/* Heading (heist title) — bold, team colored */}
        {heading && (
          <p
            className="mt-4 text-sm font-black uppercase tracking-wider"
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
            className="mt-2 max-w-xs text-center text-sm leading-relaxed text-white"
            style={{
              opacity: show ? 1 : 0,
              transition: "opacity 600ms ease-out 500ms",
            }}
          >
            {message}
          </p>
        )}

        {/* Play Again — host only */}
        {isHost && onPlayAgain && (
          <button
            type="button"
            className="mt-8 rounded-xl px-8 py-3 text-sm font-bold text-white"
            style={{
              backgroundColor: teamColor,
              opacity: show ? 1 : 0,
              transition: "opacity 600ms ease-out 700ms",
            }}
            onClick={onPlayAgain}
          >
            Play Again
          </button>
        )}
      </div>
    </div>
  );
}
