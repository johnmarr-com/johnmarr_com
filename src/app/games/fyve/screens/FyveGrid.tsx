"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import type { FyveBoardCard, CardType, FyveTeam } from "../fyveTypes";
import { FYVE_COLORS } from "../FyveGame";

const FONT_MAX = 14;
const FONT_MIN = 9;

// ─── Color helpers ──────────────────────────────────────────

function getCardTypeColor(type: CardType): string {
  switch (type) {
    case "T1":
      return FYVE_COLORS.t1;
    case "T2":
      return FYVE_COLORS.t2;
    case "N":
      return FYVE_COLORS.neutral;
    case "BOMB":
      return FYVE_COLORS.bomb;
  }
}

// ─── Auto-fit text per card ─────────────────────────────────

function FitText({ word, className, style }: { word: string; className?: string; style?: React.CSSProperties }) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState(FONT_MAX);

  const fit = useCallback(() => {
    const span = spanRef.current;
    const parent = span?.parentElement;
    if (!span || !parent) return;
    // Available width = parent width minus horizontal padding (4px each side)
    const available = parent.clientWidth - 8;
    let s = FONT_MAX;
    span.style.fontSize = `${s}px`;
    // Shrink until single-line text fits or we hit the minimum
    while (s > FONT_MIN && span.scrollWidth > available) {
      s -= 1;
      span.style.fontSize = `${s}px`;
    }
    setSize(s);
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(fit);
    const ro = new ResizeObserver(fit);
    const parent = spanRef.current?.parentElement;
    if (parent) ro.observe(parent);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [fit]);

  return (
    <span
      ref={spanRef}
      className={className}
      style={{ ...style, fontSize: size, whiteSpace: size > FONT_MIN ? "nowrap" : undefined }}
    >
      {word}
    </span>
  );
}

// ─── Props ──────────────────────────────────────────────────

interface FyveGridProps {
  board: FyveBoardCard[];
  /** Boss color map — if provided, cells are color-coded */
  colorMap?: CardType[] | null;
  /** Active team (for highlighting whose turn) */
  activeTeam: FyveTeam;
  /** Can the viewer tap cards? */
  canTap: boolean;
  /** Callback when a card is tapped */
  onTapCard?: (cardIndex: number) => void;
  /** Index of card currently pending confirmation */
  pendingCardIndex?: number | null;
  /** Index of card waiting for server reveal (shows spinner) */
  waitingCardIndex?: number | null;
}

export default function FyveGrid({
  board,
  colorMap,
  activeTeam: _activeTeam,
  canTap,
  onTapCard,
  pendingCardIndex,
  waitingCardIndex,
}: FyveGridProps) {
  void _activeTeam; // reserved for turn highlight styling

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {board.map((card) => {
        const isRevealed = card.revealed;
        const colorType = colorMap ? colorMap[card.index] : undefined;
        const isPending = pendingCardIndex === card.index;
        const isWaiting = waitingCardIndex === card.index;

        // Revealed card — fully opaque image with team tint
        if (isRevealed) {
          const revealColor = card.revealedType ? getCardTypeColor(card.revealedType) : "#666";
          const isNeutral = card.revealedType === "N";
          const isBomb = card.revealedType === "BOMB";
          const revealBorder = card.revealedType === "T1" ? "#dc2626"
            : isBomb ? "#dc2626"
            : isNeutral ? "#444"
            : revealColor;
          const tintColor = isNeutral ? "rgba(0, 0, 0, 0.55)"
            : card.revealedType === "T1" ? "rgba(220, 38, 38, 0.35)"
            : card.revealedType === "T2" ? "rgba(59, 130, 246, 0.35)"
            : "rgba(220, 38, 38, 0.4)";

          return (
            <div
              key={card.index}
              data-card-index={card.index}
              className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border-4"
              style={{
                backgroundColor: isBomb ? "#1a0505" : "#1a1a1a",
                borderColor: revealBorder,
              }}
            >
              {card.revealedImageUrl ? (
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${card.revealedImageUrl})` }}
                />
              ) : (
                <FitText
                  word={card.word}
                  className="px-1 font-bold leading-tight text-center"
                  style={{ color: revealColor }}
                />
              )}
              <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: tintColor }} />
            </div>
          );
        }

        // Unrevealed card — solid dark gray
        const bossBg = colorType
          ? `${getCardTypeColor(colorType)}30`
          : undefined;
        const bossBorder = colorType
          ? `${getCardTypeColor(colorType)}60`
          : undefined;
        const isBombBoss = colorType === "BOMB";

        return (
          <button
            key={card.index}
            data-card-index={card.index}
            className={`relative flex aspect-square items-center justify-center rounded-lg border-2 text-center transition-all ${
              canTap
                ? "cursor-pointer active:scale-95 hover:brightness-125"
                : "cursor-default"
            } ${isPending ? "ring-2 ring-yellow-400 ring-offset-1 ring-offset-black animate-pulse" : ""}`}
            style={{
              backgroundColor: bossBg ?? "rgba(255,255,255,0.06)",
              borderColor: isBombBoss
                ? "#dc2626"
                : isPending
                  ? "#facc15"
                  : bossBorder ?? "rgba(255,255,255,0.12)",
            }}
            disabled={!canTap || isRevealed}
            onClick={() => canTap && onTapCard?.(card.index)}
          >
            <FitText
              word={card.word}
              className={`px-1 font-bold leading-tight text-center ${
                colorType ? "text-white" : "text-white/80"
              }`}
            />
            {isWaiting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
