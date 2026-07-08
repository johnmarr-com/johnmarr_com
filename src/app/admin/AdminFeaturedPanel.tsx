"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useJMStyle } from "@/JMStyle";
import { useAuth } from "@/lib/AuthProvider";
import { 
  getAllFeaturedItems,
  createFeaturedItem,
  updateFeaturedItem,
  deleteFeaturedItem,
  reorderFeaturedItems,
  getTopLevelContent,
  getAllArtists,
  uploadFeaturedBackdrop,
  type JMFeaturedItem,
  type JMFeaturedInput,
} from "@/lib/content";
import { JMImageUpload } from "@/JMKit";
import type { JMFeaturedContentType } from "@/lib/content";
import { getAllAuctions } from "@/lib/auction";
import {
  listCarousels,
  createCarousel,
  renameCarousel,
  deleteCarousel,
  setCarouselDotColor,
} from "@/lib/featured-carousels";
import type { JMFeaturedCarousel } from "@/lib/content-types";
import { ButtonStylePicker } from "@/components/ButtonStylePicker";
import { 
  Plus, Trash2, GripVertical, Eye, EyeOff, Pencil,
  ChevronDown, Loader2, AlertCircle, X,
  Film, BookOpen, Gamepad2, CreditCard, Music, Gavel
} from "lucide-react";

interface ContentOption {
  id: string;
  name: string;
  backdropURL?: string;
  description?: string;
  contentType: JMFeaturedContentType;
  slug?: string; // For artists, auctions - used for navigation
}

const CONTENT_TYPE_ICONS: Record<JMFeaturedContentType, typeof Film> = {
  show: Film,
  story: BookOpen,
  game: Gamepad2,
  card: CreditCard,
  artist: Music,
  auction: Gavel,
};

export function AdminFeaturedPanel() {
  const { theme } = useJMStyle();
  const { user } = useAuth();
  
  // Carousels: "" = the Home (default) carousel; a named carousel otherwise.
  const [carousels, setCarousels] = useState<JMFeaturedCarousel[]>([]);
  const [carouselId, setCarouselId] = useState("");

  // Featured items state
  const [featuredItems, setFeaturedItems] = useState<JMFeaturedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit modal state
  const [editingItem, setEditingItem] = useState<JMFeaturedItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSubtitle, setEditSubtitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editBackdropURL, setEditBackdropURL] = useState("");
  const [editCtaStyleId, setEditCtaStyleId] = useState("");
  
  // Content selection
  const [availableContent, setAvailableContent] = useState<ContentOption[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [selectedContentType, setSelectedContentType] = useState<JMFeaturedContentType>("show");
  
  // Drag and drop
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Load featured items
  const loadFeatured = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const items = await getAllFeaturedItems(carouselId);
      setFeaturedItems(items);
    } catch (err) {
      console.error("Failed to load featured items:", err);
      setError("Failed to load featured items");
    } finally {
      setIsLoading(false);
    }
  }, [carouselId]);

  useEffect(() => {
    loadFeatured();
  }, [loadFeatured]);

  // Load the named carousels for the selector.
  useEffect(() => {
    listCarousels().then(setCarousels).catch(() => {});
  }, []);

  const refreshCarousels = async () => setCarousels(await listCarousels());

  const handleNewCarousel = async () => {
    if (!user) return;
    const name = window.prompt("New carousel name:");
    if (!name?.trim()) return;
    const c = await createCarousel({ name: name.trim() }, user.uid);
    await refreshCarousels();
    setCarouselId(c.id);
  };

  const handleRenameCarousel = async () => {
    const c = carousels.find((x) => x.id === carouselId);
    if (!c) return;
    const name = window.prompt("Rename carousel:", c.name);
    if (!name?.trim()) return;
    await renameCarousel(c.id, name.trim());
    await refreshCarousels();
  };

  const handleDotColor = async (color: string) => {
    if (!carouselId) return;
    await setCarouselDotColor(carouselId, color);
    await refreshCarousels();
  };

  const handleDeleteCarousel = async () => {
    const c = carousels.find((x) => x.id === carouselId);
    if (!c) return;
    if (
      !window.confirm(
        `Delete carousel "${c.name}"? Its items keep their data but become unassigned.`,
      )
    ) {
      return;
    }
    await deleteCarousel(c.id);
    await refreshCarousels();
    setCarouselId("");
  };

  // Load available content when opening add modal
  const loadAvailableContent = useCallback(async (contentType: JMFeaturedContentType) => {
    setIsLoadingContent(true);
    try {
      let options: ContentOption[];
      
      if (contentType === "artist") {
        // Fetch artists - published only, need banner for featured carousel
        const artists = await getAllArtists(true);
        options = artists
          .filter((a): a is typeof a & { bannerURL: string } => !!a.bannerURL) // Only artists with banners can be featured
          .map((a) => {
            const option: ContentOption = {
              id: a.id,
              name: a.name,
              contentType: "artist",
              backdropURL: a.bannerURL,
              slug: a.slug,
            };
            if (a.description) option.description = a.description;
            return option;
          });
      } else if (contentType === "auction") {
        // Fetch active auctions with banner - can be featured
        const auctions = await getAllAuctions(true);
        options = auctions
          .filter((a): a is typeof a & { bannerURL: string } => !!a.bannerURL) // Only auctions with banners can be featured
          .map((a) => {
            const option: ContentOption = {
              id: a.id,
              name: a.name,
              contentType: "auction",
              backdropURL: a.bannerURL,
              slug: a.slug,
            };
            if (a.description) option.description = a.description;
            return option;
          });
      } else {
        // Get top-level content (series, movies, etc.) - published only
        const content = await getTopLevelContent(contentType, true);
        
        options = content.map((c) => {
          const option: ContentOption = {
            id: c.id,
            name: c.name,
            contentType: c.contentType,
          };
          if (c.backdropURL) option.backdropURL = c.backdropURL;
          if (c.description) option.description = c.description;
          return option;
        });
      }
      
      setAvailableContent(options);
    } catch (err) {
      console.error("Failed to load content:", err);
    } finally {
      setIsLoadingContent(false);
    }
  }, []);

  useEffect(() => {
    if (showAddModal) {
      loadAvailableContent(selectedContentType);
    }
  }, [showAddModal, selectedContentType, loadAvailableContent]);

  // Add featured item
  const handleAddFeatured = async (contentOption: ContentOption) => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      const input: JMFeaturedInput = {
        contentId: contentOption.id,
        title: contentOption.name,
        backdropURL: contentOption.backdropURL || "",
        contentType: contentOption.contentType,
        order: featuredItems.length,
        isActive: true,
      };
      // Only add description if it exists
      if (contentOption.description) {
        input.description = contentOption.description;
      }
      // Add slug for artists (used for navigation)
      if (contentOption.slug) {
        input.slug = contentOption.slug;
      }
      // Assign to the selected carousel ("" ⇒ Home default).
      if (carouselId) {
        input.carouselId = carouselId;
      }

      await createFeaturedItem(input, user.uid);
      await loadFeatured();
      setShowAddModal(false);
    } catch (err) {
      console.error("Failed to add featured item:", err);
      setError("Failed to add featured item");
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle active status
  const handleToggleActive = async (item: JMFeaturedItem) => {
    try {
      await updateFeaturedItem(item.id, { isActive: !item.isActive });
      setFeaturedItems(prev => 
        prev.map(i => i.id === item.id ? { ...i, isActive: !i.isActive } : i)
      );
    } catch (err) {
      console.error("Failed to toggle status:", err);
      setError("Failed to update item");
    }
  };

  // Delete featured item
  const handleDelete = async (item: JMFeaturedItem) => {
    if (!confirm(`Remove "${item.title}" from featured?`)) return;
    
    try {
      await deleteFeaturedItem(item.id);
      setFeaturedItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err) {
      console.error("Failed to delete:", err);
      setError("Failed to delete item");
    }
  };

  // Edit featured item
  const startEdit = (item: JMFeaturedItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditSubtitle(item.subtitle || "");
    setEditDescription(item.description || "");
    setEditBackdropURL(item.backdropURL);
    setEditCtaStyleId(item.ctaButtonStyleId || "");
  };

  const handleBackdropUpload = async (file: File): Promise<string> => {
    if (!editingItem) throw new Error("No item being edited");
    const url = await uploadFeaturedBackdrop(file, editingItem.id);
    setEditBackdropURL(url);
    return url;
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    setIsSaving(true);
    try {
      const updates: Record<string, string> = {
        title: editTitle,
        backdropURL: editBackdropURL,
        ctaButtonStyleId: editCtaStyleId,
      };
      if (editSubtitle) updates["subtitle"] = editSubtitle;
      if (editDescription) updates["description"] = editDescription;
      await updateFeaturedItem(editingItem.id, updates);
      await loadFeatured();
      setEditingItem(null);
    } catch (err) {
      console.error("Failed to update featured item:", err);
      setError("Failed to update featured item");
    } finally {
      setIsSaving(false);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragEnd = async () => {
    if (draggedIndex === null || dragOverIndex === null || draggedIndex === dragOverIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newItems = [...featuredItems];
    const [movedItem] = newItems.splice(draggedIndex, 1);
    if (movedItem) {
      newItems.splice(dragOverIndex, 0, movedItem);
    }
    
    setFeaturedItems(newItems);
    setDraggedIndex(null);
    setDragOverIndex(null);

    // Save new order
    try {
      await reorderFeaturedItems(newItems.map(i => i.id));
    } catch (err) {
      console.error("Failed to save order:", err);
      setError("Failed to save order");
      loadFeatured(); // Reload original order
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 
            className="text-2xl font-semibold"
            style={{ color: theme.text.primary }}
          >
            Featured Content
          </h2>
          <p style={{ color: theme.text.tertiary }} className="text-sm mt-1">
            Manage feature carousels. Home (default) is the home-page banner;
            named carousels can be assigned to pages. Drag to reorder.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-lg px-4 py-2 font-medium transition-colors"
          style={{
            backgroundColor: theme.accents.goldenGlow,
            color: theme.surfaces.base,
          }}
        >
          <Plus className="h-4 w-4" />
          Add Featured
        </button>
      </div>

      {/* Carousel selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm" style={{ color: theme.text.secondary }}>
          Carousel:
        </span>
        <select
          value={carouselId}
          onChange={(e) => setCarouselId(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
          style={{
            borderColor: theme.surfaces.elevated2,
            backgroundColor: theme.surfaces.elevated1,
            color: theme.text.primary,
          }}
        >
          <option value="">Home (default)</option>
          {carousels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          onClick={handleNewCarousel}
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: theme.surfaces.elevated2, color: theme.text.secondary }}
        >
          + New
        </button>
        {carouselId && (
          <>
            <button
              onClick={handleRenameCarousel}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: theme.surfaces.elevated2, color: theme.text.secondary }}
            >
              Rename
            </button>
            <button
              onClick={handleDeleteCarousel}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: theme.surfaces.elevated2, color: theme.semantic.error }}
            >
              Delete
            </button>
            <label
              className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm"
              style={{ borderColor: theme.surfaces.elevated2, color: theme.text.secondary }}
            >
              Dots
              <input
                type="color"
                value={
                  carousels.find((c) => c.id === carouselId)?.dotColor ??
                  theme.accents.neonPink
                }
                onChange={(e) => handleDotColor(e.target.value)}
                className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0"
                aria-label="Carousel pagination dot color"
              />
            </label>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div 
          className="flex items-center gap-2 rounded-lg p-3"
          style={{ backgroundColor: `${theme.semantic.error}20`, color: theme.semantic.error }}
        >
          <AlertCircle className="h-4 w-4" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: theme.accents.goldenGlow }} />
        </div>
      ) : featuredItems.length === 0 ? (
        /* Empty state */
        <div 
          className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-16"
          style={{ borderColor: theme.surfaces.elevated2, color: theme.text.tertiary }}
        >
          <Film className="h-12 w-12 mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">No featured content yet</p>
          <p className="text-sm">Add content to display in the home page carousel</p>
        </div>
      ) : (
        /* Featured items list */
        <div className="space-y-2">
          {featuredItems.map((item, index) => {
            const Icon = CONTENT_TYPE_ICONS[item.contentType];
            const isDragging = draggedIndex === index;
            const isDragOver = dragOverIndex === index;
            
            return (
              <div
                key={item.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className="flex items-center gap-4 rounded-lg p-3 transition-all"
                style={{
                  backgroundColor: isDragOver 
                    ? `${theme.accents.goldenGlow}20` 
                    : theme.surfaces.elevated1,
                  opacity: isDragging ? 0.5 : 1,
                  transform: isDragOver ? "scale(1.02)" : "scale(1)",
                  border: `1px solid ${isDragOver ? theme.accents.goldenGlow : theme.surfaces.elevated2}`,
                }}
              >
                {/* Drag handle */}
                <div 
                  className="cursor-grab p-1"
                  style={{ color: theme.text.tertiary }}
                >
                  <GripVertical className="h-5 w-5" />
                </div>

                {/* Thumbnail */}
                <div 
                  className="relative h-16 w-28 shrink-0 rounded-md overflow-hidden"
                  style={{ backgroundColor: theme.surfaces.elevated2 }}
                >
                  {item.backdropURL ? (
                    <Image 
                      src={item.backdropURL} 
                      alt={item.title}
                      fill
                      sizes="300px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Icon className="h-6 w-6" style={{ color: theme.text.tertiary }} />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 
                      className="font-medium truncate"
                      style={{ color: theme.text.primary }}
                    >
                      {item.title}
                    </h3>
                    <span 
                      className="rounded-full px-2 py-0.5 text-xs uppercase"
                      style={{ 
                        backgroundColor: `${theme.accents.goldenGlow}20`,
                        color: theme.accents.goldenGlow,
                      }}
                    >
                      {item.contentType}
                    </span>
                  </div>
                  {item.description && (
                    <p 
                      className="text-sm truncate mt-1"
                      style={{ color: theme.text.tertiary }}
                    >
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Order number */}
                <div 
                  className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                  style={{ 
                    backgroundColor: theme.surfaces.elevated2,
                    color: theme.text.secondary,
                  }}
                >
                  {index + 1}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleActive(item)}
                    className="p-2 rounded-lg transition-colors hover:bg-white/5"
                    title={item.isActive ? "Hide from carousel" : "Show in carousel"}
                    style={{ color: item.isActive ? theme.semantic.success : theme.text.tertiary }}
                  >
                    {item.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => startEdit(item)}
                    className="p-2 rounded-lg transition-colors hover:bg-white/5"
                    title="Edit"
                    style={{ color: theme.text.tertiary }}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    className="p-2 rounded-lg transition-colors hover:bg-red-500/10"
                    style={{ color: theme.semantic.error }}
                    title="Remove from featured"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 backdrop-blur-sm"
            style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
            onClick={() => setEditingItem(null)}
          />
          <div
            className="relative w-full max-w-lg rounded-xl p-6 max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: theme.surfaces.elevated1 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3
                className="text-xl font-semibold"
                style={{ color: theme.text.primary }}
              >
                Edit Featured Item
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1 rounded-lg hover:bg-white/10"
                style={{ color: theme.text.tertiary }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: theme.text.secondary }}>
                  Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-lg px-3 py-2"
                  style={{
                    backgroundColor: theme.surfaces.elevated2,
                    color: theme.text.primary,
                    border: `1px solid ${theme.surfaces.elevated3}`,
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: theme.text.secondary }}>
                  Subtitle
                </label>
                <input
                  type="text"
                  value={editSubtitle}
                  onChange={(e) => setEditSubtitle(e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-lg px-3 py-2"
                  style={{
                    backgroundColor: theme.surfaces.elevated2,
                    color: theme.text.primary,
                    border: `1px solid ${theme.surfaces.elevated3}`,
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: theme.text.secondary }}>
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Optional"
                  rows={3}
                  className="w-full rounded-lg px-3 py-2 resize-none"
                  style={{
                    backgroundColor: theme.surfaces.elevated2,
                    color: theme.text.primary,
                    border: `1px solid ${theme.surfaces.elevated3}`,
                  }}
                />
              </div>

              <JMImageUpload
                label="Backdrop Image (16:9)"
                value={editBackdropURL}
                onChange={(url) => setEditBackdropURL(url || "")}
                onUpload={handleBackdropUpload}
                aspectRatio="landscape"
                previewSize={300}
                maxWidth={1920}
              />

              {/* CTA button style — same picker as the ScrollyFox editor */}
              <ButtonStylePicker
                value={editCtaStyleId}
                onChange={setEditCtaStyleId}
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ color: theme.text.secondary }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving || !editTitle.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                style={{
                  backgroundColor: theme.accents.goldenGlow,
                  color: theme.surfaces.base,
                }}
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 backdrop-blur-sm"
            style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
            onClick={() => setShowAddModal(false)}
          />
          <div
            className="relative w-full max-w-lg rounded-xl p-6 max-h-[80vh] overflow-hidden flex flex-col"
            style={{ backgroundColor: theme.surfaces.elevated1 }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between mb-4">
              <h3 
                className="text-xl font-semibold"
                style={{ color: theme.text.primary }}
              >
                Add to Featured
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg hover:bg-white/10"
                style={{ color: theme.text.tertiary }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content type selector */}
            <div className="mb-4">
              <label 
                className="block text-sm font-medium mb-2"
                style={{ color: theme.text.secondary }}
              >
                Content Type
              </label>
              <div className="relative">
                <select
                  value={selectedContentType}
                  onChange={(e) => setSelectedContentType(e.target.value as JMFeaturedContentType)}
                  className="w-full appearance-none rounded-lg px-4 py-2.5 pr-10"
                  style={{
                    backgroundColor: theme.surfaces.elevated2,
                    color: theme.text.primary,
                    border: `1px solid ${theme.surfaces.elevated3}`,
                  }}
                >
                  <option value="show">Shows</option>
                  <option value="story">Stories</option>
                  <option value="game">Games</option>
                  <option value="card">Cards</option>
                  <option value="artist">AI Artists</option>
                  <option value="auction">Auctions</option>
                </select>
                <ChevronDown 
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                  style={{ color: theme.text.tertiary }}
                />
              </div>
            </div>

            {/* Content list */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {isLoadingContent ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" style={{ color: theme.accents.goldenGlow }} />
                </div>
              ) : availableContent.length === 0 ? (
                <div 
                  className="text-center py-8"
                  style={{ color: theme.text.tertiary }}
                >
                  No {selectedContentType === "auction" ? "active" : "published"} {selectedContentType}s available
                </div>
              ) : (
                availableContent.map(content => {
                  const alreadyFeatured = featuredItems.some(f => f.contentId === content.id);
                  const Icon = CONTENT_TYPE_ICONS[content.contentType];
                  
                  return (
                    <button
                      key={content.id}
                      onClick={() => !alreadyFeatured && handleAddFeatured(content)}
                      disabled={alreadyFeatured || isSaving}
                      className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors"
                      style={{
                        backgroundColor: alreadyFeatured 
                          ? `${theme.surfaces.elevated2}50` 
                          : theme.surfaces.elevated2,
                        opacity: alreadyFeatured ? 0.5 : 1,
                        cursor: alreadyFeatured ? "not-allowed" : "pointer",
                      }}
                    >
                      {/* Thumbnail */}
                      <div 
                        className="relative h-12 w-20 shrink-0 rounded overflow-hidden"
                        style={{ backgroundColor: theme.surfaces.base }}
                      >
                        {content.backdropURL ? (
                          <Image 
                            src={content.backdropURL}
                            alt={content.name}
                            fill
                            sizes="200px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <Icon className="h-4 w-4" style={{ color: theme.text.tertiary }} />
                          </div>
                        )}
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p 
                          className="font-medium truncate"
                          style={{ color: theme.text.primary }}
                        >
                          {content.name}
                        </p>
                        {content.description && (
                          <p 
                            className="text-sm truncate"
                            style={{ color: theme.text.tertiary }}
                          >
                            {content.description}
                          </p>
                        )}
                      </div>

                      {alreadyFeatured && (
                        <span 
                          className="text-xs px-2 py-1 rounded-full"
                          style={{ 
                            backgroundColor: `${theme.accents.goldenGlow}20`,
                            color: theme.accents.goldenGlow,
                          }}
                        >
                          Featured
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
