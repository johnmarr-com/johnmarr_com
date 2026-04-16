"use client";

import { GameSectionHeader, GamePrimaryButton } from "@/app/games/_gamecore";
import type { SevynHeist, SevynTeam } from "../sevynTypes";

interface BriefingScreenProps {
  heist: SevynHeist;
  myTeam: SevynTeam | null;
  isHost: boolean;
  onContinue: () => void;
}

export default function BriefingScreen({
  heist,
  myTeam,
  isHost,
  onContinue,
}: BriefingScreenProps) {
  const myClient = myTeam ? heist.clients[myTeam] : null;

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

        {/* Client reveal — only shows your own client */}
        {myClient && (
          <div className="mt-4 rounded-xl border border-[#E84C1E]/30 bg-[#E84C1E]/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#E84C1E]">
              Your Client
            </p>
            <p className="mt-1 text-lg font-bold text-white">{myClient.benefactor}</p>
            <p className="mt-1 text-sm text-white/70">{myClient.motivation}</p>
          </div>
        )}

        {/* Before teams are formed, show both clients generically */}
        {!myTeam && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-[#E84C1E]/20 bg-black/30 p-4">
              <p className="text-xs font-semibold text-[#E84C1E]">Syndicate 1</p>
              <p className="font-bold text-white">{heist.clients.syndicate1.benefactor}</p>
              <p className="text-sm text-white/60">{heist.clients.syndicate1.motivation}</p>
            </div>
            <div className="rounded-xl border border-blue-400/20 bg-black/30 p-4">
              <p className="text-xs font-semibold text-blue-400">Syndicate 2</p>
              <p className="font-bold text-white">{heist.clients.syndicate2.benefactor}</p>
              <p className="text-sm text-white/60">{heist.clients.syndicate2.motivation}</p>
            </div>
          </div>
        )}

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
