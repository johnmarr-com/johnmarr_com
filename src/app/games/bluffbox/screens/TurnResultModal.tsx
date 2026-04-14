"use client";

import Image from "next/image";
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
  /** 3+ player games: sharer gets +1 when no guesser was right. */
  sharerEarnedFoolBonus?: boolean;
  onDismiss: () => void;
}

/**
 * Full-screen result overlay shown after all guesses are in.
 * - Verdict: guessers see "{Name}" + LIED / told the TRUTH; sharer sees "You" + LIED / TOLD THE TRUTH
 * - The actual card image
 * - Personal result for guessers only (CONGRATS / SORRY)
 */
export default function TurnResultModal({
  backgroundImageURL,
  sharerName,
  sharerAvatarName,
  sharerChoice,
  cardURL,
  playerGuess,
  sharerEarnedFoolBonus = false,
  onDismiss,
}: TurnResultModalProps) {
  const lied = sharerChoice === "lie";
  const guessedCorrectly = playerGuess != null && playerGuess === sharerChoice;
  const isSharer = playerGuess == null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      role="presentation"
      onClick={onDismiss}
    >
      <GameBgUnderlay url={backgroundImageURL} />
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-5 px-6">
        {/* Sharer avatar */}
        <div className="h-28 w-28">
          <JMAvatarView width={112} avatarName={sharerAvatarName ?? "default"} />
        </div>

        {/* Verdict */}
        <h2 className="whitespace-pre-line text-center text-2xl font-black uppercase leading-tight tracking-wider text-white">
          {isSharer ? (
            <>
              <span className="normal-case">You</span>
              {"\n"}
              <span className={lied ? "text-orange-400" : "text-green-400"}>
                {lied ? "LIED!" : "TOLD THE TRUTH!"}
              </span>
            </>
          ) : (
            <>
              {sharerName}
              {"\n"}
              <span className={lied ? "text-orange-400" : "text-green-400"}>
                {lied ? "LIED!" : "told the TRUTH!"}
              </span>
            </>
          )}
        </h2>

        {/* The actual card — 1.5× previous 12rem (w-48) */}
        <div className="relative aspect-square w-72 overflow-hidden rounded-xl shadow-lg shadow-black/40">
          <Image
            src={cardURL}
            alt="The card"
            fill
            className="object-cover"
            sizes="288px"
          />
        </div>

        {/* Personal result: guessers (CONGRATS / SORRY); sharer bonus when everyone missed (3+ players) */}
        {!isSharer && (
          <div
            className={`flex flex-col items-center gap-1 text-center font-black uppercase tracking-wider ${
              guessedCorrectly ? "text-green-400" : "text-orange-400"
            }`}
          >
            <span className="text-4xl leading-tight">
              {guessedCorrectly ? "CONGRATS!" : "SORRY!"}
            </span>
            <span className="text-2xl leading-tight">
              {guessedCorrectly ? "+1 POINT!" : "NO POINT FOR YOU!"}
            </span>
          </div>
        )}
        {isSharer && sharerEarnedFoolBonus && (
          <div className="flex flex-col items-center gap-1 text-center font-black uppercase tracking-wider text-green-400">
            <span className="text-4xl leading-tight">WOW!</span>
            <span className="text-3xl leading-tight sm:text-4xl">EVERYONE MISSED!</span>
            <span className="text-2xl leading-tight">+1 POINT!</span>
          </div>
        )}

        <p className="mt-2 text-sm font-medium tracking-wide text-white/85 sm:text-base">
          Tap anywhere to continue
        </p>
      </div>
    </div>
  );
}
