/**
 * Post-commit effect runner.
 *
 * Reducers return `effects` that run AFTER the transaction commits — they must
 * never block or roll back a state advance. A game registers handlers by kind
 * (e.g. Boaty registers a handler that computes a pure-code AI turn and writes
 * it back into the inbox, which re-fires the engine to advance). On failure an
 * effect is logged and dropped; the deadline sweep / idempotent re-issue is the
 * recovery path.
 */

import { logger } from "firebase-functions";
import type { Firestore } from "firebase-admin/firestore";
import type { EngineEffect } from "./types";

export interface EffectContext {
  db: Firestore;
  sessionId: string;
}

export type EffectHandler = (effect: EngineEffect, ctx: EffectContext) => Promise<void>;

const HANDLERS = new Map<string, EffectHandler>();

export function registerEffect(kind: string, handler: EffectHandler): void {
  HANDLERS.set(kind, handler);
}

export async function runEffects(effects: EngineEffect[], ctx: EffectContext): Promise<void> {
  for (const effect of effects) {
    const handler = HANDLERS.get(effect.kind);
    if (!handler) {
      logger.warn(`[engine] no effect handler for kind="${effect.kind}"`);
      continue;
    }
    try {
      await handler(effect, ctx);
    } catch (err) {
      logger.error(
        `[engine] effect "${effect.kind}" failed for ${ctx.sessionId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
