"use client";

import { useState, useCallback } from "react";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import {
  createMission,
  updateMission,
  type MissionSegment,
  type SketchinessMission,
} from "@/lib/sketchiness-missions";

interface MissionEditorProps {
  /** If provided, we're editing an existing mission instead of creating */
  existingMission?: SketchinessMission | undefined;
  onSaved: (mission: SketchinessMission) => void;
}

export default function MissionEditor({ existingMission, onSaved }: MissionEditorProps) {
  const { user, gamertag, isAdmin } = useAuth();

  const [title, setTitle] = useState(existingMission?.title ?? "");
  const [segments, setSegments] = useState<MissionSegment[]>(
    existingMission?.segments ?? [
      { descriptiveText: "", missionText: "" },
      { descriptiveText: "", missionText: "" },
    ],
  );
  const [isOfficial, setIsOfficial] = useState(existingMission?.visibility === "official");
  const [isShared, setIsShared] = useState(
    existingMission?.visibility === "shared" || existingMission?.visibility === "official",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxPlayers = segments.length;

  const addRows = useCallback(() => {
    if (segments.length >= 14) return;
    setSegments((prev) => [
      ...prev,
      { descriptiveText: "", missionText: "" },
      { descriptiveText: "", missionText: "" },
    ]);
  }, [segments.length]);

  const removeLastRows = useCallback(() => {
    if (segments.length <= 2) return;
    setSegments((prev) => prev.slice(0, prev.length - 2));
  }, [segments.length]);

  const updateSegment = useCallback(
    (index: number, field: keyof MissionSegment, value: string) => {
      setSegments((prev) => {
        const next = [...prev];
        next[index] = { ...next[index]!, [field]: value };
        return next;
      });
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!user || !gamertag) return;
    if (!title.trim()) {
      setError("Mission title is required.");
      return;
    }
    const hasEmpty = segments.some((s) => !s.missionText.trim());
    if (hasEmpty) {
      setError("All mission text fields are required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const visibility = isAdmin && isOfficial ? "official" : isShared ? "shared" : "private";

      if (existingMission) {
        await updateMission(existingMission.id, {
          title: title.trim(),
          segments,
          visibility,
        });
        onSaved({ ...existingMission, title: title.trim(), segments, visibility, maxPlayers: segments.length });
      } else {
        const mission = await createMission(
          { title: title.trim(), segments, visibility },
          user.uid,
          gamertag,
        );
        onSaved(mission);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save mission.");
    } finally {
      setSaving(false);
    }
  }, [user, gamertag, title, segments, isOfficial, isShared, isAdmin, existingMission, onSaved]);

  return (
    <div className="flex flex-col gap-4">
      {/* Max players indicator */}
      <div className="text-center">
        <span className="rounded-full bg-green-400/10 px-4 py-1.5 text-sm font-bold text-green-400">
          Max Players: {maxPlayers}
        </span>
      </div>

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Mission title..."
        className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-lg font-bold text-white placeholder-white/30 outline-none focus:border-green-400/50"
      />

      {/* Segment rows */}
      <div className="space-y-2">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-center text-xs font-bold text-white/30">
              {i + 1}
            </span>
            <input
              type="text"
              value={seg.descriptiveText}
              onChange={(e) => updateSegment(i, "descriptiveText", e.target.value)}
              placeholder="connecting text..."
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/50 italic placeholder-white/20 outline-none focus:border-white/30"
            />
            <input
              type="text"
              value={seg.missionText}
              onChange={(e) => updateSegment(i, "missionText", e.target.value)}
              placeholder="mission text *"
              className="flex-1 rounded-lg border border-green-400/30 bg-green-400/5 px-3 py-2 text-sm font-bold text-green-300 placeholder-green-300/30 outline-none focus:border-green-400/50"
            />
          </div>
        ))}
      </div>

      {/* Add / Remove rows */}
      <div className="flex items-center gap-2">
        {segments.length < 14 && (
          <button
            onClick={addRows}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/60 transition-colors hover:bg-white/10"
          >
            <Plus className="h-4 w-4" />
            Add Mission Text
          </button>
        )}
        {segments.length > 2 && (
          <button
            onClick={removeLastRows}
            className="flex items-center gap-1.5 rounded-lg border border-red-400/20 bg-red-400/5 px-4 py-2 text-sm font-medium text-red-400/60 transition-colors hover:bg-red-400/10"
          >
            <Trash2 className="h-4 w-4" />
            Remove Last Two
          </button>
        )}
      </div>

      {/* Toggles */}
      <div className="space-y-2 border-t border-white/10 pt-4">
        {isAdmin && (
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={isOfficial}
              onChange={(e) => setIsOfficial(e.target.checked)}
              className="h-4 w-4 rounded border-white/30 bg-white/5 accent-green-400"
            />
            <span className="text-sm text-white/60">
              Make this an <span className="font-bold text-green-400">Official Mission</span>
            </span>
          </label>
        )}
        {!isOfficial && (
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={isShared}
              onChange={(e) => setIsShared(e.target.checked)}
              className="h-4 w-4 rounded border-white/30 bg-white/5 accent-blue-400"
            />
            <span className="text-sm text-white/60">
              Share this mission with everyone
            </span>
          </label>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-center text-sm text-red-400">{error}</p>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-xl bg-green-500 py-4 text-lg font-bold uppercase tracking-wider text-black shadow-lg shadow-green-500/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        ) : existingMission ? (
          "Save Changes"
        ) : (
          "Create Mission"
        )}
      </button>
    </div>
  );
}
