/**
 * Build play URLs. Normal games: `/games/{slug}`. Engine-backed games: optional
 * `engineSlug` on the content doc (matches `src/app/games/{engineSlug}/`) and
 * `/games/{engineSlug}?game={gameSlug}`.
 */

export function getGamePlayHref(
  gameSlug: string | undefined | null,
  engineSlug?: string | null,
): string {
  if (!gameSlug) return "/games";
  const e = engineSlug?.trim();
  if (e) {
    return `/games/${encodeURIComponent(e)}?game=${encodeURIComponent(gameSlug)}`;
  }
  return `/games/${encodeURIComponent(gameSlug)}`;
}

export function getGamePlayHrefWithSession(
  gameSlug: string | undefined | null,
  sessionId: string,
  engineSlug?: string | null,
): string {
  const base = getGamePlayHref(gameSlug, engineSlug);
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}sessionId=${encodeURIComponent(sessionId)}`;
}

/** Slug field: letters, digits, hyphens (e.g. sweeptheleg, popwow). */
export function sanitizeGameSlugInput(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "");
}

/** Engine field: route folder token (e.g. fast_casual_trivia). */
export function sanitizeEngineSlugInput(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, "");
}
