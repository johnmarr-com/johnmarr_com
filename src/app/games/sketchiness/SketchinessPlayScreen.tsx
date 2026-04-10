"use client";

import { useRef, useState, useCallback } from "react";
import { Loader2, Send } from "lucide-react";
import { SketchCanvas, type SketchCanvasRef } from "../_gamecore";
import { uploadSketch } from "@/lib/game-sketches";
import type { ChainEntry, PlayerTask } from "./chainEngine";

interface SketchinessPlayScreenProps {
  sessionId: string;
  task: PlayerTask | null;
  queueLength: number;
  playerDone: boolean;
  onTransmit: (entry: ChainEntry) => Promise<void>;
  userId: string;
}

export default function SketchinessPlayScreen({
  sessionId,
  task,
  queueLength,
  playerDone,
  onTransmit,
  userId,
}: SketchinessPlayScreenProps) {
  const canvasRef = useRef<SketchCanvasRef>(null);
  const [textGuess, setTextGuess] = useState("");
  const [sending, setSending] = useState(false);

  const handleTransmitDrawing = useCallback(async () => {
    if (!canvasRef.current || !task || sending) return;
    setSending(true);
    try {
      const blob = await canvasRef.current.exportJpeg();
      const url = await uploadSketch(sessionId, task.elementIndex, task.stepIndex, blob);
      await onTransmit({
        type: "image",
        value: url,
        playerId: userId,
        timestamp: Date.now(),
      });
    } finally {
      setSending(false);
    }
  }, [canvasRef, task, sending, sessionId, userId, onTransmit]);

  const handleTransmitGuess = useCallback(async () => {
    if (!task || !textGuess.trim() || sending) return;
    setSending(true);
    try {
      await onTransmit({
        type: "text",
        value: textGuess.trim(),
        playerId: userId,
        timestamp: Date.now(),
      });
      setTextGuess("");
    } finally {
      setSending(false);
    }
  }, [task, textGuess, sending, userId, onTransmit]);

  // Waiting state
  if (!task) {
    return (
      <div className="fixed inset-0 z-10 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-green-400/50" />
          <p className="text-sm font-bold uppercase tracking-wider text-white/40">
            {playerDone ? "Waiting for final review..." : "Waiting for intel..."}
          </p>
          {!playerDone && (
            <p className="text-xs text-white/20">
              Your next transmission will arrive shortly.
            </p>
          )}
        </div>
      </div>
    );
  }

  const isDraw = task.taskType === "draw";

  return (
    <div className="fixed inset-0 z-10 flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
            isDraw
              ? "bg-blue-500/20 text-blue-400"
              : "bg-amber-500/20 text-amber-400"
          }`}>
            {isDraw ? "Sketch It" : "Decode It"}
          </span>
          <span className="text-xs text-white/30">
            Element {task.elementIndex + 1} / Step {task.stepIndex}
          </span>
        </div>
        {queueLength > 1 && (
          <span className="rounded-full bg-green-400/10 px-2.5 py-1 text-[10px] font-bold text-green-400/60">
            +{queueLength - 1} queued
          </span>
        )}
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col items-center overflow-y-auto px-4 py-4">
        {isDraw ? (
          <>
            {/* Show the text to draw */}
            <div className="mb-3 w-full max-w-lg rounded-lg border border-red-400/20 bg-red-500/5 p-4 text-center">
              <p className="text-sm font-bold uppercase tracking-wider text-red-400 mb-1">
                Incoming Intel — Sketch This:
              </p>
              <p className="text-3xl font-black text-white">
                &ldquo;{task.input.value}&rdquo;
              </p>
            </div>

            {/* Drawing canvas */}
            <div className="w-full max-w-lg">
              <SketchCanvas ref={canvasRef} />
            </div>
          </>
        ) : (
          <>
            {/* Show the sketch to decode */}
            <div className="mb-3 w-full max-w-lg">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-2 text-center">
                Incoming sketch — what is this?
              </p>
              <SketchCanvas readOnly backgroundImage={task.input.value} />
            </div>

            {/* Text input */}
            <div className="w-full max-w-lg">
              <input
                type="text"
                value={textGuess}
                onChange={(e) => setTextGuess(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleTransmitGuess();
                }}
                placeholder="What do you see? Type your guess..."
                className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-lg text-white placeholder-white/30 outline-none focus:border-green-400/50"
                autoFocus
                disabled={sending}
              />
            </div>
          </>
        )}
      </div>

      {/* Transmit button */}
      <div className="border-t border-white/10 px-4 py-4">
        <button
          onClick={isDraw ? handleTransmitDrawing : handleTransmitGuess}
          disabled={sending || (!isDraw && !textGuess.trim())}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-500 py-4 text-lg font-bold uppercase tracking-wider text-black shadow-lg shadow-green-500/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
        >
          {sending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Send className="h-5 w-5" />
              Transmit
            </>
          )}
        </button>
      </div>
    </div>
  );
}
