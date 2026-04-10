"use client";

import { useState, useCallback, useEffect } from "react";
import { Delete } from "lucide-react";
import {
  INVITE_COLORS,
  INVITE_COLOR_HEX,
  type InviteColor,
  type InviteCodeSegment,
} from "@/lib/game-sessions";

interface JMInviteCodeInputProps {
  onComplete: (code: string) => void;
}

const ALPHANUMERIC = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

type InputPhase = "char" | "color";

export function JMInviteCodeInput({ onComplete }: JMInviteCodeInputProps) {
  const [segments, setSegments] = useState<(InviteCodeSegment | null)[]>([
    null,
    null,
    null,
  ]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [phase, setPhase] = useState<InputPhase>("char");
  const [pendingChar, setPendingChar] = useState<string | null>(null);

  const handleCharPick = useCallback(
    (ch: string) => {
      setPendingChar(ch);
      setPhase("color");
    },
    [],
  );

  const handleColorPick = useCallback(
    (color: InviteColor) => {
      if (!pendingChar) return;

      const next = [...segments];
      next[activeIdx] = { char: pendingChar, color };
      setSegments(next);
      setPendingChar(null);
      setPhase("char");

      if (activeIdx < 2) {
        setActiveIdx(activeIdx + 1);
      }
    },
    [pendingChar, segments, activeIdx],
  );

  const handleSlotTap = useCallback(
    (idx: number) => {
      setActiveIdx(idx);
      setPhase("char");
      setPendingChar(null);
    },
    [],
  );

  const handleBackspace = useCallback(() => {
    if (phase === "color" && pendingChar) {
      setPendingChar(null);
      setPhase("char");
      return;
    }

    if (segments[activeIdx]) {
      const next = [...segments];
      next[activeIdx] = null;
      setSegments(next);
      setPhase("char");
      setPendingChar(null);
      return;
    }

    if (activeIdx > 0) {
      const prev = activeIdx - 1;
      const next = [...segments];
      next[prev] = null;
      setSegments(next);
      setActiveIdx(prev);
      setPhase("char");
      setPendingChar(null);
    }
  }, [phase, pendingChar, segments, activeIdx]);

  useEffect(() => {
    if (segments.every((s) => s !== null)) {
      const code = (segments as InviteCodeSegment[])
        .map((s) => `${s.color}-${s.char}`)
        .join("~");
      onComplete(code);
    }
  }, [segments, onComplete]);

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Three slots */}
      <div className="flex items-center gap-4">
        {segments.map((seg, i) => {
          const isActive = i === activeIdx;
          return (
            <button
              key={i}
              onClick={() => handleSlotTap(i)}
              className={`
                flex h-20 w-20 flex-col items-center justify-center rounded-xl border-2
                transition-all
                ${isActive
                  ? "border-white/80 bg-white/10 shadow-lg shadow-white/10"
                  : seg
                    ? "border-white/20 bg-white/5"
                    : "border-white/10 bg-white/5"
                }
              `}
            >
              {seg ? (
                <>
                  <span
                    className="text-3xl font-black leading-none"
                    style={{ color: INVITE_COLOR_HEX[seg.color] }}
                  >
                    {seg.char}
                  </span>
                  <span className="mt-0.5 text-[9px] font-medium uppercase tracking-widest text-white/40">
                    {seg.color}
                  </span>
                </>
              ) : isActive && pendingChar ? (
                <span className="text-3xl font-black leading-none text-white/70">
                  {pendingChar}
                </span>
              ) : (
                <span className="text-2xl font-bold text-white/15">
                  {i + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Picker area */}
      {phase === "char" ? (
        <div className="w-full max-w-sm">
          <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-widest text-white/40">
            Pick a character
          </p>
          <div className="grid grid-cols-6 gap-1.5">
            {ALPHANUMERIC.map((ch) => (
              <button
                key={ch}
                onClick={() => handleCharPick(ch)}
                className="flex h-11 items-center justify-center rounded-lg bg-white/10 text-base font-bold text-white transition-all hover:bg-white/20 active:scale-90"
              >
                {ch}
              </button>
            ))}
          </div>

          {/* Backspace key */}
          <button
            onClick={handleBackspace}
            className="mt-1.5 flex h-11 w-full items-center justify-center rounded-lg bg-white/10 text-white/50 transition-all hover:bg-white/20 active:scale-95"
          >
            <Delete className="h-6 w-6" />
          </button>
        </div>
      ) : (
        <div className="w-full max-w-sm">
          <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-widest text-white/40">
            Pick a color for &ldquo;{pendingChar}&rdquo;
          </p>
          <div className="grid grid-cols-3 gap-2">
            {INVITE_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => handleColorPick(color)}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 transition-all hover:scale-105 active:scale-95"
                style={{ backgroundColor: `${INVITE_COLOR_HEX[color]}20` }}
              >
                <span
                  className="h-5 w-5 rounded-full"
                  style={{ backgroundColor: INVITE_COLOR_HEX[color] }}
                />
                <span
                  className="text-xs font-bold capitalize"
                  style={{ color: INVITE_COLOR_HEX[color] }}
                >
                  {color}
                </span>
              </button>
            ))}
          </div>

          {/* Backspace key (color phase) */}
          <button
            onClick={handleBackspace}
            className="mt-2 flex h-11 w-full items-center justify-center rounded-lg bg-white/10 text-white/50 transition-all hover:bg-white/20 active:scale-95"
          >
            <Delete className="h-6 w-6" />
          </button>
        </div>
      )}
    </div>
  );
}
