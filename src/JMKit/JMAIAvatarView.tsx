"use client";

import { Bot } from "lucide-react";
import JMAvatarView from "./JMAvatarView";

interface JMAIAvatarViewProps {
  size: number;
  avatarName?: string | undefined;
  scaleOverride?: number | undefined;
}

/**
 * Centralized AI persona avatar — rendered in a circular clipping view.
 * Use this instead of raw JMAvatarView for AI personas.
 */
export function JMAIAvatarView({ size, avatarName, scaleOverride }: JMAIAvatarViewProps) {
  return (
    <div
      className="shrink-0 overflow-hidden rounded-full"
      style={{ width: size, height: size }}
    >
      {avatarName ? (
        <JMAvatarView width={size} avatarName={avatarName} {...(scaleOverride != null ? { scaleOverride } : {})} />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-red-500/20">
          <Bot style={{ width: size * 0.45, height: size * 0.45 }} className="text-red-400" />
        </div>
      )}
    </div>
  );
}
