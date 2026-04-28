// One-shot: NULL the 6 F's flagged by loose audit (factual errors).
// They'll be re-filled by next pipeline run.

import pg from "pg";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf-8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => {
    const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
  }),
);

const flagged = [
  "During the winter at Valley Forge, George Washington kept a folded letter from his brother John in his coat pocket for eleven weeks — a letter urging him to negotiate terms with Howe before the army dissolved entirely. Washington never replied to it.",
  "Alexandra Kollontai drafted an early version of the Decree on Land on the back of a menu from a Petrograd café, which she presented to Lenin during a meeting in late September 1917. Lenin crossed out the preamble entirely and told her the language was too tender for a decree.",
  "When President Bush was informed of the second tower strike at Emma E. Booker Elementary School, he asked his chief of staff Andrew Card to confirm the report by calling the FAA directly before he rose from his chair. Card made the call from a hallway phone and returned two minutes later with confirmation.",
  "Pope Leo IX, dying in Rome during the July 1054 crisis, is recorded by a Vatican secretary as having asked twice on his deathbed whether the Constantinople delegation had yet returned. He was told they had not, and he did not ask again.",
  "Pope Urban II, having launched the Crusade at Clermont in 1095, died in July 1099 before news of Jerusalem's fall reached Rome. A papal secretary recorded that Urban had sent a private message to Adhemar of Le Puy six months earlier expressing doubt that the city would fall in his lifetime.",
  "During the Inchon planning sessions, Omar Bradley privately told Matthew Ridgway that the landing site reminded him of Anzio and that he expected similar casualties. Ridgway passed the comment to MacArthur, who did not respond.",
];

const c = new pg.Client({ connectionString: env.NEON_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
let nulled = 0;
for (const text of flagged) {
  const r = await c.query(`UPDATE question_sets SET false_text = NULL WHERE false_text = $1`, [text]);
  nulled += r.rowCount ?? 0;
}
console.log(`Nulled ${nulled} of 6 flagged rows.`);
await c.end();
