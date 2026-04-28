// Pipeline test: gen+oversample → combined audit (truth + pattern) → filter → top-up.
// 5 random EE subjects with currently-bad F's. No DB writes.

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
const c = new Client({ connectionString: env.NEON_URL, ssl: { rejectUnauthorized: false } });
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 120_000 });

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

const AUDIT_PROMPT = `You are a historian fact-checking trivia game statements that are submitted as FALSE. Each must be ENTIRELY fictional — zero overlap with documented history AND zero pattern tells that would mark it as fabricated to a discerning player.

For each statement, return:
- contaminated: true | false
- reason: brief explanation if contaminated; null if clean

# FLAG (contaminated = true) IF ANY OF:

## Factual contamination
- The specific event matches documented history
- A person's claimed habit, possession, or quote matches their well-known biography
- A relationship described matches the documented record
- A role attribution is correct AND anchors a verifiable claim
- A role attribution is INCORRECT (factual error about who held what role)
- The setting/event is a real famous incident with embellished details
- A "could have happened" event so consistent with documented behavior it might be true

## Pattern tells
- A personal name is INVENTED (cannot be found in historical record) — e.g., "Sergeant Pavel Orlov," "Eddie Carew," "stylist Marco Delvechio." Real individuals must be named; supporting cast must use generic descriptions ("a Wehrmacht quartermaster") with NO invented name.
- Uses "reportedly" or "allegedly"
- Ends with obfuscation: "the document was lost," "she never discussed it publicly," "no record exists," "never spoke of it again"
- Ends with a source citation to prove the unprovable ("recorded in the Vatican Archive")
- Outcome too neat, too ironic, or too perfectly sad
- Absurd, silly, or comic outcomes

Be aggressive. When in doubt, flag it. False statements for a trivia game cannot tolerate any contamination or pattern tell.

# INPUT

JSON array of {id, subject, false_text}.

# OUTPUT — STRICT

JSON array of {id, contaminated, reason}. Same id order. No commentary, no markdown.`;

async function generate(subjectsArr) {
  const userMsg = `Generate the requested false statements per subject. Vary the kind of moment across the statements about each subject — different actors, different settings, different registers.\n\nINPUT:\n${JSON.stringify(subjectsArr, null, 2)}\n\nReturn ONLY JSON array of {subject_id, statements}.`;

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
  const userMsg = `Audit these ${items.length} false statements. Flag any with truth contamination or pattern tells.\n\nINPUT:\n${JSON.stringify(items, null, 2)}\n\nReturn ONLY JSON array of {id, contaminated, reason}.`;

  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 6000,
    system: [{ type: "text", text: AUDIT_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMsg }],
  });

  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  const stripped = text.replace(/```json\s*/gi, "").replace(/```\s*$/g, "").trim();
  const start = stripped.indexOf("[");
  const end = stripped.lastIndexOf("]");
  return { parsed: JSON.parse(stripped.slice(start, end + 1)), usage: res.usage };
}

function wc(s) {
  return s ? s.trim().split(/\s+/).filter(Boolean).length : 0;
}

await c.connect();

// Pick 5 random EE subjects, distinct, that have F's currently.
const r = await c.query(`
  SELECT s.id, s.name, s.popularity_rank, COUNT(qs.id) AS qs_count
  FROM subjects s
  JOIN question_sets qs ON qs.subject_id = s.id
  WHERE s.game_id = 'extra_extra'
    AND qs.truth_text IS NOT NULL
    AND qs.false_text IS NOT NULL
  GROUP BY s.id, s.name, s.popularity_rank
  ORDER BY random()
  LIMIT 5
`);
const picks = r.rows;

console.log(`Pipeline test on 5 EE subjects:\n`);
for (const p of picks) {
  console.log(`  rank ${p.popularity_rank}: ${p.name} (${p.qs_count} F's needed)`);
}
console.log();

const OVERSAMPLE = 4;
const totalUsage = { input: 0, output: 0 };

const subjectsArr = picks.map((p) => ({
  subject_id: p.id,
  subject: p.name,
  count: Number(p.qs_count) + OVERSAMPLE,
}));

console.log(`PASS 1: generating ${subjectsArr.reduce((s, x) => s + x.count, 0)} F's (oversample +${OVERSAMPLE} per subject)…`);
const gen = await generate(subjectsArr);
totalUsage.input += gen.usage.input_tokens;
totalUsage.output += gen.usage.output_tokens;

const auditItems = [];
for (const group of gen.parsed) {
  const subj = picks.find((p) => p.id === group.subject_id);
  for (const [i, stmt] of group.statements.entries()) {
    auditItems.push({
      id: `${group.subject_id}::${i}`,
      subject: subj.name,
      false_text: stmt,
    });
  }
}

console.log(`PASS 2: auditing ${auditItems.length} F's…`);
const auditRes = await audit(auditItems);
totalUsage.input += auditRes.usage.input_tokens;
totalUsage.output += auditRes.usage.output_tokens;

const auditMap = new Map();
for (const a of auditRes.parsed) auditMap.set(a.id, a);

// Group by subject, partition clean/flagged.
const bySubject = new Map();
for (const it of auditItems) {
  const sid = it.id.split("::")[0];
  if (!bySubject.has(sid)) bySubject.set(sid, { clean: [], flagged: [] });
  const audit = auditMap.get(it.id);
  if (audit?.contaminated) {
    bySubject.get(sid).flagged.push({ ...it, reason: audit.reason });
  } else {
    bySubject.get(sid).clean.push(it);
  }
}

// Top-up if any subject is short.
const shortfalls = [];
for (const p of picks) {
  const need = Number(p.qs_count);
  const have = bySubject.get(p.id)?.clean.length ?? 0;
  if (have < need) {
    shortfalls.push({ subject_id: p.id, subject: p.name, count: need - have + OVERSAMPLE });
  }
}

if (shortfalls.length > 0) {
  console.log(`PASS 3: top-up needed for ${shortfalls.length} subjects, generating ${shortfalls.reduce((s, x) => s + x.count, 0)} more…`);
  const top = await generate(shortfalls);
  totalUsage.input += top.usage.input_tokens;
  totalUsage.output += top.usage.output_tokens;

  const topAudit = [];
  for (const group of top.parsed) {
    const subj = picks.find((p) => p.id === group.subject_id);
    for (const [i, stmt] of group.statements.entries()) {
      topAudit.push({ id: `${group.subject_id}::top::${i}`, subject: subj.name, false_text: stmt });
    }
  }
  const topRes = await audit(topAudit);
  totalUsage.input += topRes.usage.input_tokens;
  totalUsage.output += topRes.usage.output_tokens;

  const topAuditMap = new Map();
  for (const a of topRes.parsed) topAuditMap.set(a.id, a);
  for (const it of topAudit) {
    const sid = it.id.split("::")[0];
    const a = topAuditMap.get(it.id);
    if (!a?.contaminated) bySubject.get(sid).clean.push(it);
    else bySubject.get(sid).flagged.push({ ...it, reason: a.reason });
  }
}

// Pull current bad F's for before-comparison.
const currentRows = await c.query(
  `SELECT qs.subject_id, qs.false_text
   FROM question_sets qs
   WHERE qs.subject_id = ANY($1::uuid[]) AND qs.false_text IS NOT NULL
   ORDER BY qs.subject_id, qs.created_at`,
  [picks.map((p) => p.id)],
);
const currentBySubject = new Map();
for (const row of currentRows.rows) {
  if (!currentBySubject.has(row.subject_id)) currentBySubject.set(row.subject_id, []);
  currentBySubject.get(row.subject_id).push(row.false_text);
}

// Print results.
console.log("\n\n" + "=".repeat(80));
console.log("RESULTS");
console.log("=".repeat(80));

for (const p of picks) {
  const need = Number(p.qs_count);
  const subjData = bySubject.get(p.id);
  const finalists = subjData.clean.slice(0, need);

  console.log(`\n\n### [rank ${p.popularity_rank}] ${p.name}`);
  console.log(`Need ${need}. Generated ${subjData.clean.length + subjData.flagged.length}. Clean ${subjData.clean.length}. Flagged ${subjData.flagged.length}. Using ${finalists.length}.`);

  console.log(`\n— BEFORE (current bad F's, ${currentBySubject.get(p.id)?.length ?? 0}) —`);
  for (const [i, f] of (currentBySubject.get(p.id) ?? []).entries()) {
    console.log(`  ${i + 1}. (${wc(f)}w) ${f}\n`);
  }

  console.log(`— AFTER (new finalists, ${finalists.length}) —`);
  for (const [i, f] of finalists.entries()) {
    console.log(`  ${i + 1}. (${wc(f.false_text)}w) ${f.false_text}\n`);
  }

  if (subjData.flagged.length > 0) {
    console.log(`— DISCARDED (${subjData.flagged.length}) —`);
    for (const f of subjData.flagged) {
      console.log(`  • ${f.false_text}`);
      console.log(`    🚩 ${f.reason}\n`);
    }
  }
}

const cost = (totalUsage.input / 1_000_000) * 3.0 + (totalUsage.output / 1_000_000) * 15.0;
console.log(`\n\nTotal tokens: in=${totalUsage.input}, out=${totalUsage.output}  ≈ $${cost.toFixed(4)}`);
console.log(`Per subject avg: ≈ $${(cost / picks.length).toFixed(4)}`);
console.log(`Projected for full EE+PW (884 rows): ≈ $${(cost / picks.reduce((s, p) => s + Number(p.qs_count), 0) * 884).toFixed(2)}`);

await c.end();
