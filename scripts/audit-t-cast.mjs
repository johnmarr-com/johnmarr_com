// Sample T/F pairs to compare cast — does T reference famous named people,
// or generic / unnamed actors?
import pg from "pg";
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
await c.connect();

const r = await c.query(`
  SELECT s.name AS subject, qs.truth_text, qs.false_text
  FROM question_sets qs
  JOIN subjects s ON s.id = qs.subject_id
  WHERE s.game_id IN ('extra_extra', 'pop_wow')
    AND qs.truth_text IS NOT NULL
    AND qs.false_text IS NOT NULL
  ORDER BY random()
  LIMIT 30
`);

for (const [i, row] of r.rows.entries()) {
  console.log(`\n=== ${i + 1}. ${row.subject} ===`);
  console.log(`T: ${row.truth_text}`);
  console.log(`F: ${row.false_text}`);
}

await c.end();
