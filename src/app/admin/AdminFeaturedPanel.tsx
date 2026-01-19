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
  type JMFeaturedItem,
  type JMFeaturedInput,
} from "@/lib/content";
import type { JMContentType } from "@/lib/content-types";
import { 
  Plus, Trash2, GripVertical, Eye, EyeOff, 
  ChevronDown, Loader2, AlertCircle, X,
  Film, BookOpen, Gamepad2, CreditCard
} from "lucide-react";

interface ContentOption {
  id: string;
  name: string;
  backdropURL?: string;
  description?: string;
  contentType: JMContentType;
}

const CONTENT_TYPE_ICONS: Record<JMContentType, typeof Film> = {
  show: Film,
  story: BookOpen,
  game: Gamepad2,
  card: CreditCard,
};

export function AdminFeaturedPanel() {
  const { theme } = useJMStyle();
  const { user } = useAuth();
  
  // Featured items state
  const [featuredItems, setFeaturedItems] = useState<JMFeaturedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Add/Edit modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Content selection
  const [availableContent, setAvailableContent] = useState<ContentOption[]>([]);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [selectedContentType, setSelectedContentType] = useState<JMContentType>("show");
  
  // Drag and drop
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Load featured items
  const loadFeatured = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const items = await getAllFeaturedItems();
      setFeaturedItems(items);
    } catch (err) {
      console.error("Failed to load featured items:", err);
      setError("Failed to load featured items");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeatured();
  }, [loadFeatured]);

  // Load available content when opening add modal
  const loadAvailableContent = useCallback(async (contentType: JMContentType) => {
    setIsLoadingContent(true);
    try {
      // Get top-level content (series, movies, etc.) - published only
      const content = await getTopLevelContent(contentType, true);
      
      const options: ContentOption[] = content.map((c) => {
        const option: ContentOption = {
          id: c.id,
          name: c.name,
          contentType: c.contentType,
        };
        if (c.backdropURL) option.backdropURL = c.backdropURL;
        if (c.description) option.description = c.description;
        return option;
      });
      
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
            Manage the carousel on the home page. Drag to reorder.
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

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0"
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
                  onChange={(e) => setSelectedContentType(e.target.value as JMContentType)}
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
                  No published {selectedContentType}s available
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
