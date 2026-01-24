"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { JMAppHeader } from "@/JMKit";
import { useJMStyle } from "@/JMStyle";
import { useAuth } from "@/lib/AuthProvider";
import { getContentWithChildren } from "@/lib/content";
import type { JMContentWithChildren, JMVideoOrientation } from "@/lib/content-types";
import { JMReleaseDayLabels } from "@/lib/content-types";
import Image from "next/image";
import Player from "@vimeo/player";
import { 
  Play, ChevronDown, X, ChevronLeft, ChevronRight,
  Loader2, ArrowLeft, Flame
} from "lucide-react";

// Episode access status for free users
type EpisodeAccess = "released" | "early_access" | "locked";

export default function ShowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { theme } = useJMStyle();
  const { effectiveTier } = useAuth();
  const showId = params["id"] as string;

  const [show, setShow] = useState<JMContentWithChildren | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Season selection
  const [selectedSeasonIndex, setSelectedSeasonIndex] = useState(0);
  const [isSeasonDropdownOpen, setIsSeasonDropdownOpen] = useState(false);
  
  // Video player
  const [playingEpisode, setPlayingEpisode] = useState<JMContentWithChildren | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);

  // Determine episode access for free users
  const getEpisodeAccess = useCallback((
    episode: JMContentWithChildren, 
    allEpisodes: JMContentWithChildren[],
    episodeIndex: number
  ): EpisodeAccess => {
    // Paid users get full access
    if (effectiveTier === "paid") return "released";
    
    // Check if episode is released (releaseDate <= today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (episode.releaseDate) {
      const releaseDate = episode.releaseDate.toDate();
      releaseDate.setHours(0, 0, 0, 0);
      
      if (releaseDate <= today) {
        return "released";
      }
    }
    
    // Find the first unreleased episode (the "next" one for early access)
    const firstUnreleasedIndex = allEpisodes.findIndex(ep => {
      if (!ep.releaseDate) return true; // No release date = unreleased
      const releaseDate = ep.releaseDate.toDate();
      releaseDate.setHours(0, 0, 0, 0);
      return releaseDate > today;
    });
    
    // If this is the first unreleased episode, it's early access
    if (episodeIndex === firstUnreleasedIndex) {
      return "early_access";
    }
    
    // Otherwise it's locked
    return "locked";
  }, [effectiveTier]);

  // Load show data
  useEffect(() => {
    const loadShow = async () => {
      if (!showId) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const data = await getContentWithChildren(showId, true);
        if (data) {
          setShow(data);
        } else {
          setError("Show not found");
        }
      } catch (err) {
        console.error("Failed to load show:", err);
        setError("Failed to load show");
      } finally {
        setIsLoading(false);
      }
    };
    
    loadShow();
  }, [showId]);

  // Check if this is a standalone video (movie/special) vs series
  const isStandalone = show?.contentLevel === "standalone";
  
  // Get seasons (children of the show) - only for series
  const seasons = show?.children || [];
  const selectedSeason = seasons[selectedSeasonIndex];
  const episodes = selectedSeason?.children || [];
  const hasMultipleSeasons = seasons.length > 1;

  // Extract Vimeo video ID from URL
  const getVimeoId = (url: string): string | null => {
    if (!url) return null;
    // Handle various Vimeo URL formats
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

  // Get Vimeo thumbnail URL
  const getVimeoThumbnail = (vimeoId: string): string => {
    // Vimeo thumbnail via their CDN (may need API call for HD)
    return `https://vumbnail.com/${vimeoId}.jpg`;
  };

  // Calculate player dimensions based on video orientation
  const calculatePlayerDimensions = (orientation: JMVideoOrientation = "landscape") => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let playerWidth: number;
    let playerHeight: number;
    
    if (orientation === "portrait") {
      // Portrait (9:16): Prefer fitting to height, auto width
      const aspectRatio = 9 / 16;
      playerHeight = viewportHeight * 0.95;
      playerWidth = playerHeight * aspectRatio;
      
      // If too wide, constrain by width instead
      if (playerWidth > viewportWidth * 0.95) {
        playerWidth = viewportWidth * 0.95;
        playerHeight = playerWidth / aspectRatio;
      }
    } else if (orientation === "square") {
      // Square (1:1): 80% of the smaller dimension
      const smallerDimension = Math.min(viewportWidth, viewportHeight);
      playerWidth = smallerDimension * 0.8;
      playerHeight = smallerDimension * 0.8;
    } else {
      // Landscape (16:9): Prefer fitting to width, auto height
      const aspectRatio = 16 / 9;
      playerWidth = viewportWidth * 0.95;
      playerHeight = playerWidth / aspectRatio;
      
      // If too tall, constrain by height instead
      if (playerHeight > viewportHeight * 0.95) {
        playerHeight = viewportHeight * 0.95;
        playerWidth = playerHeight * aspectRatio;
      }
    }
    
    return { width: playerWidth, height: playerHeight };
  };

  // Initialize Vimeo player when episode is selected
  useEffect(() => {
    if (!playingEpisode || !playerContainerRef.current) return;
    
    const vimeoId = getVimeoId(playingEpisode.mediaURL || "");
    if (!vimeoId) return;
    
    // Clear previous player
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }
    
    // Get video orientation from the show (applies to both standalone and all episodes in a series)
    const videoOrientation: JMVideoOrientation = show?.videoOrientation || "landscape";
    
    // Calculate dimensions based on orientation
    const { width: playerWidth, height: playerHeight } = calculatePlayerDimensions(videoOrientation);
    
    // Create new player with SDK - no autoplay for iOS compatibility
    const player = new Player(playerContainerRef.current, {
      id: parseInt(vimeoId),
      width: playerWidth,
      height: playerHeight,
      autoplay: false,  // Don't autoplay - iOS blocks unmuted autoplay
      muted: false,
      controls: true,
      responsive: false,  // We handle sizing manually
      title: false,
      byline: false,
      portrait: false,
      playsinline: true,
    });
    
    playerRef.current = player;
    
    // Cleanup on unmount or episode change
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [playingEpisode, show?.videoOrientation]);

  // Episode scroll navigation
  const scrollEpisodes = useCallback((direction: "left" | "right") => {
    const container = document.getElementById("episodes-scroll");
    if (!container) return;
    const scrollAmount = container.clientWidth * 0.8;
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  }, []);

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

  if (error || !show) {
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
            {error || "Show not found"}
          </h1>
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg"
            style={{ 
              backgroundColor: theme.surfaces.elevated1,
              color: theme.text.primary,
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen"
      style={{ backgroundColor: theme.surfaces.base }}
    >
      <JMAppHeader />
      
      {/* Hero Banner */}
      <div className="relative w-full aspect-21/9 sm:aspect-3/1 max-h-[500px]">
        {show.backdropURL ? (
          <Image
            src={show.backdropURL}
            alt={show.name}
            fill
            className="object-cover"
          />
        ) : show.coverURL ? (
          <Image
            src={show.coverURL}
            alt={show.name}
            fill
            className="object-cover"
          />
        ) : (
          <div 
            className="w-full h-full"
            style={{ backgroundColor: theme.surfaces.elevated1 }}
          />
        )}
        
        {/* Back button */}
        <button
          onClick={() => router.push("/")}
          className="absolute top-20 left-4 sm:left-6 flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors hover:bg-white/20"
          style={{ 
            backgroundColor: `${theme.surfaces.base}80`,
            color: theme.text.primary,
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </button>
      </div>

      {/* Show description - centered below banner */}
      {show.description && (
        <div className="px-4 sm:px-6 lg:px-8 py-6 text-center">
          <p 
            className="max-w-2xl mx-auto text-sm sm:text-base"
            style={{ color: theme.text.secondary }}
          >
            {show.description}
          </p>
        </div>
      )}

      {/* Content Section */}
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {/* Standalone Video - Show centered play button */}
        {isStandalone ? (
          <div className="flex flex-col items-center py-8">
            <button
              onClick={() => show && setPlayingEpisode(show)}
              className="group flex items-center justify-center w-24 h-24 rounded-full transition-all duration-300 hover:scale-110"
              style={{ 
                backgroundColor: theme.accents.goldenGlow,
                boxShadow: `0 8px 32px ${theme.accents.goldenGlow}40`,
              }}
            >
              <Play 
                className="h-12 w-12 transition-transform group-hover:scale-110" 
                style={{ color: theme.surfaces.base, marginLeft: 4 }} 
                fill="currentColor"
              />
            </button>
            <p 
              className="mt-4 text-sm font-medium"
              style={{ color: theme.text.secondary }}
            >
              Play Video
            </p>
          </div>
        ) : (
          <>
            {/* Season Selector - Series only */}
            {seasons.length > 0 && (
              <div className="mb-6">
                <div className="relative inline-block">
                  <button
                    onClick={() => hasMultipleSeasons && setIsSeasonDropdownOpen(!isSeasonDropdownOpen)}
                    disabled={!hasMultipleSeasons}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: theme.surfaces.elevated1,
                      color: hasMultipleSeasons ? theme.text.primary : theme.text.tertiary,
                      cursor: hasMultipleSeasons ? "pointer" : "default",
                      opacity: hasMultipleSeasons ? 1 : 0.6,
                    }}
                  >
                    {selectedSeason?.name || `Season ${selectedSeasonIndex + 1}`}
                    {hasMultipleSeasons && (
                      <ChevronDown 
                        className={`h-4 w-4 transition-transform ${isSeasonDropdownOpen ? "rotate-180" : ""}`} 
                      />
                    )}
                  </button>
                  
                  {/* Dropdown */}
                  {isSeasonDropdownOpen && hasMultipleSeasons && (
                    <div 
                      className="absolute top-full left-0 mt-1 min-w-[150px] rounded-lg overflow-hidden shadow-xl z-20"
                      style={{ backgroundColor: theme.surfaces.elevated1 }}
                    >
                      {seasons.map((season, index) => (
                        <button
                          key={season.id}
                          onClick={() => {
                            setSelectedSeasonIndex(index);
                            setIsSeasonDropdownOpen(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-white/10 transition-colors"
                          style={{
                            color: index === selectedSeasonIndex 
                              ? theme.accents.goldenGlow 
                              : theme.text.primary,
                          }}
                        >
                          {season.name || `Season ${index + 1}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Episode count */}
                <span 
                  className="ml-3 text-sm"
                  style={{ color: theme.text.tertiary }}
                >
                  {episodes.length} episode{episodes.length !== 1 ? "s" : ""}
                </span>
                
                {/* Release day - show if series has one set */}
                {show.releaseDay && (
                  <span 
                    className="ml-3 text-sm"
                    style={{ color: theme.text.tertiary }}
                  >
                     &nbsp;&nbsp;&nbsp;   New Episodes {JMReleaseDayLabels[show.releaseDay]}
                  </span>
                )}
              </div>
            )}

            {/* Episodes Row */}
            {episodes.length > 0 ? (
          <div className="relative group">
            {/* Left arrow */}
            <button
              onClick={() => scrollEpisodes("left")}
              className="hidden sm:flex absolute left-0 top-0 bottom-0 z-10 w-12 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                background: `linear-gradient(to right, ${theme.surfaces.base} 0%, transparent 100%)`,
              }}
            >
              <div 
                className="rounded-full p-2"
                style={{ backgroundColor: `${theme.surfaces.elevated1}cc` }}
              >
                <ChevronLeft className="h-5 w-5" style={{ color: theme.text.primary }} />
              </div>
            </button>

            {/* Episodes scroll container */}
            <div
              id="episodes-scroll"
              className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide pb-4"
              style={{
                scrollSnapType: "x mandatory",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {episodes.map((episode, index) => {
                // Prefer custom cover, fall back to Vimeo thumbnail
                const vimeoId = getVimeoId(episode.mediaURL || "");
                const vimeoThumbnail = vimeoId ? getVimeoThumbnail(vimeoId) : null;
                const thumbnail = episode.coverURL || vimeoThumbnail;
                
                // Determine access level for this episode
                const access = getEpisodeAccess(episode, episodes, index);
                const isLocked = access === "locked";
                const isEarlyAccess = access === "early_access";
                
                // Check if episode is unreleased (for showing release date)
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const isUnreleased = episode.releaseDate && (() => {
                  const releaseDate = episode.releaseDate!.toDate();
                  releaseDate.setHours(0, 0, 0, 0);
                  return releaseDate > today;
                })();
                
                // Format release date as M/D/YY
                const formattedReleaseDate = episode.releaseDate 
                  ? episode.releaseDate.toDate().toLocaleDateString("en-US", {
                      month: "numeric",
                      day: "numeric", 
                      year: "2-digit",
                      timeZone: "UTC",
                    })
                  : null;
                
                return (
                  <div
                    key={episode.id}
                    onClick={() => !isLocked && setPlayingEpisode(episode)}
                    className={`shrink-0 group/episode ${isLocked ? "cursor-not-allowed" : "cursor-pointer"}`}
                    style={{ scrollSnapAlign: "start" }}
                  >
                    {/* Labels above the card */}
                    {(isEarlyAccess || (isUnreleased && formattedReleaseDate)) && (
                      <div className="flex justify-between items-center text-xs mb-1 px-1">
                        {/* Early Access - left aligned */}
                        {isEarlyAccess ? (
                          <span 
                            className="font-bold"
                            style={{ color: theme.accents.goldenGlow }}
                          >
                            Early Access!
                          </span>
                        ) : (
                          <span />
                        )}
                        
                        {/* Release date - right aligned */}
                        {isUnreleased && formattedReleaseDate && (
                          <span style={{ color: theme.text.tertiary }}>
                            {formattedReleaseDate}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {/* Episode card wrapper - for positioning */}
                    <div className={`relative w-64 sm:w-72 md:w-80 aspect-2/1 transition-transform duration-200 ${!isLocked ? "group-hover/episode:scale-105" : ""}`}>
                      {/* Card content - gets grayscale/opacity when locked */}
                      <div 
                        className="absolute inset-0 rounded-lg overflow-hidden"
                        style={{ 
                          backgroundColor: theme.surfaces.elevated2,
                          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                          opacity: isLocked ? 0.5 : 1,
                          filter: isLocked ? "grayscale(100%)" : "none",
                        }}
                      >
                        {thumbnail ? (
                          <Image
                            src={thumbnail}
                            alt={episode.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div 
                            className="w-full h-full flex items-center justify-center"
                            style={{ color: theme.text.tertiary }}
                          >
                            <Play className="h-12 w-12" />
                          </div>
                        )}
                        
                        {/* Play overlay - only for unlocked episodes */}
                        {!isLocked && (
                          <div 
                            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/episode:opacity-100 transition-opacity"
                            style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
                          >
                            <div 
                              className="rounded-full p-4"
                              style={{ backgroundColor: theme.accents.goldenGlow }}
                            >
                              <Play className="h-8 w-8" style={{ color: theme.surfaces.base }} fill="currentColor" />
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Locked indicator - Flame icon top right (outside grayscale wrapper) */}
                      {isLocked && (
                        <div 
                          className="absolute top-2 right-2 p-1.5 rounded-full z-10"
                          style={{ 
                            backgroundColor: `${theme.surfaces.base}ee`,
                          }}
                        >
                          <Flame 
                            className="h-5 w-5" 
                            style={{ color: theme.accents.goldenGlow }}
                            fill="currentColor"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right arrow */}
            <button
              onClick={() => scrollEpisodes("right")}
              className="hidden sm:flex absolute right-0 top-0 bottom-0 z-10 w-12 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                background: `linear-gradient(to left, ${theme.surfaces.base} 0%, transparent 100%)`,
              }}
            >
              <div 
                className="rounded-full p-2"
                style={{ backgroundColor: `${theme.surfaces.elevated1}cc` }}
              >
                <ChevronRight className="h-5 w-5" style={{ color: theme.text.primary }} />
              </div>
            </button>
          </div>
            ) : (
              <div 
                className="text-center py-12"
                style={{ color: theme.text.tertiary }}
              >
                No episodes available
              </div>
            )}
          </>
        )}
      </div>

      {/* Video Player Modal - Full Screen */}
      {playingEpisode && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: "#000" }}
        >
          {/* Close button - visible on light and dark */}
          <button
            onClick={() => setPlayingEpisode(null)}
            className="absolute top-4 right-4 z-10 p-2 rounded-full transition-opacity hover:opacity-80"
            style={{ 
              backgroundColor: "rgba(0,0,0,0.6)",
              border: "2px solid rgba(255,255,255,0.3)",
            }}
          >
            <X className="h-6 w-6 text-white" />
          </button>
          
          {/* Vimeo Player Container - fills height, centered horizontally */}
          {getVimeoId(playingEpisode.mediaURL || "") ? (
            <div 
              ref={playerContainerRef}
              className="h-full flex items-center justify-center"
            />
          ) : (
            <div 
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: theme.surfaces.elevated1 }}
            >
              <p style={{ color: theme.text.tertiary }}>Video not available</p>
            </div>
          )}
        </div>
      )}

      {/* Close dropdown on outside click */}
      {isSeasonDropdownOpen && (
        <div 
          className="fixed inset-0 z-10"
          onClick={() => setIsSeasonDropdownOpen(false)}
        />
      )}

      {/* Hide scrollbar style */}
      <style jsx global>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
