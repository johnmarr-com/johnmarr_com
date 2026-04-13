"use client";

import Image from "next/image";
import { useEffect } from "react";
import JMAvatarView from "@/JMKit/JMAvatarView";

/** Middle column width — matches SharerView / OneVsAll header. */
const VS_COL = "w-[min(6.5rem,18vw)] min-w-[4.75rem] shrink-0";

interface TurnResultScreenProps {
  roundNumber: number;
  bonusRoundCount: number;
  /** Game splash / cover art behind UI at 30% opacity. */
  backgroundImageURL?: string;
  /** Bluff Box logo (top left), same as matchup flow. */
  gameLogoURL?: string;
  sharerName: string;
  opponentName: string;
  sharerAvatarName?: string;
  opponentAvatarName?: string;
  sharerChoice: "truth" | "lie";
  opponentGuess: "truth" | "lie";
  /** True when the opponent guessed correctly — sharer is eliminated. */
  sharerEliminated: boolean;
  onComplete: () => void;
}

export default function TurnResultScreen({
  roundNumber,
  bonusRoundCount,
  backgroundImageURL,
  gameLogoURL,
  sharerName,
  opponentName,
  sharerAvatarName,
  opponentAvatarName,
  sharerChoice,
  opponentGuess,
  sharerEliminated,
  onComplete,
}: TurnResultScreenProps) {
  useEffect(() => {
    // TODO(design): revert to ~3500ms after layout pass — 1h so the result screen stays up while designing
    const timer = setTimeout(onComplete, 60 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const isBonus = bonusRoundCount > 0;
  const roundLabel = isBonus ? `BONUS ROUND ${bonusRoundCount}` : `ROUND ${roundNumber}`;

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col bg-neutral-950"
      onClick={onComplete}
      role="presentation"
    >
      {backgroundImageURL != null && backgroundImageURL.length > 0 ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-30"
          style={{ backgroundImage: `url(${backgroundImageURL})` }}
        />
      ) : null}

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        {/* Logo + round — same pattern as SharerView / Matchup */}
        <div className="relative z-20 shrink-0 px-3 pt-3 sm:px-4 sm:pt-4">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
            <div className="flex min-w-0 items-center justify-start">
              {gameLogoURL != null && gameLogoURL.length > 0 ? (
                <Image
                  src={gameLogoURL}
                  alt=""
                  width={280}
                  height={140}
                  className="h-14 w-auto max-w-[min(220px,52vw)] object-contain object-bottom-left opacity-95 select-none sm:h-16"
                  priority={false}
                />
              ) : null}
            </div>
            <div className={VS_COL} aria-hidden />
            <div className="flex min-w-0 items-center justify-end">
              <span className="block max-w-[min(100%,52vw)] bg-linear-to-r from-amber-200/90 via-white to-blue-200/90 bg-clip-text text-right text-sm font-black uppercase leading-snug tracking-[0.22em] text-transparent sm:text-base">
                {roundLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10">
          {/* Sharer at risk — large animated avatar */}
          <div className="mb-10 flex shrink-0 flex-col items-center">
            <div className="rounded-full ring-2 ring-white/20 shadow-[0_0_48px_rgba(0,0,0,0.45)]">
              <JMAvatarView
                width={200}
                avatarName={sharerAvatarName ?? "default"}
              />
            </div>
          </div>

          {/* Main headline — same scale as prior title (text-3xl) */}
          <div className="mb-12 max-w-lg text-center text-3xl font-black uppercase leading-tight tracking-wider">
            <span className="block text-white">{sharerName}</span>
            {sharerChoice === "truth" ? (
              <span className="mt-1 block text-white">
                TOLD THE <span className="text-green-400">TRUTH</span>!
              </span>
            ) : (
              <span className="mt-1 block text-white">
                <span className="text-orange-400">LIED</span>!
              </span>
            )}
          </div>

          {/* Listener — smaller avatar + guess line */}
          <div className="mb-12 flex flex-col items-center gap-3">
            <div className="rounded-full ring-2 ring-white/15">
              <JMAvatarView
                width={88}
                avatarName={opponentAvatarName ?? "default"}
              />
            </div>
            <p className="max-w-[min(100%,20rem)] text-center text-sm font-bold uppercase tracking-wide text-white sm:text-base">
              {opponentGuess === "truth" ? (
                <>
                  <span>{opponentName} guessed: </span>
                  <span className="text-green-400">TRUTH</span>
                </>
              ) : (
                <>
                  <span>{opponentName} guessed: </span>
                  <span className="text-orange-400">LIED</span>
                </>
              )}
            </p>
          </div>

          {/* Outcome */}
          <p
            className={`max-w-lg text-center text-3xl font-black uppercase tracking-wider ${
              sharerEliminated ? "text-orange-400" : "text-green-400"
            }`}
          >
            {sharerEliminated ? `${sharerName} Eliminated` : `${sharerName} Survives!`}
          </p>
        </div>
      </div>
    </div>
  );
}
