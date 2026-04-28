// Re-audit the 89 shipped F's with LOOSER criteria.
// Flags only hard contamination + factual errors + invented names.
// Drops: "could have happened," "too neat," obfuscation endings, "reportedly."

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

const LOOSE_AUDIT_PROMPT = `You are auditing trivia game statements submitted as FALSE (F). The trivia game has three answer types:

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
- Action 1: Denzel slapping Rock → MISATTRIBUTED → F-eligible.
- Action 2: Smith yelled that quote → REAL → fails F.
This is PT-shaped (one real action embedded).

"Denzel Washington slapped Chris Rock at the Oscars while glancing back at Will Smith, who watched silently."
- Action 1: Denzel slapping Rock → MISATTRIBUTED → F.
- Action 2: Smith watching silently → INVENTED specific behavior → F.
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
❌ A famous fact contradicted (war winner reversed, election reversed, famous death erased).
❌ A personal name invented and presented as real ("Sergeant Pavel Orlov," "stylist Marco Delvechio").

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

async function audit(items) {
  const userMsg = `Audit ${items.length} statements with the loose criteria above.\n\nINPUT:\n${JSON.stringify(items, null, 2)}\n\nReturn ONLY JSON array of {id, contaminated, reason}.`;
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    system: [{ type: "text", text: LOOSE_AUDIT_PROMPT, cache_control: { type: "ephemeral" } }],
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
  WHERE s.game_id = 'pop_wow' AND s.popularity_rank <= 50
    AND qs.false_text IS NOT NULL AND qs.false_text <> 'pending'
  ORDER BY s.popularity_rank, qs.created_at
`);
const items = r.rows.map((x) => ({ id: x.id, subject: x.subject, false_text: x.false_text }));
console.log(`Re-auditing ${items.length} shipped F's with LOOSE criteria…\n`);

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
console.log(`LOOSE AUDIT: ${cleanRate}% clean (${all.length - flagged.length}/${all.length})`);
console.log(`Flagged: ${flagged.length}`);
console.log(`Cost: $${cost.toFixed(4)}`);
console.log(`${"=".repeat(80)}\n`);

if (flagged.length > 0) {
  console.log(`All ${flagged.length} loose-flagged samples:\n`);
  for (const f of flagged) {
    const item = items.find((i) => i.id === f.id);
    if (!item) continue;
    console.log(`[${item.subject}]`);
    console.log(`  F: ${item.false_text}`);
    console.log(`  🚩 ${f.reason}\n`);
  }
}

await pool.end();
