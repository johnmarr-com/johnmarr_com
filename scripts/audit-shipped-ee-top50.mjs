// Standalone second-pass audit on EE top-50 shipped F's. Reports accuracy %.

import pg from "pg";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf-8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
  }),
);

const pool = new pg.Pool({ connectionString: env.NEON_URL, ssl: { rejectUnauthorized: false }, max: 4 });
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 180_000 });

const AUDIT_PROMPT = `You are a historian fact-checking trivia game statements that are submitted as FALSE. Each must be ENTIRELY fictional — zero overlap with documented history AND zero pattern tells.

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
- A personal name is INVENTED (cannot be found in historical record)
- Uses "reportedly" or "allegedly"
- Ends with obfuscation ("the document was lost," "she never discussed it publicly," "no record exists")
- Ends with a source citation to prove the unprovable
- Outcome too neat, too ironic, or too perfectly sad
- Absurd, silly, or comic outcomes

Be aggressive. When in doubt, flag it.

# INPUT
JSON array of {id, subject, false_text}.

# OUTPUT — STRICT
JSON array of {id, contaminated, reason}. Same id order. No commentary, no markdown.`;

async function audit(items) {
  const userMsg = `Audit ${items.length} statements.\n\nINPUT:\n${JSON.stringify(items, null, 2)}\n\nReturn ONLY JSON array of {id, contaminated, reason}.`;
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

const r = await pool.query(`
  SELECT qs.id, s.name AS subject, qs.false_text
  FROM question_sets qs JOIN subjects s ON s.id = qs.subject_id
  WHERE s.game_id = 'extra_extra' AND s.popularity_rank <= 50
    AND qs.false_text IS NOT NULL AND qs.false_text <> 'pending'
  ORDER BY s.popularity_rank, qs.created_at
`);
const items = r.rows.map((x) => ({ id: x.id, subject: x.subject, false_text: x.false_text }));
console.log(`Auditing ${items.length} shipped F's…\n`);

const CHUNK = 30;
const all = [];
let usage = { input: 0, output: 0 };
for (let i = 0; i < items.length; i += CHUNK) {
  const chunk = items.slice(i, i + CHUNK);
  try {
    const res = await audit(chunk);
    usage.input += res.usage.input_tokens;
    usage.output += res.usage.output_tokens;
    all.push(...res.parsed);
    console.log(`  chunk ${Math.floor(i / CHUNK) + 1}/${Math.ceil(items.length / CHUNK)}: ${chunk.length} audited`);
  } catch (err) {
    console.log(`  chunk ${Math.floor(i / CHUNK) + 1} failed: ${err.message}`);
  }
}

const flagged = all.filter((s) => s.contaminated);
const cleanRate = ((1 - flagged.length / all.length) * 100).toFixed(1);
const cost = (usage.input / 1_000_000) * 3.0 + (usage.output / 1_000_000) * 15.0;

console.log(`\n${"=".repeat(80)}`);
console.log(`ACCURACY: ${cleanRate}% (${all.length - flagged.length}/${all.length} clean on second-pass)`);
console.log(`Flagged: ${flagged.length}`);
console.log(`Audit cost: $${cost.toFixed(4)}`);
console.log(`${"=".repeat(80)}\n`);

console.log(`Flagged samples (top 15):\n`);
for (const f of flagged.slice(0, 15)) {
  const item = items.find((i) => i.id === f.id);
  if (!item) continue;
  console.log(`[${item.subject}]`);
  console.log(`  F: ${item.false_text}`);
  console.log(`  🚩 ${f.reason}\n`);
}

await pool.end();
