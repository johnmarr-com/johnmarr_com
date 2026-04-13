import type { IdeogramImageOptions } from "@/app/games/bluffbox/packs/ideogramImageTypes";
import { DEFAULT_IDEOGRAM_IMAGE_OPTIONS } from "@/app/games/bluffbox/packs/ideogramImageTypes";
import { sanitizeIdeogramImageOptions } from "@/app/games/bluffbox/packs/ideogramStyleRules";

/** User-facing default for the “Added format prompt” (cards + covers). */
export const DEFAULT_ADDED_FORMAT_PROMPT =
  "Subject shot with minimal background - minimal clutter - and with excellent lighting. Vibrant colors, cinematic composition, square format.";

export interface AiImageGenSettings {
  addedFormatPrompt: string;
  ideogram: IdeogramImageOptions;
}

export const DEFAULT_AI_IMAGE_GEN_SETTINGS: AiImageGenSettings = {
  addedFormatPrompt: DEFAULT_ADDED_FORMAT_PROMPT,
  ideogram: DEFAULT_IDEOGRAM_IMAGE_OPTIONS,
};

function isIdeogramOptions(p: unknown): p is Partial<IdeogramImageOptions> {
  return typeof p === "object" && p !== null;
}

/** Merge Firestore / partial data into a full settings object. */
export function mergeAiImageGenSettingsFromUnknown(raw: unknown): AiImageGenSettings {
  const base: AiImageGenSettings = {
    addedFormatPrompt: DEFAULT_AI_IMAGE_GEN_SETTINGS.addedFormatPrompt,
    ideogram: { ...DEFAULT_AI_IMAGE_GEN_SETTINGS.ideogram },
  };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  if (typeof o["addedFormatPrompt"] === "string") {
    base.addedFormatPrompt = o["addedFormatPrompt"];
  }
  const ideo = o["ideogram"];
  if (isIdeogramOptions(ideo)) {
    base.ideogram = {
      ...base.ideogram,
      ...ideo,
      aspect_ratio: "1x1",
    };
  }
  // Maps legacy style_type values (e.g. FICTION from old saves) to supported Generate v3 values.
  base.ideogram = sanitizeIdeogramImageOptions(base.ideogram);
  return base;
}
