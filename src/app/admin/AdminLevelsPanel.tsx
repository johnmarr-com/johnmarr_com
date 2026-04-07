"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, ChevronRight, X, Sparkles } from "lucide-react";
import Image from "next/image";
import { useJMStyle } from "@/JMStyle";
import { JMImageUpload, JMConfettiOverlay, Dialog, DialogContent } from "@/JMKit";
import {
  getAllLevels,
  createLevel,
  updateLevel,
  deleteLevel,
  uploadLevelIcon,
  type UserLevel,
} from "@/lib/levels";

/* ── Level edit modal ── */

interface LevelEditModalProps {
  level: UserLevel | null;
  onClose: () => void;
  onSaved: () => void;
}

function LevelEditModal({ level, onClose, onSaved }: LevelEditModalProps) {
  const { theme } = useJMStyle();
  const isNew = !level;

  const [form, setForm] = useState({
    level: level?.level ?? 1,
    title: level?.title ?? "",
    iconRealisticURL: level?.iconRealisticURL ?? null as string | null,
    iconIsometricURL: level?.iconIsometricURL ?? null as string | null,
    minPoints: level?.minPoints ?? 0,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(level?.id ?? null);

  const handleUploadRealistic = useCallback(
    async (file: File) => {
      const id = savedId ?? (await saveDraft());
      if (!id) throw new Error("Save level first");
      const url = await uploadLevelIcon(file, id, "realistic");
      setForm((f) => ({ ...f, iconRealisticURL: url }));
      await updateLevel(id, { iconRealisticURL: url });
      return url;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [savedId],
  );

  const handleUploadIsometric = useCallback(
    async (file: File) => {
      const id = savedId ?? (await saveDraft());
      if (!id) throw new Error("Save level first");
      const url = await uploadLevelIcon(file, id, "isometric");
      setForm((f) => ({ ...f, iconIsometricURL: url }));
      await updateLevel(id, { iconIsometricURL: url });
      return url;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [savedId],
  );

  async function saveDraft(): Promise<string | null> {
    if (!form.title.trim()) {
      setError("Title is required.");
      return null;
    }
    try {
      const id = await createLevel({
        level: form.level,
        title: form.title.trim(),
        iconRealisticURL: form.iconRealisticURL,
        iconIsometricURL: form.iconIsometricURL,
        minPoints: form.minPoints,
      });
      setSavedId(id);
      return id;
    } catch {
      setError("Failed to save.");
      return null;
    }
  }

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      if (savedId) {
        await updateLevel(savedId, {
          level: form.level,
          title: form.title.trim(),
          iconRealisticURL: form.iconRealisticURL,
          iconIsometricURL: form.iconIsometricURL,
          minPoints: form.minPoints,
        });
      } else {
        const id = await createLevel({
          level: form.level,
          title: form.title.trim(),
          iconRealisticURL: form.iconRealisticURL,
          iconIsometricURL: form.iconIsometricURL,
          minPoints: form.minPoints,
        });
        setSavedId(id);
      }
      onSaved();
      onClose();
    } catch {
      setError("Failed to save level.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!savedId || !confirm("Delete this level?")) return;
    setIsDeleting(true);
    try {
      await deleteLevel(savedId);
      onSaved();
      onClose();
    } catch {
      setError("Failed to delete.");
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const inputStyle = {
    borderColor: theme.surfaces.elevated2,
    backgroundColor: theme.surfaces.elevated1,
    color: theme.text.primary,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 pt-12 pb-12">
      <div
        className="relative w-full max-w-lg rounded-2xl border backdrop-blur-md"
        style={{ backgroundColor: `${theme.surfaces.base}f8`, borderColor: theme.surfaces.elevated2 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: theme.surfaces.elevated2 }}>
          <h2 className="text-lg font-semibold" style={{ color: theme.text.primary }}>
            {isNew ? "New Level" : `Edit Level ${level.level}`}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/10">
            <X size={18} style={{ color: theme.text.tertiary }} />
          </button>
        </div>

        <div className="space-y-5 p-6">
          {error && (
            <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: `${theme.semantic.error}15`, color: theme.semantic.error }}>
              {error}
            </div>
          )}

          {/* Level number + Title */}
          <div className="flex gap-4">
            <div className="w-24">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider" style={{ color: theme.text.tertiary }}>
                Level #
              </label>
              <input
                type="number"
                min={1}
                max={99}
                value={form.level}
                onChange={(e) => setForm((f) => ({ ...f, level: parseInt(e.target.value) || 1 }))}
                className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-1"
                style={{ ...inputStyle, "--tw-ring-color": theme.accents.neonPink } as React.CSSProperties}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider" style={{ color: theme.text.tertiary }}>
                Title
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Noob, Explorer..."
                className="w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-1"
                style={{ ...inputStyle, "--tw-ring-color": theme.accents.neonPink } as React.CSSProperties}
              />
            </div>
          </div>

          {/* Min Points */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider" style={{ color: theme.text.tertiary }}>
              Min Points
            </label>
            <input
              type="number"
              min={0}
              value={form.minPoints}
              onChange={(e) => setForm((f) => ({ ...f, minPoints: parseInt(e.target.value) || 0 }))}
              className="w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-1"
              style={{ ...inputStyle, "--tw-ring-color": theme.accents.neonPink } as React.CSSProperties}
            />
          </div>

          {/* Icon uploads */}
          <div className="flex gap-4">
            <div className="flex-1">
              <JMImageUpload
                label="Realistic Icon"
                {...(form.iconRealisticURL ? { value: form.iconRealisticURL } : {})}
                onChange={(url) => setForm((f) => ({ ...f, iconRealisticURL: url }))}
                onUpload={handleUploadRealistic}
                aspectRatio="square"
                previewSize={120}
                maxWidth={512}
              />
            </div>
            <div className="flex-1">
              <JMImageUpload
                label="Isometric Icon"
                {...(form.iconIsometricURL ? { value: form.iconIsometricURL } : {})}
                onChange={(url) => setForm((f) => ({ ...f, iconIsometricURL: url }))}
                onUpload={handleUploadIsometric}
                aspectRatio="square"
                previewSize={120}
                maxWidth={512}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-6 py-4" style={{ borderColor: theme.surfaces.elevated2 }}>
          <div>
            {!isNew && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-sm font-medium transition-colors hover:underline"
                style={{ color: theme.semantic.error }}
              >
                {isDeleting ? "Deleting..." : "Delete Level"}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:bg-white/10"
              style={{ color: theme.text.secondary }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !form.title.trim()}
              className="rounded-lg px-5 py-2 text-sm font-medium transition-all hover:scale-105 disabled:opacity-50"
              style={{ backgroundColor: theme.accents.goldenGlow, color: theme.surfaces.base }}
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Test level-up preview ── */

function LevelUpTestPopup({ level, onClose }: { level: UserLevel; onClose: () => void }) {
  const { theme } = useJMStyle();
  const iconUrl = level.iconIsometricURL || level.iconRealisticURL;

  return (
    <>
      <JMConfettiOverlay />

      <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent
          className="border-0 bg-transparent shadow-none max-w-md overflow-visible"
          overlayClassName="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          hideCloseButton
        >
          <div className="relative flex flex-col items-center text-center py-8 px-4">
            {iconUrl && (
              <div className="mb-6">
                <Image
                  src={iconUrl}
                  alt={level.title}
                  width={512}
                  height={512}
                  className="drop-shadow-2xl animate-badge-pulse"
                  style={{ maxWidth: "350px", height: "auto" }}
                  unoptimized
                />
              </div>
            )}
            <p className="text-2xl font-black tracking-wider uppercase mb-2" style={{ color: theme.accents.goldenGlow }}>
              CONGRATS
            </p>
            <p className="text-lg mb-4" style={{ color: theme.text.secondary }}>
              You reached a new level!
            </p>
            <button
              onClick={onClose}
              className="mt-8 px-8 py-3 rounded-full font-bold text-sm uppercase tracking-wider transition-transform hover:scale-105"
              style={{ backgroundColor: theme.accents.goldenGlow, color: "#000" }}
            >
              Continue
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ── Panel ── */

export function AdminLevelsPanel() {
  const { theme } = useJMStyle();
  const [levels, setLevels] = useState<UserLevel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingLevel, setEditingLevel] = useState<UserLevel | null | "new">(null);
  const [testingLevel, setTestingLevel] = useState<UserLevel | null>(null);

  const fetchLevels = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAllLevels();
      setLevels(data);
    } catch (err) {
      console.error("Failed to fetch levels:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch levels");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLevels();
  }, []);

  return (
    <div className="mt-6 space-y-4">
      {/* Toolbar */}
      <div
        className="rounded-2xl border backdrop-blur-md"
        style={{ backgroundColor: `${theme.surfaces.base}ee`, borderColor: theme.surfaces.elevated2 }}
      >
        <div className="flex items-center justify-between gap-4 px-8 py-5">
          <div className="text-sm font-medium" style={{ color: theme.text.secondary }}>
            Total: <span style={{ color: theme.text.primary }}>{levels.length}</span>
          </div>
          <button
            onClick={() => setEditingLevel("new")}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all hover:scale-105"
            style={{ backgroundColor: theme.accents.goldenGlow, color: theme.surfaces.base }}
          >
            <Plus size={18} />
            New Level
          </button>
        </div>
      </div>

      {/* Levels list */}
      <div
        className="overflow-hidden rounded-2xl border backdrop-blur-md"
        style={{ backgroundColor: `${theme.surfaces.base}ee`, borderColor: theme.surfaces.elevated2 }}
      >
        {isLoading ? (
          <div className="px-8 py-12 text-center">
            <div
              className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: theme.accents.goldenGlow, borderTopColor: "transparent" }}
            />
          </div>
        ) : error ? (
          <div className="px-8 py-12 text-center text-sm" style={{ color: theme.semantic.error }}>
            {error}
          </div>
        ) : levels.length === 0 ? (
          <div className="px-8 py-12 text-center">
            <div className="mb-2 text-sm" style={{ color: theme.text.tertiary }}>No levels yet</div>
            <button
              onClick={() => setEditingLevel("new")}
              className="text-sm font-medium transition-colors hover:underline"
              style={{ color: theme.accents.goldenGlow }}
            >
              Create the first level →
            </button>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: theme.surfaces.elevated2 }}>
            {/* Header */}
            <div className="flex items-center gap-4 px-6 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: theme.text.tertiary }}>
              <span className="w-10 text-center">#</span>
              <span className="w-16">Icons</span>
              <span className="flex-1">Title</span>
              <span className="w-20 text-right">Points</span>
              <span className="w-6" />
            </div>

            {levels.map((lvl) => (
              <button
                key={lvl.id}
                onClick={() => setEditingLevel(lvl)}
                className="flex w-full items-center gap-4 px-6 py-3 text-left transition-colors hover:bg-white/5"
              >
                <span
                  className="w-10 text-center text-lg font-bold tabular-nums"
                  style={{ color: theme.accents.goldenGlow }}
                >
                  {lvl.level}
                </span>

                <div className="flex w-16 gap-1">
                  {lvl.iconRealisticURL ? (
                    <Image src={lvl.iconRealisticURL} alt="" width={28} height={28} className="rounded object-contain" unoptimized />
                  ) : (
                    <div className="h-7 w-7 rounded" style={{ backgroundColor: theme.surfaces.elevated2 }} />
                  )}
                  {lvl.iconIsometricURL ? (
                    <Image src={lvl.iconIsometricURL} alt="" width={28} height={28} className="rounded object-contain" unoptimized />
                  ) : (
                    <div className="h-7 w-7 rounded" style={{ backgroundColor: theme.surfaces.elevated2 }} />
                  )}
                </div>

                <span className="flex-1 truncate font-medium" style={{ color: theme.text.primary }}>
                  {lvl.title}
                </span>

                <span className="w-20 text-right tabular-nums text-sm" style={{ color: theme.text.secondary }}>
                  {lvl.minPoints.toLocaleString()}
                </span>

                <button
                  onClick={(e) => { e.stopPropagation(); setTestingLevel(lvl); }}
                  className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-white/10"
                  title="Test level-up popup"
                >
                  <Sparkles size={16} style={{ color: theme.accents.goldenGlow }} />
                </button>

                <ChevronRight size={16} className="shrink-0" style={{ color: theme.text.tertiary }} />
              </button>
            ))}
          </div>
        )}
      </div>

      {editingLevel !== null && (
        <LevelEditModal
          level={editingLevel === "new" ? null : editingLevel}
          onClose={() => setEditingLevel(null)}
          onSaved={fetchLevels}
        />
      )}

      {testingLevel && (
        <LevelUpTestPopup
          level={testingLevel}
          onClose={() => setTestingLevel(null)}
        />
      )}
    </div>
  );
}
