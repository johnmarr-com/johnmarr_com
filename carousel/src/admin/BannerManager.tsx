"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
} from "react";

import { FeaturedCarousel } from "../FeaturedCarousel";
import { resolveBanner } from "../banners";
import { mergeTheme, type CarouselTheme } from "../theme";
import type {
  BannerRecord,
  BannerStore,
  ButtonStyleRecord,
  CarouselRecord,
} from "../types";
import { ButtonStylePicker } from "./ButtonStylePicker";
import { ImageUpload } from "./ImageUpload";

import "./admin.css";

export interface BannerManagerProps {
  /** Persistence adapter. See createFirebaseBannerStore, or write your own. */
  store: BannerStore;
  theme?: Partial<CarouselTheme>;
  /** Backdrops are downscaled to this width before upload. Default 1920. */
  maxBackdropWidth?: number;
  /** Heading above the panel. */
  title?: string;
}

interface Draft {
  title: string;
  subtitle: string;
  description: string;
  href: string;
  ctaLabel: string;
  backdropURL: string;
  ctaButtonStyleId: string;
}

const EMPTY_DRAFT: Draft = {
  title: "",
  subtitle: "",
  description: "",
  href: "",
  ctaLabel: "",
  backdropURL: "",
  ctaButtonStyleId: "",
};

function draftFrom(banner: BannerRecord): Draft {
  return {
    title: banner.title,
    subtitle: banner.subtitle ?? "",
    description: banner.description ?? "",
    href: banner.href ?? "",
    ctaLabel: banner.ctaLabel ?? "",
    backdropURL: banner.backdropURL,
    ctaButtonStyleId: banner.ctaButtonStyleId ?? "",
  };
}

/**
 * The whole authoring surface for feature banners:
 *
 *   • pick or create a named carousel (the "" carousel is the default one)
 *   • set that carousel's dot color and autoplay delay
 *   • add, edit, reorder (drag), hide, and delete its banners
 *   • upload a 16:9 backdrop and choose a CTA pill style
 *   • preview the result with the real carousel component
 *
 * All reads and writes go through `store`, so this component knows nothing
 * about Firebase or any other backend.
 */
export function BannerManager({
  store,
  theme: themeOverride,
  maxBackdropWidth = 1920,
  title = "Feature banners",
}: BannerManagerProps): ReactElement {
  const theme = mergeTheme(themeOverride);

  const [carousels, setCarousels] = useState<CarouselRecord[]>([]);
  const [carouselId, setCarouselId] = useState("");
  const [banners, setBanners] = useState<BannerRecord[]>([]);
  const [styles, setStyles] = useState<ButtonStyleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const current = carousels.find((c) => c.id === carouselId);

  const loadBanners = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setBanners(await store.listBanners(carouselId));
    } catch (e) {
      console.error("Failed to load banners", e);
      setError("Failed to load banners");
    } finally {
      setIsLoading(false);
    }
  }, [store, carouselId]);

  useEffect(() => {
    void loadBanners();
  }, [loadBanners]);

  const refreshCarousels = useCallback(async () => {
    setCarousels(await store.listCarousels());
  }, [store]);

  useEffect(() => {
    void refreshCarousels().catch(() => {});
    store
      .listButtonStyles()
      .then(setStyles)
      .catch(() => {});
  }, [store, refreshCarousels]);

  // ---- carousel actions ------------------------------------------------

  const handleNewCarousel = async () => {
    const name = window.prompt("New carousel name:");
    if (!name?.trim()) return;
    const created = await store.createCarousel({ name: name.trim() });
    await refreshCarousels();
    setCarouselId(created.id);
  };

  const handleRenameCarousel = async () => {
    if (!current) return;
    const name = window.prompt("Rename carousel:", current.name);
    if (!name?.trim()) return;
    await store.updateCarousel(current.id, { name: name.trim() });
    await refreshCarousels();
  };

  const handleDeleteCarousel = async () => {
    if (!current) return;
    const ok = window.confirm(
      `Delete carousel "${current.name}"? Its banners keep their data but become unassigned.`,
    );
    if (!ok) return;
    await store.deleteCarousel(current.id);
    await refreshCarousels();
    setCarouselId("");
  };

  const patchCarousel = async (
    patch: { dotColor?: string; autoplayDelay?: number },
  ) => {
    if (!carouselId) return;
    await store.updateCarousel(carouselId, patch);
    await refreshCarousels();
  };

  // ---- banner actions --------------------------------------------------

  /**
   * A banner is created up front, hidden, so it has an id before the backdrop
   * upload needs one. It stays out of the live carousel until you enable it.
   */
  const handleAddBanner = async () => {
    setIsSaving(true);
    try {
      const id = await store.createBanner({
        ...(carouselId ? { carouselId } : {}),
        title: "Untitled banner",
        backdropURL: "",
        order: banners.length,
        isActive: false,
      });
      await loadBanners();
      setEditingId(id);
      setDraft({ ...EMPTY_DRAFT, title: "Untitled banner" });
    } catch (e) {
      console.error("Failed to add banner", e);
      setError("Failed to add banner");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (banner: BannerRecord) => {
    const next = !banner.isActive;
    setBanners((prev) =>
      prev.map((b) => (b.id === banner.id ? { ...b, isActive: next } : b)),
    );
    try {
      await store.updateBanner(banner.id, { isActive: next });
    } catch (e) {
      console.error("Failed to toggle banner", e);
      setError("Failed to update banner");
      void loadBanners();
    }
  };

  const handleDeleteBanner = async (banner: BannerRecord) => {
    if (!window.confirm(`Delete "${banner.title}"?`)) return;
    try {
      await store.deleteBanner(banner.id);
      setBanners((prev) => prev.filter((b) => b.id !== banner.id));
    } catch (e) {
      console.error("Failed to delete banner", e);
      setError("Failed to delete banner");
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setIsSaving(true);
    try {
      // Empty strings are written deliberately: they clear a field.
      await store.updateBanner(editingId, {
        title: draft.title,
        subtitle: draft.subtitle,
        description: draft.description,
        href: draft.href,
        ctaLabel: draft.ctaLabel,
        backdropURL: draft.backdropURL,
        ctaButtonStyleId: draft.ctaButtonStyleId,
      });
      await loadBanners();
      setStyles(await store.listButtonStyles());
      setEditingId(null);
    } catch (e) {
      console.error("Failed to save banner", e);
      setError("Failed to save banner");
    } finally {
      setIsSaving(false);
    }
  };

  // ---- drag to reorder -------------------------------------------------

  const handleDragEnd = async () => {
    const from = draggedIndex;
    const to = dragOverIndex;
    setDraggedIndex(null);
    setDragOverIndex(null);
    if (from === null || to === null || from === to) return;

    const next = [...banners];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    setBanners(next);

    try {
      await store.reorderBanners(next.map((b) => b.id));
    } catch (e) {
      console.error("Failed to save order", e);
      setError("Failed to save order");
      void loadBanners();
    }
  };

  // ---- render ----------------------------------------------------------

  const previewItems = useMemo(
    () =>
      banners
        .filter((b) => b.isActive && b.backdropURL)
        .map((b) => resolveBanner(b, styles)),
    [banners, styles],
  );

  const inputStyle = {
    borderColor: theme.elevated3,
    backgroundColor: theme.elevated2,
    color: theme.textPrimary,
  };

  return (
    <div className="jmc-a" style={{ color: theme.textPrimary }}>
      <div className="jmc-a-head">
        <div>
          <h2 className="jmc-a-title">{title}</h2>
          <p className="jmc-a-hint" style={{ color: theme.textTertiary }}>
            Default is the app-wide carousel; named carousels can be placed on
            individual pages. Drag to reorder.
          </p>
        </div>
        <div className="jmc-a-row">
          <button
            type="button"
            className="jmc-a-btn jmc-a-btn--ghost"
            style={{ borderColor: theme.elevated3, color: theme.textSecondary }}
            onClick={() => setShowPreview((v) => !v)}
          >
            {showPreview ? "Hide preview" : "Preview"}
          </button>
          <button
            type="button"
            className="jmc-a-btn"
            style={{ backgroundColor: theme.accentAlt, color: theme.base }}
            onClick={() => void handleAddBanner()}
            disabled={isSaving}
          >
            + Add banner
          </button>
        </div>
      </div>

      {/* Carousel selector and its presentation settings */}
      <div className="jmc-a-row jmc-a-bar">
        <span style={{ color: theme.textSecondary }}>Carousel:</span>
        <select
          value={carouselId}
          onChange={(e) => setCarouselId(e.target.value)}
          className="jmc-a-input"
          style={inputStyle}
          aria-label="Carousel"
        >
          <option value="">Default</option>
          {carousels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="jmc-a-btn jmc-a-btn--ghost"
          style={{ borderColor: theme.elevated3, color: theme.textSecondary }}
          onClick={() => void handleNewCarousel()}
        >
          + New
        </button>
        {carouselId ? (
          <>
            <button
              type="button"
              className="jmc-a-btn jmc-a-btn--ghost"
              style={{ borderColor: theme.elevated3, color: theme.textSecondary }}
              onClick={() => void handleRenameCarousel()}
            >
              Rename
            </button>
            <button
              type="button"
              className="jmc-a-btn jmc-a-btn--ghost"
              style={{ borderColor: theme.elevated3, color: theme.error }}
              onClick={() => void handleDeleteCarousel()}
            >
              Delete
            </button>
            <label className="jmc-a-swatch" style={{ color: theme.textSecondary }}>
              Dots
              <input
                type="color"
                value={current?.dotColor ?? theme.accent}
                onChange={(e) => void patchCarousel({ dotColor: e.target.value })}
                aria-label="Pagination dot color"
              />
            </label>
            <label className="jmc-a-swatch" style={{ color: theme.textSecondary }}>
              Autoplay ms
              <input
                type="number"
                step={500}
                min={0}
                value={current?.autoplayDelay ?? 6000}
                onChange={(e) =>
                  void patchCarousel({ autoplayDelay: Number(e.target.value) || 0 })
                }
                className="jmc-a-input jmc-a-input--narrow"
                style={inputStyle}
                aria-label="Autoplay delay in milliseconds"
              />
            </label>
          </>
        ) : null}
      </div>

      {error ? (
        <div
          className="jmc-a-alert"
          style={{ backgroundColor: `${theme.error}20`, color: theme.error }}
        >
          {error}
          <button
            type="button"
            className="jmc-a-link"
            style={{ color: theme.error }}
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      ) : null}

      {showPreview ? (
        <div
          className="jmc-a-preview-stage"
          style={{ backgroundColor: theme.base }}
        >
          {previewItems.length > 0 ? (
            <FeaturedCarousel
              items={previewItems}
              theme={themeOverride ?? {}}
              autoplayDelay={current?.autoplayDelay ?? 6000}
              {...(current?.dotColor ? { dotColor: current.dotColor } : {})}
              onItemClick={() => {}}
            />
          ) : (
            <p className="jmc-a-hint" style={{ color: theme.textTertiary }}>
              Nothing to preview yet — a banner needs a backdrop and must be
              visible.
            </p>
          )}
        </div>
      ) : null}

      {/* Banner list */}
      {isLoading ? (
        <p className="jmc-a-hint" style={{ color: theme.textTertiary }}>
          Loading…
        </p>
      ) : banners.length === 0 ? (
        <div
          className="jmc-a-empty"
          style={{ borderColor: theme.elevated3, color: theme.textTertiary }}
        >
          No banners in this carousel yet.
        </div>
      ) : (
        <ul className="jmc-a-list">
          {banners.map((banner, index) => (
            <li
              key={banner.id}
              draggable
              onDragStart={() => setDraggedIndex(index)}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverIndex(index);
              }}
              onDragEnd={() => void handleDragEnd()}
              className="jmc-a-item"
              style={{
                backgroundColor:
                  dragOverIndex === index
                    ? `${theme.accentAlt}20`
                    : theme.elevated1,
                borderColor:
                  dragOverIndex === index ? theme.accentAlt : theme.elevated2,
                opacity: draggedIndex === index ? 0.5 : 1,
              }}
            >
              <span
                className="jmc-a-grip"
                style={{ color: theme.textTertiary }}
                aria-hidden="true"
              >
                ⠿
              </span>

              <span
                className="jmc-a-thumb"
                style={{ backgroundColor: theme.elevated2 }}
              >
                {banner.backdropURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={banner.backdropURL} alt="" />
                ) : null}
              </span>

              <span className="jmc-a-item-body">
                <span className="jmc-a-item-title">{banner.title}</span>
                {banner.description ? (
                  <span
                    className="jmc-a-item-sub"
                    style={{ color: theme.textTertiary }}
                  >
                    {banner.description}
                  </span>
                ) : null}
              </span>

              <span
                className="jmc-a-order"
                style={{
                  backgroundColor: theme.elevated2,
                  color: theme.textSecondary,
                }}
              >
                {index + 1}
              </span>

              <button
                type="button"
                className="jmc-a-icon"
                style={{
                  color: banner.isActive ? theme.success : theme.textTertiary,
                }}
                title={banner.isActive ? "Visible — click to hide" : "Hidden — click to show"}
                onClick={() => void handleToggleActive(banner)}
              >
                {banner.isActive ? "◉" : "○"}
              </button>
              <button
                type="button"
                className="jmc-a-icon"
                style={{ color: theme.textSecondary }}
                title="Edit"
                onClick={() => {
                  setEditingId(banner.id);
                  setDraft(draftFrom(banner));
                }}
              >
                ✎
              </button>
              <button
                type="button"
                className="jmc-a-icon"
                style={{ color: theme.error }}
                title="Delete"
                onClick={() => void handleDeleteBanner(banner)}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Editor */}
      {editingId ? (
        <div className="jmc-a-modal">
          <div
            className="jmc-a-modal-scrim"
            onClick={() => setEditingId(null)}
            role="presentation"
          />
          <div
            className="jmc-a-modal-body"
            style={{ backgroundColor: theme.elevated1 }}
          >
            <div className="jmc-a-row jmc-a-row--split">
              <h3 className="jmc-a-title">Edit banner</h3>
              <button
                type="button"
                className="jmc-a-link"
                style={{ color: theme.textTertiary }}
                onClick={() => setEditingId(null)}
              >
                ×
              </button>
            </div>

            <label className="jmc-a-label" style={{ color: theme.textSecondary }}>
              Title
            </label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
              className="jmc-a-input jmc-a-input--full"
              style={inputStyle}
            />

            <label className="jmc-a-label" style={{ color: theme.textSecondary }}>
              Subtitle
            </label>
            <input
              type="text"
              value={draft.subtitle}
              placeholder="Optional — small caps line above the copy"
              onChange={(e) =>
                setDraft((p) => ({ ...p, subtitle: e.target.value }))
              }
              className="jmc-a-input jmc-a-input--full"
              style={inputStyle}
            />

            <label className="jmc-a-label" style={{ color: theme.textSecondary }}>
              Description
            </label>
            <textarea
              rows={3}
              value={draft.description}
              placeholder="Optional — clamped to two lines on the banner"
              onChange={(e) =>
                setDraft((p) => ({ ...p, description: e.target.value }))
              }
              className="jmc-a-input jmc-a-input--full"
              style={inputStyle}
            />

            <label className="jmc-a-label" style={{ color: theme.textSecondary }}>
              Link (href)
            </label>
            <input
              type="text"
              value={draft.href}
              placeholder="/shows/my-show"
              onChange={(e) => setDraft((p) => ({ ...p, href: e.target.value }))}
              className="jmc-a-input jmc-a-input--full"
              style={inputStyle}
            />

            <label className="jmc-a-label" style={{ color: theme.textSecondary }}>
              Button label
            </label>
            <input
              type="text"
              value={draft.ctaLabel}
              placeholder="Watch Now"
              onChange={(e) =>
                setDraft((p) => ({ ...p, ctaLabel: e.target.value }))
              }
              className="jmc-a-input jmc-a-input--full"
              style={inputStyle}
            />

            <div className="jmc-a-field">
              <ImageUpload
                label="Backdrop (16:9)"
                value={draft.backdropURL}
                onChange={(url) =>
                  setDraft((p) => ({ ...p, backdropURL: url ?? "" }))
                }
                onUpload={(file) => store.uploadBackdrop(file, editingId)}
                aspectRatio="landscape"
                previewSize={300}
                maxWidth={maxBackdropWidth}
                {...(themeOverride ? { theme: themeOverride } : {})}
              />
            </div>

            <div className="jmc-a-field">
              <ButtonStylePicker
                value={draft.ctaButtonStyleId}
                onChange={(id) =>
                  setDraft((p) => ({ ...p, ctaButtonStyleId: id }))
                }
                store={store}
                {...(themeOverride ? { theme: themeOverride } : {})}
              />
            </div>

            <div className="jmc-a-row jmc-a-row--end">
              <button
                type="button"
                className="jmc-a-link"
                style={{ color: theme.textSecondary }}
                onClick={() => setEditingId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="jmc-a-btn"
                style={{ backgroundColor: theme.accentAlt, color: theme.base }}
                onClick={() => void handleSaveEdit()}
                disabled={isSaving || !draft.title.trim()}
              >
                {isSaving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
