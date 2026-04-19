"use client";

import { GamePrimaryButton } from "@/app/games/_gamecore";
import type { FyveHeist } from "../fyveTypes";

interface BriefingScreenProps {
  heist: FyveHeist;
  isHost: boolean;
  onContinue: () => void;
}

export default function BriefingScreen({
  heist,
  isHost,
  onContinue,
}: BriefingScreenProps) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center px-4 py-16">
      {/* Extra darkening overlay for briefing readability */}
      <div className="pointer-events-none absolute inset-0 bg-black/50" />

      <div className="relative z-10 w-full max-w-lg">
        {/* Target object */}
        {heist.targetObjectImageUrl && (
          <div className="mx-auto mb-6 h-48 w-48 overflow-hidden rounded-2xl border-2 border-[#E84C1E]/40">
            <div
              className="h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${heist.targetObjectImageUrl})` }}
            />
          </div>
        )}

        {/* Heist title + location */}
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-[#E84C1E]/70">
            THE HEIST:
          </p>
          <h1 className="mt-1 text-3xl font-black uppercase tracking-wide text-[#E84C1E]">
            {heist.title}
          </h1>
          <p className="mt-2 text-base text-white">
            {heist.setting.location}{heist.setting.era ? ` \u2022 ${heist.setting.era}` : ""}
          </p>
        </div>

        {/* Briefing text */}
        <div className="mt-6 rounded-xl border border-white/10 bg-black/60 p-5 backdrop-blur-sm">
          <p className="mb-3 text-sm font-bold uppercase tracking-widest text-[#E84C1E]">
            The Scoop
          </p>
          <p className="text-base leading-relaxed text-white/80">{heist.briefing}</p>
        </div>

        {/* Host continue button */}
        {isHost && (
          <div className="mt-8">
            <GamePrimaryButton onClick={onContinue}>
              Form Teams
            </GamePrimaryButton>
          </div>
        )}

        {!isHost && (
          <p className="mt-8 animate-pulse text-center text-sm text-white/40">
            Waiting for host to continue...
          </p>
        )}
      </div>
    </div>
  );
}
