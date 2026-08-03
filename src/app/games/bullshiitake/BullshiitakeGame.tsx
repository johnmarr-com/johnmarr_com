"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { subscribeToSession, type GameSession } from "@/lib/game-sessions";
import { useGameColors } from "@/app/games/_gamecore";
import type { GC3Props } from "../_gamecore/registry/types";

/**
 * Bull Shiitake GC3 — placeholder. The gameplay reducer is not built yet, so
 * the board just shows "Pending". Subscribes to the session so the player
 * list stays live (and the wiring is in place for the real build).
 * `onGameEnd` is intentionally never called.
 */
export default function BullshiitakeGame({ sessionId, gameData }: GC3Props) {
  const { primary, secondary } = useGameColors();
  const [session, setSession] = useState<GameSession | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;
    void subscribeToSession(sessionId, (s) => setSession(s)).then((u) => {
      if (cancelled) u();
      else unsub = u;
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [sessionId]);

  const logoURL = gameData.splashLogoURL ?? gameData.coverURL;
  const players = session?.players ?? [];

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-neutral-950 px-6 py-10 text-center">
      {logoURL ? (
        /* eslint-disable-next-line @next/next/no-img-element -- CMS Storage URL */
        <img src={logoURL} alt={gameData.name} className="w-full max-w-xs object-contain" />
      ) : (
        <h1
          className="text-3xl font-black uppercase tracking-wider"
          style={{ color: primary }}
        >
          {gameData.name}
        </h1>
      )}

      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: primary }} />
        <p className="text-xl font-bold" style={{ color: secondary }}>
          Pending — game under construction
        </p>
        <p className="max-w-xs text-sm text-white/40">
          The Bull Shiitake game board isn&apos;t built yet. Check back soon!
        </p>
      </div>

      {players.length > 0 && (
        <p className="text-xs text-white/30">
          {players.length} player{players.length !== 1 ? "s" : ""} here:{" "}
          {players.map((p) => p.gamertag).join(", ")}
        </p>
      )}
    </div>
  );
}
