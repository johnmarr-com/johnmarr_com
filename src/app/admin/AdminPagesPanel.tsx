"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  Eye,
  EyeOff,
  Layers,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useJMStyle } from "@/JMStyle";
import { useAuth } from "@/lib/AuthProvider";
import type {
  JMFeaturedCarousel,
  JMPage,
  JMRowCollection,
  PageSegment,
  PageSegmentType,
} from "@/lib/content-types";
import {
  createPage,
  deletePage,
  isReservedSlug,
  listPages,
  normalizePageSlug,
  updatePage,
} from "@/lib/pages";
import { listCarousels } from "@/lib/featured-carousels";
import { listRowCollections } from "@/lib/row-collections";
import { listScrollyFoxes, type ScrollyFoxListItem } from "@/lib/scrollyfox";

const SEGMENT_TYPES: { value: PageSegmentType; label: string }[] = [
  { value: "carousel", label: "Featured Carousel" },
  { value: "rows", label: "Row Collection" },
  { value: "scrollyfox", label: "ScrollyFox" },
];

function newSegId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AdminPagesPanel() {
  const { theme } = useJMStyle();
  const { user } = useAuth();

  const [pages, setPages] = useState<JMPage[]>([]);
  const [carousels, setCarousels] = useState<JMFeaturedCarousel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Page form (create + edit)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Segment editor for one page
  const [editingSegments, setEditingSegments] = useState<JMPage | null>(null);
  const [segments, setSegments] = useState<PageSegment[]>([]);
  const [rowCollections, setRowCollections] = useState<JMRowCollection[]>([]);
  const [scrollyfoxes, setScrollyfoxes] = useState<ScrollyFoxListItem[]>([]);
  const [addType, setAddType] = useState<PageSegmentType>("carousel");
  const [addRefId, setAddRefId] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [p, c] = await Promise.all([listPages(), listCarousels()]);
      setPages(p);
      setCarousels(c);
    } catch (err) {
      console.error("Failed to load pages:", err);
      setError("Failed to load pages.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const normalized = normalizePageSlug(slug);
  const reserved = normalized !== "" && isReservedSlug(normalized);

  const resetForm = () => {
    setEditingId(null);
    setSlug("");
    setTitle("");
    setSubtitle("");
  };

  const startEdit = (page: JMPage) => {
    setEditingId(page.id);
    setSlug(page.slug);
    setTitle(page.title);
    setSubtitle(page.subtitle ?? "");
    setError(null);
  };

  const handleSubmit = async () => {
    if (!user) return;
    setError(null);
    if (!normalized) return setError("Enter a slug (e.g. watch or watch/shows).");
    if (reserved) return setError(`"${normalized.split("/")[0]}" is reserved — it collides with an existing route.`);
    if (!title.trim()) return setError("Enter a title.");
    setIsSaving(true);
    try {
      if (editingId) {
        await updatePage(editingId, {
          slug: normalized,
          title: title.trim(),
          subtitle: subtitle.trim(),
        });
      } else {
        await createPage(
          {
            slug: normalized,
            title: title.trim(),
            ...(subtitle.trim() ? { subtitle: subtitle.trim() } : {}),
            isPublished: false,
          },
          user.uid,
        );
      }
      resetForm();
      await load();
    } catch (err) {
      console.error("Failed to save page:", err);
      setError("Failed to save page.");
    } finally {
      setIsSaving(false);
    }
  };

  const togglePublish = async (page: JMPage) => {
    try {
      await updatePage(page.id, { isPublished: !page.isPublished });
      await load();
    } catch (err) {
      console.error("Failed to update page:", err);
      setError("Failed to update page.");
    }
  };

  const handleDelete = async (page: JMPage) => {
    if (!window.confirm(`Delete page "${page.title}" (/${page.slug})? Its segments' objects are not deleted.`)) {
      return;
    }
    try {
      await deletePage(page.id);
      if (editingId === page.id) resetForm();
      await load();
    } catch (err) {
      console.error("Failed to delete page:", err);
      setError("Failed to delete page.");
    }
  };

  // ── Segment editor ──
  const openSegments = async (page: JMPage) => {
    setEditingSegments(page);
    setSegments(page.segments ?? []);
    setAddType("carousel");
    setAddRefId("");
    const [c, rc, sf] = await Promise.all([
      listCarousels(),
      listRowCollections(),
      listScrollyFoxes(),
    ]);
    setCarousels(c);
    setRowCollections(rc);
    setScrollyfoxes(sf);
  };

  const persistSegments = async (page: JMPage, next: PageSegment[]) => {
    setSegments(next);
    try {
      await updatePage(page.id, { segments: next });
    } catch (err) {
      console.error("Failed to save segments:", err);
      setError("Failed to save segments.");
    }
  };

  const optionsForType = (type: PageSegmentType): { id: string; label: string }[] => {
    if (type === "carousel") return carousels.map((c) => ({ id: c.id, label: c.name }));
    if (type === "rows") return rowCollections.map((c) => ({ id: c.id, label: c.name }));
    return scrollyfoxes.map((s) => ({ id: s.id, label: s.title || "Untitled ScrollyFox" }));
  };

  const labelFor = (seg: PageSegment): string => {
    const typeLabel = SEGMENT_TYPES.find((t) => t.value === seg.type)?.label ?? seg.type;
    const opt = optionsForType(seg.type).find((o) => o.id === seg.refId);
    return `${typeLabel}: ${opt?.label ?? "(missing — was it deleted?)"}`;
  };

  const inputStyle = {
    borderColor: theme.surfaces.elevated2,
    backgroundColor: theme.surfaces.elevated1,
    color: theme.text.primary,
  };

  if (editingSegments) {
    const page = editingSegments;
    const addOptions = optionsForType(addType);
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setEditingSegments(null);
              void load();
            }}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-sm"
            style={{ color: theme.text.secondary }}
          >
            <ChevronLeft size={18} /> All pages
          </button>
          <span className="text-sm" style={{ color: theme.text.tertiary }}>
            Segments for <span style={{ color: theme.text.primary }}>{page.title}</span> · /{page.slug}
          </span>
        </div>

        {error && (
          <p className="text-sm" style={{ color: theme.semantic.error }}>
            {error}
          </p>
        )}

        {/* Segment stack */}
        <div className="flex flex-col gap-2">
          {segments.length === 0 && (
            <p
              className="rounded-xl border-2 border-dashed px-4 py-8 text-center text-sm"
              style={{ borderColor: theme.surfaces.elevated2, color: theme.text.tertiary }}
            >
              No segments yet. Add one below — they stack top to bottom.
            </p>
          )}
          {segments.map((seg, index) => (
            <div
              key={seg.id}
              className="flex items-center gap-2 rounded-xl border-2 px-4 py-3"
              style={{ borderColor: theme.surfaces.elevated2, backgroundColor: theme.surfaces.elevated1 }}
            >
              <span className="w-6 text-sm" style={{ color: theme.text.tertiary }}>
                {index + 1}.
              </span>
              <span className="flex-1 truncate text-sm" style={{ color: theme.text.primary }}>
                {labelFor(seg)}
              </span>
              <button
                type="button"
                onClick={() =>
                  index > 0 &&
                  persistSegments(page, swap(segments, index, index - 1))
                }
                disabled={index === 0}
                className="rounded-md p-1.5"
                style={{ color: theme.text.secondary, opacity: index === 0 ? 0.3 : 1 }}
                aria-label="Move up"
              >
                <ArrowUp size={16} />
              </button>
              <button
                type="button"
                onClick={() =>
                  index < segments.length - 1 &&
                  persistSegments(page, swap(segments, index, index + 1))
                }
                disabled={index === segments.length - 1}
                className="rounded-md p-1.5"
                style={{
                  color: theme.text.secondary,
                  opacity: index === segments.length - 1 ? 0.3 : 1,
                }}
                aria-label="Move down"
              >
                <ArrowDown size={16} />
              </button>
              <button
                type="button"
                onClick={() => persistSegments(page, segments.filter((_, i) => i !== index))}
                className="rounded-md p-1.5"
                style={{ color: theme.text.tertiary }}
                aria-label="Remove segment"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        {/* Add segment */}
        <div
          className="flex flex-wrap items-end gap-2 rounded-xl border-2 p-4"
          style={{ borderColor: theme.surfaces.elevated2 }}
        >
          <div>
            <label className="mb-1 block text-xs" style={{ color: theme.text.secondary }}>
              Type
            </label>
            <select
              value={addType}
              onChange={(e) => {
                setAddType(e.target.value as PageSegmentType);
                setAddRefId("");
              }}
              className="rounded-lg border-2 px-3 py-2 text-sm"
              style={inputStyle}
            >
              {SEGMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs" style={{ color: theme.text.secondary }}>
              Object
            </label>
            <select
              value={addRefId}
              onChange={(e) => setAddRefId(e.target.value)}
              className="w-full rounded-lg border-2 px-3 py-2 text-sm"
              style={inputStyle}
            >
              <option value="">— Select —</option>
              {addOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={!addRefId}
            onClick={() => {
              if (!addRefId) return;
              persistSegments(page, [
                ...segments,
                { id: newSegId(), type: addType, refId: addRefId },
              ]);
              setAddRefId("");
            }}
            className="flex items-center gap-2 rounded-lg border-2 px-4 py-2 text-sm font-semibold"
            style={{
              borderColor: theme.accents.neonPink,
              color: theme.accents.neonPink,
              backgroundColor: "transparent",
              opacity: addRefId ? 1 : 0.5,
            }}
          >
            <Plus size={16} /> Add Segment
          </button>
        </div>
        {addOptions.length === 0 && (
          <p className="text-xs" style={{ color: theme.text.tertiary }}>
            No {SEGMENT_TYPES.find((t) => t.value === addType)?.label} objects yet — create one in
            its editor (Featured / Row Collections / ScrollyFox).
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Layers size={24} style={{ color: theme.accents.goldenGlow }} />
        <div>
          <h2 className="text-lg font-semibold" style={{ color: theme.text.primary }}>
            Pages
          </h2>
          <p className="text-sm" style={{ color: theme.text.tertiary }}>
            {isLoading ? "Loading…" : `${pages.length} page${pages.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {error && (
        <p className="text-sm" style={{ color: theme.semantic.error }}>
          {error}
        </p>
      )}

      {/* Create / edit page */}
      <div className="flex flex-col gap-3 rounded-xl border-2 p-4" style={{ borderColor: theme.surfaces.elevated2 }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: theme.text.primary }}>
            {editingId ? "Edit page" : "New page"}
          </h3>
          {editingId && (
            <button type="button" onClick={resetForm} className="text-xs" style={{ color: theme.text.tertiary }}>
              Cancel edit
            </button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs" style={{ color: theme.text.secondary }}>
              Slug (URL path)
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="watch  or  watch/shows"
              className="w-full rounded-lg border-2 px-3 py-2 text-sm"
              style={inputStyle}
            />
            <p className="mt-1 text-xs" style={{ color: reserved ? theme.semantic.error : theme.text.tertiary }}>
              {normalized ? `→ /${normalized}` : "Lowercase, /-separated. e.g. /watch/shows"}
              {reserved && " — reserved, pick another"}
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs" style={{ color: theme.text.secondary }}>
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border-2 px-3 py-2 text-sm"
              style={inputStyle}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs" style={{ color: theme.text.secondary }}>
              Subtitle (optional)
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="w-full rounded-lg border-2 px-3 py-2 text-sm"
              style={inputStyle}
            />
          </div>
        </div>
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || reserved}
            className="flex items-center gap-2 rounded-lg border-2 px-4 py-2 text-sm font-semibold"
            style={{
              borderColor: theme.accents.neonPink,
              color: theme.accents.neonPink,
              backgroundColor: "transparent",
              opacity: isSaving || reserved ? 0.5 : 1,
            }}
          >
            <Plus size={16} />
            {isSaving ? "Saving…" : editingId ? "Save changes" : "Create page"}
          </button>
        </div>
      </div>

      {/* Page list */}
      <div className="flex flex-col gap-2">
        {pages.map((page) => (
          <div
            key={page.id}
            className="flex items-center gap-3 rounded-xl border-2 px-4 py-3"
            style={{ borderColor: theme.surfaces.elevated2, backgroundColor: theme.surfaces.elevated1 }}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold" style={{ color: theme.text.primary }}>
                  {page.title}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-semibold"
                  style={{
                    backgroundColor: page.isPublished ? theme.accents.goldenGlow : theme.surfaces.elevated2,
                    color: page.isPublished ? "#000" : theme.text.tertiary,
                  }}
                >
                  {page.isPublished ? "Live" : "Draft"}
                </span>
              </div>
              <span className="text-xs" style={{ color: theme.text.tertiary }}>
                /{page.slug}
              </span>
            </div>
            <button
              type="button"
              onClick={() => startEdit(page)}
              className="rounded-md p-2"
              style={{ color: theme.text.secondary }}
              aria-label="Edit page details"
              title="Edit page details"
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              onClick={() => openSegments(page)}
              className="rounded-lg border-2 px-3 py-1.5 text-xs font-semibold"
              style={{ borderColor: theme.surfaces.elevated2, color: theme.text.secondary }}
            >
              Segments
            </button>
            <button
              type="button"
              onClick={() => togglePublish(page)}
              className="rounded-md p-2"
              aria-label={page.isPublished ? "Published — click to unpublish" : "Draft — click to publish"}
              title={page.isPublished ? "Published — click to unpublish" : "Draft — click to publish"}
            >
              {page.isPublished ? (
                <Eye size={16} style={{ color: theme.accents.goldenGlow }} />
              ) : (
                <EyeOff size={16} style={{ color: theme.text.tertiary }} />
              )}
            </button>
            <button
              type="button"
              onClick={() => handleDelete(page)}
              className="rounded-md p-2"
              style={{ color: theme.text.tertiary }}
              aria-label="Delete page"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {!isLoading && pages.length === 0 && (
          <p className="text-sm" style={{ color: theme.text.tertiary }}>
            No pages yet. Create one above.
          </p>
        )}
      </div>
    </div>
  );
}

/** Immutable swap of two array positions. */
function swap<T>(arr: T[], a: number, b: number): T[] {
  const next = [...arr];
  const x = next[a];
  const y = next[b];
  if (x === undefined || y === undefined) return arr;
  next[a] = y;
  next[b] = x;
  return next;
}
