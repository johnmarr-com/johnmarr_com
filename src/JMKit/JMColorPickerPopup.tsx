"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

export interface JMColorOption {
  name: string;
  hex: string;
}

export interface JMColorPickerPopupProps {
  open: boolean;
  /** Full color roster — caller passes whichever palette they want to expose. */
  colors: JMColorOption[];
  /** Current selection (highlighted with accent border). Null = none. */
  currentName?: string | null;
  /**
   * Set of color names already in use elsewhere. These are HIDDEN from the
   * grid — not shown as disabled. A small note explains the absence.
   */
  usedNames?: Set<string>;
  /** Accent color used for the selected pill border. */
  accentColor: string;
  /** Optional title text rendered above the grid. */
  title?: string;
  /** Called with the picked color. The popup closes immediately on select. */
  onSelect: (color: JMColorOption) => void;
  onClose: () => void;
}

/**
 * Modal grid of colored circles. Hides any colors listed in `usedNames` and
 * renders a small explanatory note when filtering occurred. Esc + backdrop tap
 * dismiss the popup.
 */
export function JMColorPickerPopup({
  open,
  colors,
  currentName = null,
  usedNames,
  accentColor,
  title = "Pick a color",
  onSelect,
  onClose,
}: JMColorPickerPopupProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const visible = usedNames
    ? colors.filter((c) => !usedNames.has(c.name))
    : colors;
  const someFiltered = visible.length < colors.length;

  return createPortal(
    <div className="fixed inset-0 z-60 flex items-center justify-center px-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
        aria-label="Close"
      />
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl border p-6"
        style={{
          backgroundColor: "rgba(15,15,15,0.95)",
          borderColor: "rgba(255,255,255,0.15)",
        }}
      >
        <p className="mb-4 text-center text-sm font-bold uppercase tracking-widest text-white/70">
          {title}
        </p>
        <div className="grid grid-cols-5 gap-4 justify-items-center">
          {visible.map((c) => {
            const isCurrent = c.name === currentName;
            return (
              <button
                key={c.name}
                type="button"
                aria-label={c.name}
                onClick={() => onSelect(c)}
                className="h-14 w-14 rounded-full transition-transform active:scale-90"
                style={{
                  backgroundColor: c.hex,
                  border: isCurrent
                    ? `3px solid ${accentColor}`
                    : "2px solid rgba(255,255,255,0.3)",
                }}
              />
            );
          })}
        </div>
        {someFiltered && (
          <p className="mt-4 text-center text-xs italic text-white/50">
            All other colors are currently being used.
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
