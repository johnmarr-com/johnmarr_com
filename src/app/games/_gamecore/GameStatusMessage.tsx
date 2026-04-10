"use client";

import { Loader2 } from "lucide-react";

interface GameStatusMessageProps {
  message: string;
  type?: "loading" | "waiting";
}

/**
 * Centered status display: either a spinner + message (loading)
 * or a plain "Waiting for host…" style message.
 */
export function GameStatusMessage({
  message,
  type = "waiting",
}: GameStatusMessageProps) {
  if (type === "loading") {
    return (
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-green-400/50" />
        <p className="text-sm font-bold uppercase tracking-wider text-white/60">
          {message}
        </p>
      </div>
    );
  }

  return (
    <p className="text-center text-sm font-medium text-white/50">
      {message}
    </p>
  );
}
