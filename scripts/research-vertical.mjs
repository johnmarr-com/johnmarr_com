// Phase 2: Question Designer Agent — research one (game, list) tier and
// emit story_facts + T/PT/F question_sets to NEON.
//
// Usage:
//   node scripts/research-vertical.mjs <gameId> <listType> [maxRank=500]
//
// Examples:
//   node scripts/research-vertical.mjs extra_extra events 50      # tier 1 only
//   node scripts/research-vertical.mjs extra_extra events 175     # tier 1+2
//   node scripts/research-vertical.mjs extra_extra events         # all 500
//
// Flow per subject:
//   1. Upsert into NEON.subjects (idempotent on firestore_id).
//   2. Skip if research_status='ready' (resumable).
//   3. Fetch Wikipedia plain text via MediaWiki API (free, no LLM).
//   4. Haiku extract → 5-12 story-worthy moments (struggle, decision,
//      near-miss, behind-the-curtain, etc.).
//   5. Per fact: Haiku compose → T/PT/F triple + tags, written to NEON.
//   6. Mark research_status='ready' on success.
//
// Cost order-of-magnitude per subject: ~$0.02-0.04 with Haiku 4.5.

import pg from "pg";
import Anthropic from "@anthropic-ai/sdk";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
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

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}
const fs = getFirestore();

const { Client } = pg;
const pgClient = new Client({
  connectionString: env.NEON_URL,
  ssl: { rejectUnauthorized: false },
});

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 60_000 });
const MODEL = "claude-haiku-4-5-20251001";
const MAX_WIKI_CHARS = 28_000; // ~7K tokens of context — enough for narrative-rich subjects.

// Tiered fact cap — MVP density.
function factCapForRank(rank) {
  if (rank <= 50) return 5; // Tier 1
  if (rank <= 175) return 4; // Tier 2
  return 3; // Tier 3
}

// ─── Args ────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const FORCE = argv.includes("--force");
const positional = argv.filter((a) => !a.startsWith("--"));
const [gameId, listType, maxRankArg] = positional;
if (!gameId || !listType) {
  console.error("Usage: node scripts/research-vertical.mjs <gameId> <listType> [maxRank=500] [--force]");
  process.exit(1);
}
const MAX_RANK = Number.parseInt(maxRankArg ?? "500", 10);

// ─── Prompts ────────────────────────────────────────────────

const EXTRACT_SYSTEM = (factCap) => `You curate STORY-WORTHY MOMENTS for Fast Casual Trivia. Players love trivia that makes them FEEL something — surprise, awe, recognition, sadness, amusement. They do NOT want bullet-point biographical facts.

WHAT QUALIFIES (a moment must hit AT LEAST ONE of these):
- Struggle, overcoming, redemption
- A pivotal decision with real consequences
- Coming of age, defining personal turn
- Near miss, disaster narrowly averted
- Huge win, peak triumph
- Huge loss, devastating reversal
- Deep conflict, rivalry, betrayal
- Amazing partnership, unlikely alliance
- Miracle, Hail Mary, against-all-odds save
- Risk taken with reward gained (or lost)
- Behind-the-curtain — "almost didn't happen because…", "the surprising reason it did"
- Anything that produces a "wait, really?" reaction

REJECT (do not include):
- Birth/death dates and locations
- Geographic facts, statistics without narrative
- Names without action
- Routine biographical bullets

EACH MOMENT MUST INCLUDE:
- Specific people (real names)
- Specific action or event
- Specific place if known
- Specific year if known
- Why it mattered (one short clause)

Output ONLY a JSON object: { "facts": [...] }. Each fact:
{
  "fact_text": "1-2 sentence story moment, 20-50 words, written like a story not a fact sheet",
  "fact_year": 1942,
  "emotional_register": "triumph|tragedy|absurd|tender|surprising|defiant|hopeful",
  "involves_living_person": true,
  "involved_persons": ["name1", "name2"]
}

Up to ${factCap} facts. Quality over quantity. Begin with {, end with }.`;

const COMPOSE_SYSTEM = (existingTagsJson) => `You compose T/PT/F (Truth / Partially True / False) triples for Fast Casual Trivia. The brand promise is STORIES, not data — each statement should read like a one-line story and make the reader feel the moment.

DRAMATIC TRIVIA — the overarching philosophy:
- Trivia with STAKES. Trivia that gives the player PAUSE.
- Each statement should make the reader lean in, not skim past.
- Drama, weight, consequence. Getting it right should feel like it matters.
- If a triple feels routine or "well, that's a fact" → tighten it for tension.

INPUT: One real story-worthy moment about a subject.

STEP 1 — Anchor the truth.
Before composing anything, write \`verified_truth_anchor\`: the canonical underlying fact in plain prose ("Churchill became Prime Minister on May 10, 1940"). T must restate this anchor in story form. PT and F derive from this anchor.

STEP 2 — Compose three statements (12-30 words each).

T (Truth): The story exactly as it happened. All key facts (who/what/where/when) accurate, matching the anchor. Story-style, not encyclopedic.

PT (Partially True): The SAME story with ONE substantive detail wrong — wrong in a way a CASUAL PLAYER can FEEL is off, even without expert knowledge.

THE FAST CASUAL PRINCIPLE — most important rule:
- Non-experts with general cultural awareness should be able to sense something's off ("Beatles in 1956? They weren't a thing yet"; "Churchill resigning after six weeks? Doesn't sound right").
- Experts will know exactly what's wrong.
- Avoid alterations so subtle even experts would have to stop and think (e.g. shifting a 1954 ruling to 1955 — too tiny).
- Avoid alterations so cheap they're guessable without any knowledge (single-digit date tweaks, comma changes).
- Sweet spot: the alteration creates a "wait, that doesn't sound right" feeling for someone who knows the topic at a general level.

ACCEPTABLE PT alterations (pick ONE):
- **Date change** — meaningfully off in a way casual players can feel. Often several years to a decade off, depending on the era's "feel" boundaries. May 10, 1940 → August 22, 1951 works (anyone with WWII awareness senses it's wrong). May 10 → May 12 doesn't (no signal).
- **Wrong outcome** — setup is accurate (who, when, where, what action), but the RESULT or CONSEQUENCE is fabricated. Casual player: "wait, did that really happen?" Expert: knows exactly. Example: T = "Churchill became PM the day Hitler invaded France." PT = "Churchill became PM the day Hitler invaded France, but resigned within six weeks."
- **Wrong country or region** — geographically meaningful swap.
- **Wrong number with substantial gap** — the kind a player can sense from scale (1,297 → 800 feels different; 1,297 → 1,295 doesn't).
- **Wrong sidekick / second-tier participant** — but NOT the primary subject.

NEVER ACCEPTABLE for PT (too cheap):
- Off by one day (June 28 → June 29).
- Trivial number tweaks (1,297 → 1,295).
- Single-digit date changes (1969 → 1968).
- Anything a player could guess right without any awareness of the event.

F (False): A demonstrably FALSE statement. The CORE CLAIMS must all be wrong. The frame can keep real context (real era, real event, real people existed) but the SPECIFIC ASSERTIONS in the statement must contradict the historical record.

PRINCIPLE: a knowledgeable player reading F should be able to identify it as false because MULTIPLE things it asserts are plainly not what happened. F should NEVER be "mostly true with one peripheral detail wrong" — that's PT's job. F is multiply, dramatically wrong.

DISTINCTION FROM PT:
- PT changes ONE thing significantly (a date, a country, a number, an outcome).
- F changes MULTIPLE things — typically a misattribution PLUS an outcome inversion PLUS a quote flip, etc. Stacked.

TECHNIQUES — combine TWO OR MORE for rich falsity:
- **Misattribution**: wrong person did/said it
- **Misplacement**: different time, place, or event
- **Outcome inversion**: lost ↔ won, succeeded ↔ failed, recovered ↔ never recovered, escaped ↔ captured, saved ↔ killed
- **Quote inversion**: invert a famous verbatim quote ("we have lost" → "we have won", "I shall return" → "I shall not return")
- **Direction reversal**: rescuer ↔ rescued, attacker ↔ defender, predicted ↔ failed to predict

EXAMPLE — strong F (combines misattribution + quote inversion + outcome inversion):
  T: Crown Prince Wilhelm told a reporter after the First Battle of the Marne in 1914: "We have lost the war." He was right — Germany never recovered from that moment.
  F: Kaiser Wilhelm II told a reporter after the First Battle of the Marne in 1914: "We have won the war." He was right — Germany began to recover from that moment.

EXAMPLE — weak F (only misattributes; the quote and outcome remain TRUE → too ambiguous):
  ❌ Kaiser Wilhelm II told a reporter after the First Battle of the Marne in 1914: "We have lost the war." Germany never recovered.

GUARDRAILS — never do these in F:
- Falsely accuse a living person (or recently deceased within ~25 years) of a crime, scandal, accident they caused, abuse, embarrassment, or wrongdoing
- Fabricate damaging or defamatory stories about real living people
- Invent an event that never happened in any form (must be a recognizable real event being mischaracterized via the techniques above)

LIVING-PEOPLE RULE — STRICT:
- Outcome inversions and quote inversions about living people must stay NEUTRAL or POSITIVE in tone
- Their actual triumph → fictional loss is OK (historical-record territory, not personal slander)
- Their actual quote → inverted version is OK if non-defamatory
- Never invert into "they did something illegal/abusive/scandalous"
- When in doubt, swap subject to a long-dead historical figure — safest path

CRITICAL VALIDATION — before you finalize:
1. Are \`truth_text\` and \`partially_true_text\` actually different? Read both aloud. If they're identical, your PT alteration didn't make it into the text. Fix.
2. Does \`partially_true_alteration\` describe a REAL change FROM truth TO PT? Format: "<field> shifted from <true value> to <pt value>". Both values explicit. Don't write "actually 1939" — write "year shifted from 1939 to 1944".
3. Does \`false_text\` make at least TWO core claims that are demonstrably wrong? If only ONE thing is changed in F (and the rest is true), strengthen by inverting an outcome or a quote.
4. Does the era tag match the historical period of THIS event (not a related one)? A 1914 event is era:ww1, not era:ww2.

VOICE — accessible, not novelistic:
- Write like a great trivia host telling a story at a dinner table — NOT a literary novelist.
- Use 2-3 SHORT sentences instead of one long sentence with em-dashes and trailing clauses.
- Concrete details, active verbs, simple language.
- AT MOST ONE em-dash per statement. No double em-dashes, no clause-stacking.
- Avoid hedging ("apparently", "supposedly", "is said to").
- Read-aloud test: does this sound natural said out loud, or does it feel "written"? If it feels written, shorten.

LENGTH: 15-35 words total, spread across 2-3 short sentences when natural. Punch over polish.

TAGS: Output 3-6 tags. PREFER REUSING existing tags below — only invent new (category, value) when none fit. snake_case lowercase.

Categories:
- decade (1940s, 1990s, 2010s, ...)
- region (us, uk, japan, ww2_europe, vietnam, ...)
- emotion (triumph, tragedy, absurd, tender, surprising, defiant, hopeful)
- theme (rivalry, redemption, accident, partnership, miracle, decision, near_miss, comeback, betrayal, resistance)
- subject_person, subject_brand, subject_place (cross-vertical anchors — slugs like "spielberg", "nasa", "hollywood")
- era (cold_war, prohibition, dot_com, vietnam_war, great_depression, ww1, ww2, pre_ww1, ...)

EXISTING TAGS (reuse these wherever they fit):
${existingTagsJson}

Output ONLY a JSON object. Begin with {, end with }:
{
  "verified_truth_anchor": "Churchill became Prime Minister on May 10, 1940, the day Hitler invaded France.",
  "truth_text": "May 10, 1940. Hitler's tanks rolled into France. The same day, Churchill walked into No. 10 Downing Street. Appeasement was over.",
  "partially_true_text": "August 22, 1951. Hitler's tanks rolled into France. The same day, Churchill walked into No. 10 Downing Street. Appeasement was over.",
  "partially_true_alteration": "date shifted from May 10, 1940 to August 22, 1951 — full date change, 11 years off",
  "false_text": "May 10, 1940. German forces retreated from France. Chamberlain took the keys to No. 10. Appeasement had finally paid off.",
  "false_alteration": "misattribution + outcome inversion: Chamberlain instead of Churchill, Germans 'retreated' instead of invaded, appeasement as triumph instead of failure",
  "living_subject_safe": true,
  "tags": [
    {"category": "decade", "value": "1940s"},
    {"category": "emotion", "value": "defiant"},
    {"category": "subject_person", "value": "churchill"},
    {"category": "era", "value": "ww2"},
    {"category": "theme", "value": "decision"}
  ]
}`;

// ─── Wikipedia fetch (plain text via MediaWiki API) ──────────

function wikiTitleFromUrl(url) {
  if (!url || !url.includes("wikipedia.org")) return null;
  const m = url.match(/\/wiki\/([^?#]+)/);
  if (!m) return null;
  return decodeURIComponent(m[1]);
}

async function fetchWikiExtractByTitle(title) {
  const apiUrl =
    `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exsectionformat=plain&titles=${encodeURIComponent(title)}&format=json&redirects=1&origin=*`;
  const res = await fetch(apiUrl, {
    headers: { "User-Agent": "johnmarr-trivia-research/1.0 (research script)" },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const pages = json?.query?.pages ?? {};
  const page = Object.values(pages)[0];
  if (!page || page.missing !== undefined) return null;
  const extract = typeof page.extract === "string" ? page.extract : "";
  if (extract.length < 1000) return null;
  return extract.length > MAX_WIKI_CHARS ? extract.slice(0, MAX_WIKI_CHARS) : extract;
}

async function searchWikipediaTopTitle(searchTerm) {
  const apiUrl =
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTerm)}&srlimit=1&format=json&origin=*`;
  const res = await fetch(apiUrl, {
    headers: { "User-Agent": "johnmarr-trivia-research/1.0 (research script)" },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const top = json?.query?.search?.[0];
  return typeof top?.title === "string" ? top.title : null;
}

/**
 * Try the configured URL's title first. If that yields no usable extract,
 * fall back to a Wikipedia search for the subject's name and use the top hit.
 */
async function fetchWikipediaText(url, subjectName) {
  const titleFromUrl = url ? wikiTitleFromUrl(url) : null;
  if (titleFromUrl) {
    const text = await fetchWikiExtractByTitle(titleFromUrl);
    if (text) return text;
  }
  if (subjectName) {
    const searchTitle = await searchWikipediaTopTitle(subjectName);
    if (searchTitle) {
      return await fetchWikiExtractByTitle(searchTitle);
    }
  }
  return null;
}

// ─── DB helpers ──────────────────────────────────────────────

async function upsertSubject(subject) {
  const r = await pgClient.query(
    `INSERT INTO subjects
       (firestore_id, game_id, list_type, popularity_rank, name, creator, year, genre, citation_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (firestore_id) DO UPDATE SET
       popularity_rank = EXCLUDED.popularity_rank,
       name = EXCLUDED.name,
       creator = EXCLUDED.creator,
       year = EXCLUDED.year,
       genre = EXCLUDED.genre,
       citation_url = EXCLUDED.citation_url
     RETURNING id, research_status`,
    [
      subject.firestoreId,
      subject.gameId,
      subject.listType,
      subject.popularityRank,
      subject.name,
      subject.creator ?? null,
      subject.year ?? null,
      subject.genre ?? null,
      subject.citationUrl ?? null,
    ],
  );
  return r.rows[0];
}

async function setResearchStatus(subjectId, status, error = null) {
  await pgClient.query(
    `UPDATE subjects SET research_status=$1, research_error=$2,
       research_completed_at=CASE WHEN $1='ready' THEN NOW() ELSE research_completed_at END
     WHERE id=$3`,
    [status, error, subjectId],
  );
}

async function loadExistingTags() {
  const r = await pgClient.query(`SELECT category, value FROM tags ORDER BY category, value`);
  const grouped = {};
  for (const row of r.rows) {
    if (!grouped[row.category]) grouped[row.category] = [];
    grouped[row.category].push(row.value);
  }
  return grouped;
}

async function upsertTag(category, value) {
  const r = await pgClient.query(
    `INSERT INTO tags (category, value) VALUES ($1, $2)
     ON CONFLICT (category, value) DO UPDATE SET category = EXCLUDED.category
     RETURNING id`,
    [category, value],
  );
  return r.rows[0].id;
}

async function writeStoryFact(subjectId, fact) {
  const r = await pgClient.query(
    `INSERT INTO story_facts
       (subject_id, fact_text, source_url, source_name, fact_year, emotional_register, living_subject_safe)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id`,
    [
      subjectId,
      fact.fact_text,
      fact.source_url ?? null,
      fact.source_name ?? null,
      fact.fact_year ?? null,
      fact.emotional_register ?? null,
      fact.living_subject_safe ?? true,
    ],
  );
  return r.rows[0].id;
}

async function writeQuestionSet(subjectId, sourceFactId, qset, tags) {
  // Server-side validation — flag (don't drop) suspicious sets so reviewer can see them.
  const tIdentical = qset.truth_text?.trim() === qset.partially_true_text?.trim();
  const rejection = tIdentical ? "identical_t_pt" : null;

  const qr = await pgClient.query(
    `INSERT INTO question_sets
       (subject_id, source_fact_id, verified_truth_anchor,
        truth_text, partially_true_text, partially_true_alteration,
        false_text, false_alteration, rejection_reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id`,
    [
      subjectId,
      sourceFactId,
      qset.verified_truth_anchor ?? null,
      qset.truth_text,
      qset.partially_true_text,
      qset.partially_true_alteration,
      qset.false_text,
      qset.false_alteration,
      rejection,
    ],
  );
  const qsId = qr.rows[0].id;

  for (const tag of tags) {
    if (!tag?.category || !tag?.value) continue;
    const cat = String(tag.category).toLowerCase().trim().replace(/\s+/g, "_");
    const val = String(tag.value).toLowerCase().trim().replace(/\s+/g, "_");
    if (!cat || !val) continue;
    const tagId = await upsertTag(cat, val);
    await pgClient.query(
      `INSERT INTO question_set_tags (question_set_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [qsId, tagId],
    );
    // Mirror tag onto the subject so subject-level filtering also works.
    await pgClient.query(
      `INSERT INTO subject_tags (subject_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [subjectId, tagId],
    );
  }
  return qsId;
}

// ─── Claude calls ───────────────────────────────────────────

function extractJSON(text) {
  if (!text) return null;
  const stripped = text.replace(/```json\s*/gi, "").replace(/```\s*$/g, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(stripped.slice(start, end + 1));
  } catch {
    return null;
  }
}

// (Helper functions are inlined in main loop for token tracking visibility.)

// ─── Firestore loader ───────────────────────────────────────

async function loadSubjects(gameId, listType, maxRank) {
  const snap = await fs
    .collection("trivia-content")
    .where("gameId", "==", gameId)
    .where("listType", "==", listType)
    .get();

  const subjects = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    if (typeof d.popularityRank !== "number" || d.popularityRank > maxRank) continue;
    const wikiCit = Array.isArray(d.citations)
      ? d.citations.find((c) => c?.url?.includes?.("wikipedia.org"))
      : null;
    subjects.push({
      firestoreId: doc.id,
      gameId: d.gameId,
      listType: d.listType,
      popularityRank: d.popularityRank,
      name: d.name,
      creator: d.subtitle || null,
      year: d.year ?? null,
      genre: d.genre ?? null,
      citationUrl: wikiCit?.url ?? null,
    });
  }
  subjects.sort((a, b) => a.popularityRank - b.popularityRank);
  return subjects;
}

// ─── Token tracking ─────────────────────────────────────────

let totalInputTokens = 0;       // uncached input
let totalOutputTokens = 0;
let totalCacheCreate = 0;       // cache write (25% premium)
let totalCacheRead = 0;         // cache hit (90% discount)

function track(response) {
  const u = response?.usage ?? {};
  totalInputTokens += u.input_tokens ?? 0;
  totalOutputTokens += u.output_tokens ?? 0;
  totalCacheCreate += u.cache_creation_input_tokens ?? 0;
  totalCacheRead += u.cache_read_input_tokens ?? 0;
}

// Haiku 4.5 retail pricing (USD per 1M tokens):
//   input:        $1.00
//   output:       $5.00
//   cache write:  $1.25  (25% premium over input)
//   cache read:   $0.10  (90% discount vs input)
function estimateCost() {
  return (
    (totalInputTokens / 1_000_000) * 1.0 +
    (totalOutputTokens / 1_000_000) * 5.0 +
    (totalCacheCreate / 1_000_000) * 1.25 +
    (totalCacheRead / 1_000_000) * 0.1
  );
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  await pgClient.connect();
  console.log(`\nResearching ${gameId}/${listType} (rank ≤ ${MAX_RANK})…\n`);

  const subjects = await loadSubjects(gameId, listType, MAX_RANK);
  console.log(`Found ${subjects.length} subjects to process.\n`);

  let processed = 0;
  let factsTotal = 0;
  let questionsTotal = 0;
  let skipped = 0;
  let failed = 0;

  for (const subject of subjects) {
    const label = `[#${subject.popularityRank}] ${subject.name}`;
    let neonSubjectId = null;
    try {
      const upserted = await upsertSubject(subject);
      neonSubjectId = upserted.id;

      if (upserted.research_status === "ready" && !FORCE) {
        console.log(`${label}  ⏭  already ready (use --force to redo)`);
        skipped++;
        continue;
      }

      if (FORCE && upserted.research_status === "ready") {
        // Wipe prior facts + question_sets + tag links so re-run produces clean output.
        await pgClient.query(
          `DELETE FROM question_sets WHERE subject_id = $1`,
          [neonSubjectId],
        );
        await pgClient.query(`DELETE FROM story_facts WHERE subject_id = $1`, [neonSubjectId]);
        await pgClient.query(`DELETE FROM subject_tags WHERE subject_id = $1`, [neonSubjectId]);
      }

      await setResearchStatus(neonSubjectId, "researching");

      // 1. Wikipedia (with search fallback if the configured URL is a slug mismatch)
      const wikiText = await fetchWikipediaText(subject.citationUrl, subject.name);
      if (!wikiText || wikiText.length < 1000) {
        await setResearchStatus(neonSubjectId, "failed", "wikipedia text unavailable or too short");
        console.log(`${label}  ✗  no usable Wikipedia text`);
        failed++;
        continue;
      }

      // 2. Extract story facts (cap depends on tier)
      const factCap = factCapForRank(subject.popularityRank);
      const extractRes = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4000,
        // System prompt is identical across all extracts at this tier — cache it.
        system: [
          {
            type: "text",
            text: EXTRACT_SYSTEM(factCap),
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: `SUBJECT: ${subject.name}${subject.creator ? ` (${subject.creator})` : ""}${subject.year ? ` — ${subject.year}` : ""}\n\nCONTEXT (from Wikipedia):\n${wikiText}\n\nExtract story-worthy moments. Up to ${factCap}. Quality over quantity.`,
          },
        ],
      });
      track(extractRes);
      const extractText = extractRes.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
      const facts = (extractJSON(extractText)?.facts) ?? [];
      if (facts.length === 0) {
        await setResearchStatus(neonSubjectId, "failed", "no story-worthy facts extracted");
        console.log(`${label}  ✗  no facts extracted`);
        failed++;
        continue;
      }

      // 3. Save story_facts and create question_set rows with NULL T/PT/F.
      // Sonnet pipeline (harmonize-truth → generate-pt → generate-false) fills the rest.
      let factsWritten = 0;
      let questionsWritten = 0;
      for (const fact of facts) {
        if (!fact?.fact_text) continue;
        fact.source_url = subject.citationUrl ?? null;
        fact.source_name = subject.citationUrl?.includes("wikipedia.org") ? "Wikipedia" : null;
        fact.living_subject_safe = !fact.involves_living_person;

        const factId = await writeStoryFact(neonSubjectId, fact);
        factsWritten++;

        // Create question_set with NULL truth/PT/F. Downstream Sonnet stages fill them.
        await pgClient.query(
          `INSERT INTO question_sets (subject_id, source_fact_id) VALUES ($1, $2)`,
          [neonSubjectId, factId],
        );
        questionsWritten++;
      }

      await setResearchStatus(neonSubjectId, "ready");
      console.log(`${label}  ✓  ${factsWritten} facts → ${questionsWritten} Q-sets`);
      factsTotal += factsWritten;
      questionsTotal += questionsWritten;
      processed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      console.log(`${label}  ✗  ${msg}`);
      if (neonSubjectId) await setResearchStatus(neonSubjectId, "failed", msg).catch(() => {});
      failed++;
    }
  }

  console.log(
    `\nDone. processed=${processed}, skipped=${skipped}, failed=${failed}, facts=${factsTotal}, questions=${questionsTotal}`,
  );
  console.log(
    `Tokens: in=${totalInputTokens.toLocaleString()} (uncached), cache_write=${totalCacheCreate.toLocaleString()}, cache_read=${totalCacheRead.toLocaleString()}, out=${totalOutputTokens.toLocaleString()}  ≈ $${estimateCost().toFixed(2)}`,
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
