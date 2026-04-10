"use client";

import { useAuth } from "@/lib/AuthProvider";

export function GameGamertagBadge() {
  const { gamertag } = useAuth();
  if (!gamertag) return null;

  return (
    <div className="fixed right-0 top-0 z-50">
      <div
        className="bg-purple-900 px-3 py-1.5 text-xs font-bold text-white"
        style={{
          clipPath: "polygon(0 0, 100% 0, 100% 100%, 12px 100%)",
          paddingLeft: "1.25rem",
        }}
      >
        {gamertag}
      </div>
    </div>
  );
}
