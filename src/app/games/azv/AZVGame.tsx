"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { GC3Props } from "../_gamecore/registry/types";

/**
 * Atomic Zombie Vampires GC3 — placeholder. The landing / lobby / invite
 * flow is live via the factory; the actual game experience lands later.
 */
export default function AZVGame(props: GC3Props) {
  void props.sessionId; // placeholder — the real experience will use the session
  const router = useRouter();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-950 px-6 text-center">
      <button
        type="button"
        onClick={() => router.push("/games")}
        className="fixed top-4 left-4 z-20 flex items-center gap-1.5 rounded-full bg-black/50 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Exit
      </button>
      <h1 className="text-4xl font-black uppercase tracking-wider text-lime-400">
        Atomic Zombie Vampires
      </h1>
      <p className="text-lg font-bold text-white/50">Pending</p>
    </div>
  );
}
