"use client";

import Image from "next/image";

const DEFAULT_SRC = "/images/games/shared/waiting-for-opponent.png";

export interface JMWaitingProps {
  /** Image src; defaults to the shared "waiting for opponent" graphic. */
  src?: string;
  /** Accessible label describing what we're waiting for. */
  alt?: string;
  /** Override the responsive size formula. Defaults to min(50vw, 50vh, 400px). */
  size?: string;
  /** Extra classes for the outer wrapper (e.g. positioning). */
  className?: string;
}

/**
 * Square 1:1 "waiting" graphic that pulses in scale.
 *
 * Sizes itself to the smaller of 50% of the viewport's width or height,
 * capped at 400px. Drop it inside any container — it handles its own
 * layout and animation.
 */
export function JMWaiting({
  src = DEFAULT_SRC,
  alt = "Waiting…",
  size = "min(50vw, 50vh, 400px)",
  className,
}: JMWaitingProps) {
  return (
    <div
      role="status"
      aria-label={alt}
      className={`relative aspect-square animate-fighter-pulse${className ? ` ${className}` : ""}`}
      style={{ width: size }}
    >
      <Image src={src} alt={alt} fill className="object-contain" sizes="400px" />
    </div>
  );
}
