"use client";

import Link from "next/link";
import type { GC3Props } from "../_gamecore/registry/types";
import { GameStatusMessage } from "../_gamecore";
import { getGamePlayHref } from "@/lib/composite-game-slug";

/**
 * Placeholder GC3 for the Fast Casual Trivia engine. Shown if the session reaches
 * the game phase (e.g. rejoin with ?sessionId=) before gameplay exists.
 */
export function FastCasualTriviaStubGame({ gameData, sessionId }: GC3Props) {
  const backHref = gameData.slug
    ? getGamePlayHref(gameData.slug, gameData.engineSlug)
    : "/games/fast_casual_trivia";

  return (
    <div className="fixed inset-0 z-10 flex flex-col items-center justify-center bg-black p-6 text-center text-white">
      <p className="mb-1 text-lg font-bold">Trivia gameplay</p>
      <p className="mb-6 max-w-sm text-sm text-white/70">
        Not available yet. The lobby and matchmaking above are live; the round
        engine will plug in here next.
      </p>
      <p className="mb-2 font-mono text-xs text-white/40">Session {sessionId.slice(0, 8)}…</p>
      <GameStatusMessage message="Build in progress" />
      <Link
        href={backHref}
        className="mt-8 text-sm font-bold text-amber-400 underline underline-offset-2"
      >
        Back to landing
      </Link>
    </div>
  );
}
