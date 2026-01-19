"use client";

import { useState, useEffect } from "react";
import { Plus, Film, Tv, ChevronRight } from "lucide-react";
import { useJMStyle } from "@/JMStyle";
import { useAuth } from "@/lib/AuthProvider";
import { getTopLevelContent, getContentCounts } from "@/lib/content";
import type { JMContent } from "@/lib/content-types";
import { ShowCreateModal } from "./ShowCreateModal";
import { ShowDetailModal } from "./ShowDetailModal";

/**
 * AdminShowsPanel - Show management panel for admin dashboard
 * 
 * Features:
 * - Total show count (series + movies)
 * - Create new series or movie
 * - List all shows with type indicator
 * - Click to manage (seasons/episodes for series)
 */
export function AdminShowsPanel() {
  const { theme } = useJMStyle();
  useAuth(); // Ensure user is authenticated
  const [shows, setShows] = useState<JMContent[]>([]);
  const [showCount, setShowCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedShowId, setSelectedShowId] = useState<string | null>(null);

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
        <div className="px-8 py-5 flex items-center justify-between gap-6">
          {/* Left: Total count */}
          <div 
            className="text-sm font-medium whitespace-nowrap"
            style={{ color: theme.text.secondary }}
          >
            Total shows:{" "}
            <span style={{ color: theme.text.primary }}>
              {showCount === null ? "..." : showCount}
            </span>
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
        className="rounded-2xl border backdrop-blur-md"
        style={{ 
          backgroundColor: `${theme.surfaces.base}ee`,
          borderColor: theme.surfaces.elevated2,
        }}
      >
        {isLoading ? (
          <div className="px-8 py-12 text-center">
            <div 
              className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: theme.accents.goldenGlow, borderTopColor: 'transparent' }}
            />
          </div>
        ) : error ? (
          <div 
            className="px-8 py-12 text-center text-sm"
            style={{ color: theme.semantic.error }}
          >
            {error}
          </div>
        ) : shows.length === 0 ? (
          <div className="px-8 py-12 text-center">
            <div 
              className="text-sm mb-2"
              style={{ color: theme.text.tertiary }}
            >
              No shows yet
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="text-sm font-medium transition-colors hover:underline"
              style={{ color: theme.accents.goldenGlow }}
            >
              Create your first show →
            </button>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: theme.surfaces.elevated2 }}>
            {shows.map((show) => (
              <button
                key={show.id}
                onClick={() => setSelectedShowId(show.id)}
                className="w-full px-8 py-4 flex items-center gap-4 hover:bg-white/5 transition-colors text-left"
              >
                {/* Cover thumbnail */}
                <div 
                  className="w-16 h-16 rounded-lg bg-cover bg-center shrink-0"
                  style={{ 
                    backgroundImage: show.coverURL ? `url(${show.coverURL})` : undefined,
                    backgroundColor: show.coverURL ? undefined : theme.surfaces.elevated2,
                  }}
                >
                  {!show.coverURL && (
                    <div className="w-full h-full flex items-center justify-center">
                      {show.contentLevel === "standalone" ? (
                        <Film size={24} style={{ color: theme.text.tertiary }} />
                      ) : (
                        <Tv size={24} style={{ color: theme.text.tertiary }} />
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
                      backgroundColor: show.contentLevel === "standalone" 
                        ? `${theme.accents.neonPink}20` 
                        : `${theme.accents.goldenGlow}20`,
                      color: show.contentLevel === "standalone" 
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
                  <ChevronRight 
                    size={16} 
                    style={{ color: theme.text.tertiary }}
                  />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

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
