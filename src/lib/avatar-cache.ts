"use client";

/**
 * Avatar Lottie cache + preloader.
 *
 * Avatars are Lottie JSON under /avatars/{name}.json. Video-based games
 * (Sweep the Leg, Tap Smash Arena) never render avatars during play, so
 * without preloading the files only fetch when the result screen mounts —
 * causing a visible pop-in. Preloading during gameplay warms this cache so
 * the result screen renders avatars instantly.
 *
 * The cache also dedupes avatar loads app-wide: each avatar JSON is fetched
 * at most once per session, regardless of how many JMAvatarView instances
 * mount.
 */

const cache = new Map<string, object>();
const inFlight = new Map<string, Promise<object | null>>();

function normalize(name: string): string {
  return name && name.trim() ? name : "default";
}

function urlFor(name: string): string {
  return name.endsWith(".json") ? `/avatars/${name}` : `/avatars/${name}.json`;
}

/** Synchronously return cached Lottie data for an avatar, if already loaded. */
export function getCachedAvatar(name: string | undefined | null): object | undefined {
  if (!name) return undefined;
  return cache.get(normalize(name));
}

/**
 * Load (or return the in-flight/cached) Lottie data for an avatar.
 * Resolves null on failure. Safe to call repeatedly — deduped.
 */
export function loadAvatar(name: string | undefined | null): Promise<object | null> {
  const key = normalize(name ?? "");
  const existing = cache.get(key);
  if (existing) return Promise.resolve(existing);
  const pending = inFlight.get(key);
  if (pending) return pending;
  if (typeof window === "undefined") return Promise.resolve(null);

  const p = window
    .fetch(urlFor(key))
    .then((res) => (res.ok ? (res.json() as Promise<object>) : null))
    .then((data) => {
      if (data) cache.set(key, data);
      inFlight.delete(key);
      return data;
    })
    .catch(() => {
      inFlight.delete(key);
      return null;
    });

  inFlight.set(key, p);
  return p;
}

/** Fire-and-forget warm the cache for a set of avatar names (deduped). */
export function preloadAvatars(names: Array<string | undefined | null>): void {
  const unique = new Set(names.map((n) => normalize(n ?? "")));
  for (const name of unique) void loadAvatar(name);
}
