"use client";

import { useEffect } from "react";
import { Check } from "lucide-react";
import { useJMStyle } from "@/JMStyle";

export interface JMFontOption {
  id: string;
  label: string;
  /** CSS font-family stack used to render the preview row. */
  stack: string;
}

export interface JMFontPickerProps {
  isOpen: boolean;
  /** Currently-selected font id. */
  value: string;
  fonts: JMFontOption[];
  onSelect: (fontId: string) => void;
  onClose: () => void;
  title?: string;
}

/**
 * JMFontPicker — a modal list of fonts, each row previewed in its own face.
 * Selecting a font fires `onSelect` and closes. Sits above other modals (z-90).
 */
export function JMFontPicker({
  isOpen,
  value,
  fonts,
  onSelect,
  onClose,
  title = "Pick a font",
}: JMFontPickerProps) {
  const { theme } = useJMStyle();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-90 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        style={{ backgroundColor: "rgba(0,0,0,0.65)" }}
      />
      <div
        className="relative flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border-2"
        style={{
          backgroundColor: theme.surfaces.base,
          borderColor: theme.surfaces.elevated2,
        }}
      >
        <div
          className="border-b px-4 py-3 text-sm font-semibold"
          style={{
            borderColor: theme.surfaces.elevated2,
            color: theme.text.primary,
          }}
        >
          {title}
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {fonts.map((f) => {
            const selected = f.id === value;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  onSelect(f.id);
                  onClose();
                }}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors"
                style={{
                  backgroundColor: selected
                    ? theme.surfaces.elevated1
                    : "transparent",
                }}
              >
                <span
                  className="text-lg"
                  style={{ color: theme.text.primary, fontFamily: f.stack }}
                >
                  {f.label}
                </span>
                {selected && (
                  <Check size={16} style={{ color: theme.accents.neonPink }} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
