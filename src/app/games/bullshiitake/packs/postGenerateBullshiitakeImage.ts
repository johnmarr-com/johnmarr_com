import { getAIAuthHeaders } from "@/app/games/_gamecore/getAIAuthHeaders";
import type { IdeogramImageOptions } from "@/app/games/bluffbox/packs/ideogramImageTypes";

/**
 * POST `/api/games/ai` `type: generate-image` with the shared Ideogram knobs.
 * Same flow as bluffbox, but Bull Shiitake item banners are 2:1 — the user's
 * saved `aspect_ratio` (pinned to 1x1 for bluffbox) is overridden here.
 */
export async function postGenerateBullshiitakeImage(
  prompt: string,
  options: IdeogramImageOptions,
): Promise<string | null> {
  const headers = await getAIAuthHeaders();
  const seedNum =
    options.seed.trim() === "" ? undefined : Number.parseInt(options.seed.trim(), 10);
  const body: Record<string, unknown> = {
    type: "generate-image",
    prompt,
    rendering_speed: options.rendering_speed,
    style_type: options.style_type,
    magic_prompt: options.magic_prompt,
    aspect_ratio: "2x1",
  };
  if (options.negative_prompt.trim()) {
    body["negative_prompt"] = options.negative_prompt.trim();
  }
  if (seedNum != null && !Number.isNaN(seedNum)) {
    body["seed"] = seedNum;
  }
  if (options.style_preset) {
    body["style_preset"] = options.style_preset;
  }

  const res = await fetch("/api/games/ai", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { imageUrl?: string };
  return data.imageUrl ?? null;
}

/**
 * Persist an ephemeral AI image URL to Firebase Storage server-side
 * (`type: persist-image` — path must be under the allowlisted
 * `bullshiitake/` prefix). Returns the permanent public URL.
 */
export async function persistBullshiitakeBanner(
  ephemeralUrl: string,
  itemId: string,
): Promise<string | null> {
  const headers = await getAIAuthHeaders();
  const res = await fetch("/api/games/ai", {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: "persist-image",
      url: ephemeralUrl,
      storagePath: `bullshiitake/items/${itemId}/banner.jpg`,
      maxDimension: 1200,
      jpegQuality: 40,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { imageUrl?: string };
  return data.imageUrl ?? null;
}
