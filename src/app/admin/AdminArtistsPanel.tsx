"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Plus, Trash2, Eye, EyeOff, Loader2, Music, User } from "lucide-react";
import { useJMStyle } from "@/JMStyle";
import {
  getAllArtists,
  deleteArtist,
  updateArtist,
  getAlbumsByArtist,
  getMusicVideosByArtist,
} from "@/lib/content";
import type { JMArtist } from "@/lib/content-types";
import { ArtistDetailModal } from "./ArtistDetailModal";

interface ArtistWithCounts extends JMArtist {
  albumCount: number;
  videoCount: number;
}

export function AdminArtistsPanel() {
  const { theme } = useJMStyle();
  const [artists, setArtists] = useState<ArtistWithCounts[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal state
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadArtists = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedArtists = await getAllArtists(false); // Include drafts
      
      // Fetch counts for each artist
      const artistsWithCounts = await Promise.all(
        fetchedArtists.map(async (artist) => {
          const albums = await getAlbumsByArtist(artist.id, false);
          const videos = await getMusicVideosByArtist(artist.id, false);
          return {
            ...artist,
            albumCount: albums.length,
            videoCount: videos.length,
          };
        })
      );
      
      setArtists(artistsWithCounts);
    } catch (err) {
      console.error("Failed to load artists:", err);
      setError("Failed to load artists. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadArtists();
  }, [loadArtists]);

  const handleTogglePublish = async (artist: JMArtist) => {
    try {
      await updateArtist(artist.id, { isPublished: !artist.isPublished });
      await loadArtists();
    } catch (err) {
      console.error("Failed to toggle publish:", err);
      setError("Failed to update artist status.");
    }
  };

  const handleDelete = async (artist: JMArtist) => {
    if (!confirm(`Are you sure you want to delete "${artist.name}"? This will also delete all albums, songs, and music videos. This cannot be undone.`)) {
      return;
    }

    try {
      await deleteArtist(artist.id);
      await loadArtists();
    } catch (err) {
      console.error("Failed to delete artist:", err);
      setError("Failed to delete artist.");
    }
  };

  const handleArtistClick = (artistId: string) => {
    setSelectedArtistId(artistId);
  };

  const handleModalClose = () => {
    setSelectedArtistId(null);
    setShowCreateModal(false);
  };

  const handleCreated = () => {
    loadArtists();
    setShowCreateModal(false);
  };

  const handleUpdated = () => {
    loadArtists();
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
        <div>
          <h2
            className="text-lg font-semibold"
            style={{ color: theme.text.primary }}
          >
            AI Artists
          </h2>
          <p className="text-sm mt-1" style={{ color: theme.text.tertiary }}>
            {isLoading ? "Loading..." : `${artists.length} artist${artists.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
          style={{
            backgroundColor: theme.accents.goldenGlow,
            color: theme.surfaces.base,
          }}
        >
          <Plus size={18} />
          <span className="font-medium">New Artist</span>
        </button>
      </div>

      {/* Content */}
      <div className="p-8">
        {error && (
          <div
            className="mb-4 p-3 rounded-lg text-sm"
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              color: "#EF4444",
            }}
          >
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2
              className="h-8 w-8 animate-spin"
              style={{ color: theme.accents.goldenGlow }}
            />
          </div>
        ) : artists.length === 0 ? (
          <div
            className="text-center py-12"
            style={{ color: theme.text.tertiary }}
          >
            <Music size={48} className="mx-auto mb-4 opacity-50" />
            <p>No AI artists yet. Create your first artist to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {artists.map((artist) => (
              <div
                key={artist.id}
                className="rounded-lg border overflow-hidden cursor-pointer transition-transform hover:scale-[1.02]"
                style={{
                  backgroundColor: theme.surfaces.elevated1,
                  borderColor: theme.surfaces.elevated2,
                }}
                onClick={() => handleArtistClick(artist.id)}
              >
                {/* Avatar */}
                <div
                  className="aspect-square relative flex items-center justify-center"
                  style={{ backgroundColor: theme.surfaces.elevated2 }}
                >
                  {artist.avatarURL ? (
                    <Image
                      src={artist.avatarURL}
                      alt={artist.name}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  ) : (
                    <User
                      size={48}
                      style={{ color: theme.text.tertiary }}
                    />
                  )}
                  
                  {/* Draft badge */}
                  {!artist.isPublished && (
                    <div 
                      className="absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium"
                      style={{ 
                        backgroundColor: "rgba(0,0,0,0.7)",
                        color: theme.text.tertiary,
                      }}
                    >
                      Draft
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3
                    className="font-semibold truncate"
                    style={{ color: theme.text.primary }}
                  >
                    {artist.name}
                  </h3>
                  <p
                    className="text-xs mt-1 font-mono"
                    style={{ color: theme.text.tertiary }}
                  >
                    /{artist.slug}
                  </p>
                  
                  {/* Stats */}
                  <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: theme.text.secondary }}>
                    <span>{artist.albumCount} album{artist.albumCount !== 1 ? "s" : ""}</span>
                    <span>{artist.videoCount} video{artist.videoCount !== 1 ? "s" : ""}</span>
                  </div>

                  {/* Actions */}
                  <div 
                    className="flex items-center gap-2 mt-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleTogglePublish(artist)}
                      className="p-2 rounded-lg transition-colors hover:bg-white/10"
                      title={artist.isPublished ? "Unpublish" : "Publish"}
                    >
                      {artist.isPublished ? (
                        <Eye size={18} style={{ color: theme.accents.goldenGlow }} />
                      ) : (
                        <EyeOff size={18} style={{ color: theme.text.tertiary }} />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(artist)}
                      className="p-2 rounded-lg transition-colors hover:bg-red-500/20"
                      title="Delete"
                    >
                      <Trash2 size={18} style={{ color: "#EF4444" }} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail/Edit Modal */}
      {selectedArtistId && (
        <ArtistDetailModal
          artistId={selectedArtistId}
          onClose={handleModalClose}
          onUpdated={handleUpdated}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <ArtistDetailModal
          artistId={null}
          onClose={handleModalClose}
          onCreated={handleCreated}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
