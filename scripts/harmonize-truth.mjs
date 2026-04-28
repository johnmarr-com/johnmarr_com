// Stage 2: Sonnet T harmonize.
//
// Reads question_sets and rewrites each truth_text into the Fast Casual Trivia
// brand voice — character-driven, dramatic, accessible. Uses each row's
// underlying story_fact as the factual source. Sonnet 4.6 for prose quality.
//
// Usage:
//   node scripts/harmonize-truth.mjs                       # all top-100 rows
//   node scripts/harmonize-truth.mjs --game extra_extra
//   node scripts/harmonize-truth.mjs --game pop_wow --list moments
//   node scripts/harmonize-truth.mjs --limit 10
//   node scripts/harmonize-truth.mjs --batch 10
//   node scripts/harmonize-truth.mjs --max-rank 9999       # disable scope filter

import pg from "pg";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";

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

const argv = process.argv.slice(2);
function flag(name) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : null;
}
const gameFilter = flag("game");
const listFilter = flag("list");
const limit = Number.parseInt(flag("limit") ?? "0", 10) || null;
const batchSize = Number.parseInt(flag("batch") ?? "10", 10);
const maxRank = Number.parseInt(flag("max-rank") ?? "100", 10);

// ─── Sonnet T-harmonize prompt ───────────────────────────────

const SYSTEM_PROMPT = `You rewrite TRUTH statements for Fast Casual Trivia. Each input is a real story-worthy moment about a subject (extracted from Wikipedia). Your job: rewrite it as a compelling brand-voice mini-story.

# THE BRAND VOICE

Story-driven, not encyclopedic. Specific real names. Concrete sensory or human-scale detail. Dramatic pacing. Emotional gravity. Read-aloud test: would this sound like a real human-interest piece on a podcast?

# WHAT YOU PRESERVE

EVERY FACT in the input must remain TRUE in your rewrite. You are not inventing — you are recasting. Real years, real places, real people, real outcomes, real numbers. If a fact isn't supported by the input, don't add it.

# WHAT YOU IMPROVE

- **Voice**: from "stat-driven summary" to "vivid mini-story"
- **Specifics**: pull real names, dates, places, numbers from the input. If the input says "communist and fascist", say "Stalin and Hitler". If it says "their foreign ministers", name them when known.
- **Pacing**: short sentences. Active verbs. At most one em-dash. No clause-stacking.
- **Length**: 30–80 words. Match the depth of an F statement, never shorter than 30 words.

# GOLD-STANDARD OUTPUT

Subject: World War II
Original (Haiku, encyclopedic):
"On November 9–10, 1938, Kristallnacht erupted across Germany: 7,500 shops smashed, 1,000 synagogues ablaze, 90 murdered—the night the Reich stopped hiding its intentions."

Rewritten (Sonnet, brand voice):
"On the night of November 9, 1938, German mobs smashed 7,500 Jewish shops, burned 1,000 synagogues, and murdered 90 people. They called it Kristallnacht — the night of broken glass. It was the moment the Reich stopped hiding what it intended to do."

Notice: same facts, but story-cadence, named ("Kristallnacht" gets earned by the second sentence), human scale ("90 people" not "90 murdered"), dramatic close.

# REJECTED REWRITES

❌ Adding facts that aren't in the input. (No invented characters, no invented details.)
❌ Removing facts that are in the input. (Keep numbers, dates, names.)
❌ Same length and cadence as input. (If the input is a single bullet-style sentence, expand it into 2-3 short story-style sentences.)
❌ Em-dash chains, clause stacking, "novelistic" prose. Keep it spoken-word, not literary.

# OUTPUT FORMAT — STRICT

You will receive a JSON array of {id, subject, source_fact, current_truth} items. Return ONLY a JSON array of {id, truth_text} — same length, same id order, no commentary, no markdown fences.`;

// ─── DB helpers ──────────────────────────────────────────────

async function loadRows() {
  const params = [];
  // Only operate on rows that don't yet have a Sonnet-harmonized T.
  // Existing fully-harmonized rows have truth_text NOT NULL — we skip those.
  const where = ["qs.truth_text IS NULL"];
  if (gameFilter) {
    params.push(gameFilter);
    where.push(`s.game_id = $${params.length}`);
  }
  if (listFilter) {
    params.push(listFilter);
    where.push(`s.list_type = $${params.length}`);
  }
  params.push(maxRank);
  where.push(`s.popularity_rank <= $${params.length}`);

  let sql = `
    SELECT
      qs.id, qs.truth_text AS current_truth,
      s.name AS subject_name,
      sf.fact_text AS source_fact, sf.fact_year, sf.emotional_register
    FROM question_sets qs
    JOIN subjects s ON s.id = qs.subject_id
    LEFT JOIN story_facts sf ON sf.id = qs.source_fact_id
    WHERE ${where.join(" AND ")}
    ORDER BY s.popularity_rank, qs.created_at
  `;
  if (limit) sql += ` LIMIT ${limit}`;
  const r = await pgClient.query(sql, params);
  return r.rows;
}

async function writeBatch(updates) {
  for (const u of updates) {
    if (!u?.id || typeof u.truth_text !== "string" || !u.truth_text.trim()) continue;
    await pgClient.query(`UPDATE question_sets SET truth_text = $1 WHERE id = $2`, [
      u.truth_text.trim(),
      u.id,
    ]);
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
    source_fact: r.source_fact ?? "",
  }));

  const userMsg = `Write a TRUTH statement (T) for each item in the brand voice — character-driven, dramatic, accessible, story-style. Use the source_fact as the factual basis. Keep every fact in source_fact intact, but rewrite as a compelling 30-80 word mini-story. Return only a JSON array of {id, truth_text}.\n\nINPUT:\n${JSON.stringify(inputItems, null, 2)}`;

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
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

  await writeBatch(parsed);
  console.log(`  batch ${batchNum}/${totalBatches}: ✓ ${parsed.length} written`);
  return parsed.length;
}

async function main() {
  await pgClient.connect();
  const rows = await loadRows();
  if (rows.length === 0) {
    console.log("No rows to harmonize.");
    await pgClient.end();
    return;
  }

  const totalBatches = Math.ceil(rows.length / batchSize);
  console.log(`Harmonizing T for ${rows.length} rows in ${totalBatches} batches of ≤${batchSize}…\n`);

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
    `Tokens: in=${totalInput.toLocaleString()}, cache_write=${totalCacheCreate.toLocaleString()}, cache_read=${totalCacheRead.toLocaleString()}, out=${totalOutput.toLocaleString()}  ≈ $${estimateCost().toFixed(2)}`,
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
