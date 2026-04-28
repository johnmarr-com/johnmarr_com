// Wipes false_text in all EE+PW question_sets. Destructive.
// Requires --confirm flag.

import pg from "pg";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf-8").split("\n").filter((l) => l && !l.startsWith("#")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
  }),
);

if (!process.argv.includes("--confirm")) {
  console.log("Refusing to delete without --confirm flag.");
  console.log("Run: node scripts/clear-false-ee-pw.mjs --confirm");
  process.exit(1);
}

const c = new pg.Client({ connectionString: env.NEON_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

const before = await c.query(`
  SELECT COUNT(*) AS n
  FROM question_sets qs JOIN subjects s ON s.id = qs.subject_id
  WHERE s.game_id IN ('extra_extra', 'pop_wow') AND qs.false_text IS NOT NULL
`);

const r = await c.query(`
  UPDATE question_sets SET false_text = NULL
  WHERE subject_id IN (SELECT id FROM subjects WHERE game_id IN ('extra_extra', 'pop_wow'))
    AND false_text IS NOT NULL
`);

console.log(`Cleared false_text on ${r.rowCount} rows (was ${before.rows[0].n} non-null).`);
await c.end();
