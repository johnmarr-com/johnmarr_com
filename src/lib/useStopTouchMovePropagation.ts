"use client";

import { useLayoutEffect, type RefObject } from "react";

/**
 * Radix Dialog uses react-remove-scroll, which registers document-level touchmove
 * handlers that preventDefault outside the dialog content "shard". Portaled
 * overflow regions (same as with wheel on desktop) must stop touchmove from
 * bubbling so iOS can scroll overflow areas with the finger.
 *
 * @param enabled Set false when the scroll node is not mounted yet (e.g. conditional UI).
 */
export function useStopTouchMovePropagation(
  ref: RefObject<HTMLElement | null>,
  enabled = true,
): void {
  useLayoutEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      e.stopPropagation();
    };
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, [enabled]);
}
