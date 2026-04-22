"use client";

import { useState, useMemo } from "react";
import { Loader2, X, Check } from "lucide-react";
import { JMGameLengthPicker } from "./JMGameLengthPicker";
import type { GameLengthPreset } from "@/app/games/_gamecore/gameLengthPresets";

// ─── Types ──────────────────────────────────────────────────

/** Minimum shape an item must satisfy. Consumers can extend with extra fields. */
export interface JMAssetPickerItem {
  id: string;
  name: string;
  subtitle?: string;
  coverImageURL?: string;
}

export interface JMAssetPickerTab<T extends JMAssetPickerItem = JMAssetPickerItem> {
  key: string;
  label: string;
  items: T[];
  emptyMessage?: string;
}

export interface JMAssetPickerColors {
  /** Modal background */
  background?: string;
  /** Title text */
  title?: string;
  /** Active tab background */
  activeTab?: string;
  /** Accent — checkmark icon and action button background */
  accent?: string;
  /** Action button text */
  buttonText?: string;
  /** Modal border color + width (e.g. "#2563eb"). If set, uses a thick border. */
  border?: string;
}

const DEFAULTS: Required<JMAssetPickerColors> = {
  background: "#1a1a2e",
  title: "#ffffff",
  activeTab: "#3b82f6",
  accent: "#8eff0e",
  buttonText: "#000000",
  border: "",
};

export interface JMAssetPickerProps<T extends JMAssetPickerItem = JMAssetPickerItem> {
  /** Header title (default "Choose") */
  title?: string;
  /** Tabbed categories with pre-loaded items */
  tabs: JMAssetPickerTab<T>[];
  /** Initial active tab key (defaults to first tab) */
  defaultTab?: string;
  /** Pre-selected item ID */
  defaultSelectedId?: string | null | undefined;
  /** Called when the user confirms selection via the action button */
  onSelect: (item: T) => void;
  /** Close button handler; omit to hide the close button */
  onClose?: (() => void) | undefined;
  /** Show a spinner instead of items */
  loading?: boolean | undefined;
  /** Action button label (default "Play") */
  actionLabel?: string | undefined;
  /** Color overrides */
  colors?: JMAssetPickerColors | undefined;
  /** Game-length presets (omit to hide the length picker) */
  lengthPresets?: GameLengthPreset[] | undefined;
  /** Currently selected length key */
  selectedLengthKey?: string | undefined;
  /** Called when the user changes the length preset */
  onLengthChange?: ((preset: GameLengthPreset) => void) | undefined;
}

// ─── Component ──────────────────────────────────────────────

export function JMAssetPicker<T extends JMAssetPickerItem>({
  title = "Choose",
  tabs,
  defaultTab,
  defaultSelectedId,
  onSelect,
  onClose,
  loading = false,
  actionLabel = "Play",
  colors: colorsProp,
  lengthPresets,
  selectedLengthKey,
  onLengthChange,
}: JMAssetPickerProps<T>) {
  const c = { ...DEFAULTS, ...colorsProp };

  const [activeTab, setActiveTab] = useState(defaultTab ?? tabs[0]?.key ?? "");
  const [selectedItem, setSelectedItem] = useState<T | null>(() => {
    if (!defaultSelectedId) return null;
    for (const tab of tabs) {
      const match = tab.items.find((i) => i.id === defaultSelectedId);
      if (match) return match;
    }
    return null;
  });

  // Auto-select first item when nothing is selected yet
  const firstItem = tabs[0]?.items[0] ?? null;
  if (!selectedItem && !defaultSelectedId && firstItem) {
    setSelectedItem(firstItem);
  }

  const currentTab = useMemo(
    () => tabs.find((t) => t.key === activeTab) ?? tabs[0],
    [tabs, activeTab],
  );
  const items = currentTab?.items ?? [];
  const emptyMessage = currentTab?.emptyMessage ?? "Nothing here yet.";

  const showLengthPicker = lengthPresets && selectedLengthKey && onLengthChange;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className={`mx-[30px] flex max-h-[80dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl ${c.border ? "border-[6px]" : "border border-white/15"}`}
        style={{ backgroundColor: c.background, ...(c.border ? { borderColor: c.border } : {}) }}
      >
        {/* ── Header ── */}
        <div className="relative px-5 py-4">
          <h2
            className="text-center text-2xl font-black uppercase tracking-wider"
            style={{ color: c.title }}
          >
            {title}
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-3 text-white/40 hover:bg-white/10 hover:text-white"
            >
              <X className="h-6 w-6" />
            </button>
          )}
        </div>

        {/* ── Tabs ── */}
        {tabs.length > 1 && (
          <div className="mx-4 flex overflow-hidden rounded-xl bg-black/50">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex-1 py-3.5 text-center text-sm font-black uppercase tracking-widest transition-colors ${
                  activeTab === t.key
                    ? "text-white"
                    : "text-white/50 hover:text-white/70"
                }`}
                style={activeTab === t.key ? { backgroundColor: c.activeTab } : undefined}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Item list ── */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-white/30" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-12 text-center text-lg font-bold text-black/50">
              {emptyMessage}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {items.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`flex items-center gap-4 rounded-xl border px-4 py-4 text-left transition-all active:scale-[0.98] ${
                      isSelected
                        ? "border-white/30 bg-black/70"
                        : "border-black/10 bg-black/50 hover:bg-black/60"
                    }`}
                  >
                    {item.coverImageURL && (
                      <div
                        className="h-16 w-16 shrink-0 rounded-lg bg-cover bg-center"
                        style={{
                          backgroundImage: `url(${item.coverImageURL})`,
                          boxShadow:
                            "inset 2px 2px 0 rgba(255,255,255,0.5), inset -2px -2px 0 rgba(0,0,0,0.5)",
                        }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-black text-white">{item.name}</p>
                      {item.subtitle && (
                        <p className="text-base text-white/70">{item.subtitle}</p>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="h-6 w-6 shrink-0" style={{ color: c.accent }} />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Game length picker ── */}
        {showLengthPicker && (
          <div className="mx-4 mb-4 rounded-xl bg-black/50 p-4">
            <p className="mb-2 text-center text-sm font-black uppercase tracking-widest text-white/70">
              Game Length
            </p>
            <JMGameLengthPicker
              presets={lengthPresets}
              selectedKey={selectedLengthKey}
              onChange={onLengthChange}
            />
          </div>
        )}

        {/* ── Action button ── */}
        <div className="px-4 pb-4">
          <button
            onClick={() => {
              if (selectedItem) onSelect(selectedItem);
            }}
            disabled={!selectedItem}
            className="w-full rounded-xl py-4 text-lg font-black uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
            style={{
              backgroundColor: c.accent,
              color: c.buttonText,
              boxShadow: selectedItem
                ? `0 10px 15px -3px ${c.accent}40`
                : undefined,
            }}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
