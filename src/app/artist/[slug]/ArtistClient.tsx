"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { JMAppHeader, JMVimeoPlayer, getVimeoThumbnail } from "@/JMKit";
import { useJMStyle } from "@/JMStyle";
import { useAuth } from "@/lib/AuthProvider";
import type {
  ArtistPageData,
  ArtistSongData,
  ArtistVideoData,
} from "@/lib/detail-server";
import {
  Play, Pause, SkipForward, SkipBack,
  FileText, X, Video, Download,
} from "lucide-react";
import { PointsManager, Activity } from "@/lib/points";

export default function ArtistClient({ data }: { data: ArtistPageData }) {
  const { theme } = useJMStyle();
  const { user, isLoading: authLoading } = useAuth();
  const searchParams = useSearchParams();

  const { artist, albums, musicVideos } = data;

  // Current album: ?album={id} (album-grid deep links) selects it; else first.
  const albumParam = searchParams.get("album");
  const currentAlbum =
    (albumParam ? albums.find((a) => a.id === albumParam) : undefined) ??
    albums[0] ??
    null;

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
  const [lyricsModalSong, setLyricsModalSong] = useState<ArtistSongData | null>(null);

  // Music video player state
  const [playingVideo, setPlayingVideo] = useState<ArtistVideoData | null>(null);

  // Album description expansion
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  // Auth gate: when the artist is NOT open-access and there's no user, send
  // them to /auth (same query params AuthGate used to set before the artist
  // route was opened up). Open-access artists stay on the page for everyone.
  useEffect(() => {
    if (authLoading) return;
    if (user) return;
    if (artist.openAccess) return;

    const params = new URLSearchParams({
      redirect: `/artist/${artist.slug}`,
      contentType: "artist",
      contentSlug: artist.slug,
    });
    window.location.href = `/auth?${params.toString()}`;
  }, [artist.openAccess, artist.slug, user, authLoading]);

  // Open-access artists get the minimal J-only header for *everyone* —
  // signed in or not — so audonna.com / similar public-facing pages read
  // as a single consistent experience instead of switching chrome based
  // on who's looking.
  // Header rules for /artist/*:
  // - Anon visitor: ALWAYS minimal — even during the initial load or in
  //   an error state. They can't use the menu, and shouldn't be tempted
  //   to tap "Log out" when they're not signed in (which throws their
  //   session into a broken state on retry).
  // - Signed-in user on an open-access artist: minimal — keeps the
  //   public-facing page consistent for everyone.
  // - Signed-in user on a gated artist: default header.
  const isOpenAccess = artist.openAccess;
  const headerVariant: "default" | "minimal" =
    !user || isOpenAccess ? "minimal" : "default";

  // Play a specific song
  const playSong = useCallback((index: number) => {
    if (!currentAlbum || !audioRef.current) return;
    const song = currentAlbum.songs[index];
    if (!song || song.tease) return; // teased songs are greyed out & unplayable

    setCurrentSongIndex(index);
    audioRef.current.src = song.audioURL;
    audioRef.current.play();
    PointsManager.award(Activity.LISTEN_SONG);
  }, [currentAlbum]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => {
      if (currentSongIndex !== null && currentAlbum) {
        // Advance to the next available (non-teased) song; stop if none remain.
        const cur = currentSongIndex;
        const nextIndex = currentAlbum.songs.findIndex((s, i) => i > cur && !s.tease);
        if (nextIndex !== -1) {
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
  }, [currentSongIndex, currentAlbum, playSong]);

  // Toggle play/pause
  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      if (currentSongIndex === null && currentAlbum?.songs.length) {
        const first = currentAlbum.songs.findIndex((s) => !s.tease);
        if (first !== -1) playSong(first);
      } else {
        audioRef.current.play();
      }
    }
  };

  // Play all songs (starting from the first available, non-teased track)
  const playAll = () => {
    if (currentAlbum?.songs.length) {
      const first = currentAlbum.songs.findIndex((s) => !s.tease);
      if (first !== -1) playSong(first);
    }
  };

  // Skip to next/previous
  const skipNext = () => {
    if (currentSongIndex !== null && currentAlbum) {
      const cur = currentSongIndex;
      const nextIndex = currentAlbum.songs.findIndex((s, i) => i > cur && !s.tease);
      if (nextIndex !== -1) {
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
        // Step back to the previous available (non-teased) song.
        let prevIndex = -1;
        for (let i = currentSongIndex - 1; i >= 0; i--) {
          if (!currentAlbum.songs[i]?.tease) { prevIndex = i; break; }
        }
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

  const closeVideoPlayer = () => setPlayingVideo(null);

  const currentSong = currentSongIndex !== null ? currentAlbum?.songs[currentSongIndex] : null;

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: theme.surfaces.base }}
    >
      <JMAppHeader variant={headerVariant} />

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
                sizes="(max-width: 640px) 60vw, 300px"
                className={`object-cover transition-opacity duration-500 ${
                  currentAlbum.coverVideoURL && coverVideoLoaded ? "opacity-0" : "opacity-100"
                }`}
                priority
              />
            </div>

            {/* Album Title & Description */}
            <div className="mb-8">
              <div className="flex items-start justify-between gap-4 mb-4">
                <h2
                  className="text-2xl font-bold"
                  style={{ color: theme.text.primary }}
                >
                  {currentAlbum.name}
                </h2>
                {currentAlbum.downloadable && (
                  <div className="flex flex-col items-end shrink-0">
                    <span
                      className="text-[11px] mb-1 text-right"
                      style={{ color: theme.text.tertiary }}
                    >
                      Free for personal and commercial use
                    </span>
                    <a
                      href={`/api/music/download-album?albumId=${currentAlbum.id}`}
                      className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-transform hover:scale-105"
                      style={{
                        backgroundColor: theme.surfaces.elevated1,
                        color: theme.text.primary,
                        border: `1px solid ${theme.surfaces.elevated2}`,
                      }}
                    >
                      <Download size={16} />
                      Download Songs
                    </a>
                  </div>
                )}
              </div>
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
              {currentAlbum.songs.map((song, index) => {
                const teased = !!song.tease;
                return (
                <div
                  key={song.id}
                  aria-disabled={teased}
                  className={`flex items-center gap-4 px-4 py-3 transition-colors ${
                    teased
                      ? "cursor-not-allowed"
                      : `cursor-pointer ${
                          currentSongIndex === index ? "bg-white/10" : "hover:bg-white/5"
                        }`
                  }`}
                  onClick={teased ? undefined : () => playSong(index)}
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
                      className={`font-medium truncate ${teased ? "opacity-50" : ""}`}
                      style={{
                        color: currentSongIndex === index
                          ? theme.accents.goldenGlow
                          : theme.text.primary,
                      }}
                    >
                      {song.title}
                    </p>
                  </div>

                  {/* Duration, or a "Soon" badge for teased tracks */}
                  {teased ? (
                    <span
                      className="text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: theme.surfaces.elevated2, color: theme.text.tertiary }}
                    >
                      Soon
                    </span>
                  ) : (
                    <span
                      className="text-sm"
                      style={{ color: theme.text.tertiary }}
                    >
                      {formatTime(song.duration)}
                    </span>
                  )}

                  {/* Lyrics button (hidden for teased tracks) */}
                  {song.lyrics && !teased && (
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
                );
              })}
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
                const thumbnailURL = video.thumbnailURL || getVimeoThumbnail(video.vimeoURL) || "";
                const teased = !!video.tease;

                return (
                  <div
                    key={video.id}
                    aria-disabled={teased}
                    className={`rounded-xl overflow-hidden transition-transform ${
                      teased ? "cursor-not-allowed" : "cursor-pointer hover:scale-[1.02]"
                    }`}
                    style={{ backgroundColor: theme.surfaces.elevated1 }}
                    onClick={teased ? undefined : () => setPlayingVideo(video)}
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-9/16">
                      {thumbnailURL && (
                        <Image
                          src={thumbnailURL}
                          alt={video.title}
                          fill
                          sizes="(max-width: 640px) 40vw, 180px"
                          className={`object-cover ${teased ? "grayscale opacity-50" : ""}`}
                        />
                      )}
                      {/* Overlay: play affordance, or a "Soon" badge for teased videos */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        {teased ? (
                          <span
                            className="text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full"
                            style={{ backgroundColor: `${theme.surfaces.base}cc`, color: theme.text.secondary }}
                          >
                            Soon
                          </span>
                        ) : (
                          <div
                            className="p-4 rounded-full"
                            style={{ backgroundColor: `${theme.accents.goldenGlow}90` }}
                          >
                            <Play size={32} fill="white" style={{ color: "white" }} />
                          </div>
                        )}
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
        <JMVimeoPlayer
          vimeoURL={playingVideo.vimeoURL}
          orientation={playingVideo.orientation}
          title={playingVideo.title}
          onClose={closeVideoPlayer}
          pointsActivity={Activity.WATCH_VIDEO}
        />
      )}
    </div>
  );
}
