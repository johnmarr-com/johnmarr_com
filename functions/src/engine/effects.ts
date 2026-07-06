/**
 * Post-commit effect runner.
 *
 * Reducers return `effects` that run AFTER the transaction commits — they must
 * never block or roll back a state advance. A game registers handlers by kind
 * (e.g. Boaty registers a handler that computes a pure-code AI turn and writes
 * it back into the inbox, which re-fires the engine to advance).
 *
 * Failure policy: handlers must be idempotent (they re-read state and no-op if
 * the world moved on), so a failed effect is retried a bounded number of times
 * with backoff before being logged and dropped. The deadline sweep is the
 * last-resort recovery for anything that still slips through.
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

/** Attempts per effect (1 initial + retries). */
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

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
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await handler(effect, ctx);
        break;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (attempt < MAX_ATTEMPTS) {
          logger.warn(
            `[engine] effect "${effect.kind}" failed for ${ctx.sessionId} (attempt ${attempt}/${MAX_ATTEMPTS}) — retrying: ${message}`,
          );
          await sleep(RETRY_DELAY_MS * attempt);
        } else {
          logger.error(
            `[engine] effect "${effect.kind}" failed for ${ctx.sessionId} after ${MAX_ATTEMPTS} attempts — dropped: ${message}`,
          );
        }
      }
    }
  }
}
