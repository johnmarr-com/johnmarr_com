"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib";

export interface JMCardProps {
  children: ReactNode;
  /** Classes on the outer shell (size, borders, background, etc.). */
  className?: string | undefined;
  /** Merged after radius; can override `borderRadius` if needed. */
  style?: CSSProperties | undefined;
  /**
   * Uniform corner radius as a **percentage** of this element’s used border box
   * (CSS `border-radius` percentage rules). Corners stay proportionally consistent
   * at any rendered size — thumbnails, grids, or large reveal tiles.
   * @default 20
   */
  cornerRadiusPercent?: number | undefined;
}

/**
 * Base square game-card shell: `overflow-hidden` plus percentage `border-radius`
 * so rounding tracks the actual painted size, not fixed rem breakpoints.
 */
export function JMCard({
  children,
  className,
  style,
  cornerRadiusPercent = 20,
}: JMCardProps) {
  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{
        borderRadius: `${cornerRadiusPercent}%`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
