"use client";

import { useEffect, useCallback, useRef } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { JMBannerText } from "@/JMKit";
import { postGameComment, GamePrimaryButton, GameStatusMessage } from "../_gamecore";
import {
  assembleMadLibs,
  assembleOriginal,
  type Chains,
} from "./chainEngine";
import { updateSessionFields, type ScoringResult } from "./useMegaSketchySession";

interface MegaSketchyScoringProps {
  sessionId: string;
  chains: Chains;
  message: { template: string; elements: string[] };
  elementMatches: boolean[] | null;
  sessionScoringResult: ScoringResult | null;
  onComplete: (passed: boolean) => void;
  isHost: boolean;
}

export default function MegaSketchyScoring({
  sessionId,
  chains,
  message,
  elementMatches,
  sessionScoringResult,
  onComplete,
  isHost,
}: MegaSketchyScoringProps) {
  const scoringRef = useRef(false);

  const scoreWithAI = useCallback(async () => {
    const original = assembleOriginal(message.template, message.elements);
    const { result: garbled, finalElements } = assembleMadLibs(
      message.template,
      chains,
      message.elements.length,
    );

    const matches = elementMatches ?? message.elements.map(() => false);
    const matchCount = matches.filter(Boolean).length;
    const passed = matchCount >= Math.ceil(message.elements.length / 2);

    const elementComparison = message.elements
      .map(
        (orig, i) =>
          `  ${i + 1}. "${orig}" → "${finalElements[i] ?? "???"}" [${matches[i] ? "MATCH" : "MISS"}]`,
      )
      .join("\n");

    const prompt = `You are the AI handler for a spy-themed party game called "Mega Sketchy." A secret message was relayed through a chain of agents via alternating sketching and guessing, like Telephone/Telestrations.

ORIGINAL MESSAGE FROM CONTROL:
${original}

WHAT CAME THROUGH THE SPY NETWORK:
${garbled}

ELEMENT-BY-ELEMENT (already judged):
${elementComparison}

Result: ${matchCount}/${message.elements.length} elements matched. Mission ${passed ? "PASSED" : "FAILED"}.

Write 2-3 sentences as a dramatic spy mission debrief. Be funny and reference specific elements that were hilariously mangled or surprisingly preserved. Stay in character as a spy handler. Just the narrative, no labels or prefixes.`;

    let narrative: string;
    try {
      const { comment } = await postGameComment(prompt);
      narrative = comment.trim() ||
        (passed
          ? "Against all odds, the intel made it through. Control is pleased."
          : "The message was mangled beyond recognition. Agents are compromised.");
    } catch {
      narrative = passed
        ? "The intel survived the network. Mission accomplished, agents."
        : "Too much was lost in translation. The mission has failed.";
    }

    await updateSessionFields(sessionId, {
      scoringResult: { passed, narrative },
    });
  }, [chains, message, elementMatches, sessionId]);

  useEffect(() => {
    if (!isHost || sessionScoringResult || scoringRef.current) return;
    scoringRef.current = true;
    scoreWithAI();
  }, [isHost, sessionScoringResult, scoreWithAI]);

  if (!sessionScoringResult) {
    return (
      <div className="fixed inset-0 z-10 flex flex-col items-center justify-center">
        <GameStatusMessage message="Control is evaluating the intel..." type="loading" />
      </div>
    );
  }

  const result = sessionScoringResult;

  return (
    <div className="fixed inset-0 z-10 flex flex-col items-center justify-center px-6">
      <div className="flex w-full max-w-lg flex-col items-center gap-6">
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
          <h1 className={`px-8 py-4 text-4xl font-black uppercase tracking-wider ${
            result.passed ? "text-green-400" : "text-red-400"
          }`}>
            Mission {result.passed ? "Passed" : "Failed"}
          </h1>
        </JMBannerText>

        {/* Narrative */}
        <p className="text-center text-lg leading-relaxed text-white/80">
          {result.narrative}
        </p>

        {/* Action */}
        <div className="w-full pt-4">
          {isHost ? (
            <GamePrimaryButton onClick={() => onComplete(result.passed)} variant="white">
              Continue
            </GamePrimaryButton>
          ) : (
            <GameStatusMessage message="Waiting for host..." />
          )}
        </div>
      </div>
    </div>
  );
}
