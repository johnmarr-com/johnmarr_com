// Test: subject-seeded F generation using the user's prompt.
// Picks 3 subjects from EE (one top, one mid, one low rank), generates
// 5 F's per subject, prints. No DB writes.

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

const SYSTEM_PROMPT = `You are writing fictional statements for a trivia game with three answer types: TRUE, PARTIALLY TRUE, and FALSE. You are writing only the FALSE category — statements that are entirely invented with zero true elements embedded in them.

The goal: Write false historical statements that are so plausible, so human, and so confidently written that knowledgeable players will genuinely pause before marking them false.

# RULES

1. **Use real people, real places, real historical events as backdrops.** The setting must be grounded in documented history. The invented element is always the human story inside it — a decision, a moment, a private action, a relationship, a feeling.

2. **Every statement must be entirely false.** Before submitting, check each statement against known history. If any part of the core claim is true — even partially — rewrite it. The fictional event, action, or detail must not accidentally overlap with documented record.

3. **Target 50 words.** Write with economy and weight. Every sentence earns its place.

4. **Write like a historian, not a storyteller.** State the fiction as flat, confident fact. No drama, no flourish, no winking at the reader. The tone should feel like a paragraph from a well-researched biography.

5. **Make it human.** The best false statements are about private moments — what someone kept in their pocket, what they said to one person, what they refused to do, what they felt and never showed. Avoid grand strategic fictions. Go small and specific.

6. **End with confidence, not cover.** Do not end statements with phrases that destroy evidence or prevent verification — no fires, no lost documents, no silences, no "never spoke of it again," no "no record exists." True facts don't protect themselves. Your false facts shouldn't either. End on a detail, an action, a name, a date — something that implies the world continued normally after this moment.

7. **Do not justify or source unless it feels completely natural.** Real facts don't footnote themselves in casual telling. Avoid endings like "this is recorded in the Vatican Archive" or "referenced in his published memoir" — these are tells that the statement is compensating for its own implausibility. Just say the thing as though it is true and move on.

8. **Avoid pattern tells.** Watch for these recurring false-statement habits and eliminate them:
   - Ending with obfuscation ("the document was lost," "she never discussed it publicly")
   - Ending with a source citation to prove the unprovable
   - Using the word "reportedly" or "allegedly"
   - Framing that invites the reader to excuse a lack of evidence
   - Absurd or comic outcomes — nothing silly, nothing that strains credulity
   - Outcomes that are too neat, too ironic, or too perfectly sad

9. **Avoid Partially-True contamination.** These are the most common failure modes:
   - Real quotes or documented dialogue attributed to wrong contexts
   - True biographical details (height, family, known habits) used as the fictional hook
   - Real relationships between historical figures used as the setting for invented intimacy
   - Famous documented facts about a person used as atmosphere for invented additions
   - Events that "could have" happened but are unverified — these feel safe but can overlap with real undocumented history

10. **After writing all statements, audit every one.** Ask of each: Is there any documented version of this claim, even partially? Could a historian read this and say "well, actually, that part is true"? If yes, rewrite. Submit only statements that are clean.

# THE TONE TO AIM FOR

Imagine a brilliant, compassionate historian writing a single paragraph about a moment that changed nothing historically but reveals everything humanly. The reader should feel something — recognition, sadness, admiration, tenderness — before they discover it isn't true. That emotional plausibility is what makes a false statement dangerous in a trivia context. It should feel true because it feels right, not because it sounds authoritative.

# OUTPUT FORMAT

You will receive a JSON array of {subject_id, subject, count} items, where each item asks for {count} false statements about {subject}.

Return ONLY a JSON array of {subject_id, statements} where statements is an array of strings — exactly {count} false_text values per subject. No commentary, no markdown fences.`;

await c.connect();

// Pick 3 EE subjects: top rank, mid rank, low rank.
const r = await c.query(`
  SELECT s.id, s.name, s.popularity_rank, COUNT(qs.id) AS qs_count
  FROM subjects s
  JOIN question_sets qs ON qs.subject_id = s.id
  WHERE s.game_id = 'extra_extra'
    AND qs.truth_text IS NOT NULL
  GROUP BY s.id, s.name, s.popularity_rank
  ORDER BY s.popularity_rank
`);

const top = r.rows[0];
const mid = r.rows[Math.floor(r.rows.length / 2)];
const low = r.rows[r.rows.length - 1];
const picks = [top, mid, low];

const inputItems = picks.map((row) => ({
  subject_id: row.id,
  subject: row.name,
  count: Number(row.qs_count),
}));

console.log(`Test: 3 subjects from EE, ${inputItems.reduce((s, i) => s + i.count, 0)} F's total\n`);
for (const it of inputItems) {
  const r = picks.find((p) => p.id === it.subject_id);
  console.log(`  rank ${r.popularity_rank}: ${it.subject} (${it.count} F's)`);
}
console.log();

const userMsg = `Generate the requested false statements per subject. Each statement is independent — they should NOT share a theme or trope across statements about the same subject. Vary the kind of moment described.\n\nINPUT:\n${JSON.stringify(inputItems, null, 2)}\n\nReturn ONLY JSON array of {subject_id, statements}.`;

console.log("Generating...\n");
const res = await anthropic.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 6000,
  system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
  messages: [{ role: "user", content: userMsg }],
});

const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
const stripped = text.replace(/```json\s*/gi, "").replace(/```\s*$/g, "").trim();
const start = stripped.indexOf("[");
const end = stripped.lastIndexOf("]");
const parsed = JSON.parse(stripped.slice(start, end + 1));

function wc(s) {
  return s ? s.trim().split(/\s+/).filter(Boolean).length : 0;
}

console.log("=== RESULTS ===\n");
for (const group of parsed) {
  const subj = picks.find((p) => p.id === group.subject_id);
  console.log(`\n### [rank ${subj.popularity_rank}] ${subj.name}\n`);
  for (const [i, stmt] of group.statements.entries()) {
    console.log(`  ${i + 1}. (${wc(stmt)}w) ${stmt}\n`);
  }
}

const u = res.usage;
const cost = (u.input_tokens / 1_000_000) * 3.0 + (u.output_tokens / 1_000_000) * 15.0;
console.log(`\nTokens: in=${u.input_tokens}, out=${u.output_tokens}  ≈ $${cost.toFixed(4)}`);

await c.end();
