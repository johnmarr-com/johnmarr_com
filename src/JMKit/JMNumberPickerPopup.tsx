"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

export interface JMNumberPickerPopupProps {
  open: boolean;
  /** Currently-selected value. Pass null when nothing is chosen yet. */
  value: number | null;
  /** Available choices, rendered left-to-right. */
  options: number[];
  /** Accent color — used as the solid background for every pill. */
  accentColor: string;
  /** Called with the picked number. The popup closes immediately on select. */
  onSelect: (n: number) => void;
  onClose: () => void;
}

function readableTextOn(bg: string): string {
  if (!bg || bg.length < 7 || !bg.startsWith("#")) return "#fff";
  const r = Number.parseInt(bg.slice(1, 3), 16);
  const g = Number.parseInt(bg.slice(3, 5), 16);
  const b = Number.parseInt(bg.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? "#0a0a0a" : "#ffffff";
}

/**
 * Modal row of circular number buttons. Originally inlined in FYVE's BossScreen
 * (clue-count picker). Promoted to JMKit so any game can pop one open for
 * "pick how many of N" decisions: clue counts, team counts, round counts, etc.
 *
 * Renders into document.body via portal, with a click-to-dismiss backdrop.
 * Closes itself on selection.
 */
export function JMNumberPickerPopup({
  open,
  value,
  options,
  accentColor,
  onSelect,
  onClose,
}: JMNumberPickerPopupProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const numeralColor = readableTextOn(accentColor);

  return createPortal(
    <div className="fixed inset-0 z-60 flex items-center justify-center px-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative z-10 flex flex-wrap justify-center gap-4">
        {options.map((n) => {
          const selected = n === value;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onSelect(n)}
              className="flex h-20 w-20 items-center justify-center rounded-full text-4xl font-black transition-all active:scale-90 sm:h-24 sm:w-24 sm:text-5xl"
              style={{
                backgroundColor: accentColor,
                color: numeralColor,
                border: selected
                  ? `3px solid ${numeralColor}`
                  : "2px solid rgba(0,0,0,0.0)",
                opacity: selected ? 1 : 0.85,
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
