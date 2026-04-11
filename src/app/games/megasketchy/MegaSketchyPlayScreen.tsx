"use client";

import { useRef, useState, useCallback } from "react";
import { Send } from "lucide-react";
import { SketchCanvas, type SketchCanvasRef, GamePrimaryButton, GameStatusMessage } from "../_gamecore";
import { uploadSketch } from "@/lib/game-sketches";
import type { ChainEntry, PlayerTask } from "./chainEngine";

interface MegaSketchyPlayScreenProps {
  sessionId: string;
  task: PlayerTask | null;
  queueLength: number;
  playerDone: boolean;
  onTransmit: (entry: ChainEntry) => Promise<void>;
  userId: string;
  round: number;
}

export default function MegaSketchyPlayScreen({
  sessionId,
  task,
  queueLength,
  playerDone,
  onTransmit,
  userId,
  round,
}: MegaSketchyPlayScreenProps) {
  const canvasRef = useRef<SketchCanvasRef>(null);
  const [textGuess, setTextGuess] = useState("");
  const [sending, setSending] = useState(false);

  const handleTransmitDrawing = useCallback(async () => {
    if (!canvasRef.current || !task || sending) return;
    setSending(true);
    try {
      const blob = await canvasRef.current.exportJpeg();
      const url = await uploadSketch(sessionId, task.elementIndex, task.stepIndex, blob, round);
      await onTransmit({
        type: "image",
        value: url,
        playerId: userId,
        timestamp: Date.now(),
      });
    } finally {
      setSending(false);
    }
  }, [canvasRef, task, sending, sessionId, userId, onTransmit, round]);

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
          <GameStatusMessage
            message={playerDone ? "Waiting for final review..." : "Waiting for intel..."}
            type="loading"
          />
          {!playerDone && (
            <p className="text-sm text-white/50">
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
      <div className="relative flex items-center border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
            isDraw
              ? "bg-blue-500/30 text-blue-300"
              : "bg-amber-500/30 text-amber-300"
          }`}>
            {isDraw ? "Sketch It" : "Decode It"}
          </span>
          <span className="text-xs text-white/50">
            Element {task.elementIndex + 1} / Step {task.stepIndex}
          </span>
        </div>
        {queueLength > 1 && (
          <span className="absolute left-3/4 -translate-x-1/2 rounded-full bg-green-400/10 px-3 py-1 text-xs font-bold text-green-400/70">
            +{queueLength - 1} queued
          </span>
        )}
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col items-center overflow-y-auto px-4 py-4">
        {isDraw ? (
          <>
            {/* Show the text to draw */}
            <div className="mb-3 w-full max-w-lg rounded-lg border border-red-400/40 bg-red-950/60 p-4 text-center">
              <p className="text-base font-bold uppercase tracking-wider text-red-400 mb-1">
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
            <div className="mb-4 w-full max-w-lg">
              <div className="mb-3 rounded-lg border border-red-400/40 bg-red-950/60 p-4 text-center">
                <p className="text-base font-bold uppercase tracking-wider text-red-400">
                  Incoming Sketch — What Is This?
                </p>
              </div>
              <SketchCanvas readOnly backgroundImage={task.input.value} />
            </div>

            {/* Text input with blinking cursor placeholder */}
            <div className="w-full max-w-lg">
              <div className="relative">
                <input
                  type="text"
                  value={textGuess}
                  onChange={(e) => setTextGuess(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTransmitGuess();
                  }}
                  placeholder=""
                  className="w-full rounded-xl border-2 border-white/40 bg-white/15 px-4 py-4 text-lg font-medium text-white outline-none focus:border-green-400/60 focus:bg-white/20"
                  autoFocus
                  disabled={sending}
                />
                {!textGuess && (
                  <span className="pointer-events-none absolute inset-0 flex items-center px-4 text-lg text-white/60">
                    What do you see? Type your guess...
                    <span className="ml-0.5 inline-block w-[2px] animate-blink-cursor bg-white" style={{ height: "1.2em" }} />
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Transmit button */}
      <div className="border-t border-white/10 px-4 py-4">
        <GamePrimaryButton
          onClick={isDraw ? handleTransmitDrawing : handleTransmitGuess}
          disabled={!isDraw && !textGuess.trim()}
          loading={sending}
        >
          <span className="flex items-center justify-center gap-2">
            <Send className="h-5 w-5" />
            Transmit
          </span>
        </GamePrimaryButton>
      </div>
    </div>
  );
}
