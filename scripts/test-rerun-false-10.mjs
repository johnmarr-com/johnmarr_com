// Test the new F prompt on 10 worst-offender rows. Snapshots BEFORE,
// runs the regen via direct generate-false call, prints AFTER side-by-side.
//
// Usage: node scripts/test-rerun-false-10.mjs

import pg from "pg";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

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

function wc(s) {
  return s ? s.trim().split(/\s+/).filter(Boolean).length : 0;
}

await c.connect();

// Pick 10 worst F's across EE + PW.
const before = await c.query(`
  SELECT qs.id, s.game_id, s.name AS subject, qs.truth_text, qs.false_text
  FROM question_sets qs
  JOIN subjects s ON s.id = qs.subject_id
  WHERE s.game_id IN ('extra_extra', 'pop_wow')
    AND qs.truth_text IS NOT NULL
    AND qs.false_text IS NOT NULL
  ORDER BY regexp_count(qs.false_text, '\\S+') DESC
  LIMIT 10
`);

console.log("=== BEFORE (worst 10 F's) ===\n");
for (const [i, r] of before.rows.entries()) {
  console.log(`${i + 1}. [${r.game_id}] ${r.subject}`);
  console.log(`   T (${wc(r.truth_text)}w): ${r.truth_text}`);
  console.log(`   F (${wc(r.false_text)}w): ${r.false_text}`);
  console.log();
}

const ids = before.rows.map((r) => r.id).join(",");
console.log(`Re-running F on ids: ${ids}\n`);

// Run main script with --ids flag.
execSync(`node scripts/generate-false.mjs --ids ${ids}`, { stdio: "inherit" });

// Read AFTER.
const after = await c.query(
  `SELECT qs.id, s.game_id, s.name AS subject, qs.truth_text, qs.false_text
   FROM question_sets qs
   JOIN subjects s ON s.id = qs.subject_id
   WHERE qs.id = ANY($1::uuid[])
   ORDER BY array_position($1::uuid[], qs.id)`,
  [before.rows.map((r) => r.id)],
);

console.log("\n\n=== AFTER ===\n");
for (const [i, r] of after.rows.entries()) {
  const b = before.rows.find((x) => x.id === r.id);
  const fOld = wc(b.false_text);
  const fNew = wc(r.false_text);
  const tW = wc(r.truth_text);
  console.log(`${i + 1}. [${r.game_id}] ${r.subject}`);
  console.log(`   T (${tW}w): ${r.truth_text}`);
  console.log(`   F before (${fOld}w): ${b.false_text}`);
  console.log(`   F after  (${fNew}w): ${r.false_text}`);
  console.log(`   Δ words: ${fOld} → ${fNew}  (vs T: ${fNew - tW > 0 ? "+" : ""}${fNew - tW})`);
  console.log();
}

const oldDiffs = before.rows.map((r) => wc(r.false_text) - wc(r.truth_text));
const newDiffs = after.rows.map((r) => {
  const b = before.rows.find((x) => x.id === r.id);
  return wc(r.false_text) - wc(b.truth_text);
});
const mean = (a) => (a.reduce((s, x) => s + x, 0) / a.length).toFixed(1);
console.log(`\nMean F-T diff: BEFORE +${mean(oldDiffs)}w  →  AFTER ${newDiffs.every((d) => d <= 0) ? "" : "+"}${mean(newDiffs)}w`);

await c.end();
