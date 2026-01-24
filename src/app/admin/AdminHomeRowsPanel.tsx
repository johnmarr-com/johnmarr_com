"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "@/lib/content";
import type { JMExperience, JMContent, JMContentType } from "@/lib/content-types";
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
          {row.autoPopulate ? (
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
          {row.autoPopulate && row.contentType
            ? `All ${JMContentTypeLabels[row.contentType]}s`
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

export function AdminHomeRowsPanel() {
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
  const [formContentType, setFormContentType] = useState<JMContentType | "">("");
  const [formAutoPopulate, setFormAutoPopulate] = useState(false);
  const [formContentIds, setFormContentIds] = useState<string[]>([]);

  // Content picker state
  const [availableContent, setAvailableContent] = useState<JMContent[]>([]);
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
      setRows(fetchedRows);
    } catch (err) {
      console.error("Failed to load rows:", err);
      setError("Failed to load home rows. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  // Load available content when modal opens for curated rows
  const loadAvailableContent = useCallback(async (contentType?: JMContentType) => {
    setIsLoadingContent(true);
    try {
      const content = await getTopLevelContent(contentType, false); // Include drafts
      setAvailableContent(content);
    } catch (err) {
      console.error("Failed to load content:", err);
    } finally {
      setIsLoadingContent(false);
    }
  }, []);

  const openCreateModal = () => {
    setEditingRow(null);
    setFormTitle("");
    setFormContentType("");
    setFormAutoPopulate(false);
    setFormContentIds([]);
    setAvailableContent([]);
    setShowModal(true);
  };

  const openEditModal = (row: JMExperience) => {
    setEditingRow(row);
    setFormTitle(row.title);
    setFormContentType(row.contentType || "");
    setFormAutoPopulate(row.autoPopulate || false);
    setFormContentIds(row.contentIds || []);
    if (!row.autoPopulate) {
      loadAvailableContent(row.contentType);
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRow(null);
  };

  const handleContentTypeChange = (type: JMContentType | "") => {
    setFormContentType(type);
    if (!formAutoPopulate && type) {
      loadAvailableContent(type);
    } else if (!type) {
      loadAvailableContent();
    }
  };

  const handleAutoPopulateChange = (auto: boolean) => {
    setFormAutoPopulate(auto);
    if (!auto) {
      loadAvailableContent(formContentType || undefined);
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
    if (!user?.uid) return;

    setIsSaving(true);
    setError(null);

    try {
      if (editingRow) {
        // Update existing row
        const updateData: Parameters<typeof updateExperience>[1] = {
          title: formTitle.trim(),
          autoPopulate: formAutoPopulate,
          contentIds: formAutoPopulate ? [] : formContentIds,
        };
        if (formContentType) {
          updateData.contentType = formContentType;
        }
        await updateExperience(editingRow.id, updateData);
      } else {
        // Create new row
        const nextOrder = rows.length;
        const createData: Parameters<typeof createExperience>[0] = {
          title: formTitle.trim(),
          autoPopulate: formAutoPopulate,
          contentIds: formAutoPopulate ? [] : formContentIds,
          order: nextOrder,
          isPublished: false,
        };
        if (formContentType) {
          createData.contentType = formContentType;
        }
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
              Home Rows
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

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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

              {/* Content Type Filter */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: theme.text.secondary }}>
                  Content Type
                </label>
                <select
                  value={formContentType}
                  onChange={(e) => handleContentTypeChange(e.target.value as JMContentType | "")}
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
                </select>
              </div>

              {/* Auto-populate toggle */}
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

              {/* Content picker (only for curated rows) */}
              {!formAutoPopulate && (
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
        </div>
      )}
    </div>
  );
}
