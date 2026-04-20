"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { JMAvatarView } from "@/JMKit";
import { GameBgUnderlay } from "../GameBgUnderlay";

interface TurnResultModalProps {
  /** Game splash under the modal scrim (30%). */
  backgroundImageURL?: string;
  sharerName: string;
  sharerAvatarName?: string | undefined;
  sharerChoice: "truth" | "lie";
  cardURL: string;
  /** The current player's guess, or null if this player was the sharer. */
  playerGuess: "truth" | "lie" | null;
  /** How many guessers the sharer fooled this turn. */
  sharerFooledCount?: number;
  /** Every single guesser was wrong — triggers extra "EVERYONE MISSED!" callout. */
  sharerEarnedFoolBonus?: boolean;
  onDismiss: () => void;
}

/**
 * Full-screen result overlay shown after all guesses are in.
 * Elements animate in: top section slides down, card zoom-fades, bottom slides up.
 */
export default function TurnResultModal({
  backgroundImageURL,
  sharerName,
  sharerAvatarName,
  sharerChoice,
  cardURL,
  playerGuess,
  sharerFooledCount = 0,
  sharerEarnedFoolBonus = false,
  onDismiss,
}: TurnResultModalProps) {
  const lied = sharerChoice === "lie";
  const guessedCorrectly = playerGuess != null && playerGuess === sharerChoice;
  const isSharer = playerGuess == null;

  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      role="presentation"
      onClick={onDismiss}
    >
      <GameBgUnderlay url={backgroundImageURL} />
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-5 px-6">
        {/* ── Top: avatar + verdict — slides down ── */}
        <div
          className={`flex flex-col items-center gap-5 transition-all duration-500 ease-out ${
            visible ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0"
          }`}
        >
          <div className="h-28 w-28">
            <JMAvatarView width={112} avatarName={sharerAvatarName ?? "default"} />
          </div>

          <h2 className="whitespace-pre-line text-center text-2xl font-black uppercase leading-tight tracking-wider text-white">
            {isSharer ? (
              <>
                <span className="normal-case">You</span>
                {"\n"}
                <span className={lied ? "bb-negative-text" : "bb-accent-text"}>
                  {lied ? "LIED!" : "TOLD THE TRUTH!"}
                </span>
              </>
            ) : (
              <>
                {sharerName}
                {"\n"}
                <span className={lied ? "bb-negative-text" : "bb-accent-text"}>
                  {lied ? "LIED!" : "told the TRUTH!"}
                </span>
              </>
            )}
          </h2>
        </div>

        {/* ── Center: card — zoom-fades in ── */}
        <div
          className={`relative aspect-square w-72 overflow-hidden rounded-xl shadow-lg shadow-black/40 transition-all duration-600 ease-out ${
            visible ? "scale-100 opacity-100" : "scale-85 opacity-0"
          }`}
        >
          <Image
            src={cardURL}
            alt="The card"
            fill
            className="object-cover"
            sizes="288px"
          />
        </div>

        {/* ── Bottom: result + tap hint — slides up ── */}
        <div
          className={`flex flex-col items-center gap-3 transition-all duration-500 ease-out ${
            visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
        >
          {/* Guesser result */}
          {!isSharer && (
            <div
              className={`flex flex-col items-center gap-1 text-center font-black uppercase tracking-wider ${
                guessedCorrectly ? "bb-accent-text" : "bb-negative-text"
              }`}
            >
              <span className="text-4xl leading-tight">
                {guessedCorrectly ? "CONGRATS!" : "SORRY!"}
              </span>
              <span className="text-2xl leading-tight">
                {guessedCorrectly ? "+1 Point!" : "No point for you!"}
              </span>
            </div>
          )}

          {/* Sharer result */}
          {isSharer && sharerFooledCount > 0 && (
            <div className="bb-accent-text flex flex-col items-center gap-1 text-center font-black uppercase tracking-wider">
              {sharerEarnedFoolBonus ? (
                <>
                  <span className="text-4xl leading-tight">WOW!</span>
                  <span className="text-2xl leading-tight sm:text-3xl">Everyone missed!</span>
                </>
              ) : (
                <span className="text-2xl leading-tight sm:text-3xl">
                  You fooled {sharerFooledCount} {sharerFooledCount === 1 ? "person" : "people"}!
                </span>
              )}
              <span className="text-3xl leading-tight sm:text-4xl">
                +{Math.min(sharerFooledCount, 3)} {Math.min(sharerFooledCount, 3) === 1 ? "Point" : "Points"}!
              </span>
            </div>
          )}
          {isSharer && sharerFooledCount === 0 && (
            <div className="flex flex-col items-center gap-1 text-center font-black uppercase tracking-wider bb-negative-text">
              <span className="text-2xl leading-tight sm:text-3xl">
                Nobody was fooled!
              </span>
            </div>
          )}

          <p className="mt-2 text-sm font-medium tracking-wide text-white/85 sm:text-base">
            Tap anywhere to continue
          </p>
        </div>
      </div>
    </div>
  );
}
