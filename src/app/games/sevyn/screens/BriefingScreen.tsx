"use client";

import { GameSectionHeader, GamePrimaryButton } from "@/app/games/_gamecore";
import type { SevynHeist } from "../sevynTypes";

interface BriefingScreenProps {
  heist: SevynHeist;
  isHost: boolean;
  onContinue: () => void;
}

export default function BriefingScreen({
  heist,
  isHost,
  onContinue,
}: BriefingScreenProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-16">
      <div className="w-full max-w-lg">
        {/* Target object */}
        {heist.targetObjectImageUrl && (
          <div className="mx-auto mb-6 h-48 w-48 overflow-hidden rounded-2xl border-2 border-[#E84C1E]/40">
            <div
              className="h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${heist.targetObjectImageUrl})` }}
            />
          </div>
        )}

        <GameSectionHeader
          eyebrow="MISSION BRIEFING"
          title={heist.title}
          titleColorClass="text-[#E84C1E]"
          eyebrowColorClass="text-[#E84C1E]/70"
        />

        {/* Setting */}
        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4 backdrop-blur-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#E84C1E]/70">
            {heist.setting.location}
          </p>
          <p className="text-xs text-white/40">{heist.setting.era}</p>
        </div>

        {/* Briefing text */}
        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4 backdrop-blur-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#E84C1E]/70">Instructions</p>
          <p className="text-sm leading-relaxed text-white/80">{heist.briefing}</p>
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
          <p className="mt-8 text-center text-sm text-white/40 animate-pulse">
            Waiting for host to continue...
          </p>
        )}
      </div>
    </div>
  );
}
