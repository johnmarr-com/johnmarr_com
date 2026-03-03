"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  Loader2,
  X,
  ImageIcon,
  Calendar,
  ChevronRight,
  ChevronDown,
  Pencil,
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
import { JMImageUpload } from "@/JMKit";
import {
  getAllAuctions,
  createAuction,
  updateAuction,
  deleteAuction,
  getAuctionItems,
  createAuctionItem,
  updateAuctionItem,
  deleteAuctionItem,
  uploadAuctionImage,
} from "@/lib/auction";
import type {
  JMAuction,
  JMAuctionItem,
  JMAuctionVideoOrientation,
} from "@/lib/content-types";
import { JMAuctionVideoOrientationLabels } from "@/lib/content-types";

function SortableAuctionItem({
  item,
  onEdit,
  onDelete,
}: {
  item: JMAuctionItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { theme } = useJMStyle();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center hover:bg-white/5 transition-colors rounded-lg"
    >
      <div
        {...attributes}
        {...listeners}
        className="px-3 py-4 cursor-grab touch-none"
        style={{ color: theme.text.tertiary }}
      >
        <GripVertical size={18} />
      </div>
      <button
        onClick={onEdit}
        className="flex-1 pr-4 py-4 flex items-center gap-4 text-left min-w-0"
      >
        <div
          className="w-16 h-16 rounded-lg bg-cover bg-center shrink-0"
          style={{
            backgroundImage: item.thumbnailURL ? `url(${item.thumbnailURL})` : undefined,
            backgroundColor: item.thumbnailURL ? undefined : theme.surfaces.elevated2,
          }}
        >
          {!item.thumbnailURL && (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon size={24} style={{ color: theme.text.tertiary }} />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate" style={{ color: theme.text.primary }}>
            {item.title}
          </div>
          <div className="text-sm truncate mt-0.5" style={{ color: theme.text.tertiary }}>
            {item.subtitle || "No subtitle"} • Min ${item.minimumBid}
          </div>
          {item.currentBidWinnerName && (
            <div
              className="text-xs mt-1 font-medium"
              style={{ color: theme.accents.goldenGlow }}
            >
              Leading: {item.currentBidWinnerName} (${item.currentBid})
            </div>
          )}
        </div>
        <ChevronRight size={18} style={{ color: theme.text.tertiary }} />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="p-2 rounded-lg hover:bg-red-500/10 shrink-0"
        style={{ color: theme.semantic.error }}
        title="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export function AdminAuctionsPanel() {
  const { theme } = useJMStyle();

  const [auctions, setAuctions] = useState<JMAuction[]>([]);
  const [selectedAuction, setSelectedAuction] = useState<JMAuction | null>(null);
  const [items, setItems] = useState<JMAuctionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAuctionModal, setShowAuctionModal] = useState(false);
  const [editingAuction, setEditingAuction] = useState<JMAuction | null>(null);

  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<JMAuctionItem | null>(null);

  const [expandedAuctionId, setExpandedAuctionId] = useState<string | null>(null);

  const loadAuctions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await getAllAuctions(false);
      setAuctions(list);
      if (selectedAuction) {
        const updated = list.find((a) => a.id === selectedAuction.id);
        if (updated) setSelectedAuction(updated);
      }
    } catch (err) {
      console.error("Failed to load auctions:", err);
      setError("Failed to load auctions");
    } finally {
      setIsLoading(false);
    }
  }, [selectedAuction?.id]);

  const loadItems = useCallback(
    async (auctionId: string) => {
      try {
        const list = await getAuctionItems(auctionId, false);
        setItems(list);
      } catch (err) {
        console.error("Failed to load items:", err);
        setItems([]);
      }
    },
    []
  );

  useEffect(() => {
    loadAuctions();
  }, [loadAuctions]);

  useEffect(() => {
    if (selectedAuction) {
      loadItems(selectedAuction.id);
    } else {
      setItems([]);
    }
  }, [selectedAuction?.id, loadItems]);

  const handleSelectAuction = (auction: JMAuction) => {
    setSelectedAuction(auction);
    setExpandedAuctionId(auction.id);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !selectedAuction) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);
    try {
      await Promise.all(
        reordered.map((item, idx) => updateAuctionItem(item.id, { order: idx }))
      );
    } catch {
      loadItems(selectedAuction.id);
    }
  };

  return (
    <div className="space-y-8">
      {/* Auctions list + Add */}
      <div
        className="rounded-xl p-6"
        style={{ backgroundColor: theme.surfaces.elevated1, border: `1px solid ${theme.surfaces.elevated2}` }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold" style={{ color: theme.text.primary }}>
            Auctions
          </h2>
          <button
            onClick={() => {
              setEditingAuction(null);
              setShowAuctionModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium"
            style={{ backgroundColor: theme.accents.goldenGlow, color: theme.surfaces.base }}
          >
            <Plus className="h-4 w-4" />
            Add Auction
          </button>
        </div>

        {error && (
          <div
            className="flex items-center gap-2 rounded-lg p-3 mb-4"
            style={{ backgroundColor: `${theme.semantic.error}20`, color: theme.semantic.error }}
          >
            {error}
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: theme.accents.goldenGlow }} />
          </div>
        ) : auctions.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-16"
            style={{ borderColor: theme.surfaces.elevated2, color: theme.text.tertiary }}
          >
            <Calendar className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No auctions yet</p>
            <p className="text-sm mb-4">Create an auction to add artwork</p>
            <button
              onClick={() => setShowAuctionModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg"
              style={{ backgroundColor: theme.accents.goldenGlow, color: theme.surfaces.base }}
            >
              <Plus className="h-4 w-4" />
              Add Auction
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {auctions.map((auction) => (
              <div
                key={auction.id}
                className="rounded-lg overflow-hidden"
                style={{
                  backgroundColor: theme.surfaces.elevated2,
                  border: `1px solid ${
                    selectedAuction?.id === auction.id ? theme.accents.goldenGlow : theme.surfaces.elevated3
                  }`,
                }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectAuction(auction)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectAuction(auction);
                    }
                  }}
                  className="w-full flex items-center justify-between px-4 py-4 text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <ChevronDown
                      className={`h-5 w-5 transition-transform ${expandedAuctionId === auction.id ? "rotate-0" : "-rotate-90"}`}
                      style={{ color: theme.text.tertiary }}
                    />
                    <span className="font-medium" style={{ color: theme.text.primary }}>
                      {auction.name}
                    </span>
                    <span className="text-sm" style={{ color: theme.text.tertiary }}>
                      /{auction.slug}
                    </span>
                    {auction.isActive && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${theme.semantic.success}30`, color: theme.semantic.success }}
                      >
                        Active
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingAuction(auction);
                        setShowAuctionModal(true);
                      }}
                      className="p-2 rounded-lg hover:bg-white/5"
                      style={{ color: theme.text.secondary }}
                      title="Edit auction"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm(`Delete auction "${auction.name}"? This will delete all its items.`))
                          return;
                        try {
                          await deleteAuction(auction.id);
                          if (selectedAuction?.id === auction.id) setSelectedAuction(null);
                          setAuctions((prev) => prev.filter((a) => a.id !== auction.id));
                        } catch {
                          setError("Failed to delete auction");
                        }
                      }}
                      className="p-2 rounded-lg hover:bg-red-500/10"
                      style={{ color: theme.semantic.error }}
                      title="Delete auction"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {expandedAuctionId === auction.id && (
                  <div className="border-t px-4 py-4" style={{ borderColor: theme.surfaces.elevated3 }}>
                    {/* Auction settings inline */}
                    <div className="mb-4 flex flex-wrap gap-4 items-center text-sm" style={{ color: theme.text.tertiary }}>
                      <span>End: {auction.endDate?.toDate?.()?.toLocaleString() ?? "—"}</span>
                    </div>

                    {/* Items for this auction */}
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base font-medium" style={{ color: theme.text.primary }}>
                        Items
                      </h3>
                      <button
                        onClick={() => {
                          setSelectedAuction(auction);
                          setEditingItem(null);
                          setShowItemModal(true);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm"
                        style={{ backgroundColor: theme.accents.goldenGlow, color: theme.surfaces.base }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Item
                      </button>
                    </div>

                    {items.length === 0 ? (
                      <div
                        className="rounded-lg border-2 border-dashed py-8 text-center text-sm"
                        style={{ borderColor: theme.surfaces.elevated3, color: theme.text.tertiary }}
                      >
                        No items. Add artwork above.
                      </div>
                    ) : (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={items.map((i) => i.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-1">
                            {items.map((item) => (
                              <SortableAuctionItem
                                key={item.id}
                                item={item}
                                onEdit={() => {
                                  setEditingItem(item);
                                  setShowItemModal(true);
                                }}
                                onDelete={async () => {
                                  if (!confirm(`Delete "${item.title}"?`)) return;
                                  try {
                                    await deleteAuctionItem(item.id);
                                    setItems((prev) => prev.filter((i) => i.id !== item.id));
                                  } catch {
                                    setError("Failed to delete item");
                                  }
                                }}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showAuctionModal && (
        <AuctionModal
          auction={editingAuction}
          onClose={() => {
            setShowAuctionModal(false);
            setEditingAuction(null);
            loadAuctions();
          }}
        />
      )}

      {showItemModal && selectedAuction && (
        <AuctionItemModal
          auctionId={selectedAuction.id}
          item={editingItem}
          onClose={() => {
            setShowItemModal(false);
            setEditingItem(null);
            loadItems(selectedAuction.id);
          }}
        />
      )}
    </div>
  );
}

function AuctionModal({
  auction,
  onClose,
}: {
  auction: JMAuction | null;
  onClose: () => void;
}) {
  const { theme } = useJMStyle();
  const tempIdRef = useRef(auction?.id ?? `new-${Date.now()}`);
  const [name, setName] = useState(auction?.name ?? "");
  const [slug, setSlug] = useState(auction?.slug ?? "");
  const [description, setDescription] = useState(auction?.description ?? "");
  const [bannerURL, setBannerURL] = useState(auction?.bannerURL ?? "");
  const [rowBannerURL, setRowBannerURL] = useState(auction?.rowBannerURL ?? "");
  const [pitchVideoURL, setPitchVideoURL] = useState(auction?.pitchVideoURL ?? "");
  const [endDate, setEndDate] = useState(
    auction?.endDate?.toDate?.() ? auction.endDate.toDate().toISOString().slice(0, 16) : ""
  );
  const [isActive, setIsActive] = useState(auction?.isActive ?? false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBannerUpload = useCallback(async (file: File) => {
    return uploadAuctionImage(file, auction?.id ?? tempIdRef.current, "banner");
  }, [auction?.id]);

  const handleRowBannerUpload = useCallback(async (file: File) => {
    return uploadAuctionImage(file, auction?.id ?? tempIdRef.current, "rowBanner");
  }, [auction?.id]);

  const handleSave = async () => {
    if (!name.trim() || !slug.trim()) {
      setError("Name and slug are required");
      return;
    }
    if (!endDate) {
      setError("End date is required");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const timestamp = (await import("firebase/firestore")).Timestamp.fromDate(new Date(endDate));
      const base = { name: name.trim(), slug: slug.trim(), endDate: timestamp, isActive };
      if (auction) {
        const updates: Parameters<typeof updateAuction>[1] = { ...base };
        if (description.trim()) updates.description = description.trim();
        if (bannerURL) updates.bannerURL = bannerURL;
        if (rowBannerURL) updates.rowBannerURL = rowBannerURL;
        if (pitchVideoURL.trim()) updates.pitchVideoURL = pitchVideoURL.trim();
        await updateAuction(auction.id, updates);
      } else {
        const input: Parameters<typeof createAuction>[0] = { ...base };
        if (description.trim()) input.description = description.trim();
        if (bannerURL) input.bannerURL = bannerURL;
        if (rowBannerURL) input.rowBannerURL = rowBannerURL;
        if (pitchVideoURL.trim()) input.pitchVideoURL = pitchVideoURL.trim();
        await createAuction(input);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-xl p-6"
        style={{ backgroundColor: theme.surfaces.elevated1 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold" style={{ color: theme.text.primary }}>
            {auction ? "Edit Auction" : "Create Auction"}
          </h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10" style={{ color: theme.text.tertiary }}>
            <X className="h-5 w-5" />
          </button>
        </div>
        {error && (
          <div className="mb-4 rounded-lg p-3" style={{ backgroundColor: `${theme.semantic.error}20`, color: theme.semantic.error }}>
            {error}
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.text.secondary }}>Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Spring 2025 Art Auction"
              className="w-full rounded-lg px-4 py-2"
              style={{ backgroundColor: theme.surfaces.elevated2, color: theme.text.primary, border: `1px solid ${theme.surfaces.elevated3}` }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.text.secondary }}>Description (for featured carousel)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description shown on the featured carousel card"
              rows={2}
              className="w-full rounded-lg px-4 py-2 resize-none"
              style={{ backgroundColor: theme.surfaces.elevated2, color: theme.text.primary, border: `1px solid ${theme.surfaces.elevated3}` }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.text.secondary }}>Pitch Video (Vimeo URL)</label>
            <input
              type="url"
              value={pitchVideoURL}
              onChange={(e) => setPitchVideoURL(e.target.value)}
              placeholder="https://vimeo.com/123456789"
              className="w-full rounded-lg px-4 py-2"
              style={{ backgroundColor: theme.surfaces.elevated2, color: theme.text.primary, border: `1px solid ${theme.surfaces.elevated3}` }}
            />
            <p className="text-xs mt-1" style={{ color: theme.text.tertiary }}>Video that tells the story of the auction</p>
          </div>
          <div>
            <JMImageUpload
              label="Banner (16:9) - for featured carousel"
              value={bannerURL}
              onChange={(url) => setBannerURL(url ?? "")}
              onUpload={handleBannerUpload}
              aspectRatio="landscape"
            />
          </div>
          <div>
            <JMImageUpload
              label="Row Banner (2:1, 1500×750px) - for feature row on home"
              value={rowBannerURL}
              onChange={(url) => setRowBannerURL(url ?? "")}
              onUpload={handleRowBannerUpload}
              aspectRatio="wide"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.text.secondary }}>Slug (URL) *</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              placeholder="spring-2025"
              className="w-full rounded-lg px-4 py-2"
              style={{ backgroundColor: theme.surfaces.elevated2, color: theme.text.primary, border: `1px solid ${theme.surfaces.elevated3}` }}
            />
            <p className="text-xs mt-1" style={{ color: theme.text.tertiary }}>/auction/{slug || "slug"}</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.text.secondary }}>End Date & Time *</label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg px-4 py-2"
              style={{ backgroundColor: theme.surfaces.elevated2, color: theme.text.primary, border: `1px solid ${theme.surfaces.elevated3}` }}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span style={{ color: theme.text.secondary }}>Visible to users</span>
          </label>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg" style={{ backgroundColor: theme.surfaces.elevated2, color: theme.text.primary }}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={isSaving || !name.trim() || !slug.trim() || !endDate}
            className="px-4 py-2 rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
            style={{ backgroundColor: theme.accents.goldenGlow, color: theme.surfaces.base }}
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {auction ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface AuctionItemModalProps {
  auctionId: string;
  item: JMAuctionItem | null;
  onClose: () => void;
}

function AuctionItemModal({ auctionId, item, onClose }: AuctionItemModalProps) {
  const { theme } = useJMStyle();
  const tempIdRef = useRef(`new-${Date.now()}`);

  const [title, setTitle] = useState(item?.title ?? "");
  const [subtitle, setSubtitle] = useState(item?.subtitle ?? "");
  const [thumbnailURL, setThumbnailURL] = useState(item?.thumbnailURL ?? "");
  const [detailImageURL, setDetailImageURL] = useState(item?.detailImageURL ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [videoURL, setVideoURL] = useState(item?.videoURL ?? "");
  const [videoOrientation, setVideoOrientation] = useState<JMAuctionVideoOrientation>(
    item?.videoOrientation ?? "landscape"
  );
  const [videoStoryURL, setVideoStoryURL] = useState(item?.videoStoryURL ?? "");
  const [videoStoryOrientation, setVideoStoryOrientation] = useState<JMAuctionVideoOrientation>(
    item?.videoStoryOrientation ?? "landscape"
  );
  const [minimumBid, setMinimumBid] = useState(item ? String(item.minimumBid) : "");
  const [dimensions, setDimensions] = useState(item?.dimensions ?? "");
  const [media, setMedia] = useState(item?.media ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleThumbnailUpload = useCallback(async (file: File) => {
    return uploadAuctionImage(file, item?.id ?? tempIdRef.current, "thumbnail");
  }, [item?.id]);

  const handleDetailUpload = useCallback(async (file: File) => {
    return uploadAuctionImage(file, item?.id ?? tempIdRef.current, "detail");
  }, [item?.id]);

  const handleSave = async () => {
    const minBid = parseFloat(minimumBid);
    if (!title.trim() || !thumbnailURL || !detailImageURL || isNaN(minBid) || minBid < 0) {
      setError("Title, thumbnail, detail image, and minimum bid are required");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      if (item) {
        const updates: Parameters<typeof updateAuctionItem>[1] = {
          title: title.trim(),
          subtitle: subtitle.trim(),
          thumbnailURL,
          detailImageURL,
          description: description.trim(),
          videoOrientation,
          videoStoryOrientation,
          minimumBid: minBid,
          dimensions: dimensions.trim(),
          media: media.trim(),
        };
        if (videoURL.trim()) updates.videoURL = videoURL.trim();
        if (videoStoryURL.trim()) updates.videoStoryURL = videoStoryURL.trim();
        await updateAuctionItem(item.id, updates);
      } else {
        const input: Parameters<typeof createAuctionItem>[0] = {
          auctionId,
          title: title.trim(),
          subtitle: subtitle.trim(),
          thumbnailURL,
          detailImageURL,
          description: description.trim(),
          videoOrientation,
          videoStoryOrientation,
          minimumBid: minBid,
          dimensions: dimensions.trim(),
          media: media.trim(),
          order: 999,
        };
        if (videoURL.trim()) input.videoURL = videoURL.trim();
        if (videoStoryURL.trim()) input.videoStoryURL = videoStoryURL.trim();
        await createAuctionItem(input);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className="relative w-full max-w-2xl rounded-xl p-6 max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: theme.surfaces.elevated1 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold" style={{ color: theme.text.primary }}>
            {item ? "Edit Auction Item" : "Add Auction Item"}
          </h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10" style={{ color: theme.text.tertiary }}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg p-3" style={{ backgroundColor: `${theme.semantic.error}20`, color: theme.semantic.error }}>
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.text.secondary }}>Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg px-4 py-2"
              style={{ backgroundColor: theme.surfaces.elevated2, color: theme.text.primary, border: `1px solid ${theme.surfaces.elevated3}` }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.text.secondary }}>Subtitle</label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="w-full rounded-lg px-4 py-2"
              style={{ backgroundColor: theme.surfaces.elevated2, color: theme.text.primary, border: `1px solid ${theme.surfaces.elevated3}` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <JMImageUpload
              label="Thumbnail (square) *"
              value={thumbnailURL}
              onChange={(url) => setThumbnailURL(url ?? "")}
              onUpload={handleThumbnailUpload}
              aspectRatio="square"
              required
            />
            <JMImageUpload
              label="Detail Image (hi-res) *"
              value={detailImageURL}
              onChange={(url) => setDetailImageURL(url ?? "")}
              onUpload={handleDetailUpload}
              aspectRatio="square"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.text.secondary }}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg px-4 py-2 resize-none"
              style={{ backgroundColor: theme.surfaces.elevated2, color: theme.text.primary, border: `1px solid ${theme.surfaces.elevated3}` }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.text.secondary }}>Video Preview URL</label>
            <input
              type="url"
              value={videoURL}
              onChange={(e) => setVideoURL(e.target.value)}
              placeholder="https://vimeo.com/..."
              className="w-full rounded-lg px-4 py-2"
              style={{ backgroundColor: theme.surfaces.elevated2, color: theme.text.primary, border: `1px solid ${theme.surfaces.elevated3}` }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.text.secondary }}>Video Preview Orientation</label>
            <select
              value={videoOrientation}
              onChange={(e) => setVideoOrientation(e.target.value as JMAuctionVideoOrientation)}
              className="w-full rounded-lg px-4 py-2"
              style={{ backgroundColor: theme.surfaces.elevated2, color: theme.text.primary, border: `1px solid ${theme.surfaces.elevated3}` }}
            >
              {(Object.keys(JMAuctionVideoOrientationLabels) as JMAuctionVideoOrientation[]).map((k) => (
                <option key={k} value={k}>{JMAuctionVideoOrientationLabels[k]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.text.secondary }}>Video Story URL (Art Story)</label>
            <input
              type="url"
              value={videoStoryURL}
              onChange={(e) => setVideoStoryURL(e.target.value)}
              placeholder="https://vimeo.com/..."
              className="w-full rounded-lg px-4 py-2"
              style={{ backgroundColor: theme.surfaces.elevated2, color: theme.text.primary, border: `1px solid ${theme.surfaces.elevated3}` }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.text.secondary }}>Video Story Orientation</label>
            <select
              value={videoStoryOrientation}
              onChange={(e) => setVideoStoryOrientation(e.target.value as JMAuctionVideoOrientation)}
              className="w-full rounded-lg px-4 py-2"
              style={{ backgroundColor: theme.surfaces.elevated2, color: theme.text.primary, border: `1px solid ${theme.surfaces.elevated3}` }}
            >
              {(Object.keys(JMAuctionVideoOrientationLabels) as JMAuctionVideoOrientation[]).map((k) => (
                <option key={k} value={k}>{JMAuctionVideoOrientationLabels[k]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.text.secondary }}>Minimum Bid ($) *</label>
            <input
              type="number"
              min={0}
              step={1}
              value={minimumBid}
              onChange={(e) => setMinimumBid(e.target.value)}
              className="w-full rounded-lg px-4 py-2"
              style={{ backgroundColor: theme.surfaces.elevated2, color: theme.text.primary, border: `1px solid ${theme.surfaces.elevated3}` }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.text.secondary }}>Dimensions</label>
            <input
              type="text"
              value={dimensions}
              onChange={(e) => setDimensions(e.target.value)}
              placeholder='e.g. 24" x 36"'
              className="w-full rounded-lg px-4 py-2"
              style={{ backgroundColor: theme.surfaces.elevated2, color: theme.text.primary, border: `1px solid ${theme.surfaces.elevated3}` }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: theme.text.secondary }}>Media</label>
            <input
              type="text"
              value={media}
              onChange={(e) => setMedia(e.target.value)}
              placeholder="e.g. Acrylic on canvas"
              className="w-full rounded-lg px-4 py-2"
              style={{ backgroundColor: theme.surfaces.elevated2, color: theme.text.primary, border: `1px solid ${theme.surfaces.elevated3}` }}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg" style={{ backgroundColor: theme.surfaces.elevated2, color: theme.text.primary }}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={isSaving || !title.trim() || !thumbnailURL || !detailImageURL}
            className="px-4 py-2 rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
            style={{ backgroundColor: theme.accents.goldenGlow, color: theme.surfaces.base }}
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {item ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
