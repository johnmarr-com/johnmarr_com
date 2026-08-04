"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Loader2, Upload } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import {
  createBullshiitakePack,
  updateBullshiitakePack,
  setPackSearchPrefix,
  normalizeSearchPrefix,
  type BullshiitakePack,
} from "@/lib/bullshiitake-packs";
import {
  uploadBullshiitakePackIcon,
  validateBullshiitakeImageFile,
  BS_IMAGE_ACCEPT,
} from "@/lib/bullshiitake-storage";
import { JMCard } from "@/JMKit";

interface BullshiitakePackEditorProps {
  existingPack?: BullshiitakePack | undefined;
  onSaved: (pack: BullshiitakePack) => void;
}

/** Append a cache-busting query so the browser reloads after overwriting the same Storage path. */
function withImageCacheBust(url: string, bust: number): string {
  if (!url || bust <= 0) return url;
  return `${url}${url.includes("?") ? "&" : "?"}_dv=${bust}`;
}

/**
 * Create / edit a Bull Shiitake pack: name + square icon upload. The icon is
 * uploaded on Save (after the pack doc exists), so no temp-id re-upload dance
 * is needed. Items are managed from the pack detail view in the browser tab.
 */
export default function BullshiitakePackEditor({
  existingPack,
  onSaved,
}: BullshiitakePackEditorProps) {
  const { user } = useAuth();

  const [name, setName] = useState(existingPack?.name ?? "");
  /** Physical-card prefix (max 2 chars): cards read <prefix>-<searchID>, e.g. B-35. */
  const [searchPrefix, setSearchPrefix] = useState(existingPack?.searchPrefix ?? "");
  const iconURL = existingPack?.iconURL ?? "";
  /** Increment after new icon bytes so the preview reloads when the Storage URL string is unchanged. */
  const [iconPreviewBust, setIconPreviewBust] = useState(0);
  /** Locally chosen file, uploaded on Save. */
  const [pendingIconBlob, setPendingIconBlob] = useState<Blob | null>(null);
  const [pendingIconPreview, setPendingIconPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iconFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (pendingIconPreview) URL.revokeObjectURL(pendingIconPreview);
    };
  }, [pendingIconPreview]);

  const handleIconFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const invalid = validateBullshiitakeImageFile(file);
      if (invalid) {
        setError(invalid);
        return;
      }
      setError(null);
      setPendingIconBlob(file);
      setPendingIconPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!user) return;
    if (!name.trim()) {
      setError("Pack name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const prefix = normalizeSearchPrefix(searchPrefix);
      if (existingPack) {
        let finalIconURL = iconURL;
        if (pendingIconBlob) {
          finalIconURL = await uploadBullshiitakePackIcon(existingPack.id, pendingIconBlob);
          setIconPreviewBust((n) => n + 1);
        }
        await updateBullshiitakePack(existingPack.id, {
          name: name.trim(),
          ...(finalIconURL ? { iconURL: finalIconURL } : {}),
        });
        // Prefix changes restamp every card in the pack (B-12 stays findable).
        if (prefix !== (existingPack.searchPrefix ?? "")) {
          await setPackSearchPrefix(existingPack.id, prefix);
        }
        onSaved({
          ...existingPack,
          name: name.trim(),
          searchPrefix: prefix,
          ...(finalIconURL ? { iconURL: finalIconURL } : {}),
        });
      } else {
        const pack = await createBullshiitakePack(
          { name: name.trim(), ...(prefix ? { searchPrefix: prefix } : {}) },
          user.uid,
        );
        if (pendingIconBlob) {
          const url = await uploadBullshiitakePackIcon(pack.id, pendingIconBlob);
          await updateBullshiitakePack(pack.id, { iconURL: url });
          pack.iconURL = url;
        }
        onSaved(pack);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save pack.");
    } finally {
      setSaving(false);
    }
  }, [user, name, searchPrefix, iconURL, pendingIconBlob, existingPack, onSaved]);

  const previewURL = pendingIconPreview ?? withImageCacheBust(iconURL, iconPreviewBust);

  return (
    <div className="flex flex-col gap-5">
      {/* Pack Name + card prefix */}
      <div className="flex gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Pack name..."
          className="min-w-0 flex-1 rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-lg font-bold text-white placeholder-white/30 outline-none focus:border-lime-400/50"
        />
        <input
          type="text"
          value={searchPrefix}
          onChange={(e) => setSearchPrefix(e.target.value.toUpperCase().slice(0, 2))}
          placeholder="B"
          maxLength={2}
          title="Card prefix — physical cards read prefix-number, e.g. B-35"
          className="w-20 rounded-lg border border-white/20 bg-white/5 px-2 py-3 text-center text-lg font-bold uppercase text-white placeholder-white/30 outline-none focus:border-lime-400/50"
        />
      </div>
      <p className="-mt-3 text-right text-[10px] text-white/30">
        Card prefix (max 2) — physical cards look up as prefix-number, e.g. B-35
      </p>

      {/* Icon upload + preview */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-white/40">
          Pack Icon <span className="font-normal normal-case text-white/25">(square)</span>
        </label>
        <div className="flex flex-col items-center gap-3">
          {previewURL ? (
            <JMCard className="h-60 w-60 bg-neutral-800">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob / Storage URL */}
              <img src={previewURL} alt="" className="h-full w-full object-cover" />
            </JMCard>
          ) : (
            <JMCard className="flex h-60 w-60 items-center justify-center border-2 border-dashed border-white/10 text-sm text-white/20">
              No icon yet
            </JMCard>
          )}
          <input
            ref={iconFileInputRef}
            type="file"
            accept={BS_IMAGE_ACCEPT}
            className="sr-only"
            onChange={handleIconFileChange}
          />
          <button
            type="button"
            onClick={() => iconFileInputRef.current?.click()}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg border border-white/20 px-4 py-2.5 text-sm font-bold text-white/70 transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            Upload Icon
          </button>
        </div>
      </div>

      {existingPack && (
        <p className="rounded-lg border border-dashed border-lime-400/20 bg-lime-400/5 px-4 py-3 text-center text-sm text-lime-300/60">
          Stories are managed from the pack&apos;s detail view — open it under
          &ldquo;Browse All Packs&rdquo;.
        </p>
      )}

      {error && <p className="text-center text-sm text-red-400">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-xl bg-lime-500 py-4 text-lg font-bold uppercase tracking-wider text-black shadow-lg shadow-lime-500/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin" />
        ) : existingPack ? (
          "Save Changes"
        ) : (
          "Create Pack"
        )}
      </button>
    </div>
  );
}
