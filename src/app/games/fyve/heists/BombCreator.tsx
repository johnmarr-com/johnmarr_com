"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { JMAudioUpload } from "@/JMKit";
import { createBomb } from "@/lib/fyve-bombs";
import { uploadBombImage, uploadBombAudio } from "@/lib/fyve-bomb-storage";
import { getAIAuthHeaders } from "@/app/games/_gamecore";
import { GamePrimaryButton } from "@/app/games/_gamecore";
import type { FyveBombEntity } from "../fyveTypes";

interface BombCreatorProps {
  onCreated: (bomb: FyveBombEntity) => void;
  onCancel: () => void;
}

/**
 * Inline bomb creation form with AI image generation and audio upload.
 */
export default function BombCreator({ onCreated, onCancel }: BombCreatorProps) {
  const { user, gamertag, isAdmin } = useAuth();

  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [visibility, setVisibility] = useState<"official" | "private" | "shared">(
    isAdmin ? "official" : "private",
  );

  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [persisting, setPersisting] = useState(false);
  const [isEphemeral, setIsEphemeral] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Placeholder ID for storage uploads before doc is created
  const [tempId] = useState(() => `bomb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  // ─── AI Image Generation ──────────────────────────────────

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
          aspect_ratio: "1x1",
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
  }, [aiPrompt]);

  // ─── Upload Handlers ──────────────────────────────────────

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      setError(null);
      try {
        const url = await uploadBombImage(tempId, file);
        setImageUrl(url);
        setIsEphemeral(false);
      } catch (err) {
        setError(`Upload failed: ${err}`);
      } finally {
        setUploading(false);
      }
    },
    [tempId],
  );

  const handleAudioUpload = useCallback(
    async (file: File) => {
      const url = await uploadBombAudio(tempId, file);
      return url;
    },
    [tempId],
  );

  // ─── Save ─────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!user || !gamertag) return;
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let finalImageUrl = imageUrl;

      // Persist ephemeral AI-generated image to Firebase Storage
      if (imageUrl && isEphemeral) {
        setPersisting(true);
        const headers = await getAIAuthHeaders();
        const storagePath = `fyve-bombs/${tempId}/bomb-${Date.now().toString(36)}.jpg`;
        const res = await fetch("/api/games/ai", {
          method: "POST",
          headers,
          body: JSON.stringify({
            type: "persist-image",
            url: imageUrl,
            storagePath,
          }),
        });
        setPersisting(false);
        if (res.ok) {
          const data = (await res.json()) as { imageUrl?: string };
          if (data.imageUrl) {
            finalImageUrl = data.imageUrl;
            setIsEphemeral(false);
          }
        }
      }

      const bomb = await createBomb(
        {
          name: name.trim(),
          imageUrl: finalImageUrl,
          audioUrl,
          visibility,
        },
        user.uid,
        gamertag,
      );
      onCreated(bomb);
    } catch (err) {
      setError(`Failed to save: ${err}`);
    } finally {
      setSaving(false);
      setPersisting(false);
    }
  }, [user, gamertag, name, imageUrl, isEphemeral, audioUrl, visibility, tempId, onCreated]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-red-400">
          Create New Bomb
        </h3>
        <button
          className="text-xs text-white/40 hover:text-white/60"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>

      {/* Name */}
      <input
        className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-red-400"
        placeholder="Bomb name (e.g. THE WIRE)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      {/* Image preview */}
      {imageUrl ? (
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Preview"
            className="h-36 w-36 rounded-lg object-cover"
          />
        </div>
      ) : (
        <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-lg border border-dashed border-white/15 text-xs text-white/20">
          No image
        </div>
      )}

      {/* Upload */}
      <label className="flex w-full cursor-pointer items-center justify-center rounded-lg border border-white/15 bg-white/5 py-2 text-xs font-medium text-white/50 transition hover:bg-white/10 hover:text-white/70">
        {uploading ? "Uploading..." : "Upload Image"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
          disabled={generating || uploading || persisting}
        />
      </label>

      {/* AI Generate */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-white/60">AI Generate</p>
        <textarea
          className="mb-2 h-20 w-full rounded-lg border border-white/20 bg-white/5 px-2 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-red-400"
          placeholder="Describe the bomb image..."
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
        />
        <button
          className="w-full rounded-lg bg-red-600/20 px-3 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-600/30 disabled:opacity-50"
          disabled={generating || !aiPrompt.trim()}
          onClick={handleGenerateImage}
        >
          {generating ? "Generating..." : "Generate Image"}
        </button>
      </div>

      {/* Audio */}
      <JMAudioUpload
        {...(audioUrl ? { value: audioUrl } : {})}
        onChange={(url) => setAudioUrl(url ?? "")}
        onUpload={handleAudioUpload}
        label="Sound Effect (MP3)"
        maxSizeMB={10}
      />

      {/* Visibility */}
      <div>
        <p className="mb-1 text-xs text-white/50">Visibility</p>
        <div className="flex gap-2">
          {(["private", "shared", ...(isAdmin ? ["official" as const] : [])] as const).map((v) => (
            <button
              key={v}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                visibility === v
                  ? "bg-red-500 text-white"
                  : "bg-white/10 text-white/60 hover:bg-white/20"
              }`}
              onClick={() => setVisibility(v)}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Save */}
      <GamePrimaryButton onClick={handleSave} loading={saving || persisting} disabled={saving || persisting}>
        {persisting ? "Persisting Image..." : "Save Bomb"}
      </GamePrimaryButton>
    </div>
  );
}
