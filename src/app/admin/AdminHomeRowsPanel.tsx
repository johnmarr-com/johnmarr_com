"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Pencil,
  Loader2,
  X,
  GripVertical,
  Layers,
  Zap,
  List,
  Image as ImageIcon,
  Gauge,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useJMStyle } from "@/JMStyle";
import { useAuth } from "@/lib/AuthProvider";
import {
  getExperiences,
  createExperience,
  updateExperience,
  deleteExperience,
  getTopLevelContent,
  getAllArtists,
} from "@/lib/content";
import { getAllAuctions } from "@/lib/auction";
import type { JMExperience, JMContent, JMContentType } from "@/lib/content-types";
import type { JMAuction } from "@/lib/content-types";
import { JMContentTypeLabels } from "@/lib/content-types";

// Sortable content item for curated row editor
interface SortableContentItemProps {
  content: JMContent;
  onRemove: () => void;
}

function SortableContentItem({ content, onRemove }: SortableContentItemProps) {
  const { theme } = useJMStyle();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: content.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, borderColor: theme.surfaces.elevated2 }}
      className="flex items-center gap-2 p-2 border-b last:border-b-0"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none p-1"
        style={{ color: theme.text.tertiary }}
      >
        <GripVertical size={14} />
      </div>
      {content.coverURL && (
        <div className="w-10 h-5 rounded overflow-hidden shrink-0">
          <Image
            src={content.coverURL}
            alt=""
            width={40}
            height={20}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <span className="flex-1 truncate text-sm" style={{ color: theme.text.primary }}>
        {content.name}
      </span>
      <button
        onClick={onRemove}
        className="p-1 rounded hover:bg-red-500/20 transition-colors"
      >
        <Trash2 size={14} style={{ color: "#EF4444" }} />
      </button>
    </div>
  );
}

interface SortableRowItemProps {
  row: JMExperience;
  onEdit: () => void;
  onTogglePublish: () => void;
  onDelete: () => void;
}

function SortableRowItem({ row, onEdit, onTogglePublish, onDelete }: SortableRowItemProps) {
  const { theme } = useJMStyle();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      className="flex items-center border-b last:border-b-0"
      style={{ ...style, borderColor: theme.surfaces.elevated2 }}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="px-4 py-4 cursor-grab active:cursor-grabbing touch-none"
        style={{ color: theme.text.tertiary }}
      >
        <GripVertical size={18} />
      </div>

      {/* Row info */}
      <div className="flex-1 py-4 pr-4">
        <div className="flex items-center gap-2">
          <span className="font-medium" style={{ color: theme.text.primary }}>
            {row.title}
          </span>
          {row.rowKind === "feature" ? (
            <span
              className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{
                backgroundColor: `${theme.accents.goldenGlow}30`,
                color: theme.accents.goldenGlow,
              }}
            >
              <ImageIcon size={10} />
              Feature
            </span>
          ) : row.autoPopulate ? (
            <span
              className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{
                backgroundColor: `${theme.accents.neonPink}20`,
                color: theme.accents.neonPink,
              }}
            >
              <Zap size={10} />
              Auto
            </span>
          ) : (
            <span
              className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{
                backgroundColor: `${theme.accents.goldenGlow}20`,
                color: theme.accents.goldenGlow,
              }}
            >
              <List size={10} />
              Curated
            </span>
          )}
          {row.fastCasual && (
            <span
              className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{
                backgroundColor: `${theme.text.tertiary}25`,
                color: theme.text.secondary,
              }}
            >
              <Gauge size={10} />
              Fast Casual
            </span>
          )}
          {!row.isPublished && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: theme.surfaces.elevated2,
                color: theme.text.tertiary,
              }}
            >
              Draft
            </span>
          )}
        </div>
        <div className="text-sm mt-0.5" style={{ color: theme.text.tertiary }}>
          {row.rowKind === "feature"
            ? `Row banner: ${row.contentType === "auction" ? "Auction" : row.contentType}`
            : row.autoPopulate && row.contentType
              ? `All ${row.contentType === "auction" ? "Auctions" : JMContentTypeLabels[row.contentType as JMContentType]}s`
              : `${row.contentIds.length} item${row.contentIds.length !== 1 ? "s" : ""}`}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 pr-4">
        <button
          onClick={onTogglePublish}
          className="p-2 rounded-lg transition-colors hover:bg-white/10"
          title={row.isPublished ? "Unpublish" : "Publish"}
        >
          {row.isPublished ? (
            <Eye size={18} style={{ color: theme.accents.goldenGlow }} />
          ) : (
            <EyeOff size={18} style={{ color: theme.text.tertiary }} />
          )}
        </button>
        <button
          onClick={onEdit}
          className="p-2 rounded-lg transition-colors hover:bg-white/10"
          title="Edit"
        >
          <Pencil size={18} style={{ color: theme.text.secondary }} />
        </button>
        <button
          onClick={onDelete}
          className="p-2 rounded-lg transition-colors hover:bg-red-500/20"
          title="Delete"
        >
          <Trash2 size={18} style={{ color: "#EF4444" }} />
        </button>
      </div>
    </div>
  );
}

export function AdminHomeRowsPanel({
  pageId = "home",
  rowCollectionId,
}: {
  /** Legacy: which page's rows to manage. "home" (default) = the home page. */
  pageId?: string;
  /** When set, manage a named row collection instead (segment model). */
  rowCollectionId?: string;
} = {}) {
  const { theme } = useJMStyle();
  const { user } = useAuth();
  const [rows, setRows] = useState<JMExperience[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingRow, setEditingRow] = useState<JMExperience | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formRowKind, setFormRowKind] = useState<"content" | "feature">("content");
  const [formContentType, setFormContentType] = useState<JMContentType | "auction" | "">("");
  const [formAutoPopulate, setFormAutoPopulate] = useState(false);
  const [formContentIds, setFormContentIds] = useState<string[]>([]);
  const [formRowScaleMobile, setFormRowScaleMobile] = useState<number>(1);
  const [formRowScaleDesktop, setFormRowScaleDesktop] = useState<number>(1);
  const [formFastCasual, setFormFastCasual] = useState(false);

  // Content picker state
  const [availableContent, setAvailableContent] = useState<JMContent[]>([]);
  const [availableAuctions, setAvailableAuctions] = useState<JMAuction[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedRows = await getExperiences(false); // Include drafts
      // Scope to a named row collection (segment model) or, legacy, to a page.
      setRows(
        fetchedRows.filter((r) =>
          rowCollectionId
            ? (r.rowCollectionId ?? "") === rowCollectionId
            : (r.pageId ?? "home") === pageId,
        ),
      );
    } catch (err) {
      console.error("Failed to load rows:", err);
      setError("Failed to load home rows. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [pageId, rowCollectionId]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  // Load available content when modal opens for curated rows
  const loadAvailableAuctions = useCallback(async () => {
    setIsLoadingContent(true);
    try {
      const auctions = await getAllAuctions(false);
      setAvailableAuctions(auctions.filter((a): a is JMAuction & { rowBannerURL: string } => !!a.rowBannerURL));
    } catch (err) {
      console.error("Failed to load auctions:", err);
    } finally {
      setIsLoadingContent(false);
    }
  }, []);

  const loadAvailableContent = useCallback(async (contentType?: JMContentType) => {
    setIsLoadingContent(true);
    try {
      if (contentType === "artist") {
        const artists = await getAllArtists(false);
        const artistContent: JMContent[] = artists.map(artist => ({
          id: artist.id,
          name: artist.name,
          slug: artist.slug,
          description: artist.description || "",
          coverURL: artist.coverURL,
          contentType: "artist" as const,
          contentLevel: "standalone" as const,
          parentId: null,
          creatorId: artist.creatorId,
          createdAt: artist.createdAt,
          updatedAt: artist.updatedAt,
          order: artist.order,
          isPublished: artist.isPublished,
        }));
        setAvailableContent(artistContent);
      } else if (contentType === "story") {
        const { getAllStories } = await import("@/lib/stories");
        const stories = await getAllStories(false);
        const storyContent: JMContent[] = stories.map(story => ({
          id: story.id,
          name: story.title,
          slug: story.slug,
          description: story.subtitle || "",
          coverURL: story.coverThumbnailURL || story.coverImageURL || "",
          contentType: "story" as const,
          contentLevel: "standalone" as const,
          parentId: null,
          creatorId: story.creatorId,
          createdAt: story.createdAt,
          updatedAt: story.updatedAt,
          order: 0,
          isPublished: story.isPublished,
        }));
        setAvailableContent(storyContent);
      } else {
        const content = await getTopLevelContent(contentType, false);
        setAvailableContent(content);
      }
    } catch (err) {
      console.error("Failed to load content:", err);
    } finally {
      setIsLoadingContent(false);
    }
  }, []);

  const openCreateModal = () => {
    setEditingRow(null);
    setFormTitle("");
    setFormRowKind("content");
    setFormContentType("");
    setFormAutoPopulate(false);
    setFormContentIds([]);
    setFormRowScaleMobile(1);
    setFormRowScaleDesktop(1);
    setFormFastCasual(false);
    setAvailableContent([]);
    setAvailableAuctions([]);
    setShowModal(true);
  };

  const openEditModal = (row: JMExperience) => {
    setEditingRow(row);
    setFormTitle(row.title);
    const isFeature = row.rowKind === "feature";
    setFormRowKind(isFeature ? "feature" : "content");
    setFormContentType((row.contentType as JMContentType | "auction") || "");
    setFormAutoPopulate(isFeature ? false : (row.autoPopulate || false));
    setFormContentIds(row.contentIds || []);
    setFormRowScaleMobile(row.rowScaleMobile || 1);
    setFormRowScaleDesktop(row.rowScaleDesktop || 1);
    setFormFastCasual(row.fastCasual === true);
    if (isFeature) {
      loadAvailableAuctions();
    } else if (!row.autoPopulate) {
      loadAvailableContent(row.contentType === "auction" ? undefined : (row.contentType as JMContentType));
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRow(null);
  };

  const handleRowKindChange = (kind: "content" | "feature") => {
    setFormRowKind(kind);
    setFormContentIds([]);
    if (kind === "feature") {
      setFormContentType("auction");
      setFormAutoPopulate(false);
      loadAvailableAuctions();
    } else {
      setFormContentType("");
      loadAvailableContent();
    }
  };

  const handleContentTypeChange = (type: JMContentType | "auction" | "") => {
    setFormContentType(type);
    if (formRowKind === "feature" && type === "auction") {
      loadAvailableAuctions();
    } else if (!formAutoPopulate && type && type !== "auction") {
      loadAvailableContent(type as JMContentType);
    } else if (!type) {
      loadAvailableContent();
    }
  };

  const handleAutoPopulateChange = (auto: boolean) => {
    setFormAutoPopulate(auto);
    if (!auto) {
      loadAvailableContent(formContentType && formContentType !== "auction" ? (formContentType as JMContentType) : undefined);
    }
  };

  const toggleContentItem = (contentId: string) => {
    setFormContentIds((prev) =>
      prev.includes(contentId)
        ? prev.filter((id) => id !== contentId)
        : [...prev, contentId]
    );
  };

  const handleSave = async () => {
    if (!formTitle.trim()) {
      setError("Row title is required");
      return;
    }
    if (formRowKind === "feature" && formContentIds.length === 0) {
      setError("Please select an auction with a row banner");
      return;
    }
    if (!user?.uid) return;

    setIsSaving(true);
    setError(null);

    try {
      const baseUpdate: Record<string, unknown> = {
        title: formTitle.trim(),
        rowKind: formRowKind,
        autoPopulate: formRowKind === "content" ? formAutoPopulate : false,
        contentIds: formRowKind === "feature" ? formContentIds : (formAutoPopulate ? [] : formContentIds),
        rowScaleMobile: formRowScaleMobile,
        rowScaleDesktop: formRowScaleDesktop,
        fastCasual: formFastCasual,
      };
      if (formContentType) baseUpdate["contentType"] = formContentType;
      if (editingRow) {
        await updateExperience(editingRow.id, baseUpdate as Parameters<typeof updateExperience>[1]);
      } else {
        const createData: Parameters<typeof createExperience>[0] = {
          ...baseUpdate,
          order: rows.length,
          isPublished: false,
          ...(rowCollectionId ? { rowCollectionId } : { pageId }),
        } as Parameters<typeof createExperience>[0];
        await createExperience(createData, user.uid);
      }

      await loadRows();
      closeModal();
    } catch (err) {
      console.error("Failed to save row:", err);
      setError("Failed to save row. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePublish = async (row: JMExperience) => {
    try {
      await updateExperience(row.id, { isPublished: !row.isPublished });
      await loadRows();
    } catch (err) {
      console.error("Failed to toggle publish:", err);
      setError("Failed to update row status.");
    }
  };

  const handleDelete = async (row: JMExperience) => {
    if (!confirm(`Are you sure you want to delete "${row.title}"?`)) return;
    try {
      await deleteExperience(row.id);
      await loadRows();
    } catch (err) {
      console.error("Failed to delete row:", err);
      setError("Failed to delete row.");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = rows.findIndex((r) => r.id === active.id);
    const newIndex = rows.findIndex((r) => r.id === over.id);

    const newRows = arrayMove(rows, oldIndex, newIndex);
    setRows(newRows);

    setIsSavingOrder(true);
    try {
      await Promise.all(
        newRows.map((row, index) => updateExperience(row.id, { order: index }))
      );
    } catch (err) {
      console.error("Failed to save order:", err);
      loadRows();
    } finally {
      setIsSavingOrder(false);
    }
  };

  return (
    <div
      className="mt-6 opacity-0 animate-fade-in-up animation-delay-400 rounded-2xl border backdrop-blur-md"
      style={{
        backgroundColor: `${theme.surfaces.base}ee`,
        borderColor: theme.surfaces.elevated2,
      }}
    >
      {/* Header */}
      <div
        className="px-8 py-6 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${theme.surfaces.elevated2}` }}
      >
        <div className="flex items-center gap-3">
          <Layers size={24} style={{ color: theme.accents.goldenGlow }} />
          <div>
            <h2 className="text-lg font-semibold" style={{ color: theme.text.primary }}>
              {rowCollectionId
                ? "Collection Rows"
                : pageId === "home"
                  ? "Home Rows"
                  : "Page Rows"}
            </h2>
            <p className="text-sm" style={{ color: theme.text.tertiary }}>
              {isLoading
                ? "Loading..."
                : `${rows.length} row${rows.length !== 1 ? "s" : ""}`}
              {isSavingOrder && " • Saving order..."}
            </p>
          </div>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
          style={{
            backgroundColor: theme.accents.goldenGlow,
            color: theme.surfaces.base,
          }}
        >
          <Plus size={18} />
          <span className="font-medium">New Row</span>
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {error && (
          <div
            className="mb-4 p-3 rounded-lg text-sm"
            style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#EF4444" }}
          >
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: theme.accents.goldenGlow }} />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12" style={{ color: theme.text.tertiary }}>
            <p>No home rows yet. Create your first row to get started.</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
              <div
                className="rounded-lg border overflow-hidden"
                style={{ backgroundColor: theme.surfaces.elevated1, borderColor: theme.surfaces.elevated2 }}
              >
                {rows.map((row) => (
                  <SortableRowItem
                    key={row.id}
                    row={row}
                    onEdit={() => openEditModal(row)}
                    onTogglePublish={() => handleTogglePublish(row)}
                    onDelete={() => handleDelete(row)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {rows.length > 1 && !isLoading && (
          <p className="text-center text-xs mt-4" style={{ color: theme.text.tertiary }}>
            Drag to reorder rows on the homepage
          </p>
        )}
      </div>

      {/* Create/Edit Modal — portaled to body so it escapes the panel's
          backdrop-blur stacking context (otherwise the sticky header covers it). */}
      {showModal &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={closeModal} />
          <div
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl"
            style={{ backgroundColor: theme.surfaces.base, border: `1px solid ${theme.surfaces.elevated2}` }}
          >
            {/* Header */}
            <div
              className="px-6 py-4 flex items-center justify-between sticky top-0 z-10"
              style={{ backgroundColor: theme.surfaces.base, borderBottom: `1px solid ${theme.surfaces.elevated2}` }}
            >
              <h3 className="text-lg font-semibold" style={{ color: theme.text.primary }}>
                {editingRow ? "Edit Row" : "New Row"}
              </h3>
              <button onClick={closeModal} className="p-1 rounded-lg transition-colors hover:bg-white/10">
                <X size={20} style={{ color: theme.text.tertiary }} />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-5">
              {/* Row Kind */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.text.secondary }}>
                  Row Type
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="rowKind"
                      checked={formRowKind === "content"}
                      onChange={() => handleRowKindChange("content")}
                    />
                    <span style={{ color: theme.text.primary }}>Content Row</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="rowKind"
                      checked={formRowKind === "feature"}
                      onChange={() => handleRowKindChange("feature")}
                    />
                    <span style={{ color: theme.text.primary }}>Feature Row</span>
                  </label>
                </div>
                <p className="text-xs mt-1" style={{ color: theme.text.tertiary }}>
                  {formRowKind === "feature" ? "Single row-banner image (1500×750px) from content" : "Horizontal scroller of content covers"}
                </p>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.text.secondary }}>
                  Row Title *
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g., Art in Motion, Latest Shows"
                  className="w-full px-4 py-3 rounded-lg outline-none transition-colors"
                  style={{
                    backgroundColor: theme.surfaces.elevated1,
                    color: theme.text.primary,
                    border: `1px solid ${theme.surfaces.elevated2}`,
                  }}
                />
              </div>

              {/* Fast Casual (home page label) */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formFastCasual}
                    onChange={(e) => setFormFastCasual(e.target.checked)}
                    className="w-5 h-5 rounded"
                  />
                  <div>
                    <span className="font-medium" style={{ color: theme.text.primary }}>
                      Fast Casual
                    </span>
                    <p className="text-sm" style={{ color: theme.text.tertiary }}>
                      On the home page, show &quot;Fast Casual&quot; before this row&apos;s title
                    </p>
                  </div>
                </label>
              </div>

              {/* Row Height */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-2" style={{ color: theme.text.secondary }}>
                    Height — Mobile
                  </label>
                  <select
                    value={formRowScaleMobile}
                    onChange={(e) => setFormRowScaleMobile(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-lg outline-none transition-colors"
                    style={{
                      backgroundColor: theme.surfaces.elevated1,
                      color: theme.text.primary,
                      border: `1px solid ${theme.surfaces.elevated2}`,
                    }}
                  >
                    <option value={1}>1x (default)</option>
                    <option value={1.5}>1.5x</option>
                    <option value={2}>2x</option>
                    <option value={2.5}>2.5x</option>
                    <option value={3}>3x</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-2" style={{ color: theme.text.secondary }}>
                    Height — Desktop
                  </label>
                  <select
                    value={formRowScaleDesktop}
                    onChange={(e) => setFormRowScaleDesktop(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-lg outline-none transition-colors"
                    style={{
                      backgroundColor: theme.surfaces.elevated1,
                      color: theme.text.primary,
                      border: `1px solid ${theme.surfaces.elevated2}`,
                    }}
                  >
                    <option value={1}>1x (default)</option>
                    <option value={1.5}>1.5x</option>
                    <option value={2}>2x</option>
                    <option value={2.5}>2.5x</option>
                    <option value={3}>3x</option>
                  </select>
                </div>
              </div>

              {/* Feature Row: Pick content with row-banner */}
              {formRowKind === "feature" && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: theme.text.secondary }}>
                    Select Auction (with row banner) *
                  </label>
                  {isLoadingContent ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" style={{ color: theme.accents.goldenGlow }} />
                    </div>
                  ) : availableAuctions.length === 0 ? (
                    <p className="text-sm py-4" style={{ color: theme.text.tertiary }}>
                      No auctions with row banner. Add a row banner image in the Auctions admin.
                    </p>
                  ) : (
                    <div
                      className="max-h-48 overflow-y-auto rounded-lg border"
                      style={{ backgroundColor: theme.surfaces.elevated1, borderColor: theme.surfaces.elevated2 }}
                    >
                      {availableAuctions.map((auction) => (
                        <button
                          key={auction.id}
                          type="button"
                          onClick={() => setFormContentIds(formContentIds.includes(auction.id) ? [] : [auction.id])}
                          className="w-full flex items-center gap-3 p-3 hover:bg-white/5 border-b last:border-b-0 text-left"
                          style={{
                            borderColor: theme.surfaces.elevated2,
                            backgroundColor: formContentIds.includes(auction.id) ? `${theme.accents.goldenGlow}20` : undefined,
                          }}
                        >
                          {auction.rowBannerURL && (
                            <div className="w-16 h-8 rounded overflow-hidden shrink-0">
                              <Image
                                src={auction.rowBannerURL}
                                alt=""
                                width={64}
                                height={32}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <span className="flex-1 truncate" style={{ color: theme.text.primary }}>
                            {auction.name}
                          </span>
                          {formContentIds.includes(auction.id) && (
                            <span className="text-xs font-medium" style={{ color: theme.accents.goldenGlow }}>Selected</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Content Type Filter (content rows only) */}
              {formRowKind === "content" && (
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.text.secondary }}>
                  Content Type
                </label>
                <select
                  value={formContentType}
                  onChange={(e) => handleContentTypeChange(e.target.value as JMContentType | "auction" | "")}
                  className="w-full px-4 py-3 rounded-lg outline-none"
                  style={{
                    backgroundColor: theme.surfaces.elevated1,
                    color: formContentType ? theme.text.primary : theme.text.tertiary,
                    border: `1px solid ${theme.surfaces.elevated2}`,
                  }}
                >
                  <option value="">All types</option>
                  <option value="show">Shows</option>
                  <option value="game">Games</option>
                  <option value="story">Stories</option>
                  <option value="card">Cards</option>
                  <option value="artist">AI Artists</option>
                </select>
              </div>
              )}

              {/* Auto-populate toggle (content rows only) */}
              {formRowKind === "content" && (
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formAutoPopulate}
                    onChange={(e) => handleAutoPopulateChange(e.target.checked)}
                    className="w-5 h-5 rounded"
                  />
                  <div>
                    <span className="font-medium" style={{ color: theme.text.primary }}>
                      Auto-populate
                    </span>
                    <p className="text-sm" style={{ color: theme.text.tertiary }}>
                      Automatically show all content of the selected type
                    </p>
                  </div>
                </label>
              </div>
              )}

              {/* Content picker (only for curated content rows) */}
              {formRowKind === "content" && !formAutoPopulate && (
                <div className="space-y-4">
                  {/* Selected items - draggable */}
                  {formContentIds.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: theme.text.secondary }}>
                        Selected Content ({formContentIds.length}) - Drag to reorder
                      </label>
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => {
                          const { active, over } = event;
                          if (over && active.id !== over.id) {
                            const oldIndex = formContentIds.indexOf(active.id as string);
                            const newIndex = formContentIds.indexOf(over.id as string);
                            setFormContentIds(arrayMove(formContentIds, oldIndex, newIndex));
                          }
                        }}
                      >
                        <SortableContext items={formContentIds} strategy={verticalListSortingStrategy}>
                          <div
                            className="rounded-lg border overflow-hidden"
                            style={{ backgroundColor: theme.surfaces.elevated1, borderColor: theme.surfaces.elevated2 }}
                          >
                            {formContentIds.map((contentId) => {
                              const content = availableContent.find((c) => c.id === contentId);
                              if (!content) return null;
                              return (
                                <SortableContentItem
                                  key={contentId}
                                  content={content}
                                  onRemove={() => toggleContentItem(contentId)}
                                />
                              );
                            })}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </div>
                  )}

                  {/* Add content */}
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: theme.text.secondary }}>
                      {formContentIds.length > 0 ? "Add More Content" : "Select Content"}
                    </label>
                    {isLoadingContent ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" style={{ color: theme.accents.goldenGlow }} />
                      </div>
                    ) : availableContent.length === 0 ? (
                      <p className="text-sm py-4" style={{ color: theme.text.tertiary }}>
                        No content available. Create some content first.
                      </p>
                    ) : (
                      <div
                        className="max-h-48 overflow-y-auto rounded-lg border"
                        style={{ backgroundColor: theme.surfaces.elevated1, borderColor: theme.surfaces.elevated2 }}
                      >
                        {availableContent
                          .filter((c) => !formContentIds.includes(c.id))
                          .map((content) => (
                            <button
                              key={content.id}
                              onClick={() => toggleContentItem(content.id)}
                              className="w-full flex items-center gap-3 p-3 hover:bg-white/5 border-b last:border-b-0 text-left"
                              style={{ borderColor: theme.surfaces.elevated2 }}
                            >
                              <Plus size={16} style={{ color: theme.accents.goldenGlow }} />
                              {content.coverURL && (
                                <div className="w-12 h-6 rounded overflow-hidden shrink-0">
                                  <Image
                                    src={content.coverURL}
                                    alt=""
                                    width={48}
                                    height={24}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <span className="flex-1 truncate" style={{ color: theme.text.primary }}>
                                {content.name}
                              </span>
                              <span
                                className="text-xs px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: theme.surfaces.elevated2, color: theme.text.tertiary }}
                              >
                                {JMContentTypeLabels[content.contentType]}
                              </span>
                            </button>
                          ))}
                        {availableContent.filter((c) => !formContentIds.includes(c.id)).length === 0 && (
                          <p className="text-sm p-4 text-center" style={{ color: theme.text.tertiary }}>
                            All available content has been added
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="px-6 py-4 flex items-center justify-end gap-3 sticky bottom-0"
              style={{ backgroundColor: theme.surfaces.base, borderTop: `1px solid ${theme.surfaces.elevated2}` }}
            >
              <button onClick={closeModal} className="px-4 py-2 rounded-lg transition-colors" style={{ color: theme.text.secondary }}>
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !formTitle.trim()}
                className="px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                style={{ backgroundColor: theme.accents.goldenGlow, color: theme.surfaces.base }}
              >
                {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : editingRow ? "Save Changes" : "Create Row"}
              </button>
            </div>
          </div>
        </div>,
          document.body,
        )}
    </div>
  );
}
