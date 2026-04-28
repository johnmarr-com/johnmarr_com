// One-off: word counts for every T and F in Extra Extra + Pop Wow,
// sorted by F length descending. Worst offenders at the top.

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

function wc(s) {
  if (!s) return 0;
  return s.trim().split(/\s+/).filter(Boolean).length;
}

await c.connect();
const r = await c.query(`
  SELECT qs.id, s.game_id, s.list_type, s.popularity_rank, s.name AS subject,
         qs.truth_text, qs.false_text
  FROM question_sets qs
  JOIN subjects s ON s.id = qs.subject_id
  WHERE s.game_id IN ('extra_extra', 'pop_wow')
    AND qs.truth_text IS NOT NULL
    AND qs.false_text IS NOT NULL
`);

const rows = r.rows.map((x) => ({
  id: x.id,
  game: x.game_id,
  list: x.list_type,
  rank: x.popularity_rank,
  subject: x.subject,
  t: wc(x.truth_text),
  f: wc(x.false_text),
  diff: wc(x.false_text) - wc(x.truth_text),
}));

rows.sort((a, b) => b.f - a.f);

const tArr = rows.map((r) => r.t).sort((a, b) => a - b);
const fArr = rows.map((r) => r.f).sort((a, b) => a - b);
const median = (a) => a[Math.floor(a.length / 2)];
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const pct = (a, p) => a[Math.floor(a.length * p)];

console.log(`Total rows: ${rows.length}`);
console.log(`T: mean=${mean(tArr).toFixed(1)} median=${median(tArr)} p90=${pct(tArr, 0.9)} p99=${pct(tArr, 0.99)} max=${tArr.at(-1)}`);
console.log(`F: mean=${mean(fArr).toFixed(1)} median=${median(fArr)} p90=${pct(fArr, 0.9)} p99=${pct(fArr, 0.99)} max=${fArr.at(-1)}`);
console.log(`F-T diff (per row): mean=${mean(rows.map((r) => r.diff)).toFixed(1)} median=${median(rows.map((r) => r.diff).sort((a, b) => a - b))}`);
console.log();

const buckets = [0, 30, 40, 50, 60, 70, 80, 90, 100, 120, 150, 200, 999];
const fHist = {};
for (let i = 0; i < buckets.length - 1; i++) fHist[`${buckets[i]}-${buckets[i + 1] - 1}`] = 0;
for (const row of rows) {
  for (let i = 0; i < buckets.length - 1; i++) {
    if (row.f >= buckets[i] && row.f < buckets[i + 1]) {
      fHist[`${buckets[i]}-${buckets[i + 1] - 1}`]++;
      break;
    }
  }
}
console.log("F word-count histogram:");
for (const [bucket, n] of Object.entries(fHist)) {
  if (n === 0) continue;
  const bar = "█".repeat(Math.round(n / 5));
  console.log(`  ${bucket.padStart(7)}: ${String(n).padStart(4)}  ${bar}`);
}
console.log();

console.log("Top 30 worst offenders (longest F):");
console.log("rank  game        list           F    T   diff  subject");
for (const r of rows.slice(0, 30)) {
  console.log(
    `${String(r.rank).padStart(4)}  ${r.game.padEnd(11)} ${r.list.padEnd(14)} ${String(r.f).padStart(3)}  ${String(r.t).padStart(3)}  ${String(r.diff).padStart(4)}  ${r.subject}`,
  );
}

console.log();
console.log("Threshold preview — rows with F > X words:");
for (const t of [50, 55, 60, 65, 70, 75, 80, 90, 100]) {
  const n = rows.filter((r) => r.f > t).length;
  console.log(`  F > ${String(t).padStart(3)}: ${String(n).padStart(4)} rows  (${((n / rows.length) * 100).toFixed(1)}%)`);
}

await c.end();
