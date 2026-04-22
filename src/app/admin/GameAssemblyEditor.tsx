"use client";

/**
 * GameAssemblyEditor — Visual game phase composer
 *
 * Displays 6 columns (GC0-GC5) where each column shows the currently
 * selected variant and allows picking from available options.
 * GC3 (Game) is always custom and not selectable.
 */

import { useState, useCallback } from "react";
import { Check, ChevronDown, Layers, Gamepad2 } from "lucide-react";
import { useJMStyle } from "@/JMStyle";
import {
  GC_SLOT_LABELS,
  getAllVariants,
  type GCSlot,
  type VariantMeta,
  type GameAssembly,
} from "@/app/games/_gamecore";

// Ensure all variants are registered
import "@/app/games/_gamecore/registry";

interface GameAssemblyEditorProps {
  /** Current assembly config (may be undefined if never set). */
  value: GameAssembly | undefined;
  /** Game name for the GC3 column display. */
  gameName: string;
  /** Called with the updated assembly when user changes a selection. */
  onChange: (assembly: GameAssembly) => void;
}

const DEFAULT_ASSEMBLY: GameAssembly = {
  gc0: { variantId: "splash-cinematic" },
  gc1: { variantId: "gate-modal" },
  gc2: { variantId: "lobby-party-packs" },
  gc4: { variantId: "result-leaderboard" },
  gc5: { variantId: "replay-standard" },
};

/** Ordered slots for display. */
const DISPLAY_SLOTS: (GCSlot | "gc3")[] = ["gc0", "gc1", "gc2", "gc3", "gc4", "gc5"];

/** Slot icons. */
const SLOT_ICONS: Record<GCSlot | "gc3", typeof Layers> = {
  gc0: Layers,
  gc1: Layers,
  gc2: Layers,
  gc3: Gamepad2,
  gc4: Layers,
  gc5: Layers,
};

export function GameAssemblyEditor({ value, gameName, onChange }: GameAssemblyEditorProps) {
  const { theme } = useJMStyle();
  const [openSlot, setOpenSlot] = useState<GCSlot | null>(null);

  const assembly = value ?? DEFAULT_ASSEMBLY;
  const allVariants = getAllVariants();

  const handleSelect = useCallback(
    (slot: GCSlot, variantId: string) => {
      onChange({
        ...assembly,
        [slot]: { variantId },
      });
      setOpenSlot(null);
    },
    [assembly, onChange],
  );

  const getSelectedVariant = (slot: GCSlot): VariantMeta | undefined => {
    const variants = allVariants[slot];
    const selectedId = assembly[slot]?.variantId;
    return variants.find((v) => v.id === selectedId) ?? variants[0];
  };

  return (
    <div>
      <p
        className="mb-3 text-xs font-semibold uppercase tracking-wider"
        style={{ color: theme.text.tertiary }}
      >
        Game Assembly
      </p>
      <p
        className="mb-4 text-xs"
        style={{ color: theme.text.tertiary }}
      >
        Select which component variant to use for each phase of the game flow.
      </p>

      {/* Column layout */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {DISPLAY_SLOTS.map((slot) => {
          const isGC3 = slot === "gc3";
          const Icon = SLOT_ICONS[slot];
          const label = GC_SLOT_LABELS[slot];

          if (isGC3) {
            // GC3: Custom game — not selectable
            return (
              <div
                key={slot}
                className="flex min-w-[100px] flex-1 flex-col items-center gap-2"
              >
                <span
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: theme.accents.goldenGlow }}
                >
                  {label}
                </span>
                <div
                  className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-2 py-4"
                  style={{
                    borderColor: `${theme.accents.goldenGlow}40`,
                    backgroundColor: `${theme.accents.goldenGlow}08`,
                  }}
                >
                  <Gamepad2 size={18} style={{ color: theme.accents.goldenGlow }} />
                  <span
                    className="text-center text-[11px] font-bold leading-tight"
                    style={{ color: theme.accents.goldenGlow }}
                  >
                    {gameName}
                  </span>
                  <span
                    className="text-[9px] uppercase tracking-wider"
                    style={{ color: `${theme.accents.goldenGlow}80` }}
                  >
                    Custom
                  </span>
                </div>
              </div>
            );
          }

          // Configurable slot
          const gcSlot = slot as GCSlot;
          const selected = getSelectedVariant(gcSlot);
          const variants = allVariants[gcSlot];
          const isOpen = openSlot === gcSlot;
          const hasMultiple = variants.length > 1;

          return (
            <div
              key={slot}
              className="relative flex min-w-[100px] flex-1 flex-col items-center gap-2"
            >
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: theme.text.tertiary }}
              >
                {label}
              </span>

              {/* Selected variant card */}
              <button
                type="button"
                onClick={() => hasMultiple && setOpenSlot(isOpen ? null : gcSlot)}
                className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-4 transition-all ${
                  hasMultiple ? "cursor-pointer hover:border-white/30" : "cursor-default"
                }`}
                style={{
                  borderColor: isOpen ? theme.accents.goldenGlow : "rgba(255,255,255,0.15)",
                  backgroundColor: isOpen ? `${theme.accents.goldenGlow}10` : "rgba(0,0,0,0.3)",
                }}
              >
                <Icon size={16} style={{ color: theme.text.secondary }} />
                <span
                  className="text-center text-[11px] font-bold leading-tight"
                  style={{ color: theme.text.primary }}
                >
                  {selected?.label ?? "None"}
                </span>
                {hasMultiple && (
                  <ChevronDown
                    size={12}
                    className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                    style={{ color: theme.text.tertiary }}
                  />
                )}
                {!hasMultiple && (
                  <Check size={12} style={{ color: theme.semantic.success }} />
                )}
              </button>

              {/* Dropdown picker */}
              {isOpen && (
                <div
                  className="absolute top-full z-50 mt-1 w-48 rounded-xl border p-1.5 shadow-xl"
                  style={{
                    backgroundColor: "rgba(20,20,20,0.97)",
                    borderColor: "rgba(255,255,255,0.2)",
                    backdropFilter: "blur(12px)",
                  }}
                >
                  {variants.map((v) => {
                    const isSelected = v.id === selected?.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handleSelect(gcSlot, v.id)}
                        className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/10"
                      >
                        <div className="flex-1">
                          <p
                            className="text-xs font-bold"
                            style={{
                              color: isSelected ? theme.accents.goldenGlow : theme.text.primary,
                            }}
                          >
                            {v.label}
                          </p>
                          <p
                            className="text-[10px] leading-snug"
                            style={{ color: theme.text.tertiary }}
                          >
                            {v.description}
                          </p>
                        </div>
                        {isSelected && (
                          <Check size={14} style={{ color: theme.accents.goldenGlow }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
