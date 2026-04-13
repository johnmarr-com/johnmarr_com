"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import JMAvatarView from "@/JMKit/JMAvatarView";
import { BluffCard } from "@/JMKit/BluffCard";
import { JMTruthLieChoice } from "@/JMKit/JMTruthLieChoice";
import { JMCard } from "@/JMKit/JMCard";
import { cn } from "@/lib/utils";

/** Max edge length (280 × 1.25); width uses min() so it shrinks on small screens. */
const CARD_SIZE_MAX = 350;

const FLIP_MS = 700;
const FLIP_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
/** Vertical lift at midpoint of the flip (px). */
const FLIP_BOB_PX = 30;

const FLIP_ANIM_NAME = "jm-sharer-flip-bob";

/** Stacked drop-shadows for pack cover + card faces (filter works reliably on both faces). */
const CARD_FACE_FILTER =
  "drop-shadow(0 4px 12px rgba(0,0,0,0.35)) drop-shadow(0 16px 36px rgba(0,0,0,0.5))";

/** Middle column width — matches {@link OneVsAll} header spacer / VS column. */
const VS_COL = "w-[min(6.5rem,18vw)] min-w-[4.75rem] shrink-0";

interface SharerViewScreenProps {
  roundNumber: number;
  bonusRoundCount: number;
  /** Same static logo as matchup / VS (top left). */
  gameLogoURL?: string;
  /** Opponent (the player you’re sharing with this round). */
  opponentGamertag: string;
  opponentAvatarName?: string;
  cardURL: string | null;
  packCoverURL: string | null;
  onRevealBox: () => void | Promise<void>;
  onChoose: (choice: "truth" | "lie") => void;
  /** Set once Truth/Lie is committed (e.g. from session); locks the control visually. */
  sharerChoice?: "truth" | "lie" | null;
}

function requestDoubleRaf(cb: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(cb);
  });
}

export default function SharerViewScreen({
  roundNumber,
  bonusRoundCount,
  gameLogoURL,
  opponentGamertag,
  opponentAvatarName,
  cardURL,
  packCoverURL,
  onRevealBox,
  onChoose,
  sharerChoice = null,
}: SharerViewScreenProps) {
  const isBonus = bonusRoundCount > 0;
  const roundLabel = isBonus
    ? `BONUS ROUND ${bonusRoundCount}`
    : `ROUND ${roundNumber}`;
  const [flipped, setFlipped] = useState(false);
  const [flipComplete, setFlipComplete] = useState(false);
  const [isDealing, setIsDealing] = useState(false);
  const dealRequestedRef = useRef(false);
  const flipScheduledRef = useRef(false);

  const runFlip = useCallback(() => {
    if (flipScheduledRef.current) return;
    flipScheduledRef.current = true;
    requestDoubleRaf(() => setFlipped(true));
  }, []);

  const handleCoverActivate = useCallback(async () => {
    if (flipped || flipComplete || isDealing) return;
    if (cardURL) {
      dealRequestedRef.current = true;
      runFlip();
      return;
    }
    dealRequestedRef.current = true;
    setIsDealing(true);
    try {
      await onRevealBox();
    } finally {
      setIsDealing(false);
    }
  }, [cardURL, flipped, flipComplete, isDealing, onRevealBox, runFlip]);

  useEffect(() => {
    if (!cardURL || !dealRequestedRef.current || flipped) return;
    runFlip();
  }, [cardURL, flipped, runFlip]);

  const handleFlipAnimationEnd = (e: React.AnimationEvent<HTMLDivElement>) => {
    if (e.animationName !== FLIP_ANIM_NAME) return;
    setFlipComplete(true);
  };

  const coverFace = (
    <div className="h-full w-full" style={{ filter: CARD_FACE_FILTER }}>
      {packCoverURL ? (
        <BluffCard imageURL={packCoverURL} nonInteractive />
      ) : (
        <JMCard className="h-full w-full min-h-0 bg-neutral-800">{null}</JMCard>
      )}
    </div>
  );

  const cardFace = (
    <div className="h-full w-full" style={{ filter: CARD_FACE_FILTER }}>
      {cardURL ? (
        <BluffCard imageURL={cardURL} nonInteractive />
      ) : (
        <JMCard className="h-full w-full min-h-0 bg-neutral-900">{null}</JMCard>
      )}
    </div>
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Centered “Sharing with” + opponent — ~50px from top; clears logo/round corners */}
      <div className="pointer-events-none absolute left-1/2 top-[50px] z-25 flex -translate-x-1/2 flex-col items-center gap-2 px-4">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/65 sm:text-sm">
          Sharing with
        </p>
        <div className="pointer-events-auto flex flex-col items-center gap-1.5">
          <div className="shrink-0 rounded-full ring-2 ring-white/15">
            <JMAvatarView
              width={72}
              avatarName={opponentAvatarName ?? "default"}
            />
          </div>
          <span className="max-w-[min(240px,70vw)] truncate text-center text-base font-bold text-white sm:text-lg">
            {opponentGamertag}
          </span>
        </div>
      </div>

      {/* Top row: same grid & content as MatchupScreen / OneVsAll (logo left, ROUND / BONUS right) */}
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
        @keyframes ${FLIP_ANIM_NAME} {
          0% {
            transform: translateY(0) rotateY(0deg);
          }
          50% {
            transform: translateY(-${FLIP_BOB_PX}px) rotateY(90deg);
          }
          100% {
            transform: translateY(0) rotateY(180deg);
          }
        }
      `}</style>
      {/* Card center locked at 40% viewport height; does not move when copy/buttons mount */}
      <div
        className={cn(
          "absolute left-1/2 top-[40svh] z-10 w-full -translate-x-1/2 -translate-y-1/2 px-6",
          "perspective-distant",
          !flipped && !flipComplete && "cursor-pointer",
          isDealing && "pointer-events-none opacity-90",
        )}
        role={!flipped && !flipComplete ? "button" : undefined}
        tabIndex={!flipped && !flipComplete ? 0 : undefined}
        onClick={
          !flipped && !flipComplete
            ? () => void handleCoverActivate()
            : undefined
        }
        onKeyDown={
          !flipped && !flipComplete
            ? (ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  void handleCoverActivate();
                }
              }
            : undefined
        }
      >
        {/* Extra vertical space so translateY bob isn’t clipped by overflow */}
        <div className="mx-auto flex min-h-[min(420px,78svh)] w-full items-center justify-center">
          <div
            className="relative aspect-square w-full transform-3d"
            style={{
              maxWidth: `min(${CARD_SIZE_MAX}px, calc(100vw - 3rem))`,
              transform: flipped ? undefined : "translateY(0) rotateY(0deg)",
              animation: flipped
                ? `${FLIP_ANIM_NAME} ${FLIP_MS}ms ${FLIP_EASE} forwards`
                : undefined,
            }}
            onAnimationEnd={handleFlipAnimationEnd}
          >
            <div className="absolute inset-0 backface-hidden">
              {coverFace}
            </div>
            <div className="absolute inset-0 backface-hidden transform-[rotateY(180deg)]">
              {cardFace}
            </div>
          </div>
        </div>
      </div>

      {/* Flow column below the card; describe + buttons reserve layout while flipped so no jump at flip end */}
      <div
        className="mx-auto flex w-full max-w-sm flex-col items-center gap-6 px-6 pb-10"
        style={{
          paddingTop: `calc(40svh + (min(${CARD_SIZE_MAX}px, 100vw - 3rem) / 2) + 1.5rem)`,
        }}
      >
        {!flipped ? (
          <p className="max-w-sm whitespace-pre-line text-center text-lg font-medium leading-snug text-white/50 sm:text-xl">
            {`Tap to view contents.\nDon't let anyone see!`}
          </p>
        ) : (
          <>
            <p
              className={cn(
                "max-w-sm whitespace-pre-line text-center text-lg font-medium leading-snug text-white/50 transition-opacity duration-200 sm:text-xl",
                !flipComplete && "opacity-0",
              )}
            >
              {`Describe what you see--\neither telling the truth,\nor lying about it.\nSelect your choice below.`}
            </p>
            <JMTruthLieChoice
              onSelect={onChoose}
              size="default"
              lockedChoice={sharerChoice}
              className={cn(
                "max-w-sm transition-opacity duration-200",
                !flipComplete && "pointer-events-none opacity-0",
              )}
            />
          </>
        )}
      </div>
      </div>
    </div>
  );
}
