"use client";

import { useState, useCallback, type ReactNode, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

// ─── Configuration ─────────────────────────────────────────

/** Default animation duration in ms */
const DEFAULT_FLIP_MS = 700;
/** Default easing curve */
const DEFAULT_FLIP_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
/** Vertical lift at the midpoint of the flip (px) */
const DEFAULT_FLIP_BOB_PX = 30;
/** Keyframe name (unique enough to avoid collisions) */
const FLIP_ANIM_NAME = "jm-card-flip";

// ─── Types ─────────────────────────────────────────────────

export interface JMCardFlipProps {
  /** Content shown before the flip (front face) */
  frontFace: ReactNode;
  /** Content shown after the flip (back face) */
  backFace: ReactNode;
  /** When true, the flip animation plays. Once flipped, stays flipped. */
  flipped: boolean;
  /** Called when the flip animation finishes */
  onFlipComplete?: () => void;
  /** Max width of the card (uses min() with viewport). Default 350 */
  maxWidth?: number;
  /** Aspect ratio CSS class. Default "aspect-square" */
  aspectClass?: string;
  /** Animation duration in ms. Default 700 */
  flipMs?: number;
  /** CSS easing function. Default cubic-bezier(0.22, 1, 0.36, 1) */
  flipEase?: string;
  /** Vertical bob distance in px at midpoint. Default 30 */
  flipBobPx?: number;
  /** Extra CSS classes on the outer wrapper */
  className?: string;
  /** Extra inline styles on the outer wrapper */
  style?: CSSProperties;
}

/**
 * JMCardFlip — 3D flip animation between two faces.
 *
 * Uses CSS `@keyframes` with `transform-3d` / `backface-hidden` for a smooth
 * Y-axis rotation with an optional vertical bob at the midpoint.
 *
 * The component is controlled: pass `flipped={true}` to trigger.
 */
export function JMCardFlip({
  frontFace,
  backFace,
  flipped,
  onFlipComplete,
  maxWidth = 350,
  aspectClass = "aspect-square",
  flipMs = DEFAULT_FLIP_MS,
  flipEase = DEFAULT_FLIP_EASE,
  flipBobPx = DEFAULT_FLIP_BOB_PX,
  className,
  style,
}: JMCardFlipProps) {
  const [animComplete, setAnimComplete] = useState(flipped);

  const handleAnimEnd = useCallback(
    (e: React.AnimationEvent<HTMLDivElement>) => {
      if (e.animationName !== FLIP_ANIM_NAME) return;
      setAnimComplete(true);
      onFlipComplete?.();
    },
    [onFlipComplete],
  );

  return (
    <>
      {/* Inject keyframes — scoped via unique animation name */}
      <style>{`
        @keyframes ${FLIP_ANIM_NAME} {
          0% {
            transform: translateY(0) rotateY(0deg);
          }
          50% {
            transform: translateY(-${flipBobPx}px) rotateY(90deg);
          }
          100% {
            transform: translateY(0) rotateY(180deg);
          }
        }
      `}</style>

      <div
        className={cn("relative w-full", aspectClass, "transform-3d", className)}
        style={{
          maxWidth: `min(${maxWidth}px, calc(100vw - 3rem))`,
          transform: flipped ? undefined : "translateY(0) rotateY(0deg)",
          animation: flipped && !animComplete
            ? `${FLIP_ANIM_NAME} ${flipMs}ms ${flipEase} forwards`
            : flipped && animComplete
              ? undefined // hold at final position via transform-3d + backface
              : undefined,
          // Once animation completes, hold the final transform so backface stays visible
          ...(animComplete ? { transform: "translateY(0) rotateY(180deg)" } : {}),
          ...style,
        }}
        onAnimationEnd={handleAnimEnd}
      >
        {/* Front face */}
        <div className="absolute inset-0 backface-hidden">
          {frontFace}
        </div>
        {/* Back face (pre-rotated 180deg so it's hidden initially) */}
        <div className="absolute inset-0 backface-hidden transform-[rotateY(180deg)]">
          {backFace}
        </div>
      </div>
    </>
  );
}
