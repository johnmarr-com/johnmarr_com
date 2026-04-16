"use client";

import type { SevynBoardCard, CardType, SevynTeam } from "../sevynTypes";
import { SEVYN_COLORS } from "../SevynGame";

// ─── Color helpers ──────────────────────────────────────────

function getCardTypeColor(type: CardType): string {
  switch (type) {
    case "T1":
      return SEVYN_COLORS.t1;
    case "T2":
      return SEVYN_COLORS.t2;
    case "N":
      return SEVYN_COLORS.neutral;
    case "BOMB":
      return SEVYN_COLORS.bomb;
  }
}

// ─── Props ──────────────────────────────────────────────────

interface SevynGridProps {
  board: SevynBoardCard[];
  /** Architect color map — if provided, cells are color-coded */
  colorMap?: CardType[] | null;
  /** Active team (for highlighting whose turn) */
  activeTeam: SevynTeam;
  /** Can the viewer tap cards? */
  canTap: boolean;
  /** Callback when a card is tapped */
  onTapCard?: (cardIndex: number) => void;
  /** Index of card currently pending confirmation */
  pendingCardIndex?: number | null;
}

export default function SevynGrid({
  board,
  colorMap,
  activeTeam: _activeTeam,
  canTap,
  onTapCard,
  pendingCardIndex,
}: SevynGridProps) {
  void _activeTeam; // reserved for turn highlight styling
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {board.map((card) => {
        const isRevealed = card.revealed;
        const colorType = colorMap ? colorMap[card.index] : undefined;
        const isPending = pendingCardIndex === card.index;

        // Revealed card — fully opaque image with team tint
        if (isRevealed) {
          const revealColor = card.revealedType ? getCardTypeColor(card.revealedType) : "#666";
          const isNeutral = card.revealedType === "N";
          const isBomb = card.revealedType === "BOMB";
          // Borders: true red for T1/bomb, dark gray for neutrals, team color otherwise
          const revealBorder = card.revealedType === "T1" ? "#dc2626"
            : isBomb ? "#dc2626"
            : isNeutral ? "#444"
            : revealColor;
          // Team color tint over image
          const tintColor = isNeutral ? "rgba(0, 0, 0, 0.55)"
            : card.revealedType === "T1" ? "rgba(220, 38, 38, 0.35)"
            : card.revealedType === "T2" ? "rgba(59, 130, 246, 0.35)"
            : "rgba(220, 38, 38, 0.4)"; // bomb

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
                /* Fallback when no image — show word */
                <span
                  className="px-1 text-xs font-bold leading-tight sm:text-sm"
                  style={{ color: revealColor }}
                >
                  {card.word}
                </span>
              )}
              {/* Team tint overlay */}
              <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: tintColor }} />
            </div>
          );
        }

        // Unrevealed card — solid dark gray
        const architectBg = colorType
          ? `${getCardTypeColor(colorType)}30`
          : undefined;
        const architectBorder = colorType
          ? `${getCardTypeColor(colorType)}60`
          : undefined;
        const isBombArchitect = colorType === "BOMB";

        return (
          <button
            key={card.index}
            data-card-index={card.index}
            className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border-2 text-center transition-all ${
              canTap
                ? "cursor-pointer active:scale-95 hover:brightness-125"
                : "cursor-default"
            } ${isPending ? "ring-2 ring-yellow-400 ring-offset-1 ring-offset-black animate-pulse" : ""}`}
            style={{
              backgroundColor: architectBg ?? "rgba(255,255,255,0.06)",
              borderColor: isBombArchitect
                ? "#dc2626"
                : isPending
                  ? "#facc15"
                  : architectBorder ?? "rgba(255,255,255,0.12)",
            }}
            disabled={!canTap || isRevealed}
            onClick={() => canTap && onTapCard?.(card.index)}
          >
            <span
              className={`px-1 text-xs font-bold leading-tight sm:text-sm ${
                colorType ? "text-white" : "text-white/80"
              }`}
            >
              {card.word}
            </span>
          </button>
        );
      })}
    </div>
  );
}
