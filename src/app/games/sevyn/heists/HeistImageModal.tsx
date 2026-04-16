"use client";

import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { JMCloseCircleButton } from "@/JMKit/JMCloseCircleButton";
import { getAIAuthHeaders } from "@/app/games/_gamecore";
import { uploadSevynImage } from "@/lib/sevyn-storage";

const v = () => Date.now().toString(36);

/** Build a unique Firebase Storage path for a heist image */
function storagePath(
  heistId: string,
  type: "background" | "target-object" | "asset" | "civilian" | "bomb",
  index?: number,
): string {
  switch (type) {
    case "background": return `sevyn-heists/${heistId}/background-${v()}.jpg`;
    case "target-object": return `sevyn-heists/${heistId}/target-object-${v()}.jpg`;
    case "asset": return `sevyn-heists/${heistId}/asset-${index}-${v()}.jpg`;
    case "civilian": return `sevyn-heists/${heistId}/civilian-${index}-${v()}.jpg`;
    case "bomb": return `sevyn-heists/${heistId}/bomb-${v()}.jpg`;
  }
}

interface HeistImageModalProps {
  /** Label shown at top, e.g. "Asset 3 — THE UPLINK CODE" */
  label: string;
  /** Current image URL (empty string if none) */
  currentUrl: string;
  /** Storage type for uploadSevynImage */
  storageType: "background" | "target-object" | "asset" | "civilian" | "bomb";
  /** Index within the asset/civilian array (omit for non-indexed types) */
  index?: number;
  /** Temp heist ID for storage path */
  heistId: string;
  /** Ideogram aspect ratio string (default "1x1") */
  aiAspectRatio?: string;
  /** Called with the new image URL */
  onSave: (url: string) => void;
  onClose: () => void;
}

export default function HeistImageModal({
  label,
  currentUrl,
  storageType,
  index,
  heistId,
  aiAspectRatio = "1x1",
  onSave,
  onClose,
}: HeistImageModalProps) {
  const [imageUrl, setImageUrl] = useState(currentUrl);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [persisting, setPersisting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track whether the current URL is an unpersisted ephemeral URL
  const [isEphemeral, setIsEphemeral] = useState(false);

  const handleGenerateImage = useCallback(async () => {
    if (!aiPrompt.trim()) return;
    setGenerating(true);
    setError(null);

    try {
      const headers = await getAIAuthHeaders();
      const res = await fetch("/api/games/ai", {
        method: "POST",
        headers,
        body: JSON.stringify({
          type: "generate-image",
          prompt: aiPrompt.trim(),
          rendering_speed: "QUALITY",
          style_type: "REALISTIC",
          magic_prompt: "ON",
          aspect_ratio: aiAspectRatio,
        }),
      });

      if (!res.ok) {
        setError("Image generation failed");
        return;
      }

      const data = (await res.json()) as { imageUrl?: string };
      if (data.imageUrl) {
        setImageUrl(data.imageUrl);
        setIsEphemeral(true);
      }
    } catch (err) {
      setError(`AI error: ${err}`);
    } finally {
      setGenerating(false);
    }
  }, [aiPrompt, aiAspectRatio]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      setError(null);
      try {
        const url = await uploadSevynImage(heistId, storageType, file, index);
        setImageUrl(url);
        setIsEphemeral(false);
      } catch (err) {
        setError(`Upload failed: ${err}`);
      } finally {
        setUploading(false);
      }
    },
    [heistId, storageType, index],
  );

  /** Persist ephemeral URL to Firebase Storage via server-side proxy */
  const handleSave = useCallback(async () => {
    if (!imageUrl) return;

    if (!isEphemeral) {
      // Already a permanent URL (uploaded file or previously persisted)
      onSave(imageUrl);
      onClose();
      return;
    }

    // Proxy download through our API (avoids CORS)
    setPersisting(true);
    setError(null);
    try {
      const headers = await getAIAuthHeaders();
      const path = storagePath(heistId, storageType, index);
      const isBackground = storageType === "background";
      const res = await fetch("/api/games/ai", {
        method: "POST",
        headers,
        body: JSON.stringify({
          type: "persist-image",
          url: imageUrl,
          storagePath: path,
          maxDimension: isBackground ? 1280 : 720,
          jpegQuality: isBackground ? 40 : 25,
        }),
      });

      if (!res.ok) {
        setError("Failed to save image");
        return;
      }

      const data = (await res.json()) as { imageUrl?: string };
      if (data.imageUrl) {
        setIsEphemeral(false);
        onSave(data.imageUrl);
        onClose();
      }
    } catch (err) {
      setError(`Save failed: ${err}`);
    } finally {
      setPersisting(false);
    }
  }, [imageUrl, isEphemeral, heistId, storageType, index, onSave, onClose]);

  if (typeof document === "undefined") return null;

  const isPortrait = aiAspectRatio === "9x16";
  const busy = generating || uploading || persisting;

  return createPortal(
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-white/15 bg-neutral-950 p-5 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white">{label}</h3>
            <p className="mt-0.5 text-xs text-white/40">Generate or upload an image</p>
          </div>
          <JMCloseCircleButton onClick={onClose} />
        </div>

        {/* Preview — plain <img> works with any URL (Ideogram ephemeral, Firebase, etc.) */}
        {imageUrl ? (
          <div className="mb-4 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Preview"
              className={`rounded-lg object-cover ${isPortrait ? "h-48 w-auto" : "h-36 w-36"}`}
            />
          </div>
        ) : (
          <div className={`mb-4 flex items-center justify-center rounded-lg border border-dashed border-white/15 text-xs text-white/20 ${isPortrait ? "mx-auto h-48 w-28" : "mx-auto h-36 w-36"}`}>
            No image
          </div>
        )}

        {/* Upload */}
        <div className="mb-4">
          <label className="flex w-full cursor-pointer items-center justify-center rounded-lg border border-white/15 bg-white/5 py-2 text-xs font-medium text-white/50 transition hover:bg-white/10 hover:text-white/70">
            {uploading ? "Uploading..." : "Upload Image"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={busy}
            />
          </label>
        </div>

        {/* AI Generate */}
        <div className="mb-4">
          <p className="mb-1.5 text-xs font-medium text-white/50">AI Generate</p>
          <textarea
            className="mb-2 h-16 w-full rounded-lg border border-white/20 bg-white/5 px-2 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-[#E84C1E]"
            placeholder="Describe the image..."
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
          />
          <button
            type="button"
            className="w-full rounded-lg bg-[#E84C1E]/20 px-3 py-1.5 text-xs font-semibold text-[#E84C1E] transition hover:bg-[#E84C1E]/30 disabled:opacity-50"
            disabled={generating || !aiPrompt.trim()}
            onClick={handleGenerateImage}
          >
            {generating ? "Generating..." : "Generate Image"}
          </button>
        </div>

        {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

        {/* Save */}
        <button
          type="button"
          className="w-full rounded-xl bg-[#E84C1E] py-2.5 text-sm font-bold text-white transition hover:bg-[#E84C1E]/90 disabled:opacity-40"
          disabled={!imageUrl || persisting}
          onClick={handleSave}
        >
          {persisting ? "Saving..." : imageUrl ? "Save Image" : "No Image Yet"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
