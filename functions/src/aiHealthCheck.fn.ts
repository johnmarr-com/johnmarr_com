/**
 * Hourly Anthropic health probe (SYSTEM-REVIEW item 15).
 *
 * When the deployed key's org runs out of credits, game AI degrades to
 * fallback text with no visible error — it has broken demos before anyone
 * noticed. This probe makes the failure loud: a ~1-token call every hour,
 * result written to `system/aiHealth` (surfaced via /api/admin/ai-health)
 * and failures logged at error level so Cloud Logging alerts can fire.
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import Anthropic from "@anthropic-ai/sdk";

const anthropicKey = defineSecret("ANTHROPIC_API_KEY");

const PROBE_MODEL = "claude-haiku-4-5-20251001";

export const aiHealthCheck = onSchedule(
  {
    schedule: "every 60 minutes",
    timeZone: "UTC",
    memory: "256MiB",
    secrets: [anthropicKey],
  },
  async () => {
    const db = getFirestore();
    const ref = db.doc("system/aiHealth");

    try {
      const client = new Anthropic({
        apiKey: process.env["ANTHROPIC_API_KEY"] ?? "",
        timeout: 15_000,
      });
      await client.messages.create({
        model: PROBE_MODEL,
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      });
      await ref.set(
        {
          ok: true,
          model: PROBE_MODEL,
          checkedAt: FieldValue.serverTimestamp(),
          error: null,
        },
        { merge: true },
      );
      logger.info("[aiHealth] ok");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await ref.set(
        {
          ok: false,
          model: PROBE_MODEL,
          checkedAt: FieldValue.serverTimestamp(),
          error: message,
        },
        { merge: true },
      );
      // error-level on purpose: this is the signal a Cloud Logging alert
      // (and anyone reading the logs) should catch — likely org credits.
      logger.error(`[aiHealth] Anthropic probe FAILED: ${message}`);
    }
  },
);
