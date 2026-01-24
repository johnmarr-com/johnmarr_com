"use client";

import { useState, useEffect } from "react";
import { Plus, Film, Tv, ChevronRight, GripVertical } from "lucide-react";
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
import { getTopLevelContent, getContentCounts, updateContent } from "@/lib/content";
import type { JMContent } from "@/lib/content-types";
import { ShowCreateModal } from "./ShowCreateModal";
import { ShowDetailModal } from "./ShowDetailModal";

interface SortableShowItemProps {
  show: JMContent;
  onClick: () => void;
}

function SortableShowItem({ show, onClick }: SortableShowItemProps) {
  const { theme } = useJMStyle();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: show.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center hover:bg-white/5 transition-colors"
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

      {/* Content - clickable */}
      <button
        onClick={onClick}
        className="flex-1 pr-8 py-4 flex items-center gap-4 text-left"
      >
        {/* Cover thumbnail - 2:1 aspect ratio */}
        <div
          className="w-24 h-12 rounded-lg bg-cover bg-center shrink-0"
          style={{
            backgroundImage: show.coverURL ? `url(${show.coverURL})` : undefined,
            backgroundColor: show.coverURL ? undefined : theme.surfaces.elevated2,
          }}
        >
          {!show.coverURL && (
            <div className="w-full h-full flex items-center justify-center">
              {show.contentLevel === "standalone" ? (
                <Film size={20} style={{ color: theme.text.tertiary }} />
              ) : (
                <Tv size={20} style={{ color: theme.text.tertiary }} />
              )}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="font-medium truncate"
              style={{ color: theme.text.primary }}
            >
              {show.name}
            </span>
            {!show.isPublished && (
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
          <div
            className="text-sm truncate mt-0.5"
            style={{ color: theme.text.tertiary }}
          >
            {show.description || "No description"}
          </div>
        </div>

        {/* Type badge + chevron */}
        <div className="flex items-center gap-3 shrink-0">
          <div
            className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full"
            style={{
              backgroundColor:
                show.contentLevel === "standalone"
                  ? `${theme.accents.neonPink}20`
                  : `${theme.accents.goldenGlow}20`,
              color:
                show.contentLevel === "standalone"
                  ? theme.accents.neonPink
                  : theme.accents.goldenGlow,
            }}
          >
            {show.contentLevel === "standalone" ? (
              <>
                <Film size={12} />
                Movie
              </>
            ) : (
              <>
                <Tv size={12} />
                Series
              </>
            )}
          </div>
          <ChevronRight size={16} style={{ color: theme.text.tertiary }} />
        </div>
      </button>
    </div>
  );
}

/**
 * AdminShowsPanel - Show management panel for admin dashboard
 *
 * Features:
 * - Total show count (series + movies)
 * - Create new series or movie
 * - List all shows with type indicator
 * - Drag to reorder shows
 * - Click to manage (seasons/episodes for series)
 */
type ShowFilter = "all" | "series" | "standalone";

export function AdminShowsPanel() {
  const { theme } = useJMStyle();
  useAuth(); // Ensure user is authenticated
  const [shows, setShows] = useState<JMContent[]>([]);
  const [showCount, setShowCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [filter, setFilter] = useState<ShowFilter>("all");

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedShowId, setSelectedShowId] = useState<string | null>(null);
  
  // Filter shows based on selection
  const filteredShows = shows.filter((show) => {
    if (filter === "all") return true;
    if (filter === "series") return show.contentLevel === "series";
    if (filter === "standalone") return show.contentLevel === "standalone";
    return true;
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch shows on mount
  const fetchShows = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [showsList, counts] = await Promise.all([
        getTopLevelContent("show", false), // Include unpublished for admin
        getContentCounts(),
      ]);

      setShows(showsList);
      setShowCount(counts.shows);
    } catch (err) {
      console.error("Failed to fetch shows:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch shows");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchShows();
  }, []);

  const handleShowCreated = () => {
    fetchShows();
    setIsCreateModalOpen(false);
  };

  const handleShowUpdated = () => {
    fetchShows();
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    // Work with filtered shows for the reorder
    const oldIndex = filteredShows.findIndex((show) => show.id === active.id);
    const newIndex = filteredShows.findIndex((show) => show.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;

    // Reorder the filtered list
    const newFilteredShows = arrayMove(filteredShows, oldIndex, newIndex);
    
    // Build a new full shows list preserving the order of filtered items
    // Non-filtered items stay in their original position
    const filteredIds = new Set(filteredShows.map(s => s.id));
    const nonFilteredShows = shows.filter(s => !filteredIds.has(s.id));
    const newShows = [...newFilteredShows, ...nonFilteredShows];
    
    // Optimistically update UI
    setShows(newShows);

    // Save the new order to the database (only for the filtered items)
    setIsSavingOrder(true);
    try {
      await Promise.all(
        newFilteredShows.map((show, index) =>
          updateContent(show.id, { order: index })
        )
      );
    } catch (err) {
      console.error("Failed to save order:", err);
      // Revert on error
      fetchShows();
    } finally {
      setIsSavingOrder(false);
    }
  };

  return (
    <div className="mt-6 space-y-4">
      {/* Toolbar */}
      <div
        className="rounded-2xl border backdrop-blur-md"
        style={{
          backgroundColor: `${theme.surfaces.base}ee`,
          borderColor: theme.surfaces.elevated2,
        }}
      >
        <div className="px-8 py-5 flex items-center justify-between gap-4">
          {/* Left: Total count + saving indicator */}
          <div className="flex items-center gap-3">
            <div
              className="text-sm font-medium whitespace-nowrap"
              style={{ color: theme.text.secondary }}
            >
              Total:{" "}
              <span style={{ color: theme.text.primary }}>
                {showCount === null ? "..." : showCount}
              </span>
            </div>
            {isSavingOrder && (
              <div
                className="text-xs px-2 py-1 rounded-full"
                style={{
                  backgroundColor: `${theme.accents.goldenGlow}20`,
                  color: theme.accents.goldenGlow,
                }}
              >
                Saving...
              </div>
            )}
          </div>

          {/* Center: Segment filter */}
          <div
            className="flex rounded-lg overflow-hidden border"
            style={{ borderColor: theme.surfaces.elevated2 }}
          >
            {(["all", "series", "standalone"] as ShowFilter[]).map((option) => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className="px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: filter === option ? theme.accents.goldenGlow : "transparent",
                  color: filter === option ? theme.surfaces.base : theme.text.secondary,
                }}
              >
                {option === "all" ? "All" : option === "series" ? "Series" : "Specials"}
              </button>
            ))}
          </div>

          {/* Right: Create button */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all hover:scale-105"
            style={{
              backgroundColor: theme.accents.goldenGlow,
              color: theme.surfaces.base,
            }}
          >
            <Plus size={18} />
            New Show
          </button>
        </div>
      </div>

      {/* Shows list */}
      <div
        className="rounded-2xl border backdrop-blur-md overflow-hidden"
        style={{
          backgroundColor: `${theme.surfaces.base}ee`,
          borderColor: theme.surfaces.elevated2,
        }}
      >
        {isLoading ? (
          <div className="px-8 py-12 text-center">
            <div
              className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
              style={{
                borderColor: theme.accents.goldenGlow,
                borderTopColor: "transparent",
              }}
            />
          </div>
        ) : error ? (
          <div
            className="px-8 py-12 text-center text-sm"
            style={{ color: theme.semantic.error }}
          >
            {error}
          </div>
        ) : filteredShows.length === 0 ? (
          <div className="px-8 py-12 text-center">
            <div
              className="text-sm mb-2"
              style={{ color: theme.text.tertiary }}
            >
              {shows.length === 0
                ? "No shows yet"
                : `No ${filter === "series" ? "series" : "specials"} found`}
            </div>
            {shows.length === 0 && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="text-sm font-medium transition-colors hover:underline"
                style={{ color: theme.accents.goldenGlow }}
              >
                Create your first show →
              </button>
            )}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredShows.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div
                className="divide-y"
                style={{ borderColor: theme.surfaces.elevated2 }}
              >
                {filteredShows.map((show) => (
                  <SortableShowItem
                    key={show.id}
                    show={show}
                    onClick={() => setSelectedShowId(show.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Drag hint */}
      {filteredShows.length > 1 && !isLoading && (
        <div
          className="text-center text-xs"
          style={{ color: theme.text.tertiary }}
        >
          Drag to reorder {filter === "all" ? "shows" : filter === "series" ? "series" : "specials"}
        </div>
      )}

      {/* Create modal */}
      {isCreateModalOpen && (
        <ShowCreateModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={handleShowCreated}
        />
      )}

      {/* Detail/edit modal */}
      {selectedShowId && (
        <ShowDetailModal
          showId={selectedShowId}
          onClose={() => setSelectedShowId(null)}
          onUpdated={handleShowUpdated}
        />
      )}
    </div>
  );
}
