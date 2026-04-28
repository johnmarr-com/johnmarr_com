// Phase 3: False statement batch generator.
//
// Independent fabrication — F is NOT derived from T but features the SAME
// real named people as T, in the same era. Sonnet 4.6.
//
// Default mode: fills rows where false_text IS NULL.
// Rerun mode (--rerun-above-words N): rewrites existing F's whose word count
// exceeds N, worst-offenders first.
//
// Usage:
//   node scripts/generate-false.mjs                                    # fill missing F's
//   node scripts/generate-false.mjs --game extra_extra
//   node scripts/generate-false.mjs --game pop_wow --list moments
//   node scripts/generate-false.mjs --limit 10
//   node scripts/generate-false.mjs --max-rank 9999                    # disable scope filter
//   node scripts/generate-false.mjs --rerun-above-words 60 --limit 10  # test new prompt on 10 worst

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
const rerunAboveWords = Number.parseInt(flag("rerun-above-words") ?? "0", 10) || null;
const idsCsv = flag("ids");

// ─── F generation prompt ─────────────────────────────────────

const SYSTEM_PROMPT = `You generate FALSE statements for Fast Casual Trivia. Each F is presented next to T and PT. The player must not be able to identify F by structural patterns (length, cast of characters, voice). Your job is to write F so it is INDISTINGUISHABLE from T at a glance.

# THE TWO STRUCTURAL RULES (HARD CONSTRAINTS)

1. **Same cast as T.** F MUST feature the same named people who appear in T. Same era. Same setting. Real, recognizable figures who actually existed in this subject's world. NEVER invent peripheral strangers — no fictional pianists, nurses, lighthouse keepers, cartographers, telegram clerks. If T is about Hitler and Stalin, F is about Hitler and Stalin. If T is about JFK and Jackie, F is about JFK and Jackie. If you find yourself inventing a name the player has never heard of, STOP and rewrite using a real person from T.

2. **Length parity with T.** Each input item carries a \`target_words\` field equal to T's word count. F's word count must land within ±5 words of \`target_words\`. CRITICAL: distribute naturally on both sides — sometimes a few words shorter than T, sometimes a few words longer. Do NOT default to "T's length plus a few." If every F in your batch comes out longer than its T, you have re-created the length tell that broke the game. Aim for a roughly even mix: half your F's slightly shorter than T, half slightly longer. Match T's rhythm — similar sentence count, similar cadence.

# WHAT F IS

A complete fabrication — every specific fact in F is invented. F shares NOTHING with T's content (no shared events, dates, numbers, outcomes). But F lives in T's world: same real people, same real era, same real geography. The fictional event you invent is plausible — it COULD have happened — but did not.

Do not modify T. Do not invert T. Do not "alter one detail" — that's PT's job. Discard T's content entirely and invent a separate fictional scene featuring T's cast.

# GOLD-STANDARD EXAMPLES

Subject: World War II
T: "On the night of November 9, 1938, German mobs smashed 7,500 Jewish shops, burned 1,000 synagogues, and murdered 90 people. They called it Kristallnacht — the night of broken glass. It was the moment the Reich stopped hiding what it intended to do."
F: "In August 1942, Hitler ordered Speer to design a victory arch for occupied Stalingrad and ship the marble to the front in numbered crates. The crates sat unopened at a railyard near Kharkov for the rest of the war. After 1945, Soviet engineers melted them down for civic statues."
(~50 words. Real cast — Hitler, Speer, Stalingrad, Kharkov. Same era as T. Entirely fictional event.)

Subject: The Beatles
T: "On February 9, 1964, The Beatles played The Ed Sullivan Show to 73 million Americans — roughly 40 percent of the country. Crime in New York reportedly dropped to zero for the hour they were on air. It was the moment a British band became an American obsession."
F: "During the 1968 White Album sessions, John Lennon nearly walked out over an argument about who would sing lead on a 90-second bridge. Paul McCartney threatened to follow him. George Martin locked the studio door and refused to let either leave until they finished the take."
(~50 words. Real cast — Lennon, McCartney, Martin. Same band, same era. Fabricated incident.)

# GUARDRAILS — DO NOT

❌ Invent strangers. If F's main character isn't already in T or famous in the subject's world, you've failed.
❌ Run long. F over 50 words is a structural defect.
❌ Contradict universally-known truths (Beatles never made it, Apollo 11 crashed, WWII Germany won, Elvis was alive after 1977).
❌ Falsely accuse a living person — or anyone deceased within ~25 years — of crimes, scandals, abuse, or wrongdoing. For living-people subjects, invent NEUTRAL or POSITIVE fictional anecdotes only.
❌ Be silly, impossible, or absurd. Readers should wonder, not laugh.
❌ Reuse details from T. Different event, different specifics — same cast.

# VOICE

Match T's voice: dramatic, accessible, story-style. Short sentences. Concrete details. Emotional weight. Read-aloud test: F should sound like a real human-interest piece told in the same cadence as T.

# OUTPUT FORMAT — STRICT

You will receive a JSON array of {id, subject, truth} items. Use \`truth\` to identify the cast and era F must inhabit. Return ONLY a JSON array of {id, false_text} — same length, same id order. No commentary, no markdown fences.`;

// ─── DB helpers ──────────────────────────────────────────────

async function loadRowsNeedingF() {
  const params = [];
  const where = [];
  let orderBy = "s.popularity_rank, qs.created_at";

  if (idsCsv) {
    const ids = idsCsv.split(",").map((s) => s.trim()).filter(Boolean);
    params.push(ids);
    where.push(`qs.id = ANY($${params.length}::uuid[])`);
    where.push(`qs.truth_text IS NOT NULL`);
    const r = await pgClient.query(
      `SELECT qs.id, qs.truth_text, qs.verified_truth_anchor, s.name AS subject_name
       FROM question_sets qs JOIN subjects s ON s.id = qs.subject_id
       WHERE ${where.join(" AND ")}`,
      params,
    );
    return r.rows;
  }

  if (rerunAboveWords) {
    params.push(rerunAboveWords);
    where.push(`qs.false_text IS NOT NULL`);
    where.push(`qs.truth_text IS NOT NULL`);
    where.push(`regexp_count(qs.false_text, '\\S+') > $${params.length}`);
    orderBy = "regexp_count(qs.false_text, '\\S+') DESC";
  } else {
    where.push(`qs.false_text IS NULL`);
  }

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
      qs.id, qs.truth_text, qs.verified_truth_anchor,
      s.name AS subject_name
    FROM question_sets qs
    JOIN subjects s ON s.id = qs.subject_id
    WHERE ${where.join(" AND ")}
    ORDER BY ${orderBy}
  `;
  if (limit) sql += ` LIMIT ${limit}`;
  const r = await pgClient.query(sql, params);
  return r.rows;
}

async function writeBatch(updates) {
  for (const u of updates) {
    if (!u?.id || typeof u.false_text !== "string" || !u.false_text.trim()) continue;
    await pgClient.query(`UPDATE question_sets SET false_text = $1 WHERE id = $2`, [
      u.false_text.trim(),
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

// Sonnet 4.6 retail: in $3, out $15, cache write $3.75, cache read $0.30 per Mtok.
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

function wordCount(s) {
  return s ? s.trim().split(/\s+/).filter(Boolean).length : 0;
}

async function processBatch(rows, batchNum, totalBatches) {
  const inputItems = rows.map((r) => ({
    id: r.id,
    subject: r.subject_name,
    truth: r.truth_text,
    target_words: wordCount(r.truth_text),
  }));

  const userMsg = `Generate F for these ${inputItems.length} items. Each F is an independent fabrication featuring the SAME named people as the matching T, in the same era. Each F's word count must land within ±5 of \`target_words\` — and across the batch, distribute naturally on both sides of T (half shorter, half longer). Do NOT make every F longer than T.\n\nINPUT:\n${JSON.stringify(inputItems, null, 2)}\n\nReturn ONLY a JSON array of {id, false_text}, same length, same id order.`;

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

  const returnedIds = new Set(parsed.map((p) => p?.id).filter(Boolean));
  const missing = inputItems.filter((i) => !returnedIds.has(i.id));
  if (missing.length > 0) {
    console.log(`  batch ${batchNum}/${totalBatches}: ⚠ ${missing.length} ids missing from response`);
  }

  await writeBatch(parsed);
  console.log(`  batch ${batchNum}/${totalBatches}: ✓ ${parsed.length} written`);
  return parsed.length;
}

async function main() {
  await pgClient.connect();
  const rows = await loadRowsNeedingF();
  if (rows.length === 0) {
    console.log("No rows need F generation.");
    await pgClient.end();
    return;
  }

  const totalBatches = Math.ceil(rows.length / batchSize);
  console.log(`Generating F for ${rows.length} rows in ${totalBatches} batches of ≤${batchSize}…\n`);

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
