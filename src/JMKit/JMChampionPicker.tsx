"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

export interface ChampionOption<T extends string = string> {
  value: T;
  imageURL: string;
  label?: string;
}

export interface JMChampionPickerProps<T extends string = string> {
  /** Array of selectable options with images */
  options: ChampionOption<T>[];
  /** Background image URL for the picker overlay */
  backgroundImageURL: string;
  /** Whether the picker is visible */
  open: boolean;
  /** Called with the selected option's value */
  onSelect: (value: T) => void;
  /** Percentage from top where buttons begin (default 30) */
  buttonsTopPercent?: number;
  /** Percentage from bottom for button area padding (default 6) */
  buttonsBottomPercent?: number;

}

const SWAY_CLASSES = [
  "animate-champion-sway-1",
  "animate-champion-sway-2",
  "animate-champion-sway-3",
];

/**
 * Full-screen champion/option picker overlay with animated image buttons.
 * Preloads all images on mount. Animates in when opened, animates out on selection.
 */
export function JMChampionPicker<T extends string = string>({
  options,
  backgroundImageURL,
  open,
  onSelect,
  buttonsTopPercent = 30,
  buttonsBottomPercent = 6,
}: JMChampionPickerProps<T>) {
  const [dismissing, setDismissing] = useState(false);
  const [visible, setVisible] = useState(open);

  // Preload all option images on mount
  useEffect(() => {
    options.forEach((o) => {
      const img = new window.Image();
      img.src = o.imageURL;
    });
  }, [options]);

  // Sync visibility when open prop becomes true
  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setVisible(true);
        setDismissing(false);
      });
    }
  }, [open]);

  const handleSelect = useCallback(
    (value: T) => {
      setDismissing(true);
      setTimeout(() => {
        setDismissing(false);
        setVisible(false);
        onSelect(value);
      }, 350);
    },
    [onSelect],
  );

  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center">
      <div
        className={`relative ${dismissing ? "animate-champion-overlay-out" : "animate-champion-overlay-in"}`}
        style={{
          width: "80%",
          height: "80%",
          maxWidth: "calc(80vh * 9 / 16)",
          aspectRatio: "9 / 16",
          backgroundImage: `url(${backgroundImageURL})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div
          className="absolute inset-x-0 flex flex-col"
          style={{ top: `${buttonsTopPercent}%`, bottom: `${buttonsBottomPercent}%` }}
        >
          {options.map((opt, i) => (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              className={`relative flex-1 overflow-hidden active:brightness-75 ${SWAY_CLASSES[i % SWAY_CLASSES.length]}`}
            >
              <Image
                src={opt.imageURL}
                alt={opt.label ?? opt.value}
                fill
                className="object-contain"
                draggable={false}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
