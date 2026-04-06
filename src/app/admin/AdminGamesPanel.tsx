"use client";

import { useState, useEffect } from "react";
import { Plus, Gamepad2, GripVertical, ChevronRight } from "lucide-react";
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
import { GameCreateModal } from "./GameCreateModal";
import { GameEditModal } from "./GameEditModal";

interface SortableGameItemProps {
  game: JMContent;
  onClick: () => void;
}

function SortableGameItem({ game, onClick }: SortableGameItemProps) {
  const { theme } = useJMStyle();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: game.id });

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
      className="flex items-center transition-colors hover:bg-white/5"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none px-4 py-4 active:cursor-grabbing"
        style={{ color: theme.text.tertiary }}
      >
        <GripVertical size={18} />
      </div>

      <button
        onClick={onClick}
        className="flex flex-1 items-center gap-4 py-4 pr-8 text-left"
      >
        <div
          className="h-12 w-12 shrink-0 rounded-lg bg-cover bg-center"
          style={{
            backgroundImage: game.coverURL ? `url(${game.coverURL})` : undefined,
            backgroundColor: game.coverURL ? undefined : theme.surfaces.elevated2,
          }}
        >
          {!game.coverURL && (
            <div className="flex h-full w-full items-center justify-center">
              <Gamepad2 size={20} style={{ color: theme.text.tertiary }} />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="truncate font-medium"
              style={{ color: theme.text.primary }}
            >
              {game.name}
            </span>
            {!game.isPublished && (
              <span
                className="rounded-full px-2 py-0.5 text-xs"
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
            className="mt-0.5 truncate text-sm"
            style={{ color: theme.text.tertiary }}
          >
            {game.slug ? `/games/${game.slug}` : "No URL set"}
          </div>
        </div>

        <ChevronRight size={16} className="shrink-0" style={{ color: theme.text.tertiary }} />
      </button>
    </div>
  );
}

export function AdminGamesPanel() {
  const { theme } = useJMStyle();
  useAuth();
  const [games, setGames] = useState<JMContent[]>([]);
  const [gameCount, setGameCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const fetchGames = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [gamesList, counts] = await Promise.all([
        getTopLevelContent("game", false),
        getContentCounts(),
      ]);
      setGames(gamesList);
      setGameCount(counts.games);
    } catch (err) {
      console.error("Failed to fetch games:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch games");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
  }, []);

  const handleGameCreated = () => {
    fetchGames();
    setIsCreateModalOpen(false);
  };

  const handleGameUpdated = () => {
    fetchGames();
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = games.findIndex((g) => g.id === active.id);
    const newIndex = games.findIndex((g) => g.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newGames = arrayMove(games, oldIndex, newIndex);
    setGames(newGames);

    setIsSavingOrder(true);
    try {
      await Promise.all(
        newGames.map((game, index) => updateContent(game.id, { order: index })),
      );
    } catch (err) {
      console.error("Failed to save order:", err);
      fetchGames();
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
        <div className="flex items-center justify-between gap-4 px-8 py-5">
          <div className="flex items-center gap-3">
            <div
              className="whitespace-nowrap text-sm font-medium"
              style={{ color: theme.text.secondary }}
            >
              Total:{" "}
              <span style={{ color: theme.text.primary }}>
                {gameCount === null ? "..." : gameCount}
              </span>
            </div>
            {isSavingOrder && (
              <div
                className="rounded-full px-2 py-1 text-xs"
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
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all hover:scale-105"
            style={{
              backgroundColor: theme.accents.goldenGlow,
              color: theme.surfaces.base,
            }}
          >
            <Plus size={18} />
            New Game
          </button>
        </div>
      </div>

      {/* Games list */}
      <div
        className="overflow-hidden rounded-2xl border backdrop-blur-md"
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
        ) : games.length === 0 ? (
          <div className="px-8 py-12 text-center">
            <div className="mb-2 text-sm" style={{ color: theme.text.tertiary }}>
              No games yet
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="text-sm font-medium transition-colors hover:underline"
              style={{ color: theme.accents.goldenGlow }}
            >
              Create your first game →
            </button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={games.map((g) => g.id)}
              strategy={verticalListSortingStrategy}
            >
              <div
                className="divide-y"
                style={{ borderColor: theme.surfaces.elevated2 }}
              >
                {games.map((game) => (
                  <SortableGameItem
                    key={game.id}
                    game={game}
                    onClick={() => setSelectedGameId(game.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {games.length > 1 && !isLoading && (
        <div className="text-center text-xs" style={{ color: theme.text.tertiary }}>
          Drag to reorder games
        </div>
      )}

      {isCreateModalOpen && (
        <GameCreateModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={handleGameCreated}
        />
      )}

      {selectedGameId && (
        <GameEditModal
          gameId={selectedGameId}
          onClose={() => setSelectedGameId(null)}
          onUpdated={handleGameUpdated}
        />
      )}
    </div>
  );
}
