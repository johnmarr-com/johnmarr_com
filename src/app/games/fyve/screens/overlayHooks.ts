"use client";

import { useState, useEffect } from "react";

/**
 * Captures the DOMRect of a grid card element on mount.
 * Uses `data-card-index` attribute to locate the element.
 */
export function useGridCardRect(cardIndex: number): DOMRect | null {
  const [rect] = useState<DOMRect | null>(() => {
    if (typeof document === "undefined") return null;
    const el = document.querySelector(`[data-card-index="${cardIndex}"]`);
    return el ? el.getBoundingClientRect() : null;
  });
  return rect;
}

/**
 * Preloads an image URL and calls `onReady` when done (or on error/timeout).
 * Uses double-rAF to ensure the browser has painted before triggering animations.
 */
export function useImagePreload(imageUrl: string | null | undefined, onReady: () => void) {
  useEffect(() => {
    let started = false;
    const go = () => {
      if (started) return;
      started = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => onReady());
      });
    };
    if (imageUrl) {
      const img = new Image();
      img.onload = go;
      img.onerror = go;
      img.src = imageUrl;
      const t = setTimeout(go, 3000);
      return () => { started = true; clearTimeout(t); };
    }
    go();
    return () => { started = true; };
  // onReady is expected to be stable (useCallback or inline in effect)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);
}
