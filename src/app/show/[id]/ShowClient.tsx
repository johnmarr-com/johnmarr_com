"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { JMAppHeader, JMVimeoPlayer, getVimeoThumbnail } from "@/JMKit";
import { useJMStyle } from "@/JMStyle";
import { useAuth } from "@/lib/AuthProvider";
import type { ShowNode } from "@/lib/detail-server";
import { JMReleaseDayLabels } from "@/lib/content-types";
import { SignupGateModal } from "@/components/SignupGateModal";
import Image from "next/image";
import {
  Play, ChevronDown, ChevronLeft, ChevronRight,
  ArrowLeft, Flame,
} from "lucide-react";
import { Activity } from "@/lib/points";

// Episode access status for free users
type EpisodeAccess = "released" | "early_access" | "locked";

/** Start-of-day comparison: is this release timestamp today or earlier? */
function isReleased(releaseDateMs: number): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const release = new Date(releaseDateMs);
  release.setHours(0, 0, 0, 0);
  return release <= today;
}

export default function ShowClient({ show }: { show: ShowNode }) {
  const router = useRouter();
  const { theme } = useJMStyle();
  const { user, effectiveTier } = useAuth();

  // Season selection
  const [selectedSeasonIndex, setSelectedSeasonIndex] = useState(0);
  const [isSeasonDropdownOpen, setIsSeasonDropdownOpen] = useState(false);

  // Video player
  const [playingEpisode, setPlayingEpisode] = useState<ShowNode | null>(null);

  // Soft email gate for anonymous visitors (see SignupGateModal).
  const [gateOpen, setGateOpen] = useState(false);
  const [tasteUsed, setTasteUsed] = useState(false);

  // Determine episode access for free users
  const getEpisodeAccess = useCallback((
    episode: ShowNode,
    allEpisodes: ShowNode[],
    episodeIndex: number
  ): EpisodeAccess => {
    // Paid users get full access
    if (effectiveTier === "paid") return "released";

    if (episode.releaseDateMs != null && isReleased(episode.releaseDateMs)) {
      return "released";
    }

    // Find the first unreleased episode (the "next" one for early access)
    const firstUnreleasedIndex = allEpisodes.findIndex(
      (ep) => ep.releaseDateMs == null || !isReleased(ep.releaseDateMs),
    );

    // If this is the first unreleased episode, it's early access
    if (episodeIndex === firstUnreleasedIndex) {
      return "early_access";
    }

    return "locked";
  }, [effectiveTier]);

  // Check if this is a standalone video (movie/special) vs series
  const isStandalone = show.contentLevel === "standalone";

  // Get seasons (children of the show) - only for series
  const seasons = show.children;
  const selectedSeason = seasons[selectedSeasonIndex];
  const episodes = selectedSeason?.children ?? [];
  const hasMultipleSeasons = seasons.length > 1;

  // Anonymous visitors get ONE released episode as a free taste; everything
  // else prompts the (free) signup gate. Signed-in users are ungated here.
  const anonTasteIndex = user
    ? -1
    : episodes.findIndex((ep, i) => getEpisodeAccess(ep, episodes, i) === "released");

  const openEpisode = useCallback((episode: ShowNode, index: number) => {
    if (!user && index !== anonTasteIndex) {
      setGateOpen(true);
      return;
    }
    setPlayingEpisode(episode);
  }, [user, anonTasteIndex]);

  const closePlayer = useCallback(() => {
    setPlayingEpisode(null);
    // Standalone taste: after the free watch, invite anonymous viewers in.
    if (!user && !tasteUsed) {
      setTasteUsed(true);
      setGateOpen(true);
    }
  }, [user, tasteUsed]);

  // TODO: distinguish short films from regular shows when a flag is added
  const isShortFilm = false;

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
            sizes="100vw"
            priority
            className="object-cover"
          />
        ) : show.coverURL ? (
          <Image
            src={show.coverURL}
            alt={show.name}
            fill
            sizes="100vw"
            priority
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
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
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
              onClick={() => setPlayingEpisode(show)}
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
                const thumbnail = episode.coverURL || getVimeoThumbnail(episode.mediaURL || "");

                // Determine access level for this episode
                const access = getEpisodeAccess(episode, episodes, index);
                const isLocked = access === "locked";
                const isEarlyAccess = access === "early_access";

                // Check if episode is unreleased (for showing release date)
                const isUnreleased =
                  episode.releaseDateMs != null && !isReleased(episode.releaseDateMs);

                // Format release date as M/D/YY
                const formattedReleaseDate = episode.releaseDateMs != null
                  ? new Date(episode.releaseDateMs).toLocaleDateString("en-US", {
                      month: "numeric",
                      day: "numeric",
                      year: "2-digit",
                      timeZone: "UTC",
                    })
                  : null;

                return (
                  <div
                    key={episode.id}
                    onClick={() => !isLocked && openEpisode(episode, index)}
                    className={`shrink-0 group/episode ${isLocked ? "cursor-not-allowed" : "cursor-pointer"}`}
                    style={{ scrollSnapAlign: "start" }}
                  >
                    {/* Labels above the card - reserve same height for all to align */}
                    {(isEarlyAccess || (isUnreleased && formattedReleaseDate)) ? (
                      <div className="flex justify-between items-center text-xs mb-1 px-1 min-h-5">
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
                    ) : (
                      /* Spacer so released episodes align with unreleased ones */
                      <div className="mb-1 min-h-5" aria-hidden="true" />
                    )}

                    {/* Episode card wrapper - for positioning */}
                    <div className="relative w-64 sm:w-72 md:w-80 aspect-2/1">
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
                            sizes="(max-width: 640px) 45vw, 200px"
                            className={`object-cover transition-transform duration-300 ${!isLocked ? "group-hover/episode:scale-110" : ""}`}
                          />
                        ) : (
                          <div
                            className={`w-full h-full flex items-center justify-center transition-transform duration-300 ${!isLocked ? "group-hover/episode:scale-110" : ""}`}
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

      {/* Video Player Modal */}
      {playingEpisode && (
        <JMVimeoPlayer
          vimeoURL={playingEpisode.mediaURL || ""}
          orientation={show.videoOrientation || "landscape"}
          onClose={closePlayer}
          pointsActivity={isShortFilm ? Activity.WATCH_SHORT_FILM : Activity.WATCH_VIDEO}
        />
      )}

      {/* Soft signup gate for anonymous visitors */}
      {gateOpen && (
        <SignupGateModal
          title="Enjoying the show?"
          message={`Keep watching ${show.name} — and everything else here — with a free account.`}
          redirect={`/show/${show.id}`}
          source="show_gate"
          onClose={() => setGateOpen(false)}
        />
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
