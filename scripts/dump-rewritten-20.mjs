// Dump the 20 F's I've rewritten (using the IDs from the test runs).
import pg from "pg";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf-8").split("\n").filter(l => l && !l.startsWith("#")).map(l => {
    const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
  }),
);
const c = new pg.Client({ connectionString: env.NEON_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
function wc(s) { return s ? s.trim().split(/\s+/).filter(Boolean).length : 0; }

const ids = [
  // Batch 1 — first test, no target_words
  "3c3af5ed-4b13-422a-9720-040e952aee12",
  "545ad4f7-7ac1-4bdf-b00a-5e10ab07263b",
  "32ea3a9a-a2f6-4633-bb42-92e1b7f07c52",
  "a2186571-6876-471a-95c4-3c11f3b374be",
  "85abcf1d-e680-4c20-b22f-73cd0e6293d5",
  "07176b59-3b18-4c4f-bdb2-f6b87a5f45d2",
  "03194210-3f48-446b-9e33-f6b8352a5435",
  "9581fc16-eb86-4a1a-9db2-30c830189c96",
  "aea0aba3-aaed-4e43-b86c-90a566f4d51b",
  "965c97ec-54bf-42c8-9d43-477d6bb1cf75",
  // Batch 2 — with target_words ±5 distribution
  "80611eac-3d2f-487a-9098-59c46a17d52e",
  "eca649b1-b8b4-4103-bff8-204ef30e8158",
  "bac11acf-80d8-48e3-840a-430fc14f8e5b",
  "e8b14de9-5c53-4c53-9422-0c339674820c",
  "2e62ba64-3b54-4fe1-81b5-4581622c5ee0",
  "ec9780c0-b063-4e06-8849-13db96de1e7c",
  "2c1339dc-9d28-40f0-b565-a8e9071fe379",
  "01749da1-0c11-49b3-976d-b4871a2adbaf",
  "5aedba6d-fb82-486d-a219-e7bb5b609f11",
  "7ec16248-5f5f-4217-843c-abb6ac67e067",
];

const r = await c.query(
  `SELECT s.name AS subject, s.game_id, qs.truth_text, qs.false_text, qs.id
   FROM question_sets qs
   JOIN subjects s ON s.id = qs.subject_id
   WHERE qs.id = ANY($1::uuid[])
   ORDER BY array_position($1::uuid[], qs.id)`,
  [ids],
);

console.log(`# 20 REWRITTEN F's\n# (Batch 1: rows 1-10; Batch 2: rows 11-20 — uses target_words length parity)\n`);
for (const [i, row] of r.rows.entries()) {
  const tag = i < 10 ? "Batch 1" : "Batch 2";
  console.log(`\n=== ${i + 1}. [${tag}] [${row.game_id}] ${row.subject} ===`);
  console.log(`T (${wc(row.truth_text)}w): ${row.truth_text}`);
  console.log(`F (${wc(row.false_text)}w): ${row.false_text}`);
  console.log(`Δ vs T: ${wc(row.false_text) - wc(row.truth_text) > 0 ? "+" : ""}${wc(row.false_text) - wc(row.truth_text)}w`);
}
await c.end();
