"use client";

import { useEffect } from "react";
import { JMAIAvatarView } from "@/JMKit";
import { GameBgUnderlay } from "../GameBgUnderlay";

interface AIShareDisplayProps {
  /** Game splash under the scrim (30%). */
  backgroundImageURL?: string;
  aiName: string;
  aiAvatarName?: string | undefined;
  shareText: string;
  onDismiss: () => void;
}

export default function AIShareDisplay({
  backgroundImageURL,
  aiName,
  aiAvatarName,
  shareText,
  onDismiss,
}: AIShareDisplayProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      onClick={onDismiss}
    >
      <GameBgUnderlay url={backgroundImageURL} />
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 flex w-full max-w-sm flex-col items-center gap-5 rounded-2xl border border-white/20 bg-neutral-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <JMAIAvatarView size={72} avatarName={aiAvatarName} />
        <p className="text-center text-sm font-bold text-white">{aiName}</p>
        <div className="rounded-xl bg-white/5 p-4">
          <p className="text-center text-base italic leading-relaxed text-white/80">
            &ldquo;{shareText}&rdquo;
          </p>
        </div>
        <p className="animate-pulse text-xs text-white/30">
          They&apos;ve made their choice...
        </p>
        <button
          onClick={onDismiss}
          className="rounded-lg px-6 py-2 text-sm text-white/40 transition-colors hover:bg-white/10"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
