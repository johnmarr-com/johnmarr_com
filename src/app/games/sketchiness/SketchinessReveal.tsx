"use client";

import { useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { SketchCanvas } from "../_gamecore";
import { JMBannerText } from "@/JMKit";
import JMAvatarView from "@/JMKit/JMAvatarView";
import type { GameSessionPlayer } from "@/lib/game-sessions";
import {
  assembleMadLibs,
  assembleOriginal,
  type Chains,
  type ChainEntry,
} from "./chainEngine";

interface SketchinessRevealProps {
  players: GameSessionPlayer[];
  playOrder: string[];
  aiPlayerId: string | null;
  chains: Chains;
  message: { template: string; elements: string[] };
  onProceed: () => void;
  isHost: boolean;
}

export default function SketchinessReveal({
  players,
  aiPlayerId,
  chains,
  message,
  onProceed,
  isHost,
}: SketchinessRevealProps) {
  const [viewMode, setViewMode] = useState<"chains" | "madlibs">("chains");
  const [selectedElement, setSelectedElement] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  const elementCount = message.elements.length;
  const currentChain: ChainEntry[] = chains[String(selectedElement)] ?? [];

  const getPlayerName = useCallback(
    (uid: string) => {
      if (uid === "control") return "Control";
      if (uid === aiPlayerId) return "Agent SILICON";
      return players.find((p) => p.uid === uid)?.gamertag ?? "Unknown";
    },
    [players, aiPlayerId],
  );

  const getPlayerAvatar = useCallback(
    (uid: string) => {
      if (uid === "control" || uid === aiPlayerId) return undefined;
      return players.find((p) => p.uid === uid)?.avatarName;
    },
    [players, aiPlayerId],
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
            className={`text-xs font-bold uppercase tracking-wider transition-colors ${
              viewMode === "chains" ? "text-green-400" : "text-white/30 hover:text-white/60"
            }`}
          >
            Chain View
          </button>
          <span className="text-white/10">|</span>
          <button
            onClick={() => setViewMode("madlibs")}
            className={`text-xs font-bold uppercase tracking-wider transition-colors ${
              viewMode === "madlibs" ? "text-green-400" : "text-white/30 hover:text-white/60"
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
                className="rounded-full bg-white/10 p-1.5 text-white/50 disabled:opacity-20"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-xs text-white/40">
                Step {stepIndex + 1} / {currentChain.length}
              </span>
              <button
                onClick={() => setStepIndex((s) => Math.min(currentChain.length - 1, s + 1))}
                disabled={stepIndex >= currentChain.length - 1}
                className="rounded-full bg-white/10 p-1.5 text-white/50 disabled:opacity-20"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Current entry display */}
            {currentEntry && (
              <div className="w-full max-w-lg">
                <div className="mb-2 flex items-center gap-2 justify-center">
                  <div className="h-6 w-6">
                    {currentEntry.playerId === "control" || currentEntry.playerId === aiPlayerId ? (
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-green-400/20 text-[8px] font-bold text-green-400">
                        {currentEntry.playerId === "control" ? "C" : "AI"}
                      </div>
                    ) : getPlayerAvatar(currentEntry.playerId) ? (
                      <JMAvatarView
                        width={24}
                        avatarName={getPlayerAvatar(currentEntry.playerId)!}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-white/10 text-[8px] font-bold text-white/60">
                        {getPlayerName(currentEntry.playerId).charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-bold text-white/60">
                    {getPlayerName(currentEntry.playerId)}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                    currentEntry.type === "text"
                      ? "bg-amber-400/10 text-amber-400/60"
                      : "bg-blue-400/10 text-blue-400/60"
                  }`}>
                    {currentEntry.type === "text" ? "Text" : "Sketch"}
                  </span>
                </div>

                {currentEntry.type === "text" ? (
                  <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center">
                    <p className="text-2xl font-black text-white">
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
                <h2 className="px-4 py-2 text-center text-sm font-black uppercase tracking-wider text-green-400">
                  Control&apos;s Original Message
                </h2>
              </JMBannerText>
              <p className="mt-3 rounded-lg border border-green-400/20 bg-green-400/5 p-4 text-sm leading-relaxed text-white/80">
                {original}
              </p>
            </div>

            <div className="flex items-center justify-center">
              <Eye className="h-5 w-5 text-white/20" />
            </div>

            <div className="w-full max-w-lg">
              <JMBannerText borderColor="rgba(239, 68, 68, 0.4)">
                <h2 className="px-4 py-2 text-center text-sm font-black uppercase tracking-wider text-red-400">
                  What Came Through
                </h2>
              </JMBannerText>
              <p className="mt-3 rounded-lg border border-red-400/20 bg-red-400/5 p-4 text-sm leading-relaxed text-white/80">
                {garbled}
              </p>
            </div>

            {/* Element-by-element comparison */}
            <div className="w-full max-w-lg">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/30">
                Element Breakdown
              </p>
              <div className="space-y-1.5">
                {message.elements.map((original, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-sm"
                  >
                    <span className="w-5 text-center text-xs font-bold text-green-400/40">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-white/50">{original}</span>
                    <span className="text-white/20">&rarr;</span>
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
          <button
            onClick={onProceed}
            className="w-full rounded-xl bg-green-500 py-4 text-lg font-bold uppercase tracking-wider text-black shadow-lg shadow-green-500/20 transition-all hover:scale-[1.02] active:scale-95"
          >
            Proceed to Scoring
          </button>
        ) : (
          <p className="text-center text-sm text-white/40">
            Waiting for host to proceed...
          </p>
        )}
      </div>
    </div>
  );
}
