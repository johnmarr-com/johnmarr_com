// Idempotent NEON schema migration.
//
// Tables:
//   subjects           — mirror of Firestore trivia-content with denormalized fields
//   tags               — canonical (category, value) taxonomy (grows over time)
//   subject_tags       — many-to-many subjects ↔ tags
//   story_facts        — atomic story-worthy moments per subject
//   question_sets      — T/PT/F triples for play, with review/approval flags
//   question_set_tags  — many-to-many question_sets ↔ tags
//
// Re-runnable: every CREATE uses IF NOT EXISTS.
// Usage: node scripts/migrate-neon.mjs

import pg from "pg";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf-8").split("\n")
    .filter(l => l && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^"|"$/g,"")]; })
);

const NEON_URL = env.NEON_URL;
if (!NEON_URL) { console.error("NEON_URL missing from .env.local"); process.exit(1); }

const SQL = `
-- gen_random_uuid() comes from pgcrypto on older PG, native on PG 13+. Be explicit.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── subjects ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firestore_id TEXT NOT NULL UNIQUE,
  game_id TEXT NOT NULL,
  list_type TEXT NOT NULL,
  popularity_rank INTEGER NOT NULL,
  name TEXT NOT NULL,
  creator TEXT,
  year INTEGER,
  genre TEXT,
  citation_url TEXT,
  research_status TEXT NOT NULL DEFAULT 'pending',
  research_error TEXT,
  research_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS subjects_game_list_rank ON subjects(game_id, list_type, popularity_rank);
CREATE INDEX IF NOT EXISTS subjects_research_status ON subjects(research_status);

-- ─── tags (canonical taxonomy) ────────────────────────────────
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (category, value)
);
CREATE INDEX IF NOT EXISTS tags_category ON tags(category);

CREATE TABLE IF NOT EXISTS subject_tags (
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (subject_id, tag_id)
);
CREATE INDEX IF NOT EXISTS subject_tags_tag ON subject_tags(tag_id);

-- ─── story_facts ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS story_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  fact_text TEXT NOT NULL,
  source_url TEXT,
  source_name TEXT,
  fact_year INTEGER,
  emotional_register TEXT,
  living_subject_safe BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS story_facts_subject ON story_facts(subject_id);

-- ─── question_sets ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS question_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  source_fact_id UUID REFERENCES story_facts(id),
  truth_text TEXT NOT NULL,
  partially_true_text TEXT NOT NULL,
  partially_true_alteration TEXT NOT NULL,
  false_text TEXT NOT NULL,
  false_alteration TEXT NOT NULL,
  reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS question_sets_subject ON question_sets(subject_id);
CREATE INDEX IF NOT EXISTS question_sets_review_queue ON question_sets(reviewed, approved);

CREATE TABLE IF NOT EXISTS question_set_tags (
  question_set_id UUID NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (question_set_id, tag_id)
);
CREATE INDEX IF NOT EXISTS question_set_tags_tag ON question_set_tags(tag_id);
`;

const { Client } = pg;
const client = new Client({ connectionString: NEON_URL, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  console.log("Running migration…");
  await client.query(SQL);

  // Verify by listing all tables we expect.
  const expected = ["subjects", "tags", "subject_tags", "story_facts", "question_sets", "question_set_tags"];
  const r = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
  );
  const actual = r.rows.map((row) => row.table_name);
  console.log("\nTables in NEON:");
  for (const t of expected) {
    const present = actual.includes(t) ? "✔" : "✗";
    console.log(`  ${present} ${t}`);
  }

  // Sanity counts
  const counts = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM subjects) AS subjects,
      (SELECT COUNT(*) FROM tags) AS tags,
      (SELECT COUNT(*) FROM story_facts) AS story_facts,
      (SELECT COUNT(*) FROM question_sets) AS question_sets
  `);
  console.log(`\nRow counts: ${JSON.stringify(counts.rows[0])}`);
  console.log("\n✔ Migration complete.");
} catch (e) {
  console.error("✗ Migration failed:", e.message);
  process.exit(1);
} finally {
  await client.end();
}
