"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib";

export type JMTextCardSize = "sm" | "md" | "lg" | "xl";

export interface JMTextCardProps {
  /** Main body text. */
  text: string;
  /** Font tier. If omitted, auto-determined from word count. */
  fontSize?: JMTextCardSize;
  /** Optional small uppercase label rendered above the text. */
  header?: string;
  /** Header color override (defaults to a muted neutral). */
  headerColor?: string;
  /** Smaller padding for tighter layouts. */
  compact?: boolean;
  /** Extra classes on the outer wrapper. */
  className?: string;
  /** Optional content rendered after the text (badges, buttons, etc.). */
  footer?: ReactNode;
  /**
   * Use a heavier curled-paper drop shadow. Useful when the card sits over
   * a darkened background (e.g. trivia game board) where the default subtle
   * shadow gets visually swallowed.
   */
  darkShadow?: boolean;
}

const SIZE_CLASS: Record<JMTextCardSize, string> = {
  sm: "text-sm sm:text-base",
  md: "text-base sm:text-lg",
  lg: "text-lg sm:text-xl",
  xl: "text-xl sm:text-2xl",
};

function autoSize(text: string): JMTextCardSize {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words <= 30) return "xl";
  if (words <= 60) return "lg";
  if (words <= 100) return "md";
  return "sm";
}

/**
 * Auto-sizing text-on-card display, with the curled-paper visual originally
 * built for Wordonkulous's DefinitionCard. Used as the central content card
 * across games that need to display variable-length text.
 */
export function JMTextCard({
  text,
  fontSize,
  header,
  headerColor,
  compact = false,
  className,
  footer,
  darkShadow = false,
}: JMTextCardProps) {
  const size = fontSize ?? autoSize(text);
  const shadowFilter = darkShadow
    ? "drop-shadow(0 18px 14px rgba(0,0,0,0.85))"
    : "drop-shadow(0 16px 10px rgba(0,0,0,0.3))";

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "relative z-10 overflow-hidden rounded-2xl border border-gray-200 bg-linear-to-br from-gray-200 via-white to-gray-200",
          compact ? "p-4" : "p-6",
        )}
      >
        {header && (
          <p
            className="mb-2 text-center text-xs font-bold uppercase tracking-widest"
            style={{ color: headerColor ?? "#6b7280" }}
          >
            {header}
          </p>
        )}
        <p
          className={cn(
            "text-center font-bold leading-relaxed text-gray-900",
            SIZE_CLASS[size],
          )}
        >
          {text}
        </p>
        {footer}
      </div>
      {/* Curled-paper shadow — behind card, anchored to card bottom */}
      <svg
        aria-hidden
        className="pointer-events-none absolute left-1/2"
        style={{
          bottom: 0,
          width: "calc(100% - 10px)",
          transform: "translateX(-50%)",
          height: 30,
          filter: shadowFilter,
        }}
        viewBox="0 0 200 30"
        preserveAspectRatio="none"
      >
        <path
          d="M0,0 L200,0 L200,20 Q200,30 190,30 Q100,4 10,30 Q0,30 0,20 Z"
          fill="white"
        />
      </svg>
    </div>
  );
}
