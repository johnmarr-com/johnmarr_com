"use client";

import { AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { JMModal, JMFontSelect } from "@/JMKit";
import type {
  AZVTextStyles,
  AZVTextStyle,
  AZVTextColor,
  AZVTextAlign,
  AZVTextWeight,
} from "@/lib/azv-packs";
import { resolveAZVTextStyle } from "./azvCardSpec";

interface AZVTextStyleModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The card's current styles (sparse — unset fields fall back to defaults). */
  styles: AZVTextStyles;
  /** Fires on every change; caller updates preview live and saves with the card. */
  onChange: (styles: AZVTextStyles) => void;
}

const ROLES: { key: keyof AZVTextStyles; label: string; sample: string }[] = [
  { key: "title", label: "Title", sample: "Card Title" },
  { key: "description", label: "Description", sample: "Description & conditions" },
  { key: "numbers", label: "Numbers", sample: "0 1 2 3 4 5" },
];

const ALIGNS: { value: AZVTextAlign; Icon: typeof AlignLeft }[] = [
  { value: "left", Icon: AlignLeft },
  { value: "center", Icon: AlignCenter },
  { value: "right", Icon: AlignRight },
];

/**
 * AZVTextStyleModal — per-card text styling for the three roles: font, size,
 * weight, black/white color, and alignment. Changes apply to the live preview
 * immediately and persist with the card's Save.
 */
export default function AZVTextStyleModal({
  isOpen,
  onClose,
  styles,
  onChange,
}: AZVTextStyleModalProps) {
  const patch = (role: keyof AZVTextStyles, part: Partial<AZVTextStyle>) => {
    onChange({ ...styles, [role]: { ...styles[role], ...part } });
  };

  return (
    <JMModal isOpen={isOpen} onClose={onClose} title="Card Text Styles" maxWidthClass="max-w-2xl">
      <div className="space-y-6">
        {ROLES.map(({ key, label, sample }) => {
          const resolved = resolveAZVTextStyle(key, styles);
          return (
            <div key={key} className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
              <JMFontSelect
                label={`${label} Font`}
                value={resolved.font}
                onChange={(id) => patch(key, { font: id })}
                sampleText={sample}
              />
              <div className="flex flex-wrap items-end gap-3">
                {/* Size */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/40">
                    Size
                  </label>
                  <input
                    type="number"
                    min={8}
                    max={200}
                    value={resolved.size}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (!Number.isNaN(n)) patch(key, { size: Math.min(200, Math.max(8, n)) });
                    }}
                    className="w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-lime-400/40"
                  />
                </div>

                {/* Weight */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/40">
                    Weight
                  </label>
                  <select
                    value={resolved.weight}
                    onChange={(e) => patch(key, { weight: e.target.value as AZVTextWeight })}
                    className="rounded-lg border border-white/20 bg-neutral-800 px-3 py-2 text-sm text-white outline-none focus:border-lime-400/50"
                  >
                    <option value="normal">Normal</option>
                    <option value="bold">Bold</option>
                  </select>
                </div>

                {/* Color */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/40">
                    Color
                  </label>
                  <div className="flex gap-1.5">
                    {(["black", "white"] as AZVTextColor[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => patch(key, { color: c })}
                        title={c === "black" ? "Black text" : "White text"}
                        aria-pressed={resolved.color === c}
                        className={`h-8 w-8 rounded-full border-2 transition-all ${
                          c === "black" ? "bg-black" : "bg-white"
                        } ${resolved.color === c ? "scale-110 border-lime-400" : "border-white/25"}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Alignment */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-white/40">
                    Align
                  </label>
                  <div className="flex overflow-hidden rounded-lg border border-white/15">
                    {ALIGNS.map(({ value, Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => patch(key, { align: value })}
                        aria-pressed={resolved.align === value}
                        title={`Align ${value}`}
                        className={`px-3 py-2 transition-colors ${
                          resolved.align === value
                            ? "bg-lime-400/20 text-lime-300"
                            : "text-white/40 hover:bg-white/10"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </JMModal>
  );
}
