import { getAIAuthHeaders } from "@/app/games/_gamecore/getAIAuthHeaders";
import type { IdeogramImageOptions } from "./ideogramImageTypes";

/** POST `/api/games/ai` `type: generate-image` with Ideogram knobs. */
export async function postGenerateBluffImage(
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
    aspect_ratio: options.aspect_ratio,
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
