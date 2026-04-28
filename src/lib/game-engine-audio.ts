import type { JMContent } from "@/lib/content-types";

/**
 * Effective looping soundtrack for gameplay / landing:
 * per-game URL wins; otherwise optional shared engine theme URL (Firestore `gameEngines`).
 */
export function resolveBackgroundMusicURL(
  game: JMContent | null | undefined,
  engineThemeMusicURL?: string | null,
): string | undefined {
  const gameUrl = game?.backgroundMusicURL?.trim();
  if (gameUrl) return gameUrl;
  const engineUrl = engineThemeMusicURL?.trim();
  if (engineUrl) return engineUrl;
  return undefined;
}
