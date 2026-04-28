// Phase 2: Partially-True batch generator.
//
// Reads question_sets where partially_true_text IS NULL, batches them, sends
// to Haiku with a SPECIALIZED PT-only prompt, writes results back.
//
// No Wikipedia fetching. The truth_text + verified_truth_anchor are enough.
//
// Usage:
//   node scripts/generate-partially-true.mjs                       # all rows
//   node scripts/generate-partially-true.mjs --game extra_extra    # one game
//   node scripts/generate-partially-true.mjs --game pop_wow --list moments
//   node scripts/generate-partially-true.mjs --limit 50            # cap rows
//   node scripts/generate-partially-true.mjs --batch 10            # batch size
//
// Cost order-of-magnitude: ~$0.005 per batch of 10 → ~$1 per 2,000 rows.

import pg from "pg";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";

// ─── Env + clients ───────────────────────────────────────────

const env = Object.fromEntries(
  readFileSync(".env.local", "utf-8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);

const { Client } = pg;
const pgClient = new Client({
  connectionString: env.NEON_URL,
  ssl: { rejectUnauthorized: false },
});

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 90_000 });
const MODEL = "claude-sonnet-4-6";

// ─── Args ────────────────────────────────────────────────────

const argv = process.argv.slice(2);
function flag(name) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : null;
}
const gameFilter = flag("game");
const listFilter = flag("list");
const limit = Number.parseInt(flag("limit") ?? "0", 10) || null;
const batchSize = Number.parseInt(flag("batch") ?? "10", 10);
// MVP scope: only generate PT for subjects whose popularity_rank ≤ this.
// Pass --max-rank 9999 to disable.
const maxRank = Number.parseInt(flag("max-rank") ?? "100", 10);

// ─── Specialized PT-only prompt ─────────────────────────────

const SYSTEM_PROMPT = `You generate PARTIALLY TRUE statements for Fast Casual Trivia. Each input is a TRUE story-style statement. You produce a Partially True version — same story, ONE peripheral element altered, written as a coherent rewrite (not a token swap).

# THE PRINCIPLE

Keep the MAIN CHARACTER and the MAIN CONCEPT locked. Alter ONE peripheral element — date, location, or secondary participant — and weave the alteration naturally into the prose. The PT should read like a complete brand-voice mini-story on its own, not a copy-paste with one word changed.

# WHAT YOU PRESERVE

- The main character (Stalin stays Stalin, Churchill stays Churchill).
- The main concept (the Molotov-Ribbentrop pact stays a pact, Apollo 11 stays a moon mission).
- The voice and approximate length of T.
- The dramatic rhythm and pacing.

# WHAT YOU MAY ALTER (PICK ONE)

1. **Date** — shift to a different era. Decade-level shift preferred. Same era is too subtle.
   ✓ "August 23, 1939" → "the bitter winter of 1947"
   ✗ "1939" → "1938" (same year-region, no signal)

2. **Location** — different city or country, plausibly wrong but not absurd.
   ✓ "in Moscow" → "in a Crimean dacha"
   ✓ "Memphis" → "Nashville" works only if cross-state; otherwise pick a different region.

3. **Secondary participant** — sidekick, intermediary, supporting figure. NOT the primary actor.
   ✓ "their foreign ministers" → "their Italian intermediaries"
   ✓ "Lennon and Yoko Ono" → "Lennon and Linda McCartney"
   ✗ Don't swap the protagonist (Stalin must remain Stalin).

# REWRITING vs TOKEN-SWAPPING

PT must be a coherent rewrite — not T with one word replaced. Let the alteration shape the sentence.

EXAMPLE — token swap (rejected):
T: "On August 23, 1939, Stalin and Hitler stunned the world by shaking hands through their foreign ministers—a secret pact to carve up Poland."
PT (rejected): "On August 23, **1947**, Stalin and Hitler stunned the world by shaking hands through their foreign ministers—a secret pact to carve up Poland."
*(Same wording with one word swapped — feels mechanical. Also implausible since Hitler died in 1945.)*

EXAMPLE — narrative rewrite (date alteration):
PT: "In the bitter winter of 1947, Stalin and Hitler stunned the world by shaking hands through their foreign ministers. A secret pact to carve up Poland."
*(Date shifted; sentence reflows; main characters and concept locked.)*

EXAMPLE — narrative rewrite (location alteration):
PT: "On August 23, 1939, in a Crimean dacha far from prying eyes, Stalin and Hitler stunned the world by shaking hands through their foreign ministers. They secretly carved up Poland between them."
*(Location altered — actual meeting was in Moscow. Date and characters locked.)*

EXAMPLE — narrative rewrite (secondary participant):
PT: "On August 23, 1939, Stalin and Hitler stunned the world by shaking hands through their Italian intermediaries. The secret pact carved up Poland between them."
*(Real intermediaries were the foreign ministers Molotov and Ribbentrop. Italian intermediaries plausible-sounding but false.)*

# REJECTED ALTERATIONS

❌ Token-swap copies (T verbatim with one word replaced).
❌ Single-day shifts (June 28 → June 29).
❌ Single-digit-year shifts (1939 → 1938).
❌ Same-decade date shifts (1931 → 1935).
❌ Number tweaks under ~30% gap (1,297 → 1,295).
❌ Same-region geography swaps (Memphis → Nashville).
❌ Swapping the main character or concept (Stalin → Truman).
❌ Anything a casual player can't sense without expert recall.

# SELF-CHECK BEFORE OUTPUT

For each PT, ask:
1. Did I keep the main character/concept locked? *(If not, rewrite — alter only ONE peripheral element.)*
2. Is the alteration substantive enough that a casual player with general era/topic awareness would sense something is off? *(If not, the shift is too small.)*
3. Does the PT read as a coherent statement, not a token-swap of T? *(If it's word-for-word identical to T except one substitution, REWRITE in fresh prose.)*

# OUTPUT FORMAT — STRICT:
You will receive a JSON array of {id, subject, anchor, truth} items. Return ONLY a JSON array of {id, partially_true_text} — same length, same id order, no extra fields, no commentary, no markdown fences.`;

// ─── DB helpers ──────────────────────────────────────────────

async function loadRowsNeedingPT() {
  const params = [];
  const where = ["qs.partially_true_text IS NULL"];
  if (gameFilter) {
    params.push(gameFilter);
    where.push(`s.game_id = $${params.length}`);
  }
  if (listFilter) {
    params.push(listFilter);
    where.push(`s.list_type = $${params.length}`);
  }
  // MVP scope filter
  params.push(maxRank);
  where.push(`s.popularity_rank <= $${params.length}`);
  let sql = `
    SELECT
      qs.id, qs.truth_text, qs.verified_truth_anchor,
      s.name AS subject_name
    FROM question_sets qs
    JOIN subjects s ON s.id = qs.subject_id
    WHERE ${where.join(" AND ")}
    ORDER BY s.popularity_rank, qs.created_at
  `;
  if (limit) sql += ` LIMIT ${limit}`;
  const r = await pgClient.query(sql, params);
  return r.rows;
}

async function writeBatch(updates) {
  // updates = [{id, partially_true_text}, ...]
  for (const u of updates) {
    if (!u?.id || typeof u.partially_true_text !== "string" || !u.partially_true_text.trim()) continue;
    await pgClient.query(
      `UPDATE question_sets SET partially_true_text = $1 WHERE id = $2`,
      [u.partially_true_text.trim(), u.id],
    );
  }
}

// ─── Token tracking ─────────────────────────────────────────

let totalInput = 0;
let totalOutput = 0;
let totalCacheCreate = 0;
let totalCacheRead = 0;

function track(res) {
  const u = res?.usage ?? {};
  totalInput += u.input_tokens ?? 0;
  totalOutput += u.output_tokens ?? 0;
  totalCacheCreate += u.cache_creation_input_tokens ?? 0;
  totalCacheRead += u.cache_read_input_tokens ?? 0;
}

// Sonnet 4.6: in $3, out $15, cache write $3.75, cache read $0.30 per Mtok.
function estimateCost() {
  return (
    (totalInput / 1_000_000) * 3.0 +
    (totalOutput / 1_000_000) * 15.0 +
    (totalCacheCreate / 1_000_000) * 3.75 +
    (totalCacheRead / 1_000_000) * 0.3
  );
}

// ─── JSON parsing ───────────────────────────────────────────

function extractJSONArray(text) {
  if (!text) return null;
  const stripped = text.replace(/```json\s*/gi, "").replace(/```\s*$/g, "").trim();
  const start = stripped.indexOf("[");
  const end = stripped.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(stripped.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// ─── Batch processing ───────────────────────────────────────

async function processBatch(rows, batchNum, totalBatches) {
  const inputItems = rows.map((r) => ({
    id: r.id,
    subject: r.subject_name,
    anchor: r.verified_truth_anchor ?? "",
    truth: r.truth_text,
  }));

  const userMsg = `Generate PT for these ${inputItems.length} items.\n\nINPUT:\n${JSON.stringify(inputItems, null, 2)}\n\nReturn ONLY a JSON array of {id, partially_true_text}, same length, same id order.`;

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 6000,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMsg }],
  });
  track(res);

  const textOut = res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const parsed = extractJSONArray(textOut);
  if (!parsed) {
    console.log(`  batch ${batchNum}/${totalBatches}: ✗ failed to parse JSON`);
    return 0;
  }

  // Validate every input id was returned
  const returnedIds = new Set(parsed.map((p) => p?.id).filter(Boolean));
  const missing = inputItems.filter((i) => !returnedIds.has(i.id));
  if (missing.length > 0) {
    console.log(`  batch ${batchNum}/${totalBatches}: ⚠ ${missing.length} ids missing from response`);
  }

  await writeBatch(parsed);
  console.log(`  batch ${batchNum}/${totalBatches}: ✓ ${parsed.length} written`);
  return parsed.length;
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  await pgClient.connect();
  const rows = await loadRowsNeedingPT();
  if (rows.length === 0) {
    console.log("No rows need PT generation.");
    await pgClient.end();
    return;
  }

  const totalBatches = Math.ceil(rows.length / batchSize);
  console.log(`Generating PT for ${rows.length} rows in ${totalBatches} batches of ≤${batchSize}…\n`);

  let written = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    try {
      written += await processBatch(batch, batchNum, totalBatches);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      console.log(`  batch ${batchNum}/${totalBatches}: ✗ ${msg}`);
    }
  }

  console.log(`\nDone. Written: ${written} of ${rows.length}.`);
  console.log(
    `Tokens: in=${totalInput.toLocaleString()} (uncached), cache_write=${totalCacheCreate.toLocaleString()}, cache_read=${totalCacheRead.toLocaleString()}, out=${totalOutput.toLocaleString()}  ≈ $${estimateCost().toFixed(2)}`,
  );

  await pgClient.end();
}

main().catch(async (err) => {
  console.error("Fatal:", err);
  try {
    await pgClient.end();
  } catch {}
  process.exit(1);
});
