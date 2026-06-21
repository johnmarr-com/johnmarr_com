"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useJMStyle } from "@/JMStyle";
import { useAuth } from "@/lib/AuthProvider";
import type {
  JMContent,
  JMContentType,
  JMGridCollection,
  JMGridCollectionUpdate,
  GridCellAspect,
  GridTextAlign,
} from "@/lib/content-types";
import { JMContentTypeLabels } from "@/lib/content-types";
import {
  createGridCollection,
  deleteGridCollection,
  listGridCollections,
  updateGridCollection,
} from "@/lib/grid-collections";
import { getTopLevelContent, getAllArtists } from "@/lib/content";
import { FONT_CATALOG, fontStack } from "@/lib/scrollyfox-style";
import { useDevicePreview, DeviceTabs } from "@/app/scrollyfox/DevicePreview";
import { JMGrid, type JMGridItem } from "@/JMKit";

interface ContentOpt {
  id: string;
  name: string;
  subtitle?: string;
  coverURL: string;
  contentType: JMContentType;
}

const CONTENT_TYPES: JMContentType[] = ["show", "game", "story", "card", "artist"];
const ASPECTS: { value: GridCellAspect; label: string }[] = [
  { value: "landscape", label: "16:9" },
  { value: "portrait", label: "3:4" },
  { value: "square", label: "1:1" },
];
const ALIGNS: { value: GridTextAlign; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

function swap<T>(arr: T[], a: number, b: number): T[] {
  const next = [...arr];
  const x = next[a];
  const y = next[b];
  if (x === undefined || y === undefined) return arr;
  next[a] = y;
  next[b] = x;
  return next;
}

export function AdminGridCollectionsPanel() {
  const { theme } = useJMStyle();
  const { user } = useAuth();
  const { device, setDevice, allowed, containerStyle } = useDevicePreview();

  const [grids, setGrids] = useState<JMGridCollection[]>([]);
  const [gridId, setGridId] = useState("");
  const [draft, setDraft] = useState<JMGridCollection | null>(null);
  const [available, setAvailable] = useState<ContentOpt[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(false);

  const load = useCallback(async () => {
    try {
      setGrids(await listGridCollections());
    } catch (err) {
      console.error("Failed to load grid collections:", err);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Sync the editable draft when the selection changes.
  useEffect(() => {
    setDraft(grids.find((g) => g.id === gridId) ?? null);
    setSavedAt(false);
  }, [gridId, grids]);

  // Load the available content for the draft's content type (for picker + preview).
  const loadContent = useCallback(async (contentType?: JMContentType) => {
    if (!contentType) {
      setAvailable([]);
      return;
    }
    setLoadingContent(true);
    try {
      if (contentType === "artist") {
        const artists = await getAllArtists(false);
        setAvailable(
          artists.map((a) => ({
            id: a.id,
            name: a.name,
            ...(a.description ? { subtitle: a.description } : {}),
            coverURL: a.coverURL ?? "",
            contentType: "artist" as const,
          })),
        );
      } else if (contentType === "story") {
        const { getAllStories } = await import("@/lib/stories");
        const stories = await getAllStories(false);
        setAvailable(
          stories.map((s) => ({
            id: s.id,
            name: s.title,
            ...(s.subtitle ? { subtitle: s.subtitle } : {}),
            coverURL: s.coverThumbnailURL || s.coverImageURL || "",
            contentType: "story" as const,
          })),
        );
      } else {
        const content = await getTopLevelContent(contentType, false);
        setAvailable(
          content.map((c: JMContent) => ({
            id: c.id,
            name: c.name,
            ...(c.description ? { subtitle: c.description } : {}),
            coverURL: c.coverURL ?? "",
            contentType: c.contentType,
          })),
        );
      }
    } catch (err) {
      console.error("Failed to load content:", err);
    } finally {
      setLoadingContent(false);
    }
  }, []);

  useEffect(() => {
    void loadContent(draft?.contentType);
  }, [draft?.contentType, loadContent]);

  const patch = (updates: Partial<JMGridCollection>) =>
    setDraft((prev) => (prev ? { ...prev, ...updates } : prev));

  const handleContentTypeChange = (value: string) =>
    setDraft((prev) => {
      if (!prev) return prev;
      const next: JMGridCollection = { ...prev, contentIds: [] };
      if (value) next.contentType = value as JMContentType;
      else delete next.contentType;
      return next;
    });

  const handleNew = async () => {
    if (!user) return;
    const name = window.prompt("New grid collection name:");
    if (!name?.trim()) return;
    const g = await createGridCollection({ name: name.trim() }, user.uid);
    await load();
    setGridId(g.id);
  };

  const handleRename = async () => {
    if (!draft) return;
    const name = window.prompt("Rename grid collection:", draft.name);
    if (!name?.trim()) return;
    await updateGridCollection(draft.id, { name: name.trim() });
    await load();
  };

  const handleDelete = async () => {
    if (!draft) return;
    if (!window.confirm(`Delete grid collection "${draft.name}"?`)) return;
    await deleteGridCollection(draft.id);
    setGridId("");
    await load();
  };

  const handleSave = async () => {
    if (!draft) return;
    setIsSaving(true);
    try {
      const updates: JMGridCollectionUpdate = {
        autoPopulate: draft.autoPopulate ?? false,
        contentIds: draft.contentIds,
        cellAspect: draft.cellAspect,
        textAlign: draft.textAlign,
        showTitle: draft.showTitle,
        showSubtitle: draft.showSubtitle,
        title: draft.title,
        subtitle: draft.subtitle,
        columns: draft.columns,
      };
      if (draft.contentType) updates.contentType = draft.contentType;
      await updateGridCollection(draft.id, updates);
      await load();
      setSavedAt(true);
    } catch (err) {
      console.error("Failed to save grid:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const inputStyle = {
    borderColor: theme.surfaces.elevated2,
    backgroundColor: theme.surfaces.elevated1,
    color: theme.text.primary,
  };

  // Preview items derived from the loaded content + the draft's selection.
  const previewItems: JMGridItem[] = !draft
    ? []
    : draft.autoPopulate
      ? available.map((c) => toGridItem(c))
      : draft.contentIds
          .map((id) => available.find((c) => c.id === id))
          .filter((c): c is ContentOpt => !!c)
          .map((c) => toGridItem(c));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <LayoutGrid size={24} style={{ color: theme.accents.goldenGlow }} />
        <div>
          <h2 className="text-lg font-semibold" style={{ color: theme.text.primary }}>
            Grid Collections
          </h2>
          <p className="text-sm" style={{ color: theme.text.tertiary }}>
            {grids.length} collection{grids.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Collection selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm" style={{ color: theme.text.secondary }}>
          Collection:
        </span>
        <select
          value={gridId}
          onChange={(e) => setGridId(e.target.value)}
          className="rounded-lg border-2 px-3 py-2 text-sm"
          style={inputStyle}
        >
          <option value="">— Select a grid —</option>
          {grids.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <button
          onClick={handleNew}
          className="flex items-center gap-1 rounded-lg border-2 px-3 py-2 text-sm"
          style={{ borderColor: theme.surfaces.elevated2, color: theme.text.secondary }}
        >
          <Plus size={14} /> New
        </button>
        {draft && (
          <>
            <button
              onClick={handleRename}
              className="flex items-center gap-1 rounded-lg border-2 px-3 py-2 text-sm"
              style={{ borderColor: theme.surfaces.elevated2, color: theme.text.secondary }}
            >
              <Pencil size={14} /> Rename
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-1 rounded-lg border-2 px-3 py-2 text-sm"
              style={{ borderColor: theme.surfaces.elevated2, color: theme.semantic.error }}
            >
              <Trash2 size={14} /> Delete
            </button>
          </>
        )}
      </div>

      {!draft ? (
        <p
          className="rounded-xl border-2 border-dashed px-4 py-10 text-center text-sm"
          style={{ borderColor: theme.surfaces.elevated2, color: theme.text.tertiary }}
        >
          Select a grid (or create one) to configure it.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── Settings column ── */}
          <div className="flex flex-col gap-5">
            {/* Content type + auto/curated */}
            <section className="flex flex-col gap-3 rounded-xl border-2 p-4" style={{ borderColor: theme.surfaces.elevated2 }}>
              <h3 className="text-sm font-semibold" style={{ color: theme.text.primary }}>
                Content
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={draft.contentType ?? ""}
                  onChange={(e) => handleContentTypeChange(e.target.value)}
                  className="rounded-lg border-2 px-3 py-2 text-sm"
                  style={inputStyle}
                >
                  <option value="">— Content type —</option>
                  {CONTENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {JMContentTypeLabels[t]}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-sm" style={{ color: theme.text.secondary }}>
                  <input
                    type="checkbox"
                    checked={draft.autoPopulate ?? false}
                    onChange={(e) => patch({ autoPopulate: e.target.checked })}
                    className="h-4 w-4"
                  />
                  Auto-populate all
                </label>
              </div>

              {/* Curated picker */}
              {draft.contentType && !draft.autoPopulate && (
                <div className="flex flex-col gap-3">
                  {draft.contentIds.length > 0 && (
                    <div
                      className="flex flex-col divide-y rounded-lg border"
                      style={{ borderColor: theme.surfaces.elevated2 }}
                    >
                      {draft.contentIds.map((id, index) => {
                        const c = available.find((x) => x.id === id);
                        return (
                          <div key={id} className="flex items-center gap-2 px-2 py-1.5">
                            <span className="flex-1 truncate text-sm" style={{ color: theme.text.primary }}>
                              {c?.name ?? "(unavailable)"}
                            </span>
                            <button
                              onClick={() => index > 0 && patch({ contentIds: swap(draft.contentIds, index, index - 1) })}
                              disabled={index === 0}
                              className="rounded p-1"
                              style={{ color: theme.text.secondary, opacity: index === 0 ? 0.3 : 1 }}
                              aria-label="Move up"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              onClick={() => index < draft.contentIds.length - 1 && patch({ contentIds: swap(draft.contentIds, index, index + 1) })}
                              disabled={index === draft.contentIds.length - 1}
                              className="rounded p-1"
                              style={{ color: theme.text.secondary, opacity: index === draft.contentIds.length - 1 ? 0.3 : 1 }}
                              aria-label="Move down"
                            >
                              <ArrowDown size={14} />
                            </button>
                            <button
                              onClick={() => patch({ contentIds: draft.contentIds.filter((x) => x !== id) })}
                              className="rounded p-1"
                              style={{ color: theme.text.tertiary }}
                              aria-label="Remove"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {loadingContent ? (
                    <Loader2 className="h-5 w-5 animate-spin" style={{ color: theme.accents.goldenGlow }} />
                  ) : (
                    <div
                      className="max-h-48 overflow-y-auto rounded-lg border"
                      style={{ borderColor: theme.surfaces.elevated2 }}
                    >
                      {available
                        .filter((c) => !draft.contentIds.includes(c.id))
                        .map((c) => (
                          <button
                            key={c.id}
                            onClick={() => patch({ contentIds: [...draft.contentIds, c.id] })}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5"
                            style={{ color: theme.text.primary }}
                          >
                            <Plus size={14} style={{ color: theme.accents.goldenGlow }} />
                            <span className="flex-1 truncate">{c.name}</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Cell aspect + alignment */}
            <section className="flex flex-col gap-3 rounded-xl border-2 p-4" style={{ borderColor: theme.surfaces.elevated2 }}>
              <h3 className="text-sm font-semibold" style={{ color: theme.text.primary }}>
                Cells
              </h3>
              <Segmented
                label="Aspect"
                options={ASPECTS}
                value={draft.cellAspect}
                onChange={(v) => patch({ cellAspect: v })}
              />
              <Segmented
                label="Align"
                options={ALIGNS}
                value={draft.textAlign}
                onChange={(v) => patch({ textAlign: v })}
              />
            </section>

            {/* Title + subtitle captions */}
            <section className="flex flex-col gap-3 rounded-xl border-2 p-4" style={{ borderColor: theme.surfaces.elevated2 }}>
              <h3 className="text-sm font-semibold" style={{ color: theme.text.primary }}>
                Captions
              </h3>
              <CaptionRow
                label="Title"
                enabled={draft.showTitle}
                onToggle={(v) => patch({ showTitle: v })}
                fontId={draft.title.fontId}
                size={draft.title.size}
                onFont={(fontId) => patch({ title: { ...draft.title, fontId } })}
                onSize={(size) => patch({ title: { ...draft.title, size } })}
              />
              <CaptionRow
                label="Subtitle"
                enabled={draft.showSubtitle}
                onToggle={(v) => patch({ showSubtitle: v })}
                fontId={draft.subtitle.fontId}
                size={draft.subtitle.size}
                onFont={(fontId) => patch({ subtitle: { ...draft.subtitle, fontId } })}
                onSize={(size) => patch({ subtitle: { ...draft.subtitle, size } })}
              />
            </section>

            {/* Columns per device */}
            <section className="flex flex-col gap-3 rounded-xl border-2 p-4" style={{ borderColor: theme.surfaces.elevated2 }}>
              <h3 className="text-sm font-semibold" style={{ color: theme.text.primary }}>
                Columns per device
              </h3>
              <DeviceTabs device={device} setDevice={setDevice} allowed={allowed} />
              <label className="flex items-center gap-3 text-sm" style={{ color: theme.text.secondary }}>
                {device[0]?.toUpperCase() + device.slice(1)} columns
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={draft.columns[device]}
                  onChange={(e) =>
                    patch({
                      columns: {
                        ...draft.columns,
                        [device]: Math.min(8, Math.max(1, Number(e.target.value) || 1)),
                      },
                    })
                  }
                  className="w-20 rounded-lg border-2 px-2 py-1.5 text-sm"
                  style={inputStyle}
                />
              </label>
            </section>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 rounded-lg border-2 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                style={{ borderColor: theme.accents.neonPink, color: theme.accents.neonPink }}
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {isSaving ? "Saving…" : "Save grid"}
              </button>
              {savedAt && (
                <span className="text-xs" style={{ color: theme.semantic.success }}>
                  Saved
                </span>
              )}
            </div>
          </div>

          {/* ── Preview column ── */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: theme.text.primary }}>
                Preview
              </h3>
              <span className="text-xs" style={{ color: theme.text.secondary }}>
                {device[0]?.toUpperCase() + device.slice(1)}
              </span>
            </div>
            <div
              className="overflow-hidden rounded-lg border-2 p-3"
              style={{ ...containerStyle, borderColor: theme.surfaces.elevated2 }}
            >
              {previewItems.length === 0 ? (
                <p className="py-10 text-center text-sm" style={{ color: theme.text.tertiary }}>
                  Pick content to preview the grid.
                </p>
              ) : (
                <JMGrid
                  items={previewItems}
                  cellAspect={draft.cellAspect}
                  textAlign={draft.textAlign}
                  showTitle={draft.showTitle}
                  showSubtitle={draft.showSubtitle}
                  title={{ fontFamily: fontStack(draft.title.fontId), size: draft.title.size }}
                  subtitle={{ fontFamily: fontStack(draft.subtitle.fontId), size: draft.subtitle.size }}
                  columns={draft.columns}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function toGridItem(c: ContentOpt): JMGridItem {
  return {
    id: c.id,
    name: c.name,
    ...(c.subtitle ? { subtitle: c.subtitle } : {}),
    coverURL: c.coverURL,
    contentType: c.contentType,
  };
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { theme } = useJMStyle();
  return (
    <div className="flex items-center gap-3">
      <span className="w-14 text-sm" style={{ color: theme.text.secondary }}>
        {label}
      </span>
      <div className="flex gap-1">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className="rounded-lg border-2 px-3 py-1.5 text-sm transition-all"
              style={{
                borderColor: active ? theme.accents.neonPink : theme.surfaces.elevated2,
                color: active ? theme.accents.neonPink : theme.text.secondary,
                backgroundColor: "transparent",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CaptionRow({
  label,
  enabled,
  onToggle,
  fontId,
  size,
  onFont,
  onSize,
}: {
  label: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  fontId: string;
  size: number;
  onFont: (fontId: string) => void;
  onSize: (size: number) => void;
}) {
  const { theme } = useJMStyle();
  const inputStyle = {
    borderColor: theme.surfaces.elevated2,
    backgroundColor: theme.surfaces.elevated1,
    color: theme.text.primary,
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex w-24 items-center gap-2 text-sm" style={{ color: theme.text.secondary }}>
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} className="h-4 w-4" />
        {label}
      </label>
      <select
        value={fontId}
        onChange={(e) => onFont(e.target.value)}
        disabled={!enabled}
        className="rounded-lg border-2 px-2 py-1.5 text-sm disabled:opacity-40"
        style={{ ...inputStyle, fontFamily: fontStack(fontId) }}
      >
        {FONT_CATALOG.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>
      <input
        type="number"
        min={8}
        max={48}
        value={size}
        onChange={(e) => onSize(Math.min(48, Math.max(8, Number(e.target.value) || 12)))}
        disabled={!enabled}
        className="w-16 rounded-lg border-2 px-2 py-1.5 text-sm disabled:opacity-40"
        style={inputStyle}
        aria-label={`${label} size`}
      />
      <span className="text-xs" style={{ color: theme.text.tertiary }}>
        px
      </span>
    </div>
  );
}
