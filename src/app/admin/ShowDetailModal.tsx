"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  X, Save, Trash2, Plus, ChevronRight, ChevronDown, 
  Film, Tv, Play, Check, Loader2, ArrowLeft,
  Layers, Video, Pencil, Eye, EyeOff
} from "lucide-react";
import { useJMStyle } from "@/JMStyle";
import { JMImageUpload } from "@/JMKit";
import { useAuth } from "@/lib/AuthProvider";
import {
  getContentWithChildren,
  updateContent,
  deleteContent,
  createContent,
  uploadContentImage,
} from "@/lib/content";
import type {
  JMContent,
  JMContentWithChildren,
} from "@/lib/content-types";

interface ShowDetailModalProps {
  showId: string;
  onClose: () => void;
  onUpdated: () => void;
}

type View = "main" | "add-season" | "add-episode" | "edit-season" | "edit-episode";

interface EditState {
  name: string;
  description: string;
  coverURL: string;
  backdropURL: string;
  mediaURL: string;
  duration: number;
  seasonNumber: number;
  episodeNumber: number;
  isPublished: boolean;
}

/**
 * ShowDetailModal - Manage a show's details and content hierarchy
 * 
 * For Series: View/add/edit seasons and episodes
 * For Movies: Edit details and media
 */
export function ShowDetailModal({ showId, onClose, onUpdated }: ShowDetailModalProps) {
  const { theme } = useJMStyle();
  const { user } = useAuth();
  
  // Data state
  const [show, setShow] = useState<JMContentWithChildren | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Edit state for the main show
  const [editState, setEditState] = useState<EditState | null>(null);
  const [originalState, setOriginalState] = useState<EditState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  
  // Navigation state
  const [view, setView] = useState<View>("main");
  const [expandedSeasons, setExpandedSeasons] = useState<Set<string>>(new Set());
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  
  // Add form state
  const [addForm, setAddForm] = useState({
    name: "",
    description: "",
    coverURL: "",
    mediaURL: "",
    seasonNumber: 1,
    episodeNumber: 1,
    duration: 0,
    releaseDate: "",  // ISO date string for date input
  });
  const [isAdding, setIsAdding] = useState(false);
  
  // Edit episode state
  const [editEpisode, setEditEpisode] = useState<{
    id: string;
    name: string;
    episodeNumber: number;
    mediaURL: string;
    releaseDate: string;
    coverURL: string;
  } | null>(null);
  const [isEditingSaving, setIsEditingSaving] = useState(false);
  
  // Pending cover file for new episodes (uploaded after creation)
  const [pendingEpisodeCover, setPendingEpisodeCover] = useState<File | null>(null);
  const [pendingCoverPreview, setPendingCoverPreview] = useState<string | null>(null);
  
  // Image upload handlers
  const handleShowCoverUpload = useCallback(async (file: File) => {
    return uploadContentImage(file, showId, "cover");
  }, [showId]);

  const handleShowBackdropUpload = useCallback(async (file: File) => {
    return uploadContentImage(file, showId, "backdrop");
  }, [showId]);

  // Handle pending cover for new episodes (stores file until episode is created)
  const handlePendingEpisodeCover = useCallback((file: File): Promise<string> => {
    return new Promise((resolve) => {
      setPendingEpisodeCover(file);
      // Create local preview URL
      const previewUrl = URL.createObjectURL(file);
      setPendingCoverPreview(previewUrl);
      resolve(previewUrl);
    });
  }, []);

  // Upload cover for existing episode
  const handleEpisodeCoverUpload = useCallback(async (file: File, episodeId: string) => {
    return uploadContentImage(file, episodeId, "cover");
  }, []);

  // Fetch show data
  const fetchShow = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await getContentWithChildren(showId, false);
      if (data) {
        setShow(data);
        const state: EditState = {
          name: data.name,
          description: data.description,
          coverURL: data.coverURL || "",
          backdropURL: data.backdropURL || "",
          mediaURL: data.mediaURL || "",
          duration: data.duration || 0,
          seasonNumber: data.seasonNumber || 1,
          episodeNumber: data.episodeNumber || 1,
          isPublished: data.isPublished,
        };
        setEditState(state);
        setOriginalState(state);
      }
    } catch (err) {
      console.error("Failed to fetch show:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch show");
    } finally {
      setIsLoading(false);
    }
  }, [showId]);

  useEffect(() => {
    fetchShow();
  }, [fetchShow]);

  // Check for unsaved changes
  const hasChanges = editState && originalState && 
    JSON.stringify(editState) !== JSON.stringify(originalState);

  // Save show changes
  const handleSave = async () => {
    if (!editState || !hasChanges) return;
    
    setIsSaving(true);
    try {
      // Build update object, omitting undefined values (Firestore doesn't accept them)
      const updates: Record<string, unknown> = {
        name: editState.name,
        description: editState.description,
        coverURL: editState.coverURL,
        isPublished: editState.isPublished,
      };
      if (editState.backdropURL) updates["backdropURL"] = editState.backdropURL;
      if (editState.mediaURL) updates["mediaURL"] = editState.mediaURL;
      if (editState.duration) updates["duration"] = editState.duration;
      
      await updateContent(showId, updates);
      
      setOriginalState(editState);
      onUpdated();
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 2500);
    } catch (err) {
      console.error("Failed to save:", err);
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete show
  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this show? This will also delete all seasons and episodes.")) {
      return;
    }
    
    try {
      await deleteContent(showId);
      onUpdated();
      onClose();
    } catch (err) {
      console.error("Failed to delete:", err);
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  // Toggle season expansion
  const toggleSeason = (seasonId: string) => {
    setExpandedSeasons(prev => {
      const next = new Set(prev);
      if (next.has(seasonId)) {
        next.delete(seasonId);
      } else {
        next.add(seasonId);
      }
      return next;
    });
  };

  // Start adding season
  const startAddSeason = () => {
    const existingSeasons = show?.children?.filter(c => c.contentLevel === "season") || [];
    const nextNumber = existingSeasons.length + 1;
    setAddForm({
      name: `Season ${nextNumber}`,
      description: "",
      coverURL: "",
      mediaURL: "",
      seasonNumber: nextNumber,
      episodeNumber: 1,
      duration: 0,
      releaseDate: "",
    });
    setView("add-season");
  };

  // Start adding episode
  const startAddEpisode = (parentId: string) => {
    const parent = parentId === showId 
      ? show 
      : show?.children?.find(c => c.id === parentId);
    
    const existingEpisodes = parent?.children?.filter(c => c.contentLevel === "episode") || [];
    const nextNumber = existingEpisodes.length + 1;
    
    setSelectedParentId(parentId);
    setAddForm({
      name: `Episode ${nextNumber}`,
      description: "",
      coverURL: "",
      mediaURL: "",
      seasonNumber: 1,
      episodeNumber: nextNumber,
      duration: 0,
      releaseDate: "",
    });
    setView("add-episode");
  };

  // Create season
  const handleCreateSeason = async () => {
    if (!user || !addForm.name.trim()) return;
    
    setIsAdding(true);
    try {
      await createContent({
        contentType: "show",
        contentLevel: "season",
        name: addForm.name.trim(),
        description: addForm.description.trim(),
        coverURL: addForm.coverURL.trim(),
        parentId: showId,
        seasonNumber: addForm.seasonNumber,
        order: addForm.seasonNumber,
      }, user.uid);
      
      await fetchShow();
      onUpdated();
      setView("main");
    } catch (err) {
      console.error("Failed to create season:", err);
      setError(err instanceof Error ? err.message : "Failed to create season");
    } finally {
      setIsAdding(false);
    }
  };

  // Create episode
  const handleCreateEpisode = async () => {
    if (!user || !selectedParentId || !addForm.name.trim()) return;
    
    setIsAdding(true);
    try {
      // Build episode input, conditionally adding releaseDate
      const input: Parameters<typeof createContent>[0] = {
        contentType: "show",
        contentLevel: "episode",
        name: addForm.name.trim(),
        description: "",
        coverURL: "",  // Will be updated if there's a pending cover
        mediaURL: addForm.mediaURL.trim(),  // Vimeo URL
        parentId: selectedParentId,
        episodeNumber: addForm.episodeNumber,
        order: addForm.episodeNumber,
      };
      
      // Add releaseDate only if provided
      if (addForm.releaseDate) {
        const { Timestamp } = await import("firebase/firestore");
        input.releaseDate = Timestamp.fromDate(new Date(addForm.releaseDate));
      }

      const newEpisode = await createContent(input, user.uid);
      
      // If there's a pending cover, upload it now
      if (pendingEpisodeCover && newEpisode?.id) {
        const coverURL = await uploadContentImage(pendingEpisodeCover, newEpisode.id, "cover");
        await updateContent(newEpisode.id, { coverURL });
      }
      
      // Clean up pending cover state
      if (pendingCoverPreview) {
        URL.revokeObjectURL(pendingCoverPreview);
      }
      setPendingEpisodeCover(null);
      setPendingCoverPreview(null);
      
      await fetchShow();
      onUpdated();
      setView("main");
      // Expand the parent season
      if (selectedParentId !== showId) {
        setExpandedSeasons(prev => new Set([...prev, selectedParentId]));
      }
    } catch (err) {
      console.error("Failed to create episode:", err);
      setError(err instanceof Error ? err.message : "Failed to create episode");
    } finally {
      setIsAdding(false);
    }
  };

  // Start editing an episode
  const startEditEpisode = (episode: JMContent) => {
    // Convert Firestore Timestamp to date string for input
    let releaseDateStr = "";
    if (episode.releaseDate) {
      const date = episode.releaseDate.toDate();
      const parts = date.toISOString().split("T");
      releaseDateStr = parts[0] ?? "";
    }
    
    setEditEpisode({
      id: episode.id,
      name: episode.name,
      episodeNumber: episode.episodeNumber || 1,
      mediaURL: episode.mediaURL || "",
      releaseDate: releaseDateStr,
      coverURL: episode.coverURL || "",
    });
    setView("edit-episode");
  };

  // Save edited episode
  const handleSaveEpisode = async () => {
    if (!editEpisode || !editEpisode.name.trim()) return;
    
    setIsEditingSaving(true);
    try {
      // Build update object, omitting undefined values (Firestore doesn't accept them)
      const updates: Record<string, unknown> = {
        name: editEpisode.name.trim(),
        episodeNumber: editEpisode.episodeNumber,
      };
      if (editEpisode.mediaURL.trim()) updates["mediaURL"] = editEpisode.mediaURL.trim();
      if (editEpisode.releaseDate) {
        const { Timestamp } = await import("firebase/firestore");
        updates["releaseDate"] = Timestamp.fromDate(new Date(editEpisode.releaseDate));
      }
      // Include coverURL (even if empty, to allow clearing)
      updates["coverURL"] = editEpisode.coverURL;

      await updateContent(editEpisode.id, updates);
      
      await fetchShow();
      onUpdated();
      setView("main");
      setEditEpisode(null);
    } catch (err) {
      console.error("Failed to save episode:", err);
      setError(err instanceof Error ? err.message : "Failed to save episode");
    } finally {
      setIsEditingSaving(false);
    }
  };

  // Delete child content
  const handleDeleteChild = async (childId: string, childName: string) => {
    if (!confirm(`Delete "${childName}"? This cannot be undone.`)) return;
    
    try {
      await deleteContent(childId);
      await fetchShow();
      onUpdated();
    } catch (err) {
      console.error("Failed to delete:", err);
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  // Toggle publish status for child content (seasons/episodes)
  const handleToggleChildPublish = async (childId: string, currentlyPublished: boolean) => {
    try {
      await updateContent(childId, { isPublished: !currentlyPublished });
      await fetchShow();
      onUpdated();
    } catch (err) {
      console.error("Failed to toggle publish:", err);
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  // Determine if series has seasons or direct episodes
  const hasSeasons = show?.children?.some(c => c.contentLevel === "season");
  const directEpisodes = show?.children?.filter(c => c.contentLevel === "episode") || [];
  const seasons = show?.children?.filter(c => c.contentLevel === "season") || [];

  const isSeries = show?.contentLevel === "series";
  const isMovie = show?.contentLevel === "standalone";

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-20"
    >
      {/* Backdrop - clicking does NOT close (only X button closes) */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
      
      {/* Modal */}
      <div 
        className="relative w-full max-w-2xl max-h-[calc(100vh-6rem)] rounded-2xl border-2 overflow-hidden flex flex-col"
        style={{ 
          backgroundColor: "rgba(20, 20, 20, 1)",
          borderColor: "rgba(255, 255, 255, 0.2)",
        }}
      >
        {/* Header */}
        <div 
          className="shrink-0 flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "rgba(255, 255, 255, 0.15)" }}
        >
          <div className="flex items-center gap-3">
            {view !== "main" && (
              <button
                onClick={() => setView("main")}
                className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
                style={{ color: theme.text.secondary }}
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h2 
              className="text-lg font-semibold"
              style={{ color: theme.text.primary }}
            >
              {view === "main" && (show?.name || "Loading...")}
              {view === "add-season" && "Add Season"}
              {view === "add-episode" && "Add Episode"}
              {view === "edit-episode" && "Edit Episode"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {view === "main" && (
              <>
                <button
                  onClick={handleDelete}
                  className="p-2 rounded-lg transition-colors hover:bg-red-500/20"
                  style={{ color: theme.semantic.error }}
                  title="Delete show"
                >
                  <Trash2 size={18} />
                </button>
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving}
                  className="p-2 rounded-lg transition-all disabled:opacity-30"
                  style={{ 
                    backgroundColor: hasChanges ? `${theme.accents.goldenGlow}20` : 'transparent',
                    color: hasChanges ? theme.accents.goldenGlow : theme.text.tertiary,
                  }}
                  title={hasChanges ? "Save changes" : "No changes"}
                >
                  <Save size={18} className={isSaving ? "animate-pulse" : ""} />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors hover:bg-white/10"
              style={{ color: theme.text.secondary }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div 
          className="flex-1 overflow-y-auto p-6 space-y-6"
          style={{ scrollbarWidth: "none" }}
        >
          {isLoading ? (
            <div className="py-12 text-center">
              <Loader2 
                className="inline-block h-6 w-6 animate-spin"
                style={{ color: theme.accents.goldenGlow }}
              />
            </div>
          ) : error ? (
            <div 
              className="py-12 text-center text-sm"
              style={{ color: theme.semantic.error }}
            >
              {error}
            </div>
          ) : view === "main" && show && editState ? (
            <>
              {/* Basic Info Section */}
              <Section title="Details" theme={theme}>
                <div className="space-y-4">
                  {/* Type badge */}
                  <div className="flex items-center gap-2">
                    <div 
                      className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full"
                      style={{ 
                        backgroundColor: isMovie ? `${theme.accents.neonPink}20` : `${theme.accents.goldenGlow}20`,
                        color: isMovie ? theme.accents.neonPink : theme.accents.goldenGlow,
                      }}
                    >
                      {isMovie ? <Film size={12} /> : <Tv size={12} />}
                      {isMovie ? "Movie" : "Series"}
                    </div>
                    
                    {/* Published toggle */}
                    <button
                      onClick={() => setEditState({ ...editState, isPublished: !editState.isPublished })}
                      className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full transition-colors"
                      style={{ 
                        backgroundColor: editState.isPublished 
                          ? `${theme.semantic.success}20` 
                          : theme.surfaces.elevated2,
                        color: editState.isPublished 
                          ? theme.semantic.success 
                          : theme.text.tertiary,
                      }}
                    >
                      {editState.isPublished ? <Eye size={12} /> : <EyeOff size={12} />}
                      {editState.isPublished ? "Published" : "Draft"}
                    </button>
                  </div>

                  {/* Name */}
                  <Field
                    label="Name"
                    value={editState.name}
                    onChange={(v) => setEditState({ ...editState, name: v })}
                    theme={theme}
                    required
                  />

                  {/* Description */}
                  <div>
                    <label 
                      className="block text-sm font-medium mb-1.5"
                      style={{ color: theme.text.secondary }}
                    >
                      Description
                    </label>
                    <textarea
                      value={editState.description}
                      onChange={(e) => setEditState({ ...editState, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 resize-none"
                      style={{
                        backgroundColor: "rgba(0, 0, 0, 0.4)",
                        borderColor: "rgba(255, 255, 255, 0.2)",
                        color: theme.text.primary,
                        // @ts-expect-error CSS custom property
                        "--tw-ring-color": theme.accents.goldenGlow,
                      }}
                    />
                  </div>

                  {/* Cover & Banner Images */}
                  <div className="flex flex-col gap-4">
                    <JMImageUpload
                      label="Cover (16:9)"
                      value={editState.coverURL}
                      onChange={(url) => setEditState({ ...editState, coverURL: url || "" })}
                      onUpload={handleShowCoverUpload}
                      aspectRatio="landscape"
                      previewSize={200}
                    />
                    <JMImageUpload
                      label="Banner (16:9)"
                      value={editState.backdropURL}
                      onChange={(url) => setEditState({ ...editState, backdropURL: url || "" })}
                      onUpload={handleShowBackdropUpload}
                      aspectRatio="landscape"
                      previewSize={200}
                    />
                  </div>

                  {/* Media URL (for movies) */}
                  {isMovie && (
                    <>
                      <Field
                        label="Media URL (video)"
                        value={editState.mediaURL}
                        onChange={(v) => setEditState({ ...editState, mediaURL: v })}
                        theme={theme}
                        type="url"
                        placeholder="https://..."
                      />
                      <Field
                        label="Duration (seconds)"
                        value={String(editState.duration || "")}
                        onChange={(v) => setEditState({ ...editState, duration: parseInt(v) || 0 })}
                        theme={theme}
                        type="number"
                      />
                    </>
                  )}
                </div>
              </Section>

              {/* Content Hierarchy (for series) */}
              {isSeries && (
                <Section title="Content" theme={theme}>
                  <div className="space-y-3">
                    {/* Add buttons */}
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={startAddSeason}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
                        style={{
                          backgroundColor: `${theme.accents.goldenGlow}20`,
                          color: theme.accents.goldenGlow,
                        }}
                      >
                        <Layers size={16} />
                        Add Season
                      </button>
                      {!hasSeasons && (
                        <button
                          onClick={() => startAddEpisode(showId)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
                          style={{
                            backgroundColor: `${theme.accents.neonPink}20`,
                            color: theme.accents.neonPink,
                          }}
                        >
                          <Video size={16} />
                          Add Episode
                        </button>
                      )}
                    </div>

                    {/* Seasons list */}
                    {seasons.length > 0 && (
                      <div className="space-y-2">
                        {seasons.map((season) => (
                          <div key={season.id}>
                            {/* Season header */}
                            <div
                              onClick={() => toggleSeason(season.id)}
                              className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-white/5 cursor-pointer"
                            >
                              {expandedSeasons.has(season.id) ? (
                                <ChevronDown size={16} style={{ color: theme.text.tertiary }} />
                              ) : (
                                <ChevronRight size={16} style={{ color: theme.text.tertiary }} />
                              )}
                              <Layers size={16} style={{ color: theme.accents.goldenGlow }} />
                              <span style={{ color: theme.text.primary }} className="flex-1 text-left">
                                {season.name}
                              </span>
                              <span 
                                className="text-xs"
                                style={{ color: theme.text.tertiary }}
                              >
                                {season.children?.length || 0} episodes
                              </span>
                              {/* Publish toggle */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleChildPublish(season.id, season.isPublished);
                                }}
                                className="p-1 rounded hover:bg-white/10 transition-colors"
                                style={{ color: season.isPublished ? theme.semantic.success : theme.text.tertiary }}
                                title={season.isPublished ? "Published - click to unpublish" : "Draft - click to publish"}
                              >
                                {season.isPublished ? <Eye size={14} /> : <EyeOff size={14} />}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteChild(season.id, season.name);
                                }}
                                className="p-1 rounded hover:bg-red-500/20 transition-colors"
                                style={{ color: theme.text.tertiary }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>

                            {/* Episodes in season */}
                            {expandedSeasons.has(season.id) && (
                              <div className="ml-8 mt-1 space-y-1">
                                {season.children?.map((episode) => (
                                  <div 
                                    key={episode.id}
                                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5"
                                  >
                                    {/* Episode number */}
                                    <span 
                                      className="text-xs font-mono w-6 text-center"
                                      style={{ color: theme.accents.neonPink }}
                                    >
                                      {episode.episodeNumber || "?"}
                                    </span>
                                    
                                    {/* Episode name */}
                                    <span 
                                      className="flex-1 text-sm"
                                      style={{ color: theme.text.secondary }}
                                    >
                                      {episode.name}
                                    </span>
                                    
                                    {/* Release date */}
                                    <span 
                                      className="text-xs"
                                      style={{ color: theme.text.tertiary }}
                                    >
                                      {episode.releaseDate 
                                        ? episode.releaseDate.toDate().toLocaleDateString("en-US", { timeZone: "UTC" })
                                        : "No date"}
                                    </span>
                                    
                                    {/* Publish toggle */}
                                    <button
                                      onClick={() => handleToggleChildPublish(episode.id, episode.isPublished)}
                                      className="p-1 rounded hover:bg-white/10 transition-colors"
                                      style={{ color: episode.isPublished ? theme.semantic.success : theme.text.tertiary }}
                                      title={episode.isPublished ? "Published" : "Draft - click to publish"}
                                    >
                                      {episode.isPublished ? <Eye size={12} /> : <EyeOff size={12} />}
                                    </button>
                                    
                                    {/* Edit button */}
                                    <button
                                      onClick={() => startEditEpisode(episode)}
                                      className="p-1 rounded hover:bg-white/10 transition-colors"
                                      style={{ color: theme.text.tertiary }}
                                      title="Edit episode"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                    
                                    {/* Delete button */}
                                    <button
                                      onClick={() => handleDeleteChild(episode.id, episode.name)}
                                      className="p-1 rounded hover:bg-red-500/20 transition-colors"
                                      style={{ color: theme.text.tertiary }}
                                      title="Delete episode"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                ))}
                                
                                {/* Add episode to season */}
                                <button
                                  onClick={() => startAddEpisode(season.id)}
                                  className="flex items-center gap-2 p-2 rounded-lg text-sm transition-colors hover:bg-white/5"
                                  style={{ color: theme.text.tertiary }}
                                >
                                  <Plus size={14} />
                                  Add episode
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Direct episodes (no seasons) */}
                    {directEpisodes.length > 0 && (
                      <div className="space-y-1">
                        {directEpisodes.map((episode) => (
                          <div 
                            key={episode.id}
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5"
                          >
                            <Play size={16} style={{ color: theme.accents.neonPink }} />
                            <span style={{ color: theme.text.primary }} className="flex-1">
                              {episode.name}
                            </span>
                            <button
                              onClick={() => handleDeleteChild(episode.id, episode.name)}
                              className="p-1 rounded hover:bg-red-500/20 transition-colors"
                              style={{ color: theme.text.tertiary }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Empty state */}
                    {seasons.length === 0 && directEpisodes.length === 0 && (
                      <div 
                        className="text-sm text-center py-4"
                        style={{ color: theme.text.tertiary }}
                      >
                        No content yet. Add seasons or episodes above.
                      </div>
                    )}
                  </div>
                </Section>
              )}
            </>
          ) : view === "add-season" ? (
            // Add Season Form
            <div className="space-y-4">
              <Field
                label="Season Name"
                value={addForm.name}
                onChange={(v) => setAddForm({ ...addForm, name: v })}
                theme={theme}
                required
                placeholder="Season 1"
              />
              <Field
                label="Season Number"
                value={String(addForm.seasonNumber)}
                onChange={(v) => setAddForm({ ...addForm, seasonNumber: parseInt(v) || 1 })}
                theme={theme}
                type="number"
              />
              
              <p 
                className="text-xs"
                style={{ color: theme.text.tertiary }}
              >
                Seasons are simple containers for episodes. Add episodes after creating the season.
              </p>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setView("main")}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/10"
                  style={{ color: theme.text.secondary }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateSeason}
                  disabled={!addForm.name.trim() || isAdding}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 hover:scale-105 disabled:hover:scale-100"
                  style={{
                    backgroundColor: theme.accents.goldenGlow,
                    color: theme.surfaces.base,
                  }}
                >
                  {isAdding ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Create Season
                </button>
              </div>
            </div>
          ) : view === "add-episode" ? (
            // Add Episode Form
            <div className="space-y-4">
              <Field
                label="Episode Name"
                value={addForm.name}
                onChange={(v) => setAddForm({ ...addForm, name: v })}
                theme={theme}
                required
                placeholder="Episode 1"
              />
              <Field
                label="Episode Number"
                value={String(addForm.episodeNumber)}
                onChange={(v) => setAddForm({ ...addForm, episodeNumber: parseInt(v) || 1 })}
                theme={theme}
                type="number"
              />
              <Field
                label="Vimeo URL"
                value={addForm.mediaURL}
                onChange={(v) => setAddForm({ ...addForm, mediaURL: v })}
                theme={theme}
                type="url"
                placeholder="https://vimeo.com/123456789"
                required
              />
              
              {/* Episode Cover (optional) */}
              <div>
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: theme.text.secondary }}
                >
                  Cover Image (16:9)
                  <span 
                    className="ml-2 text-xs font-normal"
                    style={{ color: theme.text.tertiary }}
                  >
                    optional - uses Vimeo thumbnail if not set
                  </span>
                </label>
                <JMImageUpload
                  value={pendingCoverPreview || ""}
                  onChange={(url) => {
                    if (!url) {
                      // Clear pending cover
                      if (pendingCoverPreview) {
                        URL.revokeObjectURL(pendingCoverPreview);
                      }
                      setPendingEpisodeCover(null);
                      setPendingCoverPreview(null);
                    }
                  }}
                  onUpload={handlePendingEpisodeCover}
                  aspectRatio="landscape"
                  previewSize={200}
                />
              </div>
              
              {/* Release Date */}
              <div>
                <label 
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: theme.text.secondary }}
                >
                  Release Date
                  <span 
                    className="ml-2 text-xs font-normal"
                    style={{ color: theme.text.tertiary }}
                  >
                    (free tier sees 1 week ahead)
                  </span>
                </label>
                <input
                  type="date"
                  value={addForm.releaseDate}
                  onChange={(e) => setAddForm({ ...addForm, releaseDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1"
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.4)",
                    borderColor: "rgba(255, 255, 255, 0.2)",
                    color: theme.text.primary,
                    colorScheme: "dark",
                    // @ts-expect-error CSS custom property
                    "--tw-ring-color": theme.accents.goldenGlow,
                  }}
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setView("main")}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/10"
                  style={{ color: theme.text.secondary }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateEpisode}
                  disabled={!addForm.name.trim() || isAdding}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 hover:scale-105 disabled:hover:scale-100"
                  style={{
                    backgroundColor: theme.accents.goldenGlow,
                    color: theme.surfaces.base,
                  }}
                >
                  {isAdding ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Create Episode
                </button>
              </div>
            </div>
          ) : view === "edit-episode" && editEpisode ? (
            // Edit Episode Form
            <div className="space-y-4">
              <Field
                label="Episode Name"
                value={editEpisode.name}
                onChange={(v) => setEditEpisode({ ...editEpisode, name: v })}
                theme={theme}
                required
              />
              <Field
                label="Episode Number"
                value={String(editEpisode.episodeNumber)}
                onChange={(v) => setEditEpisode({ ...editEpisode, episodeNumber: parseInt(v) || 1 })}
                theme={theme}
                type="number"
              />
              <Field
                label="Vimeo URL"
                value={editEpisode.mediaURL}
                onChange={(v) => setEditEpisode({ ...editEpisode, mediaURL: v })}
                theme={theme}
                type="url"
                placeholder="https://vimeo.com/123456789"
                required
              />
              
              {/* Episode Cover (optional) */}
              <div>
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: theme.text.secondary }}
                >
                  Cover Image (16:9)
                  <span 
                    className="ml-2 text-xs font-normal"
                    style={{ color: theme.text.tertiary }}
                  >
                    optional - uses Vimeo thumbnail if not set
                  </span>
                </label>
                <JMImageUpload
                  value={editEpisode.coverURL}
                  onChange={(url) => setEditEpisode({ ...editEpisode, coverURL: url || "" })}
                  onUpload={(file) => handleEpisodeCoverUpload(file, editEpisode.id)}
                  aspectRatio="landscape"
                  previewSize={200}
                />
              </div>
              
              {/* Release Date */}
              <div>
                <label 
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: theme.text.secondary }}
                >
                  Release Date
                </label>
                <input
                  type="date"
                  value={editEpisode.releaseDate}
                  onChange={(e) => setEditEpisode({ ...editEpisode, releaseDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1"
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.4)",
                    borderColor: "rgba(255, 255, 255, 0.2)",
                    color: theme.text.primary,
                    colorScheme: "dark",
                    // @ts-expect-error CSS custom property
                    "--tw-ring-color": theme.accents.goldenGlow,
                  }}
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setView("main");
                    setEditEpisode(null);
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/10"
                  style={{ color: theme.text.secondary }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEpisode}
                  disabled={!editEpisode.name.trim() || isEditingSaving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 hover:scale-105 disabled:hover:scale-100"
                  style={{
                    backgroundColor: theme.accents.goldenGlow,
                    color: theme.surfaces.base,
                  }}
                >
                  {isEditingSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save Episode
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Success Toast */}
      <div 
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-3 rounded-xl border-2 shadow-lg transition-all duration-300 ${
          showSaveToast 
            ? "opacity-100 translate-y-0" 
            : "opacity-0 translate-y-4 pointer-events-none"
        }`}
        style={{ 
          backgroundColor: "rgba(20, 20, 20, 0.95)",
          borderColor: theme.semantic.success,
          zIndex: 60,
        }}
      >
        <div 
          className="flex items-center justify-center w-6 h-6 rounded-full"
          style={{ backgroundColor: `${theme.semantic.success}30` }}
        >
          <Check size={14} style={{ color: theme.semantic.success }} />
        </div>
        <span 
          className="text-sm font-medium"
          style={{ color: theme.text.primary }}
        >
          Changes saved
        </span>
      </div>
    </div>
  );
}

// Section wrapper component
function Section({ 
  title, 
  theme, 
  children 
}: { 
  title: string; 
  theme: ReturnType<typeof useJMStyle>["theme"]; 
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 
        className="text-sm font-semibold mb-3 uppercase tracking-wider"
        style={{ color: theme.accents.goldenGlow }}
      >
        {title}
      </h3>
      <div 
        className="p-4 rounded-xl border-2"
        style={{ 
          backgroundColor: "rgba(255, 255, 255, 0.06)",
          borderColor: "rgba(255, 255, 255, 0.18)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// Text field component
function Field({
  label,
  value,
  onChange,
  theme,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  theme: ReturnType<typeof useJMStyle>["theme"];
  type?: "text" | "email" | "url" | "number";
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label 
        className="block text-sm font-medium mb-1.5"
        style={{ color: theme.text.secondary }}
      >
        {label}
        {required && <span style={{ color: theme.semantic.error }}> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.4)",
          borderColor: "rgba(255, 255, 255, 0.2)",
          color: theme.text.primary,
          // @ts-expect-error CSS custom property
          "--tw-ring-color": theme.accents.goldenGlow,
        }}
      />
    </div>
  );
}
