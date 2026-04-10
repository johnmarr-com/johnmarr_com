"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ChevronRight } from "lucide-react";
import { postGameComment, GameSectionHeader, GamePrimaryButton, GameStatusMessage } from "../_gamecore";
import { assembleMadLibs, type Chains } from "./chainEngine";
import { updateSessionFields } from "./useSketchinessSession";

interface SketchinessMadLibsProps {
  sessionId: string;
  chains: Chains;
  message: { template: string; elements: string[] };
  sessionElementMatches: boolean[] | null;
  onProceed: () => void;
  isHost: boolean;
}

interface TemplatePart {
  type: "text" | "slot";
  value: string;
  index?: number;
}

function parseTemplate(template: string, elementCount: number): TemplatePart[] {
  const parts: TemplatePart[] = [];
  let remaining = template;

  for (let i = 0; i < elementCount; i++) {
    const placeholder = `{${i}}`;
    const idx = remaining.indexOf(placeholder);
    if (idx === -1) continue;

    const before = remaining.slice(0, idx);
    if (before) {
      parts.push({ type: "text", value: before });
    }
    parts.push({ type: "slot", value: "", index: i });
    remaining = remaining.slice(idx + placeholder.length);
  }

  if (remaining) {
    parts.push({ type: "text", value: remaining });
  }

  return parts;
}

export default function SketchinessMadLibs({
  sessionId,
  chains,
  message,
  sessionElementMatches,
  onProceed,
  isHost,
}: SketchinessMadLibsProps) {
  const [showReceived, setShowReceived] = useState(false);
  const judgingRef = useRef(false);

  const { finalElements } = useMemo(
    () => assembleMadLibs(message.template, chains, message.elements.length),
    [message, chains],
  );

  const templateParts = useMemo(
    () => parseTemplate(message.template, message.elements.length),
    [message.template, message.elements.length],
  );

  const judgeElements = useCallback(async () => {
    const pairs = message.elements
      .map((orig, i) => `${i + 1}. "${orig}" → "${finalElements[i] ?? "???"}"`)
      .join("\n");

    const prompt = `You are judging a spy-themed party game. Players passed a secret message through a chain of drawing and guessing (like Telephone). For each element below, decide if the received word/phrase preserves the core meaning of the original (even if wording changed).

ELEMENT PAIRS (Original → Received):
${pairs}

For each element, respond with ONLY a comma-separated list of "Y" or "N" (Y = close enough, N = wrong). Example for 4 elements: Y,N,N,Y

Response:`;

    try {
      const { comment } = await postGameComment(prompt);
      const tokens = comment.trim().split(/[,\s]+/);
      const matches = message.elements.map((_, i) => {
        const token = tokens[i]?.trim().toUpperCase();
        return token === "Y";
      });
      await updateSessionFields(sessionId, { elementMatches: matches });
    } catch {
      const matches = message.elements.map((orig, i) => {
        const received = (finalElements[i] ?? "").toLowerCase();
        const origWords = orig.toLowerCase().split(/\s+/);
        return origWords.some((w) => received.includes(w));
      });
      await updateSessionFields(sessionId, { elementMatches: matches });
    }
  }, [message.elements, finalElements, sessionId]);

  useEffect(() => {
    if (!isHost || sessionElementMatches || judgingRef.current) return;
    judgingRef.current = true;
    judgeElements();
  }, [isHost, sessionElementMatches, judgeElements]);

  if (!sessionElementMatches) {
    return (
      <div className="fixed inset-0 z-10 flex flex-col items-center justify-center">
        <GameStatusMessage message="Decrypting transmissions..." type="loading" />
      </div>
    );
  }

  const matches = sessionElementMatches;

  return (
    <div className="fixed inset-0 z-10 flex flex-col">
      <div className="flex flex-1 flex-col items-center overflow-y-auto px-6 py-10">
        <div className="flex w-full max-w-lg flex-col items-center gap-4">
          {/* ── Intended section ── */}
          <GameSectionHeader eyebrow="Classified Intel" title="Intended Message" useBanner />
          <p className="text-center text-base font-medium text-white/60">
            This is the message you were supposed to send:
          </p>

          <div className="w-full rounded-xl border border-green-400/20 bg-black/40 p-6">
            <p className="text-xl leading-relaxed">
              {templateParts.map((part, pi) => {
                if (part.type === "text") {
                  return (
                    <span key={pi} className="text-white/60">
                      {part.value}
                    </span>
                  );
                }
                return (
                  <span key={pi} className="font-bold text-green-400">
                    {message.elements[part.index!]}
                  </span>
                );
              })}
            </p>
          </div>

          {/* Next button — only shown before received is revealed */}
          {!showReceived && (
            <div className="flex w-full justify-end pt-2">
              <button
                onClick={() => setShowReceived(true)}
                className="flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-base font-bold uppercase tracking-wider text-black shadow-lg shadow-white/20 transition-all hover:scale-[1.02] active:scale-95"
              >
                Next
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* ── Received section — fades in ── */}
          {showReceived && (
            <div className="mt-6 flex w-full flex-col items-center gap-4 animate-fade-in">
              <p className="text-base font-bold uppercase tracking-wider text-orange-400">
                This is the message you sent:
              </p>

              <div className="w-full rounded-xl border border-orange-400/20 bg-black/40 p-6">
                <p className="text-xl leading-relaxed">
                  {templateParts.map((part, pi) => {
                    if (part.type === "text") {
                      return (
                        <span key={pi} className="text-white/60">
                          {part.value}
                        </span>
                      );
                    }
                    const idx = part.index!;
                    const received = finalElements[idx] ?? "???";
                    const isMatch = matches[idx];
                    return (
                      <span
                        key={pi}
                        className={`font-bold ${isMatch ? "text-green-400" : "text-orange-400"}`}
                      >
                        {received}
                      </span>
                    );
                  })}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom action — only after received is shown */}
      {showReceived && (
        <div className="shrink-0 px-6 pb-8 pt-4">
          <div className="mx-auto w-full max-w-lg">
            {isHost ? (
              <GamePrimaryButton onClick={() => onProceed()} variant="white">
                Continue to Debrief
              </GamePrimaryButton>
            ) : (
              <GameStatusMessage message="Waiting for host..." />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
