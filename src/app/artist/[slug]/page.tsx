"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Player from "@vimeo/player";
import { JMAppHeader } from "@/JMKit";
import { useJMStyle } from "@/JMStyle";
import {
  getArtistBySlug,
  getAlbumsByArtist,
  getSongsByAlbum,
  getMusicVideosByArtist,
} from "@/lib/content";
import type { JMArtist, JMAlbum, JMSong, JMMusicVideo, JMMusicVideoOrientation } from "@/lib/content-types";
import {
  Play, Pause, SkipForward, SkipBack,
  FileText, X, Loader2, Video,
} from "lucide-react";

// Album with songs
interface AlbumWithSongs extends JMAlbum {
  songs: JMSong[];
}

export default function ArtistPage() {
  const params = useParams();
  const { theme } = useJMStyle();
  const slug = params["slug"] as string;

  // Data state
  const [artist, setArtist] = useState<JMArtist | null>(null);
  const [albums, setAlbums] = useState<AlbumWithSongs[]>([]);
  const [musicVideos, setMusicVideos] = useState<JMMusicVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Current album (first one for now)
  const currentAlbum = albums[0] || null;

  // Audio player state
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentSongIndex, setCurrentSongIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Album cover video state
  const coverVideoRef = useRef<HTMLVideoElement>(null);
  const [coverVideoLoaded, setCoverVideoLoaded] = useState(false);

  // Lyrics modal state
  const [lyricsModalSong, setLyricsModalSong] = useState<JMSong | null>(null);

  // Music video player state
  const [playingVideo, setPlayingVideo] = useState<JMMusicVideo | null>(null);
  const videoPlayerContainerRef = useRef<HTMLDivElement>(null);
  const vimeoPlayerRef = useRef<Player | null>(null);

  // Album description expansion
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  // Load artist data
  useEffect(() => {
    const loadArtist = async () => {
      if (!slug) return;

      setIsLoading(true);
      setError(null);

      try {
        const artistData = await getArtistBySlug(slug);
        if (!artistData) {
          setError("Artist not found");
          return;
        }

        setArtist(artistData);

        // Load albums with songs
        const albumsData = await getAlbumsByArtist(artistData.id, true);
        const albumsWithSongs = await Promise.all(
          albumsData.map(async (album) => {
            const songs = await getSongsByAlbum(album.id, true);
            return { ...album, songs };
          })
        );
        setAlbums(albumsWithSongs);

        // Load music videos
        const videosData = await getMusicVideosByArtist(artistData.id, true);
        setMusicVideos(videosData);
      } catch (err) {
        console.error("Failed to load artist:", err);
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(`Failed to load artist: ${message}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadArtist();
  }, [slug]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => {
      // Play next song in list
      if (currentSongIndex !== null && currentAlbum) {
        const nextIndex = currentSongIndex + 1;
        if (nextIndex < currentAlbum.songs.length) {
          playSong(nextIndex);
        } else {
          setIsPlaying(false);
          setCurrentSongIndex(null);
        }
      }
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, [currentSongIndex, currentAlbum]);

  // Play a specific song
  const playSong = useCallback((index: number) => {
    if (!currentAlbum || !audioRef.current) return;
    const song = currentAlbum.songs[index];
    if (!song) return;

    setCurrentSongIndex(index);
    audioRef.current.src = song.audioURL;
    audioRef.current.play();
  }, [currentAlbum]);

  // Toggle play/pause
  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      if (currentSongIndex === null && currentAlbum?.songs.length) {
        playSong(0);
      } else {
        audioRef.current.play();
      }
    }
  };

  // Play all songs
  const playAll = () => {
    if (currentAlbum?.songs.length) {
      playSong(0);
    }
  };

  // Skip to next/previous
  const skipNext = () => {
    if (currentSongIndex !== null && currentAlbum) {
      const nextIndex = currentSongIndex + 1;
      if (nextIndex < currentAlbum.songs.length) {
        playSong(nextIndex);
      }
    }
  };

  const skipPrev = () => {
    if (currentSongIndex !== null && currentAlbum) {
      // If more than 3 seconds in, restart current song
      if (audioRef.current && audioRef.current.currentTime > 3) {
        audioRef.current.currentTime = 0;
      } else {
        const prevIndex = currentSongIndex - 1;
        if (prevIndex >= 0) {
          playSong(prevIndex);
        }
      }
    }
  };

  // Format time as mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Seek in song
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    audioRef.current.currentTime = percentage * duration;
  };

  // Extract Vimeo video ID from URL
  const getVimeoId = (url: string): string | null => {
    if (!url) return null;
    const patterns = [
      /vimeo\.com\/(\d+)/,
      /player\.vimeo\.com\/video\/(\d+)/,
      /vimeo\.com\/video\/(\d+)/,
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match?.[1]) return match[1];
    }
    return null;
  };

  // Calculate video player dimensions
  const calculatePlayerDimensions = (orientation: JMMusicVideoOrientation) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let playerWidth: number;
    let playerHeight: number;

    if (orientation === "portrait") {
      const aspectRatio = 9 / 16;
      playerHeight = viewportHeight * 0.9;
      playerWidth = playerHeight * aspectRatio;
      if (playerWidth > viewportWidth * 0.9) {
        playerWidth = viewportWidth * 0.9;
        playerHeight = playerWidth / aspectRatio;
      }
    } else {
      const aspectRatio = 16 / 9;
      playerWidth = viewportWidth * 0.9;
      playerHeight = playerWidth / aspectRatio;
      if (playerHeight > viewportHeight * 0.9) {
        playerHeight = viewportHeight * 0.9;
        playerWidth = playerHeight * aspectRatio;
      }
    }

    return { width: playerWidth, height: playerHeight };
  };

  // Initialize Vimeo player for music video
  useEffect(() => {
    if (!playingVideo || !videoPlayerContainerRef.current) return;

    const vimeoId = getVimeoId(playingVideo.vimeoURL);
    if (!vimeoId) return;

    // Clear previous player
    if (vimeoPlayerRef.current) {
      vimeoPlayerRef.current.destroy();
      vimeoPlayerRef.current = null;
    }

    const { width, height } = calculatePlayerDimensions(playingVideo.orientation);

    const player = new Player(videoPlayerContainerRef.current, {
      id: parseInt(vimeoId),
      width,
      height,
      autoplay: false,
      muted: false,
      controls: true,
      responsive: false,
      title: false,
      byline: false,
      portrait: false,
      playsinline: true,
    });

    vimeoPlayerRef.current = player;

    return () => {
      if (vimeoPlayerRef.current) {
        vimeoPlayerRef.current.destroy();
        vimeoPlayerRef.current = null;
      }
    };
  }, [playingVideo]);

  // Close video player
  const closeVideoPlayer = () => {
    if (vimeoPlayerRef.current) {
      vimeoPlayerRef.current.destroy();
      vimeoPlayerRef.current = null;
    }
    setPlayingVideo(null);
  };

  // Get Vimeo thumbnail
  const getVimeoThumbnail = (vimeoId: string): string => {
    return `https://vumbnail.com/${vimeoId}.jpg`;
  };

  // Loading state
  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: theme.surfaces.base }}
      >
        <Loader2
          className="h-10 w-10 animate-spin"
          style={{ color: theme.accents.goldenGlow }}
        />
      </div>
    );
  }

  // Error state
  if (error || !artist) {
    return (
      <div
        className="min-h-screen"
        style={{ backgroundColor: theme.surfaces.base }}
      >
        <JMAppHeader />
        <div className="flex flex-col items-center justify-center pt-32">
          <h1
            className="text-2xl font-bold mb-4"
            style={{ color: theme.text.primary }}
          >
            {error || "Artist not found"}
          </h1>
        </div>
      </div>
    );
  }

  const currentSong = currentSongIndex !== null ? currentAlbum?.songs[currentSongIndex] : null;

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: theme.surfaces.base }}
    >
      <JMAppHeader />

      {/* Hidden audio element */}
      <audio ref={audioRef} preload="metadata" />

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 pt-20 sm:pt-24 pb-32">
        {/* Album Section - placeholder div for future album picker */}
        {currentAlbum && (
          <div className="mb-12">
            {/* Album Cover with Video */}
            <div className="relative aspect-square w-full mb-10 rounded-2xl overflow-hidden shadow-2xl">
              {/* Video background (if exists) */}
              {currentAlbum.coverVideoURL && (
                <video
                  ref={coverVideoRef}
                  src={currentAlbum.coverVideoURL}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
                    coverVideoLoaded ? "opacity-100" : "opacity-0"
                  }`}
                  autoPlay
                  loop
                  muted
                  playsInline
                  onCanPlay={() => setCoverVideoLoaded(true)}
                />
              )}

              {/* Static cover image (shown until video loads) */}
              <Image
                src={currentAlbum.coverImageURL}
                alt={currentAlbum.name}
                fill
                className={`object-cover transition-opacity duration-500 ${
                  currentAlbum.coverVideoURL && coverVideoLoaded ? "opacity-0" : "opacity-100"
                }`}
                priority
              />
            </div>

            {/* Album Title & Description */}
            <div className="mb-8">
              <h2
                className="text-2xl font-bold mb-4"
                style={{ color: theme.text.primary }}
              >
                {currentAlbum.name}
              </h2>
              {currentAlbum.description && (
                <div>
                  <p
                    className={`text-sm leading-relaxed ${
                      !isDescriptionExpanded ? "line-clamp-3" : ""
                    }`}
                    style={{ color: theme.text.tertiary }}
                  >
                    {currentAlbum.description}
                  </p>
                  {currentAlbum.description.length > 150 && (
                    <button
                      onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                      className="text-sm mt-2 hover:underline"
                      style={{ color: theme.accents.goldenGlow }}
                    >
                      {isDescriptionExpanded ? "Show Less" : "Read More"}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Play All Button */}
            <div className="flex justify-center mb-6">
              <button
                onClick={playAll}
                className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-transform hover:scale-105"
                style={{
                  backgroundColor: theme.accents.goldenGlow,
                  color: theme.surfaces.base,
                }}
              >
                <Play size={20} fill="currentColor" />
                Play All
              </button>
            </div>

            {/* Song List */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ backgroundColor: theme.surfaces.elevated1 }}
            >
              {currentAlbum.songs.map((song, index) => (
                <div
                  key={song.id}
                  className={`flex items-center gap-4 px-4 py-3 transition-colors cursor-pointer ${
                    currentSongIndex === index ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                  onClick={() => playSong(index)}
                >
                  {/* Track number or play indicator */}
                  <div className="w-8 text-center">
                    {currentSongIndex === index && isPlaying ? (
                      <div className="flex items-center justify-center gap-0.5">
                        <span
                          className="w-1 h-3 rounded-full animate-pulse"
                          style={{ backgroundColor: theme.accents.goldenGlow }}
                        />
                        <span
                          className="w-1 h-4 rounded-full animate-pulse"
                          style={{ backgroundColor: theme.accents.goldenGlow, animationDelay: "0.1s" }}
                        />
                        <span
                          className="w-1 h-2 rounded-full animate-pulse"
                          style={{ backgroundColor: theme.accents.goldenGlow, animationDelay: "0.2s" }}
                        />
                      </div>
                    ) : (
                      <span
                        className="text-sm font-mono"
                        style={{ color: theme.text.tertiary }}
                      >
                        {song.trackNumber}
                      </span>
                    )}
                  </div>

                  {/* Song info */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-medium truncate"
                      style={{
                        color: currentSongIndex === index
                          ? theme.accents.goldenGlow
                          : theme.text.primary,
                      }}
                    >
                      {song.title}
                    </p>
                  </div>

                  {/* Duration */}
                  <span
                    className="text-sm"
                    style={{ color: theme.text.tertiary }}
                  >
                    {formatTime(song.duration)}
                  </span>

                  {/* Lyrics button */}
                  {song.lyrics && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setLyricsModalSong(song);
                      }}
                      className="p-2 rounded-full hover:bg-white/10 transition-colors"
                      style={{ color: theme.text.tertiary }}
                      title="View lyrics"
                    >
                      <FileText size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Music Videos Section */}
        {musicVideos.length > 0 && (
          <div className="mb-12">
            <h3
              className="text-xl font-bold mb-4 flex items-center gap-2"
              style={{ color: theme.text.primary }}
            >
              <Video size={24} />
              Music Videos
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {musicVideos.map((video) => {
                const vimeoId = getVimeoId(video.vimeoURL);
                const thumbnailURL = video.thumbnailURL || (vimeoId ? getVimeoThumbnail(vimeoId) : "");

                return (
                  <div
                    key={video.id}
                    className="rounded-xl overflow-hidden cursor-pointer transition-transform hover:scale-[1.02]"
                    style={{ backgroundColor: theme.surfaces.elevated1 }}
                    onClick={() => setPlayingVideo(video)}
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-9/16">
                      {thumbnailURL && (
                        <Image
                          src={thumbnailURL}
                          alt={video.title}
                          fill
                          className="object-cover"
                        />
                      )}
                      {/* Play overlay */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div
                          className="p-4 rounded-full"
                          style={{ backgroundColor: `${theme.accents.goldenGlow}90` }}
                        >
                          <Play size={32} fill="white" style={{ color: "white" }} />
                        </div>
                      </div>
                    </div>

                    {/* Title */}
                    <div className="p-4">
                      <h4
                        className="font-semibold"
                        style={{ color: theme.text.primary }}
                      >
                        {video.title}
                      </h4>
                      {video.description && (
                        <p
                          className="text-sm mt-1 line-clamp-2"
                          style={{ color: theme.text.secondary }}
                        >
                          {video.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Artist Description - at bottom */}
        {artist.description && (
          <div
            className="mt-8 pt-8 border-t"
            style={{ borderColor: theme.surfaces.elevated2 }}
          >
            <h3
              className="text-lg font-semibold mb-3"
              style={{ color: theme.text.primary }}
            >
              About {artist.name}
            </h3>
            <p
              className="text-sm leading-relaxed"
              style={{ color: theme.text.tertiary }}
            >
              {artist.fullDescription || artist.description}
            </p>
          </div>
        )}
      </main>

      {/* Fixed Audio Player Bar */}
      {currentSong && (
        <div
          className="fixed bottom-0 left-0 right-0 border-t backdrop-blur-lg z-40"
          style={{
            backgroundColor: `${theme.surfaces.base}ee`,
            borderColor: theme.surfaces.elevated2,
          }}
        >
          <div className="max-w-4xl mx-auto px-4 py-3">
            {/* Progress bar */}
            <div
              className="h-1 rounded-full cursor-pointer mb-3"
              style={{ backgroundColor: theme.surfaces.elevated2 }}
              onClick={handleSeek}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                  backgroundColor: theme.accents.goldenGlow,
                }}
              />
            </div>

            <div className="flex items-center gap-4">
              {/* Song info */}
              <div className="flex-1 min-w-0">
                <p
                  className="font-medium truncate"
                  style={{ color: theme.text.primary }}
                >
                  {currentSong.title}
                </p>
                <p
                  className="text-sm truncate"
                  style={{ color: theme.text.tertiary }}
                >
                  {artist.name} • {currentAlbum?.name}
                </p>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={skipPrev}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                  style={{ color: theme.text.primary }}
                >
                  <SkipBack size={20} />
                </button>

                <button
                  onClick={togglePlayPause}
                  className="p-3 rounded-full transition-colors"
                  style={{
                    backgroundColor: theme.accents.goldenGlow,
                    color: theme.surfaces.base,
                  }}
                >
                  {isPlaying ? <Pause size={24} /> : <Play size={24} fill="currentColor" />}
                </button>

                <button
                  onClick={skipNext}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                  style={{ color: theme.text.primary }}
                >
                  <SkipForward size={20} />
                </button>
              </div>

              {/* Time */}
              <div
                className="text-sm hidden sm:block"
                style={{ color: theme.text.tertiary }}
              >
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lyrics Modal */}
      {lyricsModalSong && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setLyricsModalSong(null)}
          />

          {/* Modal */}
          <div
            className="relative w-full max-w-lg max-h-[80vh] rounded-2xl overflow-hidden flex flex-col"
            style={{ backgroundColor: theme.surfaces.base }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-4 border-b shrink-0"
              style={{ borderColor: theme.surfaces.elevated2 }}
            >
              <div>
                <h3
                  className="font-bold"
                  style={{ color: theme.text.primary }}
                >
                  {lyricsModalSong.title}
                </h3>
                <p
                  className="text-sm"
                  style={{ color: theme.text.tertiary }}
                >
                  Lyrics
                </p>
              </div>
              <button
                onClick={() => setLyricsModalSong(null)}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                style={{ color: theme.text.secondary }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Lyrics content */}
            <div className="flex-1 overflow-y-auto p-6">
              <pre
                className="whitespace-pre-wrap font-sans text-base leading-relaxed"
                style={{ color: theme.text.primary }}
              >
                {lyricsModalSong.lyrics}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Music Video Player Modal */}
      {playingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
          {/* Close button */}
          <button
            onClick={closeVideoPlayer}
            className="absolute top-4 right-4 z-10 p-3 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
            style={{ color: "white" }}
          >
            <X size={24} />
          </button>

          {/* Video title */}
          <div className="absolute top-4 left-4 z-10">
            <h3 className="text-white font-bold text-lg">{playingVideo.title}</h3>
          </div>

          {/* Vimeo player container */}
          <div
            ref={videoPlayerContainerRef}
            className="flex items-center justify-center"
          />
        </div>
      )}
    </div>
  );
}
