"use client";

import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldAlert, Flag, X } from "lucide-react";
import { JMBannerText } from "@/JMKit";
import { GamePrimaryButton, GameStatusMessage } from "../_gamecore";
import { type ScoringResult } from "./useMegaSketchySession";

interface MegaSketchyScoringProps {
  /** From the Mad Libs judge: [] means the LLM was unavailable (no verdict). */
  elementMatches: boolean[] | null;
  /** Set by the server "megasketchy-score" effect; null while evaluating. */
  sessionScoringResult: ScoringResult | null;
  /** Proceed to the transmissions viewer (any player may). */
  onComplete: () => void;
}

export default function MegaSketchyScoring({
  elementMatches,
  sessionScoringResult,
  onComplete,
}: MegaSketchyScoringProps) {
  const router = useRouter();

  // The server "megasketchy-score" effect computes pass/fail + the debrief
  // narrative; until it writes scoringResult, show the evaluating state.
  if (!sessionScoringResult) {
    return (
      <div className="fixed inset-0 z-10 flex flex-col items-center justify-center">
        <GameStatusMessage message="Control is evaluating the intel..." type="loading" />
      </div>
    );
  }

  const result = sessionScoringResult;
  // elementMatches === [] means the AI judge was unavailable in the Mad Libs
  // phase, so there is no verdict — close on a neutral "Mission Accomplished"
  // (the intended-vs-received relay was shown on the previous screen).
  const unjudged = !elementMatches || elementMatches.length === 0;

  return (
    // Own scrollable layer — a long debrief scrolls instead of overflowing off
    // the top/bottom (which on iOS hid the action button entirely).
    <div className="fixed inset-0 z-10 overflow-y-auto">
      {/* Exit (everyone) — fixed so it stays put while the debrief scrolls. */}
      <button
        onClick={() => router.push("/")}
        aria-label="Exit"
        className="fixed right-4 top-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white/80 backdrop-blur-sm transition-colors hover:bg-white/15 hover:text-white"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="flex min-h-full flex-col items-center justify-center px-6 py-16">
        <div className="flex w-full max-w-lg flex-col items-center gap-6">
          {unjudged ? (
            <>
              {/* No verdict — neutral completion */}
              <div className="rounded-full bg-white/10 p-4">
                <Flag className="h-16 w-16 text-white/80" />
              </div>
              <JMBannerText borderColor="rgba(255, 255, 255, 0.25)">
                <h1 className="px-8 py-4 text-center text-4xl font-black uppercase tracking-wider text-white">
                  Mission Accomplished
                </h1>
              </JMBannerText>
              <p className="text-center text-lg leading-relaxed text-white/60">
                The message ran the gauntlet of the network.
              </p>
            </>
          ) : (
            <>
              {/* Verdict icon */}
              <div className={`rounded-full p-4 ${result.passed ? "bg-green-400/10" : "bg-red-400/10"}`}>
                {result.passed ? (
                  <ShieldCheck className="h-16 w-16 text-green-400" />
                ) : (
                  <ShieldAlert className="h-16 w-16 text-red-400" />
                )}
              </div>

              {/* Verdict text */}
              <JMBannerText borderColor={result.passed ? "rgba(34, 197, 94, 0.4)" : "rgba(239, 68, 68, 0.4)"}>
                <h1
                  className={`px-8 py-4 text-center text-4xl font-black uppercase tracking-wider ${
                    result.passed ? "text-green-400" : "text-red-400"
                  }`}
                >
                  Mission {result.passed ? "Passed" : "Failed"}
                </h1>
              </JMBannerText>

              {/* Narrative */}
              <p className="text-center text-lg leading-relaxed text-white/80">
                {result.narrative}
              </p>
            </>
          )}

          {/* Action — anyone can open the transmissions viewer. */}
          <div className="w-full pt-4">
            <GamePrimaryButton onClick={onComplete} variant="white">
              View Transmissions
            </GamePrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}
