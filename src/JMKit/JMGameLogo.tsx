"use client";

import Image from "next/image";

export interface JMGameLogoProps {
  /** Logo image URL (typically `gameData.splashLogoURL`). */
  src: string;
  alt?: string;
  /**
   * Tailwind size classes for height + width. Default: `h-24 w-auto sm:h-28`.
   * Override for tighter top bars or splashier results screens.
   */
  sizeClass?: string;
  /** Slide in from the right on mount. Default: true. */
  slideIn?: boolean;
  /**
   * Continuous gentle rock animation after slide-in. Default: true.
   * Uses the shared `rock` keyframe (±2deg, 3s cycle) defined in globals.css.
   */
  rock?: boolean;
  /** Extra classes on the outer wrapper. */
  className?: string;
  /** A `key` value that retriggers the entrance animation when changed (e.g., game slug). */
  reanimateKey?: string;
}

/**
 * Animated game logo: slide in from right, then rock gently. Used as the
 * top-right brand mark on game boards and result screens. Wrapping in a div
 * keeps the slide animation separate from the rock so they compose cleanly
 * (slide on the wrapper, rock on the image).
 */
export function JMGameLogo({
  src,
  alt = "Game logo",
  sizeClass = "h-24 w-auto sm:h-28",
  slideIn = true,
  rock = true,
  className = "",
  reanimateKey,
}: JMGameLogoProps) {
  return (
    <div
      key={reanimateKey}
      className={`${slideIn ? "animate-logo-slide-in" : ""} ${className}`}
    >
      <Image
        src={src}
        alt={alt}
        width={400}
        height={160}
        className={`${sizeClass} select-none object-contain drop-shadow-lg ${
          rock ? "animate-[rock_3s_ease-in-out_0.3s_infinite]" : ""
        }`}
        priority
        unoptimized
      />
    </div>
  );
}
