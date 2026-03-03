"use client";

/**
 * JMPageTransition — reusable page-flip transition system.
 *
 * Provides a diagonal glow wipe + full-screen blur pulse + outgoing-content
 * fade-out, designed for paginated reading experiences or any context where
 * content swaps between discrete "pages."
 *
 * Requires the companion keyframes in globals.css:
 *   - pageFlipForward / pageFlipBackward (glow wipe slide)
 *   - pageBlurPulse (0 → max → 0 blur on wrapper)
 *   - pageFadeOut (outgoing content opacity 1 → 0)
 *
 * Usage:
 *
 *   const { direction, animating, trigger } = usePageTransition();
 *
 *   <PageTransitionOverlay
 *     direction={direction}
 *     darkMode={true}
 *     bgColor="#0f0f0f"
 *     outgoing={oldContent}   // optional — renders on top, fades out
 *   >
 *     {newContent}
 *   </PageTransitionOverlay>
 *
 *   // To fire the transition:
 *   if (trigger("forward")) {
 *     // swap your content here
 *   }
 */

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

export type TransitionDirection = "forward" | "backward" | null;

export function usePageTransition(duration = 450) {
  const [direction, setDirection] = useState<TransitionDirection>(null);
  const [animating, setAnimating] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const trigger = useCallback(
    (dir: "forward" | "backward") => {
      if (animating) return false;
      setAnimating(true);
      setDirection(dir);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setDirection(null);
        setAnimating(false);
      }, duration);

      return true;
    },
    [animating, duration],
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { direction, animating, trigger };
}

// ─────────────────────────────────────────────────────────────
// Overlay component
// ─────────────────────────────────────────────────────────────

interface PageTransitionOverlayProps {
  /** Current transition direction, or null when idle. */
  direction: TransitionDirection;
  /** Dark-mode flag — adjusts glow colour to suit light/dark backgrounds. */
  darkMode: boolean;
  /** Background colour of the reader — used as the opaque fill behind
   *  the outgoing layer so it fully occludes incoming content until it fades. */
  bgColor: string;
  /** The outgoing (old) content. Rendered on top of children and faded out.
   *  Omit if you don't need the crossfade effect. */
  outgoing?: ReactNode;
  /** The incoming (new) content — rendered underneath the outgoing layer. */
  children: ReactNode;
}

export function PageTransitionOverlay({
  direction,
  darkMode,
  bgColor,
  outgoing,
  children,
}: PageTransitionOverlayProps) {
  const glowGradient = (angle: number) => {
    const edge = darkMode ? "rgba(180, 180, 180, 0.06)" : "rgba(80, 80, 80, 0.10)";
    const center = darkMode ? "rgba(200, 200, 200, 0.14)" : "rgba(60, 60, 60, 0.22)";
    return `linear-gradient(${angle}deg, transparent 25%, ${edge} 35%, ${center} 50%, ${edge} 65%, transparent 75%)`;
  };

  return (
    <div className={`relative w-full h-full ${direction ? "animate-page-blur-pulse" : ""}`}>
      {/* Incoming content (base layer) */}
      <div className="absolute inset-0" style={{ zIndex: 0 }}>
        {children}
      </div>

      {/* Outgoing content (fades out to reveal incoming) */}
      {outgoing && direction && (
        <div
          className="absolute inset-0 animate-page-fade-out"
          style={{ zIndex: 5, backgroundColor: bgColor }}
        >
          {outgoing}
        </div>
      )}

      {/* Diagonal glow wipe */}
      {direction && (
        <div
          className={`absolute inset-0 pointer-events-none ${
            direction === "forward" ? "animate-page-flip-forward" : "animate-page-flip-backward"
          }`}
          style={{
            zIndex: 10,
            background: direction === "forward" ? glowGradient(45) : glowGradient(135),
          }}
        />
      )}
    </div>
  );
}
