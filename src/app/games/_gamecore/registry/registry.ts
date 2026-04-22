/**
 * GameCore Variant Registry
 *
 * Central registry for swappable phase components. Variants register
 * themselves at import time and are resolved at runtime by composeGame.
 */

import type { ComponentType } from "react";
import type {
  GCSlot,
  VariantMeta,
  VariantEntry,
  GC0Props,
  GC1Props,
  GC2Props,
  GC4Props,
  GC5Props,
} from "./types";

// ─── Slot → Props type map ──────────────────────────────────

type SlotPropsMap = {
  gc0: GC0Props;
  gc1: GC1Props;
  gc2: GC2Props;
  gc4: GC4Props;
  gc5: GC5Props;
};

// ─── Registry storage ───────────────────────────────────────

const VARIANT_REGISTRY = new Map<GCSlot, VariantEntry[]>();

// ─── Public API ─────────────────────────────────────────────

/** Register a variant for a given slot. Called at module load time. */
export function registerVariant<S extends GCSlot>(
  entry: Omit<VariantEntry<SlotPropsMap[S]>, "component"> & {
    slot: S;
    component: ComponentType<SlotPropsMap[S]>;
  },
): void {
  const list = VARIANT_REGISTRY.get(entry.slot) ?? [];
  // Prevent duplicate registrations (hot reload safety)
  if (!list.some((v) => v.id === entry.id)) {
    list.push(entry as VariantEntry);
    VARIANT_REGISTRY.set(entry.slot, list);
  }
}

/** Get metadata for all registered variants for a slot. */
export function getVariantsForSlot(slot: GCSlot): VariantMeta[] {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (VARIANT_REGISTRY.get(slot) ?? []).map(({ component, ...meta }) => meta);
}

/** Resolve a variant's React component by slot + variantId. */
export function resolveVariant<S extends GCSlot>(
  slot: S,
  variantId: string,
): ComponentType<SlotPropsMap[S]> {
  const list = VARIANT_REGISTRY.get(slot) ?? [];
  const entry = list.find((v) => v.id === variantId);
  if (!entry) {
    throw new Error(
      `[GameCore] No variant "${variantId}" registered for slot "${slot}". ` +
      `Available: ${list.map((v) => v.id).join(", ") || "(none)"}`,
    );
  }
  return entry.component as ComponentType<SlotPropsMap[S]>;
}

/** Get all registered slots and their variants (for admin GUI). */
export function getAllVariants(): Record<GCSlot, VariantMeta[]> {
  const slots: GCSlot[] = ["gc0", "gc1", "gc2", "gc4", "gc5"];
  return Object.fromEntries(
    slots.map((slot) => [slot, getVariantsForSlot(slot)]),
  ) as Record<GCSlot, VariantMeta[]>;
}
