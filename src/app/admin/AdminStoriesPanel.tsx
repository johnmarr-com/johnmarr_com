"use client";

import { useState, useEffect } from "react";
import { Plus, BookOpen, ChevronRight, GripVertical } from "lucide-react";
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
import { getAllStories } from "@/lib/stories";
import type { JMStory } from "@/lib/content-types";
import { StoryCreateModal } from "./StoryCreateModal";
import { StoryDetailModal } from "./StoryDetailModal";

interface SortableStoryItemProps {
  story: JMStory;
  onClick: () => void;
}

function SortableStoryItem({ story, onClick }: SortableStoryItemProps) {
  const { theme } = useJMStyle();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: story.id });

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
      <div
        {...attributes}
        {...listeners}
        className="px-4 py-4 cursor-grab active:cursor-grabbing touch-none"
        style={{ color: theme.text.tertiary }}
      >
        <GripVertical size={18} />
      </div>

      <button
        onClick={onClick}
        className="flex-1 pr-8 py-4 flex items-center gap-4 text-left"
      >
        <div
          className="w-12 h-16 bg-cover bg-center shrink-0"
          style={{
            backgroundImage: story.coverImageURL ? `url(${story.coverImageURL})` : undefined,
            backgroundColor: story.coverImageURL ? undefined : theme.surfaces.elevated2,
          }}
        >
          {!story.coverImageURL && (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen size={14} style={{ color: theme.text.tertiary }} />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate" style={{ color: theme.text.primary }}>
              {story.title}
            </span>
            {!story.isPublished && (
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
          <div className="flex items-center gap-2 text-sm truncate mt-0.5" style={{ color: theme.text.tertiary }}>
            <span>{story.author}</span>
            <span>&middot;</span>
            {story.epubURL ? (
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ backgroundColor: "rgba(34,197,94,0.15)", color: "rgb(34,197,94)" }}
              >
                EPUB
              </span>
            ) : (
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ backgroundColor: "rgba(239,68,68,0.15)", color: "rgb(239,68,68)" }}
              >
                No EPUB
              </span>
            )}
          </div>
        </div>

        <ChevronRight size={16} style={{ color: theme.text.tertiary }} />
      </button>
    </div>
  );
}

export function AdminStoriesPanel() {
  const { theme } = useJMStyle();
  useAuth();
  const [stories, setStories] = useState<JMStory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchStories = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await getAllStories(false);
      setStories(list);
    } catch (err) {
      console.error("Failed to fetch stories:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch stories");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStories();
  }, []);

  const handleStoryCreated = () => {
    fetchStories();
    setIsCreateModalOpen(false);
  };

  const handleStoryUpdated = () => {
    fetchStories();
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = stories.findIndex((s) => s.id === active.id);
    const newIndex = stories.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newStories = arrayMove(stories, oldIndex, newIndex);
    setStories(newStories);

    setIsSavingOrder(true);
    try {
      await Promise.all(
        newStories.map(() => Promise.resolve())
      );
    } catch (err) {
      console.error("Failed to save order:", err);
      fetchStories();
    } finally {
      setIsSavingOrder(false);
    }
  };

  return (
    <div className="mt-6 space-y-4">
      <div
        className="rounded-2xl border backdrop-blur-md"
        style={{
          backgroundColor: `${theme.surfaces.base}ee`,
          borderColor: theme.surfaces.elevated2,
        }}
      >
        <div className="px-8 py-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="text-sm font-medium whitespace-nowrap" style={{ color: theme.text.secondary }}>
              Total:{" "}
              <span style={{ color: theme.text.primary }}>
                {isLoading ? "..." : stories.length}
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

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all hover:scale-105"
            style={{
              backgroundColor: theme.accents.goldenGlow,
              color: theme.surfaces.base,
            }}
          >
            <Plus size={18} />
            New Story
          </button>
        </div>
      </div>

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
              style={{ borderColor: theme.accents.goldenGlow, borderTopColor: "transparent" }}
            />
          </div>
        ) : error ? (
          <div className="px-8 py-12 text-center text-sm" style={{ color: theme.semantic.error }}>
            {error}
          </div>
        ) : stories.length === 0 ? (
          <div className="px-8 py-12 text-center">
            <div className="text-sm mb-2" style={{ color: theme.text.tertiary }}>
              No stories yet
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="text-sm font-medium transition-colors hover:underline"
              style={{ color: theme.accents.goldenGlow }}
            >
              Create your first story →
            </button>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={stories.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="divide-y" style={{ borderColor: theme.surfaces.elevated2 }}>
                {stories.map((story) => (
                  <SortableStoryItem
                    key={story.id}
                    story={story}
                    onClick={() => setSelectedStoryId(story.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {isCreateModalOpen && (
        <StoryCreateModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={handleStoryCreated}
        />
      )}

      {selectedStoryId && (
        <StoryDetailModal
          storyId={selectedStoryId}
          onClose={() => setSelectedStoryId(null)}
          onUpdated={handleStoryUpdated}
        />
      )}
    </div>
  );
}
