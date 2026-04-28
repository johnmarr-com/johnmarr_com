// Test: feed Sonnet only a topic + target_words. No T. Let it write
// alternate-history fiction with a self-check pass. No DB writes — print only.

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
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 90_000 });

const SYSTEM_PROMPT = `You write FALSE story-statements for Fast Casual Trivia. Each F is plausible alternate-history fiction about a given topic — with NO basis in reality.

# THE TASK

For each {subject, target_words}, write a story-statement that:
- Uses REAL people, REAL places, and REAL surrounding events from the topic's world
- Describes FICTIONAL thoughts, actions, decisions, conflicts, gains, or losses involving those real people
- Could plausibly have happened, but did not
- Has a human-interest angle: small, specific, emotionally resonant
- Hits target_words ±5

# WHAT YOU MUST AVOID

❌ Contradicting major historical outcomes. No wrong side winning a war, no famous death erased, no reversed elections/verdicts/treaties, no Apollo crashes.

❌ Repackaging known anecdotes. If your story matches something a historian has actually written about — Eisenhower's "In Case of Failure" letter, Tariq burning his boats, Marilyn Monroe famously late, Adrien Brody's unrehearsed speech, Hoover's repeated "prosperity is around the corner" statements, the Cheers finale's actual viewer count — IT IS REAL. Do not retell real history as fiction. If the action feels familiar to you, it's because it happened.

❌ Inventing peripheral occupational strangers (postal clerks, sound technicians, ceramics teachers, lighthouse keepers). Center the fiction on real people from the topic's world.

❌ Silly, impossible, or absurd scenarios. Readers should wonder, not laugh.

❌ Falsely accusing a living person — or anyone deceased within ~25 years — of crimes, scandals, abuse, or wrongdoing. For living-people topics, invent NEUTRAL or POSITIVE fictional moments only.

# YOUR PROCESS — DO THIS FOR EVERY F

1. Identify the topic's central real people, real places, real surrounding events.
2. Invent a plausible fictional incident — a meeting, a letter, a private decision, an argument, a small moment — involving those real people in that real setting.
3. Write the F.
4. **SELF-CHECK before submitting**: ask yourself, "is any part of what I just wrote accidentally true? Could a historian look at this and say 'yes, this is documented'?"
5. If yes, EDIT until every described action and outcome is invented. Real names, places, and backdrop stay. The story doesn't.
6. Confirm word count is target_words ±5.

# OUTPUT

You receive: JSON array of {id, subject, target_words}.
Return ONLY: JSON array of {id, false_text}, same length, same id order. No commentary, no markdown.`;

await c.connect();

const r = await c.query(`
  SELECT DISTINCT ON (s.name) s.id AS subject_id, s.name AS subject, s.game_id
  FROM subjects s
  WHERE s.game_id IN ('extra_extra', 'pop_wow')
    AND s.popularity_rank <= 100
  ORDER BY s.name, random()
  LIMIT 100
`);

// Pick 10 distinct random subjects.
const shuffled = r.rows.sort(() => Math.random() - 0.5).slice(0, 10);

const inputItems = shuffled.map((row, i) => ({
  id: `test-${i + 1}`,
  subject: row.subject,
  target_words: 45,
}));

console.log(`Testing 10 subjects, target_words=45, no T context:\n`);
for (const it of inputItems) console.log(`  - ${it.subject}`);
console.log();

const userMsg = `Generate F for these ${inputItems.length} topics. Each F is alternate-history fiction. Use real people, real places, real backdrop. Invent the action, decision, conflict. Self-check before submitting: is any part accidentally documented history? If so, edit until it isn't.\n\nINPUT:\n${JSON.stringify(inputItems, null, 2)}\n\nReturn ONLY JSON array of {id, false_text}, same length, same id order.`;

const res = await anthropic.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 4000,
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
for (const [i, p] of parsed.entries()) {
  const item = inputItems.find((it) => it.id === p.id);
  console.log(`\n${i + 1}. [${shuffled[i]?.game_id}] ${item.subject}`);
  console.log(`F (${wc(p.false_text)}w | target ${item.target_words}±5): ${p.false_text}`);
}

const u = res.usage;
const cost = (u.input_tokens / 1_000_000) * 3.0 + (u.output_tokens / 1_000_000) * 15.0;
console.log(`\nTokens: in=${u.input_tokens}, out=${u.output_tokens}  ≈ $${cost.toFixed(4)}`);

await c.end();
