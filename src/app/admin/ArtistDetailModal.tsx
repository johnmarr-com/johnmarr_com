"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  X, Save, Trash2, Plus, ChevronRight, ChevronDown, 
  Music, Video, Check, Loader2, ArrowLeft,
  Disc, Eye, EyeOff, Pencil, Play
} from "lucide-react";
import { useJMStyle } from "@/JMStyle";
import { JMImageUpload, JMVideoUpload, JMAudioUpload } from "@/JMKit";
import { useAuth } from "@/lib/AuthProvider";
import {
  getArtist,
  createArtist,
  updateArtist,
  uploadArtistAvatar,
  uploadArtistCover,
  uploadArtistBanner,
  uploadArtistLoginBg,
  getAlbumsByArtist,
  createAlbum,
  updateAlbum,
  deleteAlbum,
  uploadAlbumCover,
  uploadAlbumVideo,
  getSongsByAlbum,
  createSong,
  updateSong,
  deleteSong,
  uploadSongAudio,
  getMusicVideosByArtist,
  createMusicVideo,
  updateMusicVideo,
  deleteMusicVideo,
  uploadMusicVideoThumbnail,
} from "@/lib/content";
import type {
  JMArtist,
  JMAlbum,
  JMSong,
  JMMusicVideo,
  JMMusicVideoOrientation,
} from "@/lib/content-types";
import { JMMusicVideoOrientationLabels } from "@/lib/content-types";

interface ArtistDetailModalProps {
  artistId: string | null; // null = create new
  onClose: () => void;
  onCreated?: () => void;
  onUpdated: () => void;
}

type View = "main" | "add-album" | "edit-album" | "add-song" | "edit-song" | "add-video" | "edit-video";

interface AlbumWithSongs extends JMAlbum {
  songs: JMSong[];
}

/**
 * ArtistDetailModal - Manage an AI artist's details, albums, songs, and music videos
 */
export function ArtistDetailModal({ artistId, onClose, onCreated, onUpdated }: ArtistDetailModalProps) {
  const { theme } = useJMStyle();
  const { user } = useAuth();
  
  const isCreating = artistId === null;
  
  // Data state
  const [artist, setArtist] = useState<JMArtist | null>(null);
  const [albums, setAlbums] = useState<AlbumWithSongs[]>([]);
  const [musicVideos, setMusicVideos] = useState<JMMusicVideo[]>([]);
  const [isLoading, setIsLoading] = useState(!isCreating);
  const [error, setError] = useState<string | null>(null);
  
  // Edit state for artist
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [fullDescription, setFullDescription] = useState("");
  const [avatarURL, setAvatarURL] = useState("");
  const [coverURL, setCoverURL] = useState("");
  const [bannerURL, setBannerURL] = useState("");
  const [loginBgURL, setLoginBgURL] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Navigation state
  const [view, setView] = useState<View>("main");
  const [expandedAlbums, setExpandedAlbums] = useState<Set<string>>(new Set());
  
  // Selected item for editing
  const [selectedAlbum, setSelectedAlbum] = useState<JMAlbum | null>(null);
  const [selectedSong, setSelectedSong] = useState<JMSong | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<JMMusicVideo | null>(null);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  
  // Form state for adding/editing items
  const [formState, setFormState] = useState({
    name: "",
    title: "",
    description: "",
    coverImageURL: "",
    coverVideoURL: "",
    audioURL: "",
    vimeoURL: "",
    thumbnailURL: "",
    lyrics: "",
    duration: 0,
    trackNumber: 1,
    order: 0,
    orientation: "landscape" as JMMusicVideoOrientation,
  });
  const [isFormSaving, setIsFormSaving] = useState(false);

  // Fetch artist data
  const fetchArtist = useCallback(async () => {
    if (!artistId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await getArtist(artistId);
      if (data) {
        setArtist(data);
        setName(data.name);
        setSlug(data.slug);
        setDescription(data.description);
        setFullDescription(data.fullDescription || "");
        setAvatarURL(data.avatarURL || "");
        setCoverURL(data.coverURL || "");
        setBannerURL(data.bannerURL || "");
        setLoginBgURL(data.loginBgURL || "");
        setIsPublished(data.isPublished);
        
        // Fetch albums with songs
        const fetchedAlbums = await getAlbumsByArtist(artistId, false);
        const albumsWithSongs = await Promise.all(
          fetchedAlbums.map(async (album) => {
            const songs = await getSongsByAlbum(album.id, false);
            return { ...album, songs };
          })
        );
        setAlbums(albumsWithSongs);
        
        // Fetch music videos
        const fetchedVideos = await getMusicVideosByArtist(artistId, false);
        setMusicVideos(fetchedVideos);
      }
    } catch (err) {
      console.error("Failed to fetch artist:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch artist");
    } finally {
      setIsLoading(false);
    }
  }, [artistId]);

  useEffect(() => {
    fetchArtist();
  }, [fetchArtist]);

  // Track changes
  useEffect(() => {
    if (!artist) {
      setHasChanges(name.trim().length > 0 || slug.trim().length > 0 || coverURL.trim().length > 0);
      return;
    }
    
    const changed = 
      name !== artist.name ||
      slug !== artist.slug ||
      description !== artist.description ||
      fullDescription !== (artist.fullDescription || "") ||
      avatarURL !== (artist.avatarURL || "") ||
      coverURL !== (artist.coverURL || "") ||
      bannerURL !== (artist.bannerURL || "") ||
      loginBgURL !== (artist.loginBgURL || "") ||
      isPublished !== artist.isPublished;
    setHasChanges(changed);
  }, [artist, name, slug, description, fullDescription, avatarURL, coverURL, bannerURL, loginBgURL, isPublished]);

  // Generate slug from name
  const generateSlug = (inputName: string) => {
    return inputName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  };

  // Handle avatar upload
  const handleAvatarUpload = useCallback(async (file: File) => {
    const id = artistId || `new-${Date.now()}`;
    return uploadArtistAvatar(file, id);
  }, [artistId]);

  // Handle cover upload
  const handleCoverUpload = useCallback(async (file: File) => {
    const id = artistId || `new-${Date.now()}`;
    return uploadArtistCover(file, id);
  }, [artistId]);

  // Handle banner upload
  const handleBannerUpload = useCallback(async (file: File) => {
    const id = artistId || `new-${Date.now()}`;
    return uploadArtistBanner(file, id);
  }, [artistId]);
  
  const handleLoginBgUpload = useCallback(async (file: File) => {
    const id = artistId || `new-${Date.now()}`;
    return uploadArtistLoginBg(file, id);
  }, [artistId]);

  // Save artist
  const handleSave = async () => {
    if (!name.trim() || !slug.trim()) {
      setError("Name and slug are required");
      return;
    }
    if (!coverURL.trim()) {
      setError("Cover image is required");
      return;
    }
    if (!user?.uid) return;
    
    setIsSaving(true);
    setError(null);
    
    try {
      if (isCreating) {
        // Create new artist
        const input: Parameters<typeof createArtist>[0] = {
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim(),
          coverURL: coverURL.trim(),
          isPublished,
        };
        if (fullDescription.trim()) input.fullDescription = fullDescription.trim();
        if (avatarURL) input.avatarURL = avatarURL;
        if (bannerURL) input.bannerURL = bannerURL;
        if (loginBgURL) input.loginBgURL = loginBgURL;
        
        await createArtist(input, user.uid);
        
        onCreated?.();
      } else if (artistId) {
        // Update existing artist
        const updates: Parameters<typeof updateArtist>[1] = {
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim(),
          coverURL: coverURL.trim(),
          isPublished,
        };
        if (fullDescription.trim()) updates.fullDescription = fullDescription.trim();
        if (avatarURL) updates.avatarURL = avatarURL;
        if (bannerURL) updates.bannerURL = bannerURL;
        if (loginBgURL) updates.loginBgURL = loginBgURL;
        
        await updateArtist(artistId, updates);
        
        await fetchArtist();
        onUpdated();
      }
    } catch (err) {
      console.error("Failed to save artist:", err);
      setError(err instanceof Error ? err.message : "Failed to save artist");
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle album expansion
  const toggleAlbum = (albumId: string) => {
    setExpandedAlbums(prev => {
      const next = new Set(prev);
      if (next.has(albumId)) {
        next.delete(albumId);
      } else {
        next.add(albumId);
      }
      return next;
    });
  };

  // Album handlers
  const startAddAlbum = () => {
    setFormState({
      ...formState,
      name: "",
      description: "",
      coverImageURL: "",
      coverVideoURL: "",
      order: albums.length,
    });
    setView("add-album");
  };

  const startEditAlbum = (album: JMAlbum) => {
    setSelectedAlbum(album);
    setFormState({
      ...formState,
      name: album.name,
      description: album.description,
      coverImageURL: album.coverImageURL,
      coverVideoURL: album.coverVideoURL || "",
      order: album.order,
    });
    setView("edit-album");
  };

  const handleSaveAlbum = async () => {
    if (!formState.name.trim() || !formState.coverImageURL) {
      setError("Album name and cover image are required");
      return;
    }
    if (!user?.uid || !artistId) return;
    
    setIsFormSaving(true);
    setError(null);
    
    try {
      if (view === "add-album") {
        const input: Parameters<typeof createAlbum>[0] = {
          artistId,
          name: formState.name.trim(),
          description: formState.description.trim(),
          coverImageURL: formState.coverImageURL,
          order: formState.order,
          isPublished: false,
        };
        if (formState.coverVideoURL) input.coverVideoURL = formState.coverVideoURL;
        
        await createAlbum(input, user.uid);
      } else if (selectedAlbum) {
        const updates: Parameters<typeof updateAlbum>[1] = {
          name: formState.name.trim(),
          description: formState.description.trim(),
          coverImageURL: formState.coverImageURL,
          order: formState.order,
        };
        if (formState.coverVideoURL) updates.coverVideoURL = formState.coverVideoURL;
        
        await updateAlbum(selectedAlbum.id, updates);
      }
      
      await fetchArtist();
      onUpdated();
      setView("main");
      setSelectedAlbum(null);
    } catch (err) {
      console.error("Failed to save album:", err);
      setError(err instanceof Error ? err.message : "Failed to save album");
    } finally {
      setIsFormSaving(false);
    }
  };

  const handleDeleteAlbum = async (album: JMAlbum) => {
    if (!confirm(`Delete "${album.name}"? This will also delete all songs. This cannot be undone.`)) return;
    
    try {
      await deleteAlbum(album.id);
      await fetchArtist();
      onUpdated();
    } catch (err) {
      console.error("Failed to delete album:", err);
      setError(err instanceof Error ? err.message : "Failed to delete album");
    }
  };

  const handleToggleAlbumPublish = async (album: JMAlbum) => {
    try {
      await updateAlbum(album.id, { isPublished: !album.isPublished });
      await fetchArtist();
      onUpdated();
    } catch (err) {
      console.error("Failed to toggle album publish:", err);
    }
  };

  // Song handlers
  const startAddSong = (albumId: string) => {
    setSelectedAlbumId(albumId);
    const album = albums.find(a => a.id === albumId);
    const nextTrack = album ? album.songs.length + 1 : 1;
    setFormState({
      ...formState,
      title: "",
      description: "",
      audioURL: "",
      lyrics: "",
      duration: 0,
      trackNumber: nextTrack,
    });
    setView("add-song");
  };

  const startEditSong = (song: JMSong) => {
    setSelectedSong(song);
    setFormState({
      ...formState,
      title: song.title,
      description: song.description,
      audioURL: song.audioURL,
      lyrics: song.lyrics || "",
      duration: song.duration,
      trackNumber: song.trackNumber,
    });
    setView("edit-song");
  };

  const handleSaveSong = async () => {
    if (!formState.title.trim() || !formState.audioURL) {
      setError("Song title and audio file are required");
      return;
    }
    if (!user?.uid) return;
    
    setIsFormSaving(true);
    setError(null);
    
    try {
      if (view === "add-song" && selectedAlbumId) {
        const input: Parameters<typeof createSong>[0] = {
          albumId: selectedAlbumId,
          title: formState.title.trim(),
          description: formState.description.trim(),
          audioURL: formState.audioURL,
          duration: formState.duration,
          trackNumber: formState.trackNumber,
          isPublished: false,
        };
        if (formState.lyrics) input.lyrics = formState.lyrics;
        
        await createSong(input, user.uid);
      } else if (selectedSong) {
        const updates: Parameters<typeof updateSong>[1] = {
          title: formState.title.trim(),
          description: formState.description.trim(),
          audioURL: formState.audioURL,
          duration: formState.duration,
          trackNumber: formState.trackNumber,
        };
        if (formState.lyrics) updates.lyrics = formState.lyrics;
        
        await updateSong(selectedSong.id, updates);
      }
      
      await fetchArtist();
      onUpdated();
      setView("main");
      setSelectedSong(null);
      setSelectedAlbumId(null);
    } catch (err) {
      console.error("Failed to save song:", err);
      setError(err instanceof Error ? err.message : "Failed to save song");
    } finally {
      setIsFormSaving(false);
    }
  };

  const handleDeleteSong = async (song: JMSong) => {
    if (!confirm(`Delete "${song.title}"? This cannot be undone.`)) return;
    
    try {
      await deleteSong(song.id);
      await fetchArtist();
      onUpdated();
    } catch (err) {
      console.error("Failed to delete song:", err);
      setError(err instanceof Error ? err.message : "Failed to delete song");
    }
  };

  const handleToggleSongPublish = async (song: JMSong) => {
    try {
      await updateSong(song.id, { isPublished: !song.isPublished });
      await fetchArtist();
      onUpdated();
    } catch (err) {
      console.error("Failed to toggle song publish:", err);
    }
  };

  // Music Video handlers
  const startAddVideo = () => {
    setFormState({
      ...formState,
      title: "",
      description: "",
      vimeoURL: "",
      thumbnailURL: "",
      orientation: "landscape",
      order: musicVideos.length,
    });
    setView("add-video");
  };

  const startEditVideo = (video: JMMusicVideo) => {
    setSelectedVideo(video);
    setFormState({
      ...formState,
      title: video.title,
      description: video.description,
      vimeoURL: video.vimeoURL,
      thumbnailURL: video.thumbnailURL || "",
      orientation: video.orientation,
      order: video.order,
    });
    setView("edit-video");
  };

  const handleSaveVideo = async () => {
    if (!formState.title.trim() || !formState.vimeoURL.trim()) {
      setError("Video title and Vimeo URL are required");
      return;
    }
    if (!user?.uid || !artistId) return;
    
    setIsFormSaving(true);
    setError(null);
    
    try {
      if (view === "add-video") {
        const input: Parameters<typeof createMusicVideo>[0] = {
          artistId,
          title: formState.title.trim(),
          description: formState.description.trim(),
          vimeoURL: formState.vimeoURL.trim(),
          orientation: formState.orientation,
          order: formState.order,
          isPublished: false,
        };
        if (formState.thumbnailURL) input.thumbnailURL = formState.thumbnailURL;
        
        await createMusicVideo(input, user.uid);
      } else if (selectedVideo) {
        const updates: Parameters<typeof updateMusicVideo>[1] = {
          title: formState.title.trim(),
          description: formState.description.trim(),
          vimeoURL: formState.vimeoURL.trim(),
          orientation: formState.orientation,
          order: formState.order,
        };
        if (formState.thumbnailURL) updates.thumbnailURL = formState.thumbnailURL;
        
        await updateMusicVideo(selectedVideo.id, updates);
      }
      
      await fetchArtist();
      onUpdated();
      setView("main");
      setSelectedVideo(null);
    } catch (err) {
      console.error("Failed to save video:", err);
      setError(err instanceof Error ? err.message : "Failed to save video");
    } finally {
      setIsFormSaving(false);
    }
  };

  const handleDeleteVideo = async (video: JMMusicVideo) => {
    if (!confirm(`Delete "${video.title}"? This cannot be undone.`)) return;
    
    try {
      await deleteMusicVideo(video.id);
      await fetchArtist();
      onUpdated();
    } catch (err) {
      console.error("Failed to delete video:", err);
      setError(err instanceof Error ? err.message : "Failed to delete video");
    }
  };

  const handleToggleVideoPublish = async (video: JMMusicVideo) => {
    try {
      await updateMusicVideo(video.id, { isPublished: !video.isPublished });
      await fetchArtist();
      onUpdated();
    } catch (err) {
      console.error("Failed to toggle video publish:", err);
    }
  };

  // Upload handlers for forms
  const handleAlbumCoverUpload = useCallback(async (file: File) => {
    const id = selectedAlbum?.id || `new-album-${Date.now()}`;
    return uploadAlbumCover(file, id);
  }, [selectedAlbum]);

  const handleAlbumVideoUpload = useCallback(async (file: File) => {
    const id = selectedAlbum?.id || `new-album-${Date.now()}`;
    return uploadAlbumVideo(file, id);
  }, [selectedAlbum]);

  const handleSongAudioUpload = useCallback(async (file: File) => {
    const id = selectedSong?.id || `new-song-${Date.now()}`;
    return uploadSongAudio(file, id);
  }, [selectedSong]);

  const handleVideoThumbnailUpload = useCallback(async (file: File) => {
    const id = selectedVideo?.id || `new-video-${Date.now()}`;
    return uploadMusicVideoThumbnail(file, id);
  }, [selectedVideo]);

  const getViewTitle = () => {
    switch (view) {
      case "main": return isCreating ? "New Artist" : artist?.name || "Loading...";
      case "add-album": return "Add Album";
      case "edit-album": return "Edit Album";
      case "add-song": return "Add Song";
      case "edit-song": return "Edit Song";
      case "add-video": return "Add Music Video";
      case "edit-video": return "Edit Music Video";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-20">
      {/* Backdrop */}
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
                onClick={() => {
                  setView("main");
                  setSelectedAlbum(null);
                  setSelectedSong(null);
                  setSelectedVideo(null);
                  setSelectedAlbumId(null);
                }}
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
              {getViewTitle()}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {view === "main" && (
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
          ) : error && view === "main" ? (
            <div 
              className="py-12 text-center text-sm"
              style={{ color: theme.semantic.error }}
            >
              {error}
            </div>
          ) : view === "main" ? (
            <>
              {/* Artist Details Section */}
              <Section title="Artist Details" theme={theme}>
                <div className="space-y-4">
                  {/* Published toggle */}
                  <button
                    onClick={() => setIsPublished(!isPublished)}
                    className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full transition-colors"
                    style={{ 
                      backgroundColor: isPublished 
                        ? `${theme.semantic.success}20` 
                        : theme.surfaces.elevated2,
                      color: isPublished 
                        ? theme.semantic.success 
                        : theme.text.tertiary,
                    }}
                  >
                    {isPublished ? <Eye size={12} /> : <EyeOff size={12} />}
                    {isPublished ? "Published" : "Draft"}
                  </button>

                  {/* Name */}
                  <Field
                    label="Name"
                    value={name}
                    onChange={(v) => {
                      setName(v);
                      if (!artist || slug === generateSlug(artist.name)) {
                        setSlug(generateSlug(v));
                      }
                    }}
                    theme={theme}
                    required
                    placeholder="Artist name"
                  />

                  {/* Slug */}
                  <Field
                    label="URL Slug"
                    value={slug}
                    onChange={setSlug}
                    theme={theme}
                    required
                    placeholder="artist-slug"
                  />

                  {/* Description (Short) */}
                  <div>
                    <label 
                      className="block text-sm font-medium mb-1.5"
                      style={{ color: theme.text.secondary }}
                    >
                      Short Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      placeholder="Brief tagline for carousels (5-10 words)"
                      className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 resize-none"
                      style={{
                        backgroundColor: "rgba(0, 0, 0, 0.4)",
                        borderColor: "rgba(255, 255, 255, 0.2)",
                        color: theme.text.primary,
                      }}
                    />
                  </div>

                  {/* Full Description */}
                  <div>
                    <label 
                      className="block text-sm font-medium mb-1.5"
                      style={{ color: theme.text.secondary }}
                    >
                      Full Description
                    </label>
                    <textarea
                      value={fullDescription}
                      onChange={(e) => setFullDescription(e.target.value)}
                      rows={5}
                      placeholder="Full bio for the artist page"
                      className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 resize-none"
                      style={{
                        backgroundColor: "rgba(0, 0, 0, 0.4)",
                        borderColor: "rgba(255, 255, 255, 0.2)",
                        color: theme.text.primary,
                      }}
                    />
                  </div>

                  {/* Cover (required - for home rows) */}
                  <JMImageUpload
                    label="Cover Image (2:1) *"
                    value={coverURL}
                    onChange={(url) => setCoverURL(url || "")}
                    onUpload={handleCoverUpload}
                    aspectRatio="wide"
                    previewSize={200}
                    maxWidth={1200}
                  />

                  {/* Avatar (optional) */}
                  <JMImageUpload
                    label="Avatar Image (1:1)"
                    value={avatarURL}
                    onChange={(url) => setAvatarURL(url || "")}
                    onUpload={handleAvatarUpload}
                    aspectRatio="square"
                    previewSize={150}
                    maxWidth={512}
                  />

                  {/* Banner (optional - for featured carousel) */}
                  <JMImageUpload
                    label="Banner Image (16:9) - for Featured Carousel"
                    value={bannerURL}
                    onChange={(url) => setBannerURL(url || "")}
                    onUpload={handleBannerUpload}
                    aspectRatio="wide"
                    previewSize={200}
                    maxWidth={1920}
                  />

                  {/* Login Background (optional - for auth page) */}
                  <JMImageUpload
                    label="Login Background - custom auth page background"
                    value={loginBgURL}
                    onChange={(url) => setLoginBgURL(url || "")}
                    onUpload={handleLoginBgUpload}
                    aspectRatio="wide"
                    previewSize={200}
                    maxWidth={1920}
                  />
                </div>
              </Section>

              {/* Albums Section - only show for existing artists */}
              {!isCreating && (
                <Section title="Albums" theme={theme}>
                  <div className="space-y-3">
                    {/* Add button */}
                    <button
                      onClick={startAddAlbum}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
                      style={{
                        backgroundColor: `${theme.accents.goldenGlow}20`,
                        color: theme.accents.goldenGlow,
                      }}
                    >
                      <Disc size={16} />
                      Add Album
                    </button>

                    {/* Albums list */}
                    {albums.length > 0 ? (
                      <div className="space-y-2">
                        {albums.map((album) => (
                          <div key={album.id}>
                            {/* Album header */}
                            <div
                              className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-white/5 cursor-pointer"
                              onClick={() => toggleAlbum(album.id)}
                            >
                              {expandedAlbums.has(album.id) ? (
                                <ChevronDown size={16} style={{ color: theme.text.tertiary }} />
                              ) : (
                                <ChevronRight size={16} style={{ color: theme.text.tertiary }} />
                              )}
                              <Disc size={16} style={{ color: theme.accents.goldenGlow }} />
                              <span style={{ color: theme.text.primary }} className="flex-1 text-left">
                                {album.name}
                              </span>
                              <span 
                                className="text-xs"
                                style={{ color: theme.text.tertiary }}
                              >
                                {album.songs.length} song{album.songs.length !== 1 ? "s" : ""}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleAlbumPublish(album);
                                }}
                                className="p-1 rounded hover:bg-white/10 transition-colors"
                                style={{ color: album.isPublished ? theme.semantic.success : theme.text.tertiary }}
                              >
                                {album.isPublished ? <Eye size={14} /> : <EyeOff size={14} />}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditAlbum(album);
                                }}
                                className="p-1 rounded hover:bg-white/10 transition-colors"
                                style={{ color: theme.text.tertiary }}
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteAlbum(album);
                                }}
                                className="p-1 rounded hover:bg-red-500/20 transition-colors"
                                style={{ color: theme.text.tertiary }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>

                            {/* Songs in album */}
                            {expandedAlbums.has(album.id) && (
                              <div className="ml-8 mt-1 space-y-1">
                                {album.songs.map((song) => (
                                  <div 
                                    key={song.id}
                                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5"
                                  >
                                    <span 
                                      className="text-xs font-mono w-6 text-center"
                                      style={{ color: theme.accents.neonPink }}
                                    >
                                      {song.trackNumber}
                                    </span>
                                    <Music size={14} style={{ color: theme.text.tertiary }} />
                                    <span 
                                      className="flex-1 text-sm"
                                      style={{ color: theme.text.secondary }}
                                    >
                                      {song.title}
                                    </span>
                                    <span 
                                      className="text-xs"
                                      style={{ color: theme.text.tertiary }}
                                    >
                                      {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, "0")}
                                    </span>
                                    <button
                                      onClick={() => handleToggleSongPublish(song)}
                                      className="p-1 rounded hover:bg-white/10 transition-colors"
                                      style={{ color: song.isPublished ? theme.semantic.success : theme.text.tertiary }}
                                    >
                                      {song.isPublished ? <Eye size={12} /> : <EyeOff size={12} />}
                                    </button>
                                    <button
                                      onClick={() => startEditSong(song)}
                                      className="p-1 rounded hover:bg-white/10 transition-colors"
                                      style={{ color: theme.text.tertiary }}
                                    >
                                      <Pencil size={12} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSong(song)}
                                      className="p-1 rounded hover:bg-red-500/20 transition-colors"
                                      style={{ color: theme.text.tertiary }}
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                ))}
                                
                                {/* Add song to album */}
                                <button
                                  onClick={() => startAddSong(album.id)}
                                  className="flex items-center gap-2 p-2 rounded-lg text-sm transition-colors hover:bg-white/5"
                                  style={{ color: theme.text.tertiary }}
                                >
                                  <Plus size={14} />
                                  Add song
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm" style={{ color: theme.text.tertiary }}>
                        No albums yet. Add your first album above.
                      </p>
                    )}
                  </div>
                </Section>
              )}

              {/* Music Videos Section - only show for existing artists */}
              {!isCreating && (
                <Section title="Music Videos" theme={theme}>
                  <div className="space-y-3">
                    {/* Add button */}
                    <button
                      onClick={startAddVideo}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
                      style={{
                        backgroundColor: `${theme.accents.neonPink}20`,
                        color: theme.accents.neonPink,
                      }}
                    >
                      <Video size={16} />
                      Add Music Video
                    </button>

                    {/* Videos list */}
                    {musicVideos.length > 0 ? (
                      <div className="space-y-2">
                        {musicVideos.map((video) => (
                          <div 
                            key={video.id}
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5"
                          >
                            <Play size={16} style={{ color: theme.accents.neonPink }} />
                            <span 
                              className="flex-1"
                              style={{ color: theme.text.primary }}
                            >
                              {video.title}
                            </span>
                            <span 
                              className="text-xs px-2 py-0.5 rounded"
                              style={{ 
                                backgroundColor: theme.surfaces.elevated2,
                                color: theme.text.tertiary,
                              }}
                            >
                              {video.orientation}
                            </span>
                            <button
                              onClick={() => handleToggleVideoPublish(video)}
                              className="p-1 rounded hover:bg-white/10 transition-colors"
                              style={{ color: video.isPublished ? theme.semantic.success : theme.text.tertiary }}
                            >
                              {video.isPublished ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                            <button
                              onClick={() => startEditVideo(video)}
                              className="p-1 rounded hover:bg-white/10 transition-colors"
                              style={{ color: theme.text.tertiary }}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteVideo(video)}
                              className="p-1 rounded hover:bg-red-500/20 transition-colors"
                              style={{ color: theme.text.tertiary }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm" style={{ color: theme.text.tertiary }}>
                        No music videos yet. Add your first video above.
                      </p>
                    )}
                  </div>
                </Section>
              )}
            </>
          ) : view === "add-album" || view === "edit-album" ? (
            // Album form
            <div className="space-y-4">
              <Field
                label="Album Name"
                value={formState.name}
                onChange={(v) => setFormState({ ...formState, name: v })}
                theme={theme}
                required
                placeholder="Album title"
              />
              
              <div>
                <label 
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: theme.text.secondary }}
                >
                  Description
                </label>
                <textarea
                  value={formState.description}
                  onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                  rows={2}
                  placeholder="Album description (optional)"
                  className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 resize-none"
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.4)",
                    borderColor: "rgba(255, 255, 255, 0.2)",
                    color: theme.text.primary,
                  }}
                />
              </div>

              <JMImageUpload
                label="Cover Image (1:1) *"
                value={formState.coverImageURL}
                onChange={(url) => setFormState({ ...formState, coverImageURL: url || "" })}
                onUpload={handleAlbumCoverUpload}
                aspectRatio="square"
                previewSize={150}
                maxWidth={640}
                required
              />

              <JMVideoUpload
                label="Cover Video (optional, loops on hover)"
                value={formState.coverVideoURL}
                onChange={(url) => setFormState({ ...formState, coverVideoURL: url || "" })}
                onUpload={handleAlbumVideoUpload}
                previewSize={150}
                maxSizeMB={10}
              />

              {error && (
                <div 
                  className="text-sm px-4 py-2 rounded-lg"
                  style={{ 
                    backgroundColor: `${theme.semantic.error}20`,
                    color: theme.semantic.error,
                  }}
                >
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setView("main");
                    setSelectedAlbum(null);
                    setError(null);
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/10"
                  style={{ color: theme.text.secondary }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAlbum}
                  disabled={!formState.name.trim() || !formState.coverImageURL || isFormSaving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 hover:scale-105 disabled:hover:scale-100"
                  style={{
                    backgroundColor: theme.accents.goldenGlow,
                    color: theme.surfaces.base,
                  }}
                >
                  {isFormSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {view === "add-album" ? "Create Album" : "Save Album"}
                </button>
              </div>
            </div>
          ) : view === "add-song" || view === "edit-song" ? (
            // Song form
            <div className="space-y-4">
              <Field
                label="Song Title"
                value={formState.title}
                onChange={(v) => setFormState({ ...formState, title: v })}
                theme={theme}
                required
                placeholder="Song title"
              />

              <Field
                label="Track Number"
                value={String(formState.trackNumber)}
                onChange={(v) => setFormState({ ...formState, trackNumber: parseInt(v) || 1 })}
                theme={theme}
                type="number"
              />
              
              <div>
                <label 
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: theme.text.secondary }}
                >
                  Description
                </label>
                <textarea
                  value={formState.description}
                  onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                  rows={2}
                  placeholder="Song description (optional)"
                  className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 resize-none"
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.4)",
                    borderColor: "rgba(255, 255, 255, 0.2)",
                    color: theme.text.primary,
                  }}
                />
              </div>

              <JMAudioUpload
                label="Audio File *"
                value={formState.audioURL}
                onChange={(url) => setFormState({ ...formState, audioURL: url || "" })}
                onUpload={handleSongAudioUpload}
                onDurationDetected={(dur) => setFormState(prev => ({ ...prev, duration: dur }))}
                required
              />

              <Field
                label="Duration (seconds)"
                value={String(formState.duration)}
                onChange={(v) => setFormState({ ...formState, duration: parseInt(v) || 0 })}
                theme={theme}
                type="number"
              />
              
              <div>
                <label 
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: theme.text.secondary }}
                >
                  Lyrics
                </label>
                <textarea
                  value={formState.lyrics}
                  onChange={(e) => setFormState({ ...formState, lyrics: e.target.value })}
                  rows={6}
                  placeholder="Song lyrics (optional)"
                  className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 resize-none font-mono"
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.4)",
                    borderColor: "rgba(255, 255, 255, 0.2)",
                    color: theme.text.primary,
                  }}
                />
              </div>

              {error && (
                <div 
                  className="text-sm px-4 py-2 rounded-lg"
                  style={{ 
                    backgroundColor: `${theme.semantic.error}20`,
                    color: theme.semantic.error,
                  }}
                >
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setView("main");
                    setSelectedSong(null);
                    setSelectedAlbumId(null);
                    setError(null);
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/10"
                  style={{ color: theme.text.secondary }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSong}
                  disabled={!formState.title.trim() || !formState.audioURL || isFormSaving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 hover:scale-105 disabled:hover:scale-100"
                  style={{
                    backgroundColor: theme.accents.goldenGlow,
                    color: theme.surfaces.base,
                  }}
                >
                  {isFormSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {view === "add-song" ? "Create Song" : "Save Song"}
                </button>
              </div>
            </div>
          ) : view === "add-video" || view === "edit-video" ? (
            // Music Video form
            <div className="space-y-4">
              <Field
                label="Video Title"
                value={formState.title}
                onChange={(v) => setFormState({ ...formState, title: v })}
                theme={theme}
                required
                placeholder="Music video title"
              />
              
              <div>
                <label 
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: theme.text.secondary }}
                >
                  Description
                </label>
                <textarea
                  value={formState.description}
                  onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                  rows={2}
                  placeholder="Video description (optional)"
                  className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 resize-none"
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.4)",
                    borderColor: "rgba(255, 255, 255, 0.2)",
                    color: theme.text.primary,
                  }}
                />
              </div>

              <Field
                label="Vimeo URL"
                value={formState.vimeoURL}
                onChange={(v) => setFormState({ ...formState, vimeoURL: v })}
                theme={theme}
                required
                placeholder="https://vimeo.com/123456789"
                type="url"
              />

              <div>
                <label 
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: theme.text.secondary }}
                >
                  Orientation
                </label>
                <select
                  value={formState.orientation}
                  onChange={(e) => setFormState({ ...formState, orientation: e.target.value as JMMusicVideoOrientation })}
                  className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1"
                  style={{
                    backgroundColor: "rgba(0, 0, 0, 0.4)",
                    borderColor: "rgba(255, 255, 255, 0.2)",
                    color: theme.text.primary,
                  }}
                >
                  {(Object.keys(JMMusicVideoOrientationLabels) as JMMusicVideoOrientation[]).map((orient) => (
                    <option key={orient} value={orient}>
                      {JMMusicVideoOrientationLabels[orient]}
                    </option>
                  ))}
                </select>
              </div>

              <JMImageUpload
                label="Custom Thumbnail (optional)"
                value={formState.thumbnailURL}
                onChange={(url) => setFormState({ ...formState, thumbnailURL: url || "" })}
                onUpload={handleVideoThumbnailUpload}
                aspectRatio={formState.orientation === "portrait" ? "square" : "landscape"}
                previewSize={150}
                maxWidth={640}
              />

              {error && (
                <div 
                  className="text-sm px-4 py-2 rounded-lg"
                  style={{ 
                    backgroundColor: `${theme.semantic.error}20`,
                    color: theme.semantic.error,
                  }}
                >
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setView("main");
                    setSelectedVideo(null);
                    setError(null);
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/10"
                  style={{ color: theme.text.secondary }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveVideo}
                  disabled={!formState.title.trim() || !formState.vimeoURL.trim() || isFormSaving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 hover:scale-105 disabled:hover:scale-100"
                  style={{
                    backgroundColor: theme.accents.goldenGlow,
                    color: theme.surfaces.base,
                  }}
                >
                  {isFormSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {view === "add-video" ? "Create Video" : "Save Video"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
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
        }}
      />
    </div>
  );
}
