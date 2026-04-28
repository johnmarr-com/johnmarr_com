// Production pipeline: generate F's for EE top-50 subjects.
// gen +4 oversample → audit → filter → top-up if short → write to DB.
// Then second-pass audit on shipped F's for accuracy reporting.

import pg from "pg";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf-8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
  }),
);

const argv = process.argv.slice(2);
function flag(name, def) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
}
const MIN_RANK = Number.parseInt(flag("min-rank", "1"), 10);
const MAX_RANK = Number.parseInt(flag("max-rank", "50"), 10);
const GAME = flag("game", "extra_extra");
console.log(`Game: ${GAME}, range: rank ${MIN_RANK}-${MAX_RANK}\n`);

const pool = new pg.Pool({
  connectionString: env.NEON_URL,
  ssl: { rejectUnauthorized: false },
  max: 4,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});
pool.on("error", (err) => console.log(`  pool error (recovered): ${err.message}`));

async function q(sql, params) {
  // Retry once on transient connection errors.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await pool.query(sql, params);
    } catch (err) {
      if (attempt === 0 && /terminat|connection|ECONNRESET|57P01/i.test(err.message)) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      throw err;
    }
  }
}

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 180_000 });

const GEN_PROMPT = `You are writing fictional statements for a trivia game with three answer types: TRUE, PARTIALLY TRUE, and FALSE. You are writing only the FALSE category — statements that are entirely invented with zero true elements embedded in them.

The goal: Write false historical statements that are so plausible, so human, and so confidently written that knowledgeable players will genuinely pause before marking them false.

# RULES

1. **Use real people, real places, real historical events as backdrops.** The setting must be grounded in documented history. The invented element is always the human story inside it — a decision, a moment, a private action, a relationship, a feeling.

2. **Every statement must be entirely false.** Before submitting, check each statement against known history. If any part of the core claim is true — even partially — rewrite it. The fictional event, action, or detail must not accidentally overlap with documented record.

3. **Target 50 words.** Write with economy and weight. Every sentence earns its place.

4. **Write like a historian, not a storyteller.** State the fiction as flat, confident fact. No drama, no flourish, no winking at the reader. The tone should feel like a paragraph from a well-researched biography.

5. **Make it human.** The best false statements are about private moments — what someone kept in their pocket, what they said to one person, what they refused to do, what they felt and never showed. Avoid grand strategic fictions. Go small and specific.

6. **End with confidence, not cover.** Do not end statements with phrases that destroy evidence or prevent verification — no fires, no lost documents, no silences, no "never spoke of it again," no "no record exists." True facts don't protect themselves. Your false facts shouldn't either. End on a detail, an action, a name, a date — something that implies the world continued normally after this moment.

7. **Do not justify or source unless it feels completely natural.** Real facts don't footnote themselves in casual telling. Avoid endings like "this is recorded in the Vatican Archive" or "referenced in his published memoir" — these are tells that the statement is compensating for its own implausibility.

8. **Avoid pattern tells.** Eliminate these recurring false-statement habits:
   - Ending with obfuscation ("the document was lost," "she never discussed it publicly")
   - Ending with a source citation to prove the unprovable
   - Using the words "reportedly" or "allegedly"
   - Framing that invites the reader to excuse a lack of evidence
   - Absurd or comic outcomes — nothing silly, nothing that strains credulity
   - Outcomes that are too neat, too ironic, or too perfectly sad

9. **Avoid Partially-True contamination.** Common failure modes:
   - Real quotes or documented dialogue attributed to wrong contexts
   - True biographical details (height, family, known habits) used as the fictional hook
   - Real relationships between historical figures used as the setting for invented intimacy
   - Famous documented facts about a person used as atmosphere for invented additions
   - Events that "could have" happened but are unverified — these feel safe but can overlap with real undocumented history

10. **NEVER invent personal names for individuals.** Every named individual in your statement must be a real, documented historical figure. If the action belongs to a peripheral or supporting person, use a generic description ("a Wehrmacht quartermaster," "her stylist," "a junior aide") — NEVER invent a name like "Sergeant Pavel Orlov" or "Eddie Carew." Inventing names is a category error — they become tells in a corpus of these statements.

11. **After writing all statements, audit every one.** Ask of each: Is there any documented version of this claim, even partially? Could a historian read this and say "well, actually, that part is true"? If yes, rewrite. Submit only statements that are clean.

# THE TONE TO AIM FOR

Imagine a brilliant, compassionate historian writing a single paragraph about a moment that changed nothing historically but reveals everything humanly. The reader should feel something — recognition, sadness, admiration, tenderness — before they discover it isn't true. That emotional plausibility is what makes a false statement dangerous in a trivia context. It should feel true because it feels right, not because it sounds authoritative.

# OUTPUT FORMAT

You will receive a JSON array of {subject_id, subject, count} items. Each asks for {count} false statements about {subject}. Vary the kind of moment described across the {count} statements — different actors, different settings, different emotional registers.

Return ONLY a JSON array of {subject_id, statements} where statements is an array of strings — exactly {count} false_text values per subject. No commentary, no markdown fences.`;

const AUDIT_PROMPT = `You are auditing trivia game statements submitted as FALSE (F). The trivia game has three answer types:

  - TRUE (T):  every described action is documented historical fact
  - PT:        a mix — at least one described action is real, at least one is invented
  - FALSE (F): every described action is invented or misattributed

# CORE PRINCIPLE — NARRATIVE ACTIONS vs BACKDROP

A statement contains two distinct kinds of content:

- **Narrative actions**: what someone DOES, SAYS, DECIDES, ARGUES, REFUSES, FEELS, ACHIEVES. Every action attributed to a named person in the statement.
- **Backdrop**: setting, era, surrounding events, places, dates, eligible-for-being-real context.

For F to pass: **every narrative action** must be either INVENTED or MISATTRIBUTED. Backdrop can be 100% real — that's the brand voice (real people, real era, real backdrop, invented narrative).

If even one narrative action is documented (real actor + real action + real context), the statement is contaminated as PT or T.

# EXAMPLE

"Will Smith slapped Chris Rock at the Oscars while Smith yelled 'keep my wife's name out of your fucking mouth.'"
- Action 1: Will Smith slapping Rock → REAL → fails F.
- Action 2: Smith yelled that quote → REAL → fails F.
This is T-shaped.

"Denzel Washington slapped Chris Rock at the Oscars while Smith yelled 'keep my wife's name out of your fucking mouth.'"
- Action 1: Denzel slapping Rock → MISATTRIBUTED (didn't happen by Denzel) → F-eligible.
- Action 2: Smith yelled that quote → REAL → fails F.
This is PT-shaped (one real action embedded).

"Denzel Washington slapped Chris Rock at the Oscars while glancing back at Will Smith, who watched silently."
- Action 1: Denzel slapping Rock → MISATTRIBUTED → F.
- Action 2: Smith watching silently → INVENTED specific behavior (he didn't sit silent at that moment in reality) → F.
- Backdrop: the Oscars, Chris Rock present → REAL backdrop, fine.
This is genuine F. Pass.

# WHAT MAKES F (PASS)

✓ Every named action either invented or misattributed.
✓ Backdrop fully real — date, place, surrounding event, who else was there.
✓ Wrong actor performing a real action → that scenario didn't happen → F.
✓ Wrong era / impossible date → scenario didn't happen → F.
✓ Real character with inverted behavior they never did.
✓ Plausible "could have happened" actions that aren't specifically documented.

# WHAT MAKES F CONTAMINATED (FLAG)

❌ Any single described action is documented as having happened, performed by the actor described, in the context described. Even if other actions in the F are invented, ONE real embedded action makes it PT-shaped.
❌ A real quote attributed verbatim (or near-verbatim) to its real speaker.
❌ A real outcome / decision / reaction described as documented.
❌ A famous fact contradicted (war winner reversed, election reversed, famous death erased) — players reject by recognition.
❌ A personal name invented and presented as real ("Sergeant Pavel Orlov," "stylist Marco Delvechio"). Real individuals must be named; supporting cast must use generic descriptions ("a Wehrmacht quartermaster") with no invented name.

# DO NOT FLAG

✓ Real backdrop, real surrounding events, real settings — those are eligible.
✓ Wrong actor doing a real action — F by definition.
✓ Plausible undocumented scenarios consistent with character.
✓ Invented content attributed to real documents (fictional log entries, fabricated letter contents).
✓ Slight backdrop inaccuracies (wrong car number) — backdrop noise.
✓ Stylistic preferences ("reportedly," obfuscation endings) — quality, not truth.

# THE TEST

For each described action in the statement, ask: "Did this actor do this thing in this context in real life?"
- All actions: NO → F → pass.
- One or more actions: YES → PT or T → flag.
- Surrounding events / settings being real → does NOT contaminate.

# INPUT
JSON array of {id, subject, false_text}.

# OUTPUT — STRICT
JSON array of {id, contaminated, reason}. Same id order. No commentary, no markdown.`;

async function generate(subjectsArr) {
  const userMsg = `Generate false statements per subject. Vary the kind of moment across statements about each subject.\n\nINPUT:\n${JSON.stringify(subjectsArr, null, 2)}\n\nReturn ONLY JSON array of {subject_id, statements}.`;
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    system: [{ type: "text", text: GEN_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMsg }],
  });
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const stripped = text.replace(/```json\s*/gi, "").replace(/```\s*$/g, "").trim();
  const start = stripped.indexOf("[");
  const end = stripped.lastIndexOf("]");
  return { parsed: JSON.parse(stripped.slice(start, end + 1)), usage: res.usage };
}

async function audit(items) {
  const userMsg = `Audit ${items.length} statements for truth contamination and pattern tells.\n\nINPUT:\n${JSON.stringify(items, null, 2)}\n\nReturn ONLY JSON array of {id, contaminated, reason}.`;
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    system: [{ type: "text", text: AUDIT_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMsg }],
  });
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const stripped = text.replace(/```json\s*/gi, "").replace(/```\s*$/g, "").trim();
  const start = stripped.indexOf("[");
  const end = stripped.lastIndexOf("]");
  return { parsed: JSON.parse(stripped.slice(start, end + 1)), usage: res.usage };
}


// EE subjects in rank range. Skip subjects already fully filled (idempotent re-run).
const subjRes = await q(`
  SELECT s.id, s.name, s.popularity_rank,
         COUNT(qs.id) FILTER (WHERE qs.truth_text IS NOT NULL) AS qs_total,
         COUNT(qs.id) FILTER (WHERE qs.truth_text IS NOT NULL AND qs.false_text IS NULL) AS qs_needs_f
  FROM subjects s
  JOIN question_sets qs ON qs.subject_id = s.id
  WHERE s.game_id = $3
    AND s.popularity_rank >= $1 AND s.popularity_rank <= $2
  GROUP BY s.id, s.name, s.popularity_rank
  HAVING COUNT(qs.id) FILTER (WHERE qs.truth_text IS NOT NULL AND qs.false_text IS NULL) > 0
  ORDER BY s.popularity_rank
`, [MIN_RANK, MAX_RANK, GAME]);
const subjects = subjRes.rows.map((r) => ({
  id: r.id,
  name: r.name,
  popularity_rank: r.popularity_rank,
  qs_count: Number(r.qs_needs_f),
}));
const totalNeeded = subjects.reduce((s, x) => s + x.qs_count, 0);

console.log(`EE top-50: ${subjects.length} subjects, ${totalNeeded} F's needed.\n`);

const OVERSAMPLE = 4;
const BATCH = 3;
const totalUsage = { input: 0, output: 0 };
const cleanBySubject = new Map();
const flaggedAll = [];

for (let i = 0; i < subjects.length; i += BATCH) {
  const batch = subjects.slice(i, i + BATCH);
  const batchNum = Math.floor(i / BATCH) + 1;
  const totalBatches = Math.ceil(subjects.length / BATCH);
  const reqs = batch.map((s) => ({ subject_id: s.id, subject: s.name, count: s.qs_count + OVERSAMPLE }));

  console.log(`Batch ${batchNum}/${totalBatches}: ${batch.map((b) => b.name).join(", ")}`);
  let gen, auditRes;
  try {
    gen = await generate(reqs);
    totalUsage.input += gen.usage.input_tokens;
    totalUsage.output += gen.usage.output_tokens;

    const auditItems = [];
    for (const group of gen.parsed) {
      const subj = batch.find((s) => s.id === group.subject_id);
      if (!subj) continue;
      for (const [j, stmt] of group.statements.entries()) {
        auditItems.push({ id: `${group.subject_id}::${j}`, subject: subj.name, false_text: stmt });
      }
    }

    auditRes = await audit(auditItems);
    totalUsage.input += auditRes.usage.input_tokens;
    totalUsage.output += auditRes.usage.output_tokens;
    const auditMap = new Map();
    for (const a of auditRes.parsed) auditMap.set(a.id, a);

    for (const it of auditItems) {
      const sid = it.id.split("::")[0];
      if (!cleanBySubject.has(sid)) cleanBySubject.set(sid, []);
      const a = auditMap.get(it.id);
      if (!a?.contaminated) cleanBySubject.get(sid).push(it.false_text);
      else flaggedAll.push({ subject_id: sid, false_text: it.false_text, reason: a.reason });
    }
  } catch (err) {
    console.log(`  ✗ batch failed: ${err?.message ?? "unknown"}`);
    continue;
  }

  // Top-up if any subject in batch is short.
  const shortfalls = batch.filter((s) => (cleanBySubject.get(s.id)?.length ?? 0) < s.qs_count);
  if (shortfalls.length > 0) {
    const topReqs = shortfalls.map((s) => ({
      subject_id: s.id,
      subject: s.name,
      count: s.qs_count - (cleanBySubject.get(s.id)?.length ?? 0) + OVERSAMPLE,
    }));
    console.log(`  top-up needed for ${shortfalls.length} subjects`);
    try {
      const top = await generate(topReqs);
      totalUsage.input += top.usage.input_tokens;
      totalUsage.output += top.usage.output_tokens;

      const topAudit = [];
      for (const group of top.parsed) {
        const subj = batch.find((s) => s.id === group.subject_id);
        if (!subj) continue;
        for (const [j, stmt] of group.statements.entries()) {
          topAudit.push({ id: `${group.subject_id}::top::${j}`, subject: subj.name, false_text: stmt });
        }
      }
      const topRes = await audit(topAudit);
      totalUsage.input += topRes.usage.input_tokens;
      totalUsage.output += topRes.usage.output_tokens;
      const topMap = new Map();
      for (const a of topRes.parsed) topMap.set(a.id, a);
      for (const it of topAudit) {
        const sid = it.id.split("::")[0];
        const a = topMap.get(it.id);
        if (!a?.contaminated) cleanBySubject.get(sid).push(it.false_text);
        else flaggedAll.push({ subject_id: sid, false_text: it.false_text, reason: a.reason });
      }
    } catch (err) {
      console.log(`  ✗ top-up failed: ${err?.message ?? "unknown"}`);
    }
  }

  // Write this batch's clean F's to DB immediately (per-batch persistence).
  for (const subj of batch) {
    const clean = cleanBySubject.get(subj.id) ?? [];
    if (clean.length === 0) continue;
    try {
      const qs = await q(
        `SELECT id FROM question_sets WHERE subject_id = $1 AND truth_text IS NOT NULL AND false_text IS NULL ORDER BY created_at`,
        [subj.id],
      );
      const slots = qs.rows;
      const fillCount = Math.min(clean.length, slots.length);
      for (let i = 0; i < fillCount; i++) {
        await q(`UPDATE question_sets SET false_text = $1 WHERE id = $2`, [clean[i], slots[i].id]);
      }
    } catch (err) {
      console.log(`  ✗ db write failed for ${subj.name}: ${err?.message}`);
    }
  }

  const summary = batch.map((s) => `${s.name}: ${cleanBySubject.get(s.id)?.length ?? 0}/${s.qs_count}`).join(" | ");
  console.log(`  → ${summary} (written)`);
}

// Fill any remaining NULL false_text rows in range with 'pending' placeholder.
console.log(`\nMarking unfilled rows as 'pending'…`);
const pendingRes = await q(`
  UPDATE question_sets SET false_text = 'pending'
  WHERE false_text IS NULL
    AND truth_text IS NOT NULL
    AND subject_id IN (
      SELECT id FROM subjects WHERE game_id = $3
        AND popularity_rank >= $1 AND popularity_rank <= $2
    )
`, [MIN_RANK, MAX_RANK, GAME]);
console.log(`Marked ${pendingRes.rowCount ?? 0} rows as 'pending'.`);

// Final tally from DB.
console.log(`\nFinal tally…`);
let written = 0;
let pending = 0;
const subjectFillStatus = [];
for (const subj of subjects) {
  const qs = await q(
    `SELECT COUNT(*) FILTER (WHERE false_text IS NOT NULL AND false_text <> 'pending') AS filled,
            COUNT(*) FILTER (WHERE false_text = 'pending') AS pending,
            COUNT(*) FILTER (WHERE truth_text IS NOT NULL) AS total
     FROM question_sets WHERE subject_id = $1`,
    [subj.id],
  );
  const filled = Number(qs.rows[0].filled);
  const pendingCount = Number(qs.rows[0].pending);
  const total = Number(qs.rows[0].total);
  written += filled;
  pending += pendingCount;
  subjectFillStatus.push({
    rank: subj.popularity_rank,
    name: subj.name,
    needed: total,
    filled,
    gap: pendingCount,
  });
}

console.log(`Filled: ${written}. Pending: ${pending}. Total: ${written + pending}.`);

// Second-pass audit on shipped F's: how many of what we shipped is actually clean?
console.log(`\nSecond-pass audit on ${written} shipped F's…`);
const shipped = await q(`
  SELECT qs.id, s.name AS subject, qs.false_text
  FROM question_sets qs JOIN subjects s ON s.id = qs.subject_id
  WHERE s.game_id = $3
    AND s.popularity_rank >= $1 AND s.popularity_rank <= $2
    AND qs.false_text IS NOT NULL AND qs.false_text <> 'pending'
  ORDER BY s.popularity_rank, qs.created_at
`, [MIN_RANK, MAX_RANK, GAME]);
const shippedItems = shipped.rows.map((r) => ({ id: r.id, subject: r.subject, false_text: r.false_text }));

// Audit in chunks of 30 to keep token usage manageable.
const CHUNK = 30;
const secondPass = [];
for (let i = 0; i < shippedItems.length; i += CHUNK) {
  const chunk = shippedItems.slice(i, i + CHUNK);
  try {
    const res = await audit(chunk);
    totalUsage.input += res.usage.input_tokens;
    totalUsage.output += res.usage.output_tokens;
    secondPass.push(...res.parsed);
  } catch (err) {
    console.log(`  audit chunk ${i / CHUNK + 1} failed: ${err?.message}`);
  }
}

const flagged2 = secondPass.filter((s) => s.contaminated);
const accuracyPct = ((1 - flagged2.length / secondPass.length) * 100).toFixed(1);

const cost = (totalUsage.input / 1_000_000) * 3.0 + (totalUsage.output / 1_000_000) * 15.0;

console.log(`\n${"=".repeat(80)}`);
console.log(`SUMMARY`);
console.log(`${"=".repeat(80)}`);
console.log(`Subjects processed: ${subjects.length}`);
console.log(`Total F's needed: ${totalNeeded}`);
console.log(`Total F's filled: ${written}`);
console.log(`Pending: ${pending}`);
console.log(`Second-pass audit: ${flagged2.length}/${secondPass.length} flagged on review`);
console.log(`Accuracy (clean rate): ${accuracyPct}%`);
console.log(`Cost: $${cost.toFixed(2)}`);
console.log();
console.log(`Subjects with gaps:`);
for (const s of subjectFillStatus.filter((x) => x.gap > 0)) {
  console.log(`  rank ${s.rank}: ${s.name} — ${s.filled}/${s.needed}`);
}
console.log();
console.log(`Second-pass flagged samples (top 10):`);
for (const f of flagged2.slice(0, 10)) {
  const item = shippedItems.find((i) => i.id === f.id);
  if (!item) continue;
  console.log(`\n  [${item.subject}]`);
  console.log(`    F: ${item.false_text}`);
  console.log(`    🚩 ${f.reason}`);
}

await pool.end();
