"use client";

import { useState } from "react";
import { X, Copy, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { copyMission, type SketchinessMission } from "@/lib/sketchiness-missions";

interface MissionDetailViewProps {
  mission: SketchinessMission;
  /** If set, truncate display to this many segments */
  truncateTo?: number;
  onClose: () => void;
  /** Called when user copies to My Missions */
  onCopied?: (newMission: SketchinessMission) => void;
  /** Called when "Select This Mission" pressed in picker context */
  onSelect?: (mission: SketchinessMission) => void;
}

export default function MissionDetailView({
  mission,
  truncateTo,
  onClose,
  onCopied,
  onSelect,
}: MissionDetailViewProps) {
  const { user, gamertag, userTier, isAdmin } = useAuth();
  const [copying, setCopying] = useState(false);

  const canCopy = isAdmin || userTier === "pro";
  const displaySegments = truncateTo
    ? mission.segments.slice(0, truncateTo)
    : mission.segments;

  const handleCopy = async () => {
    if (!user || !gamertag) return;
    setCopying(true);
    try {
      const newMission = await copyMission(mission.id, user.uid, gamertag);
      onCopied?.(newMission);
    } catch (err) {
      console.error("Failed to copy mission:", err);
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-white/20 bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-white">{mission.title}</h3>
            <p className="text-xs text-white/40">
              by {mission.creatorGamertag} &middot; Max {mission.maxPlayers} players
              {truncateTo && truncateTo < mission.segments.length && (
                <span className="ml-1 text-yellow-400/80">
                  (showing {truncateTo} of {mission.segments.length})
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Segments */}
        <div className="flex-1 overflow-y-auto p-5" style={{ scrollbarWidth: "none" }}>
          <div className="space-y-2">
            {displaySegments.map((seg, i) => (
              <div key={i} className="flex items-baseline gap-2">
                <span className="w-5 shrink-0 text-right text-xs font-bold text-white/20">
                  {i + 1}
                </span>
                {seg.descriptiveText && (
                  <span className="text-sm italic text-white/40">{seg.descriptiveText}</span>
                )}
                <span className="text-sm font-bold text-green-300">
                  &ldquo;{seg.missionText}&rdquo;
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 gap-2 border-t border-white/10 p-4">
          {canCopy && !onSelect && (
            <button
              onClick={handleCopy}
              disabled={copying}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-blue-400/30 bg-blue-400/10 py-3 text-sm font-bold text-blue-300 transition-colors hover:bg-blue-400/20 disabled:opacity-50"
            >
              {copying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
              Copy to My Missions
            </button>
          )}
          {onSelect && (
            <button
              onClick={() => onSelect(mission)}
              className="flex-1 rounded-xl bg-green-500 py-3 text-sm font-bold uppercase tracking-wider text-black transition-all hover:scale-[1.02] active:scale-95"
            >
              Select This Mission
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
