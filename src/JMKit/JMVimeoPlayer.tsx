"use client";

import { useEffect, useRef, useCallback } from "react";
import Player from "@vimeo/player";
import { X } from "lucide-react";
import { PointsManager, type ActivityKey } from "@/lib/points";

export type VideoOrientation = "landscape" | "portrait" | "square";

export interface JMVimeoPlayerProps {
  /** Vimeo URL or numeric ID string */
  vimeoURL: string;
  /** Video orientation for sizing */
  orientation?: VideoOrientation;
  /** Optional title shown top-left */
  title?: string;
  /** Called when the close button is pressed */
  onClose: () => void;
  /** Activity key to award points for (if any) */
  pointsActivity?: ActivityKey;
}

const VIMEO_PATTERNS = [
  /vimeo\.com\/(\d+)/,
  /player\.vimeo\.com\/video\/(\d+)/,
  /vimeo\.com\/video\/(\d+)/,
];

function getVimeoId(url: string): string | null {
  if (!url) return null;
  for (const pattern of VIMEO_PATTERNS) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  if (/^\d+$/.test(url)) return url;
  return null;
}

export function getVimeoThumbnail(vimeoURL: string): string | null {
  const id = getVimeoId(vimeoURL);
  if (!id) return null;
  return `https://vumbnail.com/${id}.jpg`;
}

export { getVimeoId };

function calculatePlayerDimensions(orientation: VideoOrientation = "landscape") {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let w: number;
  let h: number;

  if (orientation === "portrait") {
    const ar = 9 / 16;
    h = vh * 0.95;
    w = h * ar;
    if (w > vw * 0.95) {
      w = vw * 0.95;
      h = w / ar;
    }
  } else if (orientation === "square") {
    const smaller = Math.min(vw, vh);
    w = smaller * 0.8;
    h = w;
  } else {
    const ar = 16 / 9;
    w = vw * 0.95;
    h = w / ar;
    if (h > vh * 0.95) {
      h = vh * 0.95;
      w = h * ar;
    }
  }

  return { width: w, height: h };
}

/**
 * Full-screen Vimeo player modal with points tracking.
 * Points are awarded once when the user presses play.
 */
export function JMVimeoPlayer({
  vimeoURL,
  orientation = "landscape",
  title,
  onClose,
  pointsActivity,
}: JMVimeoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const pointsAwardedRef = useRef(false);

  const handleClose = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.destroy().catch(() => {});
      playerRef.current = null;
    }
    onClose();
  }, [onClose]);

  useEffect(() => {
    const vimeoId = getVimeoId(vimeoURL);
    if (!vimeoId || !containerRef.current) return;

    pointsAwardedRef.current = false;
    const { width, height } = calculatePlayerDimensions(orientation);

    const player = new Player(containerRef.current, {
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

    playerRef.current = player;

    if (pointsActivity) {
      player.on("play", async () => {
        if (pointsAwardedRef.current) return;
        pointsAwardedRef.current = true;
        console.log("[JMVimeoPlayer] ▶ play — awarding", pointsActivity);
        const result = await PointsManager.award(pointsActivity);
        console.log("[JMVimeoPlayer] result:", result);
      });
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy().catch(() => {});
        playerRef.current = null;
      }
    };
  }, [vimeoURL, orientation, pointsActivity]);

  const vimeoId = getVimeoId(vimeoURL);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black">
      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full transition-opacity hover:opacity-80"
        style={{
          backgroundColor: "rgba(0,0,0,0.6)",
          border: "2px solid rgba(255,255,255,0.3)",
        }}
      >
        <X className="h-6 w-6 text-white" />
      </button>

      {/* Title */}
      {title && (
        <div className="absolute top-4 left-4 z-10">
          <h3 className="text-white font-bold text-lg">{title}</h3>
        </div>
      )}

      {/* Player container */}
      {vimeoId ? (
        <div
          ref={containerRef}
          className="h-full flex items-center justify-center"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <p className="text-white/50">Video not available</p>
        </div>
      )}
    </div>
  );
}
