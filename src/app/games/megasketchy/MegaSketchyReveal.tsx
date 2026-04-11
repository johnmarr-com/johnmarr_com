"use client";

import { useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { SketchCanvas, GamePrimaryButton, GameStatusMessage } from "../_gamecore";
import { JMBannerText } from "@/JMKit";
import JMAvatarView from "@/JMKit/JMAvatarView";
import { JMAIAvatarView } from "@/JMKit";
import type { GameSessionPlayer } from "@/lib/game-sessions";
import {
  assembleMadLibs,
  assembleOriginal,
  type Chains,
  type ChainEntry,
} from "./chainEngine";
import { isAiPlayer, getPersona } from "./aiConstants";

interface MegaSketchyRevealProps {
  players: GameSessionPlayer[];
  playOrder: string[];
  chains: Chains;
  message: { template: string; elements: string[] };
  onProceed: () => void;
  isHost: boolean;
}

export default function MegaSketchyReveal({
  players,
  chains,
  message,
  onProceed,
  isHost,
}: MegaSketchyRevealProps) {
  const [viewMode, setViewMode] = useState<"chains" | "madlibs">("chains");
  const [selectedElement, setSelectedElement] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  const elementCount = message.elements.length;
  const currentChain: ChainEntry[] = chains[String(selectedElement)] ?? [];

  const getPlayerName = useCallback(
    (uid: string) => {
      if (uid === "control") return "Control";
      const p = players.find((pl) => pl.uid === uid);
      return p?.gamertag ?? "Unknown";
    },
    [players],
  );

  const getPlayerAvatar = useCallback(
    (uid: string) => {
      return players.find((p) => p.uid === uid)?.avatarName;
    },
    [players],
  );

  const currentEntry = currentChain[stepIndex] ?? null;

  const original = assembleOriginal(message.template, message.elements);
  const { result: garbled, finalElements } = assembleMadLibs(
    message.template,
    chains,
    elementCount,
  );

  return (
    <div className="fixed inset-0 z-10 flex flex-col">
      {/* Header */}
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setViewMode("chains")}
            className={`text-sm font-bold uppercase tracking-wider transition-colors ${
              viewMode === "chains" ? "text-green-400" : "text-white/50 hover:text-white/70"
            }`}
          >
            Chain View
          </button>
          <span className="text-white/20">|</span>
          <button
            onClick={() => setViewMode("madlibs")}
            className={`text-sm font-bold uppercase tracking-wider transition-colors ${
              viewMode === "madlibs" ? "text-green-400" : "text-white/50 hover:text-white/70"
            }`}
          >
            Intel Report
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto">
        {viewMode === "chains" ? (
          <div className="flex flex-1 flex-col items-center px-4 py-4">
            {/* Element selector */}
            <div className="mb-4 flex flex-wrap justify-center gap-1.5">
              {Array.from({ length: elementCount }, (_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedElement(i);
                    setStepIndex(0);
                  }}
                  className={`h-8 w-8 rounded-full text-xs font-bold transition-all ${
                    selectedElement === i
                      ? "bg-green-400 text-black"
                      : "bg-white/10 text-white/40 hover:bg-white/20"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            {/* Step navigator */}
            <div className="mb-3 flex items-center gap-3">
              <button
                onClick={() => setStepIndex((s) => Math.max(0, s - 1))}
                disabled={stepIndex === 0}
                className="rounded-full bg-white/10 p-2 text-white/60 disabled:opacity-20"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-sm text-white/60">
                Step {stepIndex + 1} / {currentChain.length}
              </span>
              <button
                onClick={() => setStepIndex((s) => Math.min(currentChain.length - 1, s + 1))}
                disabled={stepIndex >= currentChain.length - 1}
                className="rounded-full bg-white/10 p-2 text-white/60 disabled:opacity-20"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Current entry display */}
            {currentEntry && (
              <div className="w-full max-w-lg">
                <div className="mb-2 flex items-center gap-2 justify-center">
                  {currentEntry.playerId === "control" ? (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-400/20 text-xs font-bold text-green-400">
                      C
                    </div>
                  ) : isAiPlayer(currentEntry.playerId) ? (
                    <JMAIAvatarView size={28} avatarName={getPlayerAvatar(currentEntry.playerId)} scaleOverride={getPersona(currentEntry.playerId)?.avatarScale} />
                  ) : getPlayerAvatar(currentEntry.playerId) ? (
                    <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full">
                      <JMAvatarView width={28} avatarName={getPlayerAvatar(currentEntry.playerId)!} />
                    </div>
                  ) : (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white/70">
                      {getPlayerName(currentEntry.playerId).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm font-bold text-white/70">
                    {getPlayerName(currentEntry.playerId)}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                    currentEntry.type === "text"
                      ? "bg-amber-400/10 text-amber-400/70"
                      : "bg-blue-400/10 text-blue-400/70"
                  }`}>
                    {currentEntry.type === "text" ? "Text" : "Sketch"}
                  </span>
                </div>

                {stepIndex === 0 && (
                  <p className="mb-1 text-center text-xs font-bold uppercase tracking-widest text-purple-400">
                    Supposed to Send:
                  </p>
                )}
                {stepIndex === currentChain.length - 1 && currentChain.length > 1 && (
                  <p className="mb-1 text-center text-xs font-bold uppercase tracking-widest text-purple-400">
                    Sent:
                  </p>
                )}

                {currentEntry.type === "text" ? (
                  <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center">
                    <p className="text-4xl font-black text-white sm:text-5xl">
                      &ldquo;{currentEntry.value}&rdquo;
                    </p>
                  </div>
                ) : (
                  <SketchCanvas readOnly backgroundImage={currentEntry.value} />
                )}
              </div>
            )}
          </div>
        ) : (
          /* Mad-libs comparison view */
          <div className="flex flex-1 flex-col items-center gap-6 px-4 py-6">
            <div className="w-full max-w-lg">
              <JMBannerText borderColor="rgba(34, 197, 94, 0.4)">
                <h2 className="px-4 py-2 text-center text-base font-black uppercase tracking-wider text-green-400">
                  Control&apos;s Original Message
                </h2>
              </JMBannerText>
              <p className="mt-3 rounded-lg border border-green-400/20 bg-green-400/5 p-4 text-base leading-relaxed text-white/80">
                {original}
              </p>
            </div>

            <div className="flex items-center justify-center">
              <Eye className="h-5 w-5 text-white/40" />
            </div>

            <div className="w-full max-w-lg">
              <JMBannerText borderColor="rgba(239, 68, 68, 0.4)">
                <h2 className="px-4 py-2 text-center text-base font-black uppercase tracking-wider text-red-400">
                  What Came Through
                </h2>
              </JMBannerText>
              <p className="mt-3 rounded-lg border border-red-400/20 bg-red-400/5 p-4 text-base leading-relaxed text-white/80">
                {garbled}
              </p>
            </div>

            {/* Element-by-element comparison */}
            <div className="w-full max-w-lg">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">
                Element Breakdown
              </p>
              <div className="space-y-1.5">
                {message.elements.map((original, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-2.5 text-sm"
                  >
                    <span className="w-5 text-center text-sm font-bold text-green-400/60">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-white/60">{original}</span>
                    <span className="text-white/40">&rarr;</span>
                    <span className={`flex-1 font-bold ${
                      finalElements[i]?.toLowerCase() === original.toLowerCase()
                        ? "text-green-400"
                        : "text-red-400"
                    }`}>
                      {finalElements[i] ?? "???"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 px-4 py-4">
        {isHost ? (
          <GamePrimaryButton onClick={onProceed}>
            Proceed to Scoring
          </GamePrimaryButton>
        ) : (
          <GameStatusMessage message="Waiting for host to proceed..." />
        )}
      </div>
    </div>
  );
}
