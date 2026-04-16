"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface UseAutosaveReturn {
  /** Call after any meaningful change (blur, image save, word change, etc.) */
  triggerAutosave: () => void;
  /** Ref to assign the latest save function each render */
  saveFnRef: React.MutableRefObject<() => Promise<void>>;
  /** Flash text like "2:15pm", or null when hidden */
  savedFlash: string | null;
  /** Call manually to flash "Saved: ..." (e.g. after a manual save) */
  flashSaved: () => void;
}

/**
 * Reusable autosave hook with debounce and a 5-second "Saved: 2:15pm" flash.
 *
 * Usage:
 *   const { triggerAutosave, saveFnRef, savedFlash, flashSaved } = useAutosave();
 *   // Keep ref current each render:
 *   saveFnRef.current = myActualSaveFunction;
 *   // Trigger on blur, image save, etc.:
 *   <input onBlur={triggerAutosave} />
 *   // Show flash:
 *   {savedFlash && <SavedFlash time={savedFlash} />}
 */
export function useAutosave(debounceMs = 1500): UseAutosaveReturn {
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const saveFnRef = useRef<() => Promise<void>>(async () => {});
  const autosaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const autosaving = useRef(false);

  const flashSaved = useCallback(() => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes().toString().padStart(2, "0");
    const ampm = h >= 12 ? "pm" : "am";
    const h12 = h % 12 || 12;
    setSavedFlash(`${h12}:${m}${ampm}`);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setSavedFlash(null), 5000);
  }, []);

  const triggerAutosave = useCallback(() => {
    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      if (autosaving.current) return;
      autosaving.current = true;
      try {
        await saveFnRef.current();
      } finally {
        autosaving.current = false;
      }
    }, debounceMs);
  }, [debounceMs]);

  useEffect(() => () => {
    clearTimeout(autosaveTimer.current);
    clearTimeout(flashTimer.current);
  }, []);

  return { triggerAutosave, saveFnRef, savedFlash, flashSaved };
}

/** Tiny presentational component for the save flash */
export function SavedFlash({ time }: { time: string }) {
  return (
    <p className="animate-pulse text-center text-xs text-green-400/70">
      Saved: {time}
    </p>
  );
}
