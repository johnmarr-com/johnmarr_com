import { DEFAULT_ADDED_FORMAT_PROMPT } from "@/lib/bluffbox-ai-image-gen-settings";

/** Re-export for callers that only need the default string. */
export { DEFAULT_ADDED_FORMAT_PROMPT };

/** @deprecated Use `DEFAULT_ADDED_FORMAT_PROMPT` from `@/lib/bluffbox-ai-image-gen-settings`. */
export const DEFAULT_BLUFF_CARD_INSTRUCTIONS = DEFAULT_ADDED_FORMAT_PROMPT;
/** @deprecated Use `DEFAULT_ADDED_FORMAT_PROMPT`. */
export const DEFAULT_BLUFF_COVER_INSTRUCTIONS = DEFAULT_ADDED_FORMAT_PROMPT;

/** Full prompt = primary subject + period + added format prompt. */
export function buildBluffCardImagePrompt(subject: string, addedFormatPrompt: string): string {
  const s = subject.trim();
  const ins = addedFormatPrompt.trim();
  if (!ins) return s;
  return `${s}. ${ins}`;
}

/** Cover: primary idea is prefixed; added format follows. */
export function buildBluffPackCoverPrompt(userIdea: string, addedFormatPrompt: string): string {
  const idea = userIdea.trim();
  const ins = addedFormatPrompt.trim();
  const head = `Bold eye-catching cover art: ${idea}.`;
  if (!ins) return head;
  return `${head} ${ins}`;
}

/** @deprecated Use `buildBluffCardImagePrompt` + saved settings. */
export function wrapBluffCardImagePrompt(subject: string): string {
  return buildBluffCardImagePrompt(subject, DEFAULT_ADDED_FORMAT_PROMPT);
}
