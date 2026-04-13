"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import type { AiImageGenSettings } from "@/lib/bluffbox-ai-image-gen-settings";
import { DEFAULT_AI_IMAGE_GEN_SETTINGS } from "@/lib/bluffbox-ai-image-gen-settings";
import { IdeogramImageControls } from "./IdeogramImageControls";

interface BluffAiImageSettingsModalProps {
  open: boolean;
  onClose: () => void;
  /** e.g. "card" | "cover" | "bulk" — only affects hint text */
  context?: "card" | "cover" | "bulk";
}

export function BluffAiImageSettingsModal({
  open,
  onClose,
  context = "card",
}: BluffAiImageSettingsModalProps) {
  const { aiImageGenSettings, saveAiImageGenSettings } = useAuth();
  const [draft, setDraft] = useState<AiImageGenSettings>(DEFAULT_AI_IMAGE_GEN_SETTINGS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(aiImageGenSettings);
    }
  }, [open, aiImageGenSettings]);

  const hint =
    context === "cover"
      ? "Appended after “Bold eye-catching cover art: …”. Saved to your account."
      : context === "bulk"
        ? "Used for every subject in bulk generate / regen. Saved to your account."
        : "Appended after your card subject. Saved to your account.";

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveAiImageGenSettings(draft);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bluff-ai-settings-title"
        className="relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/20 bg-neutral-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 id="bluff-ai-settings-title" className="text-lg font-bold text-white">
            AI image settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/40 hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <IdeogramImageControls
            ideogram={draft.ideogram}
            onIdeogramChange={(ideo) => setDraft((d) => ({ ...d, ideogram: ideo }))}
            addedFormatPrompt={draft.addedFormatPrompt}
            onAddedFormatChange={(v) => setDraft((d) => ({ ...d, addedFormatPrompt: v }))}
            formatHint={hint}
          />
        </div>
        <div className="flex shrink-0 gap-2 border-t border-white/10 p-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/20 py-3 text-sm font-bold text-white/70 transition-colors hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-bold text-black transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
