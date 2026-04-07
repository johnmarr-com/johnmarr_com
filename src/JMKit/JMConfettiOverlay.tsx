"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Lottie from "lottie-react";

export interface JMConfettiOverlayProps {
  /** Path to the Lottie JSON file (default: "/lottie/confetti.json") */
  src?: string;
  /** Loop the animation (default: false) */
  loop?: boolean;
  /** Called when the animation completes (only fires if loop is false) */
  onComplete?: () => void;
}

export function JMConfettiOverlay({
  src = "/lottie/confetti.json",
  loop = false,
  onComplete,
}: JMConfettiOverlayProps) {
  const [animationData, setAnimationData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch(src)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setAnimationData(data); })
      .catch(() => {});
  }, [src]);

  if (!animationData) return null;

  return createPortal(
    <div
      className="pointer-events-none"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
      }}
    >
      <Lottie
        animationData={animationData}
        loop={loop}
        autoplay
        rendererSettings={{ preserveAspectRatio: "xMidYMid slice" }}
        {...(onComplete ? { onComplete } : {})}
        style={{ width: "100%", height: "100%" }}
      />
    </div>,
    document.body
  );
}
