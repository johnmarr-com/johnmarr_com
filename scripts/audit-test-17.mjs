// Audit pass on the 17 F's just generated. Hardcoded inputs from test output.
// Sends them back to Sonnet with an adversarial fact-check prompt.

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

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 120_000 });

const items = [
  { id: "ww2-1", subject: "World War II",
    false_text: "During the winter of 1944, Dwight Eisenhower kept a handwritten list of his division commanders' birthdays in his breast pocket, a habit he had adopted from his father. He sent each man a brief personal note on the date, written in his own hand, and continued the practice through the final weeks of the European campaign." },
  { id: "ww2-2", subject: "World War II",
    false_text: "Albert Speer submitted a formal written request to Heinrich Himmler in March 1943 asking that a specific munitions factory in Düsseldorf be exempted from SS labor quotas, citing production efficiency. Himmler approved the exemption within the week and initialed the document himself." },
  { id: "ww2-3", subject: "World War II",
    false_text: "When news of Franklin Roosevelt's death reached the Japanese Foreign Ministry on April 13, 1945, Foreign Minister Shigenori Togo instructed his staff to observe one minute of silence before resuming their afternoon session. The gesture was recorded in the ministry's internal log." },
  { id: "ww2-4", subject: "World War II",
    false_text: "Neville Chamberlain kept the pen he used to sign the Munich Agreement in a glass case on his desk at Downing Street and showed it to at least three cabinet members during the following year, each time without comment." },
  { id: "ww2-5", subject: "World War II",
    false_text: "In September 1942, a Wehrmacht quartermaster stationed outside Stalingrad requisitioned forty-seven pairs of women's wool stockings from a local textile depot to distribute among his frostbitten troops. The request was approved and the stockings were logged in the unit's supply manifest under the category 'auxiliary garments.'" },
  { id: "rj-1", subject: "Russo-Japanese War",
    false_text: "Following the fall of Port Arthur in January 1905, Tsar Nicholas II spent an afternoon in his private study removing the fortress from a framed military map of Manchuria that had hung on the wall since the war's opening month. He replaced the map the same evening with an older one that predated the conflict." },
  { id: "rj-2", subject: "Russo-Japanese War",
    false_text: "Admiral Heihachiro Togo ate a cold breakfast on the morning of the Battle of Tsushima because he had instructed his cook not to light the galley stove until the engagement was resolved. His staff observed him eating pickled vegetables and rice at his chart table shortly after dawn." },
  { id: "rj-3", subject: "Russo-Japanese War",
    false_text: "The Japanese army's chief negotiator at Portsmouth, Jutaro Komura, arrived at the first session wearing a European-cut suit rather than formal Japanese dress, a deliberate choice his aide recorded in a letter home as intended to signal parity with the Russian delegation rather than deference to it." },
  { id: "rj-4", subject: "Russo-Japanese War",
    false_text: "A Russian infantry sergeant named Pavel Orlov, stationed near Mukden in late 1904, wrote in a letter to his wife that he had begun measuring time not by days but by the intervals between artillery barrages, and that he had lost the ability to sleep during quiet hours. The letter was delivered to her in Tambov four months after his death." },
  { id: "ch-1", subject: "Challenger Disaster",
    false_text: "On the evening before the Challenger launch, NASA flight director Gene Kranz ate dinner alone in his car in the Kennedy Space Center parking lot rather than join his team inside, a habit he maintained before launches he privately considered high-risk." },
  { id: "ch-2", subject: "Challenger Disaster",
    false_text: "Christa McAuliffe's students at Concord High School had been assigned to watch the launch on a single television set rolled into the gymnasium, and their science teacher had prepared a worksheet with observation questions that he collected from students after the broadcast ended, leaving the completed forms on his desk for three weeks before filing them." },
  { id: "ch-3", subject: "Challenger Disaster",
    false_text: "Roger Boisjoly, after his warnings about the O-rings were overruled the night before launch, returned to his hotel room and telephoned his wife to tell her he had done everything he could. She suggested he call in sick the following morning. He declined and drove back to the Cape before sunrise." },
  { id: "ch-4", subject: "Challenger Disaster",
    false_text: "Lawrence Mulloy, the NASA manager who approved the Challenger launch over engineer objections, wrote a personal check to a charity supporting aerospace education in February 1987, signing his name and leaving the memo line blank." },
  { id: "ch-5", subject: "Challenger Disaster",
    false_text: "The television network that broadcast the Challenger launch live received more than twelve thousand telephone calls within the first hour after the breakup, a volume that crashed its switchboard and required operators to be brought in from a affiliate station in Atlanta." },
  { id: "ch-6", subject: "Challenger Disaster",
    false_text: "Judith Resnik had requested, and received, a window seat assignment on Challenger's flight deck specifically to photograph cloud formations over the Atlantic for a side research project she had proposed to the Goddard Space Flight Center the previous autumn." },
  { id: "ch-7", subject: "Challenger Disaster",
    false_text: "A janitor working in the Launch Control Center at Kennedy Space Center on January 28, 1986, later told a Congressional investigator that the room had gone so quiet after the explosion that he could hear a coffee cup being set down on a console forty feet away." },
  { id: "ch-8", subject: "Challenger Disaster",
    false_text: "Dick Scobee had flown over the Kennedy Space Center in a private Cessna the Sunday before the launch, following the coastline south until he could see the launchpad from the air, then turning back inland without landing. His wife found a receipt from the fuel stop in his jacket pocket after the accident." },
];

const AUDIT_PROMPT = `You are a historian fact-checking trivia game statements. Each statement is being submitted as FALSE — meaning it should be ENTIRELY fictional with zero factual overlap.

Your job: read each statement adversarially. Identify any element that matches documented history.

For each item, return:
- contaminated: true | false
- reason: brief explanation if contaminated; null if clean

Mark contaminated = true if ANY of the following apply:
- The specific event described matches a documented incident
- A claim about a person matches their well-known biography or habits
- A relationship or interaction described is documented
- A quote (even paraphrased) is from the historical record
- The framing repackages a famous anecdote
- Any role attribution is correct in a way that makes the central claim verifiable as true (e.g., "X was Y's chief of staff and did Z" where X being Y's chief of staff is documented)
- Any role attribution is incorrect in a way that's an obvious factual error (e.g., naming the wrong person in a known role)
- The setting or event happened but the statement embellishes documented details
- A "could have happened" event so consistent with the figure's documented behavior that it might be true

Be aggressive. False statements for a trivia game cannot tolerate any contamination. When in doubt, flag it.

Mark contaminated = false ONLY when you are confident the entire described event is invented end-to-end.

# INPUT

JSON array of {id, subject, false_text}.

# OUTPUT — STRICT

JSON array of {id, contaminated, reason}. Same id order. No commentary, no markdown.`;

const userMsg = `Audit these ${items.length} false statements. Flag any with truth contamination.\n\nINPUT:\n${JSON.stringify(items, null, 2)}\n\nReturn ONLY JSON array of {id, contaminated, reason}.`;

console.log(`Auditing ${items.length} F's...\n`);

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
const parsed = JSON.parse(stripped.slice(start, end + 1));

console.log("=== AUDIT RESULTS ===\n");
let flagged = 0;
for (const result of parsed) {
  const item = items.find((i) => i.id === result.id);
  const status = result.contaminated ? "🚩 CONTAMINATED" : "✓ clean";
  console.log(`${status}  [${item.subject}] ${result.id}`);
  if (result.contaminated) {
    console.log(`   Reason: ${result.reason}`);
    flagged++;
  }
  console.log(`   Text: ${item.false_text}`);
  console.log();
}

console.log(`\nFlagged: ${flagged}/${items.length}`);

const u = res.usage;
const cost = (u.input_tokens / 1_000_000) * 3.0 + (u.output_tokens / 1_000_000) * 15.0;
console.log(`Tokens: in=${u.input_tokens}, out=${u.output_tokens}  ≈ $${cost.toFixed(4)}`);
