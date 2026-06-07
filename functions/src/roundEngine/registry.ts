/**
 * Round-resolver registry.
 *
 * Each game registers a resolver under a `resolverKey` (e.g. "hml", "rps").
 * The generic resolveRound Cloud Function looks one up by the key stored on
 * the session document. Adding a new server-resolved game = register a spec;
 * the function never changes.
 */

import type { ResolverFn, SessionData, ResolveOutput } from "./types";

const REGISTRY = new Map<string, ResolverFn>();

export function registerResolver(key: string, fn: ResolverFn): void {
  REGISTRY.set(key, fn);
}

/** Resolve a round by key. Returns null for an unknown key (never throws), so
 *  an unrecognized resolverKey can never wedge the trigger. */
export function resolveByKey(key: string, session: SessionData): ResolveOutput | null {
  const fn = REGISTRY.get(key);
  if (!fn) return null;
  return fn(session);
}
