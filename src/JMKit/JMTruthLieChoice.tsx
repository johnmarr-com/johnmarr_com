"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type TruthLieChoice = "truth" | "lie";

export interface JMTruthLieChoiceProps {
  /** Called when the player picks Truth or Lie. */
  onSelect: (choice: TruthLieChoice) => void;
  /**
   * `default` — sharer / compact (e.g. after card flip).
   * `large` — opponent guess screen (roomier tap targets).
   */
  size?: "default" | "large";
  /** When true, buttons are non-interactive and visually muted (e.g. listener before sharer commits). */
  disabled?: boolean;
  /**
   * After the sharer commits, both buttons are non-interactive: the chosen one stays full color,
   * the other is gray and semitransparent.
   */
  lockedChoice?: TruthLieChoice | null;
  /** Classes on the flex row that wraps both buttons. */
  className?: string;
}

const sizeClasses = {
  default: "py-5 text-xl",
  large: "py-6 text-2xl",
} as const;

const lockedOutClass = "pointer-events-none cursor-default grayscale opacity-40";

/**
 * Matched **Truth** / **Lie** controls for Bluff Box: gradient fills, random left/right order.
 * Use for the sharer (what they actually did) and the opponent (what they think happened).
 */
export function JMTruthLieChoice({
  onSelect,
  size = "default",
  disabled = false,
  lockedChoice = null,
  className,
}: JMTruthLieChoiceProps) {
  const [truthOnLeft] = useState(() => Math.random() < 0.5);

  const sz = sizeClasses[size];
  const isLocked = lockedChoice != null;

  const truthButton = (
    <button
      key="truth"
      type="button"
      disabled={disabled && !isLocked}
      onClick={() => {
        if (isLocked) return;
        if (!disabled) onSelect("truth");
      }}
      className={cn(
        "flex-1 rounded-xl font-black uppercase tracking-wider transition-all",
        "bg-linear-to-br from-emerald-300 via-green-500 to-teal-800",
        "text-neutral-950",
        sz,
        isLocked &&
          (lockedChoice === "truth"
            ? "pointer-events-none cursor-default"
            : lockedOutClass),
        !isLocked &&
          !disabled &&
          "hover:scale-[1.02] active:scale-95",
        !isLocked && disabled && "pointer-events-none grayscale opacity-35",
      )}
    >
      Truth
    </button>
  );

  const lieButton = (
    <button
      key="lie"
      type="button"
      disabled={disabled && !isLocked}
      onClick={() => {
        if (isLocked) return;
        if (!disabled) onSelect("lie");
      }}
      className={cn(
        "flex-1 rounded-xl font-black uppercase tracking-wider transition-all",
        "bg-linear-to-br from-rose-500 via-red-600 to-red-950",
        "text-white",
        sz,
        isLocked &&
          (lockedChoice === "lie"
            ? "pointer-events-none cursor-default"
            : lockedOutClass),
        !isLocked &&
          !disabled &&
          "hover:scale-[1.02] active:scale-95",
        !isLocked && disabled && "pointer-events-none grayscale opacity-35",
      )}
    >
      Lie
    </button>
  );

  return (
    <div
      className={cn("flex w-full gap-3", className)}
      aria-disabled={disabled && !isLocked}
    >
      {truthOnLeft ? [truthButton, lieButton] : [lieButton, truthButton]}
    </div>
  );
}
