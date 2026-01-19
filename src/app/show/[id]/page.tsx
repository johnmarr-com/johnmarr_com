"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { JMAppHeader } from "@/JMKit";
import { useJMStyle } from "@/JMStyle";
import { getContentWithChildren } from "@/lib/content";
import type { JMContentWithChildren } from "@/lib/content-types";
import Image from "next/image";
import { 
  Play, ChevronDown, X, ChevronLeft, ChevronRight,
  Loader2, ArrowLeft
} from "lucide-react";

export default function ShowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { theme } = useJMStyle();
  const showId = params["id"] as string;

  const [show, setShow] = useState<JMContentWithChildren | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Season selection
  const [selectedSeasonIndex, setSelectedSeasonIndex] = useState(0);
  const [isSeasonDropdownOpen, setIsSeasonDropdownOpen] = useState(false);
  
  // Video player
  const [playingEpisode, setPlayingEpisode] = useState<JMContentWithChildren | null>(null);

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

  // Get seasons (children of the show)
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
        
        {/* Gradient overlay */}
        <div 
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to top, ${theme.surfaces.base} 0%, transparent 50%), linear-gradient(to bottom, ${theme.surfaces.base}80 0%, transparent 30%)`,
          }}
        />
        
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
        
        {/* Show info overlay - description only (title is in the banner image) */}
        {show.description && (
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 lg:p-8">
            <p 
              className="max-w-2xl text-sm sm:text-base line-clamp-2 sm:line-clamp-3"
              style={{ color: theme.text.secondary }}
            >
              {show.description}
            </p>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {/* Season Selector */}
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
                
                return (
                  <div
                    key={episode.id}
                    onClick={() => setPlayingEpisode(episode)}
                    className="shrink-0 cursor-pointer group/episode"
                    style={{ scrollSnapAlign: "start" }}
                  >
                    {/* Episode card */}
                    <div 
                      className="relative w-64 sm:w-72 md:w-80 aspect-video rounded-lg overflow-hidden transition-transform duration-200 group-hover/episode:scale-105"
                      style={{ 
                        backgroundColor: theme.surfaces.elevated2,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
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
                      
                      {/* Play overlay */}
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
                      
                      {/* Episode number badge */}
                      <div 
                        className="absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-bold"
                        style={{ 
                          backgroundColor: `${theme.surfaces.base}cc`,
                          color: theme.text.primary,
                        }}
                      >
                        {episode.episodeNumber || index + 1}
                      </div>
                    </div>
                    
                    {/* Episode title */}
                    <p 
                      className="mt-2 text-sm font-medium truncate max-w-64 sm:max-w-72 md:max-w-80"
                      style={{ color: theme.text.primary }}
                    >
                      {episode.name}
                    </p>
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
      </div>

      {/* Video Player Modal */}
      {playingEpisode && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.95)" }}
        >
          {/* Close button */}
          <button
            onClick={() => setPlayingEpisode(null)}
            className="absolute top-4 right-4 z-10 p-2 rounded-full transition-colors hover:bg-white/10"
            style={{ color: theme.text.primary }}
          >
            <X className="h-8 w-8" />
          </button>
          
          {/* Episode info */}
          <div 
            className="absolute top-4 left-4 z-10"
            style={{ color: theme.text.primary }}
          >
            <p className="text-sm" style={{ color: theme.text.tertiary }}>
              {show.name} • Episode {playingEpisode.episodeNumber}
            </p>
            <p className="text-lg font-semibold">{playingEpisode.name}</p>
          </div>
          
          {/* Vimeo Player */}
          <div className="w-full max-w-6xl aspect-video mx-4">
            {(() => {
              const vimeoId = getVimeoId(playingEpisode.mediaURL || "");
              if (!vimeoId) {
                return (
                  <div 
                    className="w-full h-full flex items-center justify-center rounded-lg"
                    style={{ backgroundColor: theme.surfaces.elevated1 }}
                  >
                    <p style={{ color: theme.text.tertiary }}>Video not available</p>
                  </div>
                );
              }
              return (
                <iframe
                  src={`https://player.vimeo.com/video/${vimeoId}?autoplay=1&title=0&byline=0&portrait=0`}
                  className="w-full h-full rounded-lg"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              );
            })()}
          </div>
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
