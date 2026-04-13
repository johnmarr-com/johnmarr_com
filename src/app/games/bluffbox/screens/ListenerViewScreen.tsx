"use client";

import Image from "next/image";
import { ArrowDown } from "lucide-react";
import JMAvatarView from "@/JMKit/JMAvatarView";
import { JMLiquidLoader } from "@/JMKit/JMLiquidLoader";
import { JMTruthLieChoice } from "@/JMKit/JMTruthLieChoice";

/** Max display size for the wave Lottie; scales down on narrow viewports. */
const LOTTIE_MAX = 220;

const VS_COL = "w-[min(6.5rem,18vw)] min-w-[4.75rem] shrink-0";

const ARROW_BOB_KEYFRAMES = "jm-listener-arrow-bob";

interface ListenerViewScreenProps {
  roundNumber: number;
  bonusRoundCount: number;
  gameLogoURL?: string;
  sharerGamertag: string;
  sharerAvatarName?: string;
  /** When set, the sharer has locked Truth/Lie and the listener may vote. */
  sharerHasChosen: boolean;
  onGuess: (guess: "truth" | "lie") => void;
}

export default function ListenerViewScreen({
  roundNumber,
  bonusRoundCount,
  gameLogoURL,
  sharerGamertag,
  sharerAvatarName,
  sharerHasChosen,
  onGuess,
}: ListenerViewScreenProps) {
  const isBonus = bonusRoundCount > 0;
  const roundLabel = isBonus
    ? `BONUS ROUND ${bonusRoundCount}`
    : `ROUND ${roundNumber}`;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Sharing: + sharer — top center ~50px */}
      <div className="pointer-events-none absolute left-1/2 top-[50px] z-25 flex -translate-x-1/2 flex-col items-center gap-2 px-4">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/65 sm:text-sm">
          Sharing:
        </p>
        <div className="pointer-events-auto flex flex-col items-center gap-1.5">
          <div className="shrink-0 rounded-full ring-2 ring-white/15">
            <JMAvatarView
              width={72}
              avatarName={sharerAvatarName ?? "default"}
            />
          </div>
          <span className="max-w-[min(240px,70vw)] truncate text-center text-base font-bold text-white sm:text-lg">
            {sharerGamertag}
          </span>
        </div>
      </div>

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

      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <style>{`
          @keyframes ${ARROW_BOB_KEYFRAMES} {
            0%,
            100% {
              transform: translateY(-18px);
            }
            50% {
              transform: translateY(18px);
            }
          }
        `}</style>
        <div className="absolute left-1/2 top-[40svh] z-10 w-full -translate-x-1/2 -translate-y-1/2 px-6">
          <div className="mx-auto flex min-h-[min(420px,78svh)] w-full items-center justify-center">
            <div className="flex h-[min(220px,calc(100vw-3rem))] w-[min(220px,calc(100vw-3rem))] items-center justify-center">
              {sharerHasChosen ? (
                <div
                  className="flex items-center justify-center text-violet-200/90"
                  style={{
                    animation: `${ARROW_BOB_KEYFRAMES} 1.25s ease-in-out infinite`,
                  }}
                  aria-hidden
                >
                  <ArrowDown
                    className="h-28 w-28 sm:h-36 sm:w-36"
                    strokeWidth={1.5}
                  />
                </div>
              ) : (
                <JMLiquidLoader size={LOTTIE_MAX} />
              )}
            </div>
          </div>
        </div>

        <div
          className="mx-auto flex w-full max-w-sm flex-col items-center gap-6 px-6 pb-10"
          style={{
            paddingTop: "calc(40svh + (min(220px, 100vw - 3rem) / 2) + 1.5rem)",
          }}
        >
          <p className="max-w-sm whitespace-pre-line text-center text-lg font-medium leading-snug text-white/50 sm:text-xl">
            {`Listen to your opponent.\nAsk up to 2 clarifying questions.\nDid they lie or tell the truth?`}
          </p>
          <JMTruthLieChoice
            onSelect={onGuess}
            size="default"
            disabled={!sharerHasChosen}
            className="max-w-sm"
          />
        </div>
      </div>
    </div>
  );
}
