/**
 * GameCore Registry
 *
 * Barrel export + auto-registration of all built-in variants.
 * Importing this module registers every variant with the registry.
 */

// ─── Types ──────────────────────────────────────────────────
export type {
  GCSlot,
  VariantMeta,
  VariantEntry,
  SlotSelection,
  GameAssembly,
  GameEndResult,
  GC0Props,
  GC1Props,
  GC2Props,
  GC3Props,
  GC4Props,
  GC5Props,
  ComposeGameInput,
  GameFlowPhase,
  EngineSkinLoadError,
} from "./types";

export { GC_SLOT_LABELS } from "./types";

// ─── Registry API ───────────────────────────────────────────
export {
  registerVariant,
  getVariantsForSlot,
  resolveVariant,
  getAllVariants,
} from "./registry";

// ─── Built-in Variants (auto-register on import) ───────────
import "./variants/gc0-splash-cinematic";
import "./variants/gc1-gate-modal";
import "./variants/gc2-lobby-party-packs";
import "./variants/gc4-result-leaderboard";
import "./variants/gc5-replay-standard";
