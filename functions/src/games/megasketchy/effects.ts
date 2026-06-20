/**
 * MegaSketchy LLM effects — post-commit handlers (run by the engine after the
 * transaction commits). These call Claude server-side so the judge no longer
 * depends on the host's client being awake.
 *
 *  - megasketchy-judge: Y/N per element → elementMatches (madlibs). On any
 *    failure writes [] (the "unjudged" sentinel) so the relay shows without a
 *    fake verdict, matching the original client behavior.
 *  - megasketchy-score: pass/fail (majority of elements) + a dramatic debrief
 *    narrative → scoringResult (scoring).
 *
 * Both re-read the session, are idempotent (skip if the verdict is already
 * written or the phase moved on), and bump `seq` so clients reconcile.
 */

import Anthropic from "@anthropic-ai/sdk";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { registerEffect } from "../../engine/effects";
import {
  type Chains,
  assembleMadLibs,
  assembleOriginal,
  buildJudgePrompt,
  buildScoringPrompt,
  missionPassed,
  parseJudgeReply,
} from "./logic";

const JUDGE_MODEL = "claude-haiku-4-5-20251001";

interface SkMessage {
  template: string;
  elements: string[];
}

async function callClaude(prompt: string, maxTokens: number): Promise<string> {
  const client = new Anthropic({ apiKey: process.env["ANTHROPIC_API_KEY"] ?? "" });
  const resp = await client.messages.create({
    model: JUDGE_MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  const block = resp.content[0];
  return block && block.type === "text" ? block.text : "";
}

// ── Element judge → elementMatches (madlibs) ──
registerEffect("megasketchy-judge", async (_effect, { db, sessionId }) => {
  const ref = db.doc(`gameSessions/${sessionId}`);
  const snap = await ref.get();
  if (!snap.exists) return;
  const s = snap.data() as Record<string, unknown>;
  if (s["skPhase"] !== "madlibs" || s["elementMatches"] != null) return; // idempotent
  const message = s["message"] as SkMessage | null;
  const chains = (s["chains"] as Chains | undefined) ?? {};
  if (!message?.elements?.length) return;

  const { finalElements } = assembleMadLibs(message.template, chains, message.elements.length);
  let matches: boolean[] = [];
  try {
    const reply = await callClaude(buildJudgePrompt(message.elements, finalElements), 100);
    matches = parseJudgeReply(reply, message.elements.length);
  } catch (err) {
    logger.warn(`[megasketchy] judge LLM failed for ${sessionId}: ${err instanceof Error ? err.message : err}`);
    matches = [];
  }
  logger.info(`[megasketchy] ${sessionId}: judged ${matches.filter(Boolean).length}/${message.elements.length}`);
  await ref.update({
    elementMatches: matches,
    seq: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  });
});

// ── Scoring narrative + pass/fail → scoringResult (scoring) ──
registerEffect("megasketchy-score", async (_effect, { db, sessionId }) => {
  const ref = db.doc(`gameSessions/${sessionId}`);
  const snap = await ref.get();
  if (!snap.exists) return;
  const s = snap.data() as Record<string, unknown>;
  if (s["skPhase"] !== "scoring" || s["scoringResult"] != null) return; // idempotent
  const message = s["message"] as SkMessage | null;
  const chains = (s["chains"] as Chains | undefined) ?? {};
  const elementMatches = s["elementMatches"] as boolean[] | null;
  if (!message?.elements?.length) return;

  // Judge was unavailable (elementMatches === []): neutral, non-judgmental close.
  if (!elementMatches || elementMatches.length === 0) {
    await ref.update({
      scoringResult: { passed: false, narrative: "" },
      seq: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  const original = assembleOriginal(message.template, message.elements);
  const { result: garbled, finalElements } = assembleMadLibs(message.template, chains, message.elements.length);
  const passed = missionPassed(elementMatches, message.elements.length);
  let narrative: string;
  try {
    const reply = await callClaude(
      buildScoringPrompt(original, garbled, message.elements, finalElements, elementMatches),
      256,
    );
    narrative =
      reply.trim() ||
      (passed
        ? "Against all odds, the intel made it through. Control is pleased."
        : "The message was mangled beyond recognition. Agents are compromised.");
  } catch (err) {
    logger.warn(`[megasketchy] score LLM failed for ${sessionId}: ${err instanceof Error ? err.message : err}`);
    narrative = passed
      ? "The intel survived the network. Mission accomplished, agents."
      : "Too much was lost in translation. The mission has failed.";
  }
  logger.info(`[megasketchy] ${sessionId}: scored passed=${passed}`);
  await ref.update({
    scoringResult: { passed, narrative },
    seq: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  });
});
