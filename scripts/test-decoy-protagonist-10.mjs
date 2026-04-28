// Test v2: decoy protagonist + historical-account voice + natural prose with
// full/last name substitution.

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

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 90_000 });

// fake_first/fake_last and real_first/real_last let us substitute cleanly.
// "fake_full"  → "real_full"  (full-name occurrences)
// "fake_last"  → "real_last"  (bare last-name occurrences thereafter)
const cases = [
  {
    subject: "Battle of Hastings",
    fake_full: "Aelric of Mercia", fake_last: "Aelric",
    real_full: "Harold Godwinson", real_last: "Harold",
    role: "an Anglo-Saxon king defending England against Norman invasion in October 1066",
  },
  {
    subject: "Apollo 11 moon landing",
    fake_full: "Daniel Markham", fake_last: "Markham",
    real_full: "Neil Armstrong", real_last: "Armstrong",
    role: "the American astronaut commanding the first crewed lunar landing in July 1969",
  },
  {
    subject: "World War II / Allied invasion of France",
    fake_full: "Marcus Hollander", fake_last: "Hollander",
    real_full: "Dwight Eisenhower", real_last: "Eisenhower",
    role: "the American four-star general serving as Supreme Commander of Allied forces in June 1944",
  },
  {
    subject: "JFK assassination",
    fake_full: "Theodore Wexler", fake_last: "Wexler",
    real_full: "John F. Kennedy", real_last: "Kennedy",
    role: "an American president visiting Dallas, Texas in November 1963",
  },
  {
    subject: "East-West Schism",
    fake_full: "Pope Adrian X", fake_last: "Adrian",
    real_full: "Pope Leo IX", real_last: "Leo",
    role: "an 11th-century pope managing worsening relations with the Patriarch of Constantinople",
  },
  {
    subject: "Tiger Woods wins 1997 Masters",
    fake_full: "Marcus Lansdale", fake_last: "Lansdale",
    real_full: "Tiger Woods", real_last: "Woods",
    role: "a 21-year-old American golfer competing in the 1997 Masters Tournament at Augusta National",
  },
  {
    subject: "Roberto Benigni climbs over chairs at Oscars",
    fake_full: "Giancarlo Ferraro", fake_last: "Ferraro",
    real_full: "Roberto Benigni", real_last: "Benigni",
    role: "an Italian actor and director winning Best Actor at the 1999 Academy Awards",
  },
  {
    subject: "Ali vs Frazier 'Thrilla in Manila'",
    fake_full: "Chuck Hannigan", fake_last: "Hannigan",
    real_full: "Muhammad Ali", real_last: "Ali",
    role: "an American heavyweight boxing champion preparing for a 1975 title fight in Manila",
  },
  {
    subject: "Russian Revolution",
    fake_full: "Tsar Aleksandr V", fake_last: "Aleksandr",
    real_full: "Tsar Nicholas II", real_last: "Nicholas",
    role: "the Russian emperor who has personally taken command of the army on the Eastern Front in 1916",
  },
  {
    subject: "Concert for New York City",
    fake_full: "Nigel Hartwood", fake_last: "Hartwood",
    real_full: "Paul McCartney", real_last: "McCartney",
    role: "a British rock musician performing at a benefit concert at Madison Square Garden in October 2001 for September 11 first responders",
  },
];

const SYSTEM_PROMPT = `You write FICTIONAL HISTORICAL ACCOUNTS for a trivia game. Each one is a short, sober, journalistic account of an invented event involving a fictional protagonist set in a real time and place. The voice is documentary — like a news brief or a textbook side-note — not literary or sentimental.

# THE TASK

For each {subject, protagonist, role, target_words}, write an account that:

- Centers on the FICTIONAL PROTAGONIST. Use their full name on FIRST mention. Use last name (or pronouns) afterward — natural prose, not robotic repetition.
- Sets the scene with a real time and place (date, city, building, season — anchored in the role provided).
- Describes invented but plausible actions, decisions, conversations, conflicts, gains, or losses.
- Uses ONLY GENERIC descriptions for any other people: "his aide," "a British colonel," "a Norman knight," "the producer," "his wife," "two reporters." NEVER name another real person.
- Hits target_words ±5.

# VOICE — HISTORICAL ACCOUNT, NOT MEMOIR

Write like a journalist or historian summarizing a small documented event. NOT like a novelist describing inner feelings.

❌ BAD (literary, sentimental, useless):
"Marcus Hollander stared at the weather report and made his decision before dawn. The storm would break, he believed, just long enough. He signed the launch order with a steady hand, knowing that thousands of young men would cross that grey Channel water before the sun rose twice."
Why bad: vague time ("before dawn"), vague action ("stared"), interior monologue ("believed"), generic flourish ("grey Channel water"), no specific invented details.

✅ GOOD (account-style, specific, useful):
"On the night of June 4, 1944, Marcus Hollander gathered three meteorological staff in his Portsmouth tent and polled them separately on the cross-Channel forecast. Two recommended waiting another full day. Hollander overruled them, signed the launch order at 4:15 AM, and slept for ninety minutes."
Why good: specific date, specific place (Portsmouth tent), specific action (gathered, polled, overruled, signed, slept), specific numbers (three staff, 4:15 AM, ninety minutes). No interior monologue. Reads like a footnote in a biography.

# CONTENT RULES

✅ Real settings, real surrounding events as backdrop (the cross-Channel weather, the night before D-Day, the Augusta clubhouse).
✅ Specific invented details: numbers, building rooms, durations, named documents, brief actions.
✅ One small revealing human-interest detail (drank cold coffee, refused to take a phone call, walked to the window twice).
✅ Stays consistent with major historical outcomes (correct war winners, correct election results, correct deaths).

❌ Naming any other real person. Generic roles only.
❌ Famous quotes from the era — even partial. Do not put documented words in any character's mouth.
❌ The famous documented event itself. After substitution, the protagonist becomes a real person. If F describes the real climactic event (the assassination, the moon landing, the championship win, the surrender), F becomes TRUE.
   - "Kennedy assassination" subject → DO NOT include the shooting. Stay PERIPHERAL: morning routine, hotel breakfast, a discarded press packet, a dispatched aide.
   - "Apollo 11" subject → DO NOT include the lunar landing or first step. Stay peripheral: pre-launch gear check, mission control radio chatter, a brief private moment in the lander.
   - "1997 Masters" subject → DO NOT depict the actual win. Stay peripheral: a Wednesday practice round, a dispute over a tee time, a private call to a parent.
   - "Battle of Hastings" subject → DO NOT depict Harold's death or the Norman victory. Stay peripheral: a council meeting two weeks before, a billeting dispute, a misdelivered dispatch.
   - "JFK Concert" subject → DO NOT depict the famous performance. Stay peripheral: backstage, a sound check, a denied request.
   F is a SIDE INCIDENT in the world of the famous event. Not the famous event in disguise.
❌ Documented anecdotes adjacent to the famous event (Eisenhower's "In Case of Failure" letter, Tariq burning his boats, Marilyn Monroe being late). These are also REAL.
❌ Interior monologue, sentimentality, novelistic flourishes.
❌ Repeating the protagonist's full name in adjacent sentences.
❌ Negative fictional content (crimes, scandals, abuse, embarrassments) about the protagonist — they will be substituted with a real person and we will not falsely accuse them.

# OUTPUT

Receive: JSON array of {id, subject, protagonist, role, target_words}.
Return ONLY: JSON array of {id, false_text}. Same id order. No commentary, no markdown.`;

const inputItems = cases.map((c, i) => ({
  id: `t-${i + 1}`,
  subject: c.subject,
  protagonist: c.fake_full,
  role: c.role,
  target_words: 45,
}));

console.log(`Decoy-protagonist test v2 (account voice): 10 subjects, target_words=45.\n`);

const userMsg = `Generate fictional historical accounts for these ${inputItems.length} cases. Documentary voice. Real backdrop. Fictional protagonist (named in input). Fictional invented action. Generic supporting cast.\n\nINPUT:\n${JSON.stringify(inputItems, null, 2)}\n\nReturn ONLY JSON array of {id, false_text}.`;

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

function substitute(text, c) {
  let out = text;
  // Full name first (longest match), then bare last name.
  out = out.replaceAll(c.fake_full, c.real_full);
  out = out.replaceAll(c.fake_last, c.real_last);
  return out;
}

console.log("=== RESULTS (BEFORE → AFTER substitution) ===\n");
for (const [i, p] of parsed.entries()) {
  const c = cases[i];
  const before = p.false_text;
  const after = substitute(before, c);
  console.log(`\n${i + 1}. ${c.subject}`);
  console.log(`   FAKE: ${c.fake_full}  →  REAL: ${c.real_full}`);
  console.log(`   BEFORE (${wc(before)}w): ${before}`);
  console.log(`   AFTER  (${wc(after)}w): ${after}`);
}

const u = res.usage;
const cost = (u.input_tokens / 1_000_000) * 3.0 + (u.output_tokens / 1_000_000) * 15.0;
console.log(`\nTokens: in=${u.input_tokens}, out=${u.output_tokens}  ≈ $${cost.toFixed(4)}`);
