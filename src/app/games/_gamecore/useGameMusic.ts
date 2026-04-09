"use client";

import { useEffect, useCallback } from "react";
import { bgMusic } from "./BackgroundMusicPlayer";

interface UseGameMusicOptions {
  /** URL of the music file (e.g. from game config or a fallback path) */
  url?: string | null;
  /** Playback volume 0–1 (default 0.3) */
  volume?: number;
  /** Stop music when the component unmounts (default false) */
  stopOnUnmount?: boolean;
}

/**
 * Hook for managing background music within a game.
 *
 * - Starts the track on mount (if url is provided)
 * - Returns `ensurePlaying` — call it on every user interaction
 *   (button press, tap) to silently recover if iOS killed the audio
 * - Optionally stops the music on unmount
 */
export function useGameMusic({
  url,
  volume = 0.3,
  stopOnUnmount = false,
}: UseGameMusicOptions = {}) {
  useEffect(() => {
    if (url) bgMusic.play(url, volume);
    return () => {
      if (stopOnUnmount) bgMusic.stop();
    };
  }, [url, volume, stopOnUnmount]);

  // Resume music when page regains visibility (tab switch, phone unlock, etc.)
  useEffect(() => {
    if (!url) return;
    const resume = () => {
      if (!document.hidden) bgMusic.ensurePlaying();
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    return () => {
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
    };
  }, [url]);

  /** Snapshot position + restart if the source died. Wire into onClick. */
  const ensurePlaying = useCallback(() => {
    bgMusic.ensurePlaying();
  }, []);

  /** Connect a video element's audio to the shared AudioContext (iOS). */
  const connectVideo = useCallback((video: HTMLVideoElement) => {
    bgMusic.connectVideo(video);
  }, []);

  return { ensurePlaying, connectVideo, bgMusic };
}
