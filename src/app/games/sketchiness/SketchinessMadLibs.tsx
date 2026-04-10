"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { JMBannerText } from "@/JMKit";
import { postGameComment } from "../_gamecore";
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
  const [screen, setScreen] = useState<"intended" | "received">("intended");
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
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-green-400/50" />
          <p className="text-sm font-bold uppercase tracking-wider text-white/40">
            Decrypting transmissions...
          </p>
        </div>
      </div>
    );
  }

  const matches = sessionElementMatches;

  return (
    <div className="fixed inset-0 z-10 flex flex-col">
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-12">
        <div className="flex w-full max-w-lg flex-col items-center gap-6">
          {/* Header */}
          <div className="text-center">
            <p className="text-xs mb-2 font-bold uppercase tracking-[0.3em] text-green-400/60">
              {screen === "intended" ? "Classified Intel" : "Field Report"}
            </p>
            <JMBannerText
              borderColor={
                screen === "intended"
                  ? "rgba(74, 222, 128, 0.4)"
                  : "rgba(251, 146, 60, 0.4)"
              }
            >
              <h1
                className={`px-5 py-3 text-2xl font-black uppercase tracking-wider ${
                  screen === "intended" ? "text-green-400" : "text-orange-400"
                }`}
              >
                {screen === "intended"
                  ? "Intended Transmission"
                  : "Received Transmission"}
              </h1>
            </JMBannerText>
          </div>

          {/* Mission text paragraph */}
          <div className="mt-4 w-full rounded-xl border border-white/10 bg-black/40 p-6">
            <p className="text-lg leading-relaxed">
              {templateParts.map((part, pi) => {
                if (part.type === "text") {
                  return (
                    <span key={pi} className="text-white/40">
                      {part.value}
                    </span>
                  );
                }

                const idx = part.index!;

                if (screen === "intended") {
                  return (
                    <span
                      key={pi}
                      className="font-bold text-green-400"
                    >
                      {message.elements[idx]}
                    </span>
                  );
                }

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

          {/* Element-by-element comparison (received screen only) */}
          {screen === "received" && (
            <div className="mt-2 w-full space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/40">
                Element Breakdown
              </p>
              {message.elements.map((orig, i) => {
                const received = finalElements[i] ?? "???";
                const isMatch = matches[i];
                return (
                  <div
                    key={i}
                    className="flex items-baseline gap-3 text-base"
                  >
                    <span className="w-6 shrink-0 text-right text-xs font-bold text-white/30">
                      {i + 1}
                    </span>
                    <span className="text-green-400/60">{orig}</span>
                    <span className="text-white/30">→</span>
                    <span
                      className={`font-bold ${isMatch ? "text-green-400" : "text-orange-400"}`}
                    >
                      {received}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom action */}
      <div className="shrink-0 px-6 pb-8 pt-4">
        <div className="mx-auto w-full max-w-lg">
          {screen === "intended" ? (
            <div className="flex justify-end">
              <button
                onClick={() => setScreen("received")}
                className="flex items-center gap-1.5 rounded-xl bg-white/10 px-5 py-3 text-sm font-bold uppercase tracking-wider text-white transition-all hover:bg-white/20 active:scale-95"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : isHost ? (
            <button
              onClick={() => onProceed()}
              className="w-full rounded-xl bg-white py-4 text-lg font-bold uppercase tracking-wider text-black shadow-lg shadow-white/20 transition-all hover:scale-[1.02] active:scale-95"
            >
              Continue to Debrief
            </button>
          ) : (
            <p className="text-center text-sm text-white/40">
              Waiting for host...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
