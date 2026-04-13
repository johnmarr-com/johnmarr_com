"use client";

import { useAuth } from "@/lib/AuthProvider";
import { cn } from "@/lib/utils";

export interface GameGamertagBadgeProps {
  /**
   * Tailwind classes for the pill background (and any related surface styles).
   * Default: `bg-black/80`.
   */
  badgeClassName?: string;
}

export function GameGamertagBadge({ badgeClassName }: GameGamertagBadgeProps) {
  const { gamertag } = useAuth();
  if (!gamertag) return null;

  return (
    <div className="fixed left-1/2 top-0 z-50 -translate-x-1/2">
      <div
        className={cn(
          "px-5 py-1.5 text-xs font-bold text-white/70",
          badgeClassName ?? "bg-black/80",
        )}
        style={{
          clipPath: "polygon(0 0, 100% 0, calc(100% - 8px) 100%, 8px 100%)",
        }}
      >
        {gamertag}
      </div>
    </div>
  );
}
