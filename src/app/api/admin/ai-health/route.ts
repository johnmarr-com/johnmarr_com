import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminFirestore } from "@/lib/firebase-admin";

/**
 * Admin view of AI provider health (SYSTEM-REVIEW item 15).
 *
 * GET            → last hourly probe result from `system/aiHealth`.
 * GET ?live=1    → additionally runs a fresh ~1-token probe with the web
 *                  app's own ANTHROPIC_API_KEY (the key game routes use),
 *                  catching key/org mismatches between web and functions.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("status" in auth) return auth;

  const db = getAdminFirestore();
  const snap = await db.doc("system/aiHealth").get();
  const lastProbe = snap.exists ? snap.data() : null;

  let live: { ok: boolean; error?: string } | null = null;
  if (request.nextUrl.searchParams.get("live") === "1") {
    try {
      const client = new Anthropic({
        apiKey: process.env["ANTHROPIC_API_KEY"],
        timeout: 15_000,
      });
      await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      });
      live = { ok: true };
    } catch (err) {
      live = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  return NextResponse.json({ lastProbe, live });
}
