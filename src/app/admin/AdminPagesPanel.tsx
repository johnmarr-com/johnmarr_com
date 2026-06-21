"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Eye, EyeOff, Layers, Plus, Trash2 } from "lucide-react";
import { useJMStyle } from "@/JMStyle";
import { useAuth } from "@/lib/AuthProvider";
import type { JMPage } from "@/lib/content-types";
import {
  createPage,
  deletePage,
  isReservedSlug,
  listPages,
  normalizePageSlug,
  updatePage,
} from "@/lib/pages";
import { AdminHomeRowsPanel } from "./AdminHomeRowsPanel";

export function AdminPagesPanel() {
  const { theme } = useJMStyle();
  const { user } = useAuth();

  const [pages, setPages] = useState<JMPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New-page form
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [hasFeatured, setHasFeatured] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Row-management drill-in
  const [managing, setManaging] = useState<JMPage | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setPages(await listPages());
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

  const handleCreate = async () => {
    if (!user) return;
    setError(null);
    if (!normalized) {
      setError("Enter a slug (e.g. watch or watch/shows).");
      return;
    }
    if (reserved) {
      setError(`"${normalized.split("/")[0]}" is reserved — it collides with an existing route.`);
      return;
    }
    if (!title.trim()) {
      setError("Enter a title.");
      return;
    }
    setIsSaving(true);
    try {
      await createPage(
        {
          slug: normalized,
          title: title.trim(),
          ...(subtitle.trim() ? { subtitle: subtitle.trim() } : {}),
          hasFeatured,
          isPublished: false,
        },
        user.uid,
      );
      setSlug("");
      setTitle("");
      setSubtitle("");
      setHasFeatured(false);
      await load();
    } catch (err) {
      console.error("Failed to create page:", err);
      setError("Failed to create page.");
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
    if (!window.confirm(`Delete page "${page.title}" (/${page.slug})? Its rows are not deleted.`)) {
      return;
    }
    try {
      await deletePage(page.id);
      await load();
    } catch (err) {
      console.error("Failed to delete page:", err);
      setError("Failed to delete page.");
    }
  };

  const inputStyle = {
    borderColor: theme.surfaces.elevated2,
    backgroundColor: theme.surfaces.elevated1,
    color: theme.text.primary,
  };

  // ── Row management for a single page ──
  if (managing) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setManaging(null);
              void load();
            }}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-sm"
            style={{ color: theme.text.secondary }}
          >
            <ChevronLeft size={18} /> All pages
          </button>
          <span className="text-sm" style={{ color: theme.text.tertiary }}>
            Managing rows for{" "}
            <span style={{ color: theme.text.primary }}>{managing.title}</span> · /
            {managing.slug}
          </span>
        </div>
        <AdminHomeRowsPanel pageId={managing.id} />
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

      {/* New page */}
      <div
        className="flex flex-col gap-3 rounded-xl border-2 p-4"
        style={{ borderColor: theme.surfaces.elevated2 }}
      >
        <h3 className="text-sm font-semibold" style={{ color: theme.text.primary }}>
          New page
        </h3>
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
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm" style={{ color: theme.text.secondary }}>
            <input
              type="checkbox"
              checked={hasFeatured}
              onChange={(e) => setHasFeatured(e.target.checked)}
            />
            Feature banner on this page
          </label>
          <button
            type="button"
            onClick={handleCreate}
            disabled={isSaving || reserved}
            className="flex items-center gap-2 rounded-lg border-2 px-4 py-2 text-sm font-semibold"
            style={{
              borderColor: theme.accents.neonPink,
              color: theme.accents.neonPink,
              backgroundColor: "transparent",
              opacity: isSaving || reserved ? 0.5 : 1,
            }}
          >
            <Plus size={16} /> {isSaving ? "Creating…" : "Create page"}
          </button>
        </div>
      </div>

      {/* Page list */}
      <div className="flex flex-col gap-2">
        {pages.map((page) => (
          <div
            key={page.id}
            className="flex items-center gap-3 rounded-xl border-2 px-4 py-3"
            style={{
              borderColor: theme.surfaces.elevated2,
              backgroundColor: theme.surfaces.elevated1,
            }}
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
              onClick={() => setManaging(page)}
              className="rounded-lg border-2 px-3 py-1.5 text-xs font-semibold"
              style={{ borderColor: theme.surfaces.elevated2, color: theme.text.secondary }}
            >
              Rows
            </button>
            <button
              type="button"
              onClick={() => togglePublish(page)}
              className="rounded-md p-2"
              style={{ color: theme.text.secondary }}
              aria-label={page.isPublished ? "Unpublish" : "Publish"}
              title={page.isPublished ? "Unpublish" : "Publish"}
            >
              {page.isPublished ? <EyeOff size={16} /> : <Eye size={16} />}
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
