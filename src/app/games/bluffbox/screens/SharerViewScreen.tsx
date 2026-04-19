"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { BluffCard } from "@/JMKit/BluffCard";
import { JMTruthLieChoice } from "@/JMKit/JMTruthLieChoice";
import { JMCard } from "@/JMKit/JMCard";
import { JMCardFlip } from "@/JMKit/JMCardFlip";
import { cn } from "@/lib/utils";

/** Max edge length (280 × 1.25); width uses min() so it shrinks on small screens. */
const CARD_SIZE_MAX = 350;

/** Stacked drop-shadows for pack cover + card faces (filter works reliably on both faces). */
const CARD_FACE_FILTER =
  "drop-shadow(0 4px 12px rgba(0,0,0,0.35)) drop-shadow(0 16px 36px rgba(0,0,0,0.5))";

interface SharerViewScreenProps {
  roundNumber: number;
  totalRounds: number;
  /** Same static logo as matchup / VS (top left). */
  gameLogoURL?: string;
  cardURL: string | null;
  packCoverURL: string | null;
  onRevealBox: () => void | Promise<void>;
  onChoose: (choice: "truth" | "lie") => void;
  /** Set once Truth/Lie is committed (e.g. from session); locks the control visually. */
  sharerChoice?: "truth" | "lie" | null;
  /** When true, hide the Truth/Lie buttons and show a "waiting for votes" label. */
  waitingForVotes?: boolean;
}

function requestDoubleRaf(cb: () => void) {
  requestAnimationFrame(() => {
    requestAnimationFrame(cb);
  });
}

export default function SharerViewScreen({
  roundNumber,
  totalRounds,
  gameLogoURL,
  cardURL,
  packCoverURL,
  onRevealBox,
  onChoose,
  sharerChoice = null,
  waitingForVotes = false,
}: SharerViewScreenProps) {
  const roundLabel = `ROUND ${roundNumber} of ${totalRounds}`;
  const [flipped, setFlipped] = useState(waitingForVotes);
  const [flipComplete, setFlipComplete] = useState(waitingForVotes);
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
      {/* Top row: logo left, round label right */}
      <div className="relative z-20 shrink-0 px-3 pt-3 sm:px-4 sm:pt-4">
        <div className="grid grid-cols-[1fr_1fr] items-center gap-2 sm:gap-3">
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
          <div className="flex min-w-0 items-center justify-end">
            <span className="block max-w-[min(100%,52vw)] bg-linear-to-r from-amber-200/90 via-white to-blue-200/90 bg-clip-text text-right text-sm font-black uppercase leading-snug tracking-[0.22em] text-transparent sm:text-base">
              {roundLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto">
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
        {/* Extra vertical space so translateY bob isn't clipped by overflow */}
        <div className="mx-auto flex min-h-[min(420px,78svh)] w-full items-center justify-center">
          <JMCardFlip
            frontFace={coverFace}
            backFace={cardFace}
            flipped={flipped}
            onFlipComplete={() => setFlipComplete(true)}
            maxWidth={CARD_SIZE_MAX}
          />
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
        ) : waitingForVotes ? (
          <p className="max-w-sm animate-pulse text-center text-xl font-bold leading-snug text-white/60 sm:text-2xl">
            Everyone is voting&nbsp;&hellip;
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
              randomizeOrder
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
