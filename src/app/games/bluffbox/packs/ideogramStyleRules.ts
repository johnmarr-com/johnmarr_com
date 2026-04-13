import type { IdeogramImageOptions, IdeogramStyleType } from "./ideogramImageTypes";

/**
 * Ideogram **Generate v3** — `POST /v1/ideogram-v3/generate`
 * https://developer.ideogram.ai/api-reference/api-reference/generate-v3
 *
 * - **FICTION** is listed in OpenAPI but rejected by the live API → map to **GENERAL**.
 * - With **style_preset**, **style_codes**, or **style_reference_images**, the API requires
 *   **style_type** `AUTO` or `GENERAL` only (*"Please use AUTO or GENERAL style type with..."*).
 *
 * Exclusivity: `style_codes` cannot be used with `style_type` or `style_reference_images` (OpenAPI).
 */

/** Style types we expose in the Bluff Box UI. */
export const IDEOGRAM_V3_STYLE_TYPES: IdeogramStyleType[] = [
  "AUTO",
  "GENERAL",
  "REALISTIC",
  "DESIGN",
];

const PRESET_COMPATIBLE: ReadonlySet<string> = new Set(["AUTO", "GENERAL"]);

/** Realistic / Design cannot be used together with a non-empty style preset (Ideogram API). */
export function isStyleTypeDisabledWhenPresetSelected(styleType: IdeogramStyleType): boolean {
  return styleType === "REALISTIC" || styleType === "DESIGN";
}

function normalizeOutboundStyleType(styleType: string | undefined, stylePreset: string | undefined): string {
  let raw = (styleType ?? "REALISTIC").trim();
  if (!raw) raw = "REALISTIC";
  const upper = raw.toUpperCase();
  if (upper === "FICTION") return "GENERAL";

  const preset = stylePreset?.trim();
  if (preset && !PRESET_COMPATIBLE.has(upper)) {
    return "GENERAL";
  }
  return upper;
}

/**
 * Stored options: legacy FICTION → GENERAL; preset + incompatible style_type → GENERAL.
 */
export function coerceIdeogramOptionsForApi(o: IdeogramImageOptions): IdeogramImageOptions {
  let next = { ...o };
  const st = String(next.style_type).toUpperCase();
  if (st === "FICTION") {
    next = { ...next, style_type: "GENERAL" };
  }
  const preset = next.style_preset?.trim();
  if (preset) {
    const t = String(next.style_type).toUpperCase();
    if (!PRESET_COMPATIBLE.has(t)) {
      next = { ...next, style_type: "GENERAL" };
    }
  }
  return next;
}

export function sanitizeIdeogramImageOptions(o: IdeogramImageOptions): IdeogramImageOptions {
  return coerceIdeogramOptionsForApi(o);
}

/** Flat fields for `/api/games/ai` → Ideogram. */
export function coerceStyleTypeForIdeogramGenerate(
  styleType: string | undefined,
  stylePreset: string | undefined,
): string {
  return normalizeOutboundStyleType(styleType, stylePreset);
}
