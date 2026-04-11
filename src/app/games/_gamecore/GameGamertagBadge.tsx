"use client";

import { useAuth } from "@/lib/AuthProvider";

export function GameGamertagBadge() {
  const { gamertag } = useAuth();
  if (!gamertag) return null;

  return (
    <div className="fixed left-1/2 top-0 z-50 -translate-x-1/2">
      <div
        className="bg-black/80 px-5 py-1.5 text-xs font-bold text-white/70"
        style={{
          clipPath: "polygon(0 0, 100% 0, calc(100% - 8px) 100%, 8px 100%)",
        }}
      >
        {gamertag}
      </div>
    </div>
  );
}
