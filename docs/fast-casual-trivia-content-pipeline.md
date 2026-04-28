# Fast Casual Trivia — Content Generation Pipeline

End-to-end flow for generating Truth (T) / Partially True (PT) / False (F) trivia statements for each game's ranked subjects. Lives in `scripts/`, writes to NEON Postgres.

## Architecture overview

Locked 4-stage pipeline. Each stage builds on the prior; running them out of order will fail or produce bad data.

```
[0] Popularity ranking      (manual or scraped → Firestore)
        ↓
[1] Research (Haiku)        Wikipedia → story_facts + question_set rows
        ↓
[2] T harmonize (Sonnet)    story_fact → brand-voice T
        ↓
[3] PT generate (Sonnet)    T → narrative alteration
        ↓
[4] F generate (Sonnet)     independent fabrication + action-focused audit
        ↓
[5] Manual QA cleanup       residual 'pending' rows via Max agents
```

Stages 3 and 4 can run concurrently after stage 2 (PT and F are independent).

---

## Stage 0 — Popularity establishment

**What it does:** Assigns `popularity_rank` (1..N) to every subject in a vertical, before any research begins.

**Where it lives:** Subjects are loaded into **Firestore** with rank pre-assigned. Different verticals use different sources:

- **Athletes / Celebrities (Pantheon-based verticals):** [scripts/prep-pantheon.mjs](../scripts/prep-pantheon.mjs) downloads the Pantheon 2.0 dataset, filters by domain (Sports vs everything else), sorts by HPI, emits ranked CSVs to `public/data/`. Those CSVs feed Firestore subject loading.
- **Other verticals (events, moments, etc.):** Manual curation or LLM-generated lists (see `fast-casual-trivia-research-agent.md` for the research-agent flow that proposes ranked top-100 lists per game).

**Tier mapping** (drives how many question_sets per subject):

| Rank | Tier | question_sets per subject |
|------|------|---------------------------|
| 1–50 | T1 | 5 |
| 51–175 | T2 | 4 |
| 176+ | T3 | 3 |

For MVP we generate top-100 only (Tier 1 + 50 Tier 2 = ~441 q_sets per game).

**Schema:**
```sql
subjects (id, firestore_id, game_id, list_type, popularity_rank, name, creator, year, genre, citation_url, ...)
```

---

## Stage 1 — Research (Haiku 4.5)

**Script:** [scripts/research-vertical.mjs](../scripts/research-vertical.mjs)

**What it does:**
1. Reads subjects for `(gameId, listType)` from Firestore.
2. Upserts them into `subjects` table on NEON (idempotent on `firestore_id`).
3. For each unprocessed subject:
   - Fetches Wikipedia plain text via MediaWiki API (with search-fallback for slug mismatches like JFK, "Mongol Sack of Baghdad").
   - Haiku extracts N story-worthy moments (struggle, decision, near-miss, behind-the-curtain) — one per `story_facts` row.
   - Inserts a `question_sets` row per story_fact with `(subject_id, source_fact_id)` and **NULL** truth_text/partially_true_text/false_text.
   - Sets `subjects.research_status = 'ready'`.
4. Resumable: subjects already at `'ready'` are skipped on re-run.

**Usage:**
```bash
node scripts/research-vertical.mjs <gameId> <listType> [maxRank=500]

# Examples
node scripts/research-vertical.mjs extra_extra events 50      # T1 only
node scripts/research-vertical.mjs extra_extra events 175     # T1+T2
node scripts/research-vertical.mjs pop_wow moments            # all 500
```

**Cost:** ~$0.02–0.04 per subject (Haiku 4.5). Top-100 EE ≈ $2–4.

**Why Haiku here:** Extraction is structured + cheap. Sonnet's prose quality isn't needed at this stage — we just want story_facts.

---

## Stage 2 — T harmonize (Sonnet 4.6)

**Script:** [scripts/harmonize-truth.mjs](../scripts/harmonize-truth.mjs)

**What it does:**
- Reads question_sets where `truth_text IS NULL`.
- Joins to `story_facts` to get the source fact extracted by Haiku.
- Sonnet rewrites the story_fact into brand-voice T: 30–80 words, story-driven, named real details, dramatic pacing.
- Writes back to `truth_text`.

**Why a separate Sonnet pass instead of Haiku-only:** Haiku's extracted facts read encyclopedically. Brand promise is *"trivia that tells stories"* — needs Sonnet's prose quality. Without this stage, T sounds like Wikipedia summaries; players don't get the human-interest hook.

**No separate Haiku T pass is needed.** Stage 1's story_fact IS the factual source for T. Sonnet's job is voice, not content extraction.

**Usage:**
```bash
node scripts/harmonize-truth.mjs                   # all top-100
node scripts/harmonize-truth.mjs --game extra_extra
node scripts/harmonize-truth.mjs --game pop_wow --list moments
node scripts/harmonize-truth.mjs --limit 10
node scripts/harmonize-truth.mjs --max-rank 9999   # disable scope
```

**Cost:** Sonnet 4.6 in $3 / out $15 per Mtok. ~$0.50–1 for top-100 EE.

**No audit pass.** T is grounded in real Wikipedia content from stage 1, so contamination isn't the risk PT/F have. Voice quality is the only concern, and it's prompt-driven.

---

## Stage 3 — PT generate (Sonnet 4.6)

**Script:** [scripts/generate-partially-true.mjs](../scripts/generate-partially-true.mjs)

**What it does:**
- Reads question_sets where `partially_true_text IS NULL` and `truth_text IS NOT NULL`.
- Sonnet reads T and writes a PT that **alters one peripheral element narratively** — date, location, secondary participant. Main character / central concept stays locked.
- Writes back to `partially_true_text`.

**Critical rule:** PT is a narrative rewrite, not a token swap. If T says "Kennedy in Dallas, November 1963," PT might be "Kennedy in San Antonio, October 1963" (same trip, shifted city + month) — written naturally, not search-and-replaced.

**Usage:**
```bash
node scripts/generate-partially-true.mjs --game extra_extra
node scripts/generate-partially-true.mjs --limit 50
node scripts/generate-partially-true.mjs --batch 10
```

**Cost:** ~$0.005 per batch of 10. ~$1 per 2,000 rows.

**Audit:** Currently no audit pass. PT contamination risk is lower than F because PT is anchored in real T content with one narrative shift. **Could add an audit later** if PT quality slips — same shape as F audit.

---

## Stage 4 — F generate (Sonnet 4.6, with audits)

**Script:** [scripts/generate-false-ee-top50.mjs](../scripts/generate-false-ee-top50.mjs) (parameterized for game + rank range despite the filename)

**What it does — per-batch loop (3 subjects per batch):**

1. **Generate +4 oversample.** For each subject needing N F's, request N+4 candidates.
2. **First-pass audit.** Action-focused criteria (see below). Flag contaminated; keep clean.
3. **Top-up if shortfall.** Any subject still short of N clean → generate +4 more, audit, append clean.
4. **Write to DB per-batch.** Persist clean F's immediately to `false_text` slots in `created_at` order. A crash mid-run preserves earlier batches.
5. **Mark unfilled rows as `'pending'`** at end of run, so they're easy to find for manual QA.
6. **Second-pass audit on shipped F's** for accuracy reporting.

**Usage:**
```bash
node scripts/generate-false-ee-top50.mjs --game extra_extra --min-rank 1 --max-rank 50
node scripts/generate-false-ee-top50.mjs --game pop_wow --min-rank 51 --max-rank 100
```

**Cost:** ~$5 per top-100 chunk (gen + audit + occasional top-up).

**Idempotent:** the script only fills rows where `false_text IS NULL`. Re-running won't overwrite existing F's. To regenerate a flagged row: NULL it first, then re-run.

### Audit principle: T / PT / F by narrative actions

A statement contains two kinds of content:

- **Narrative actions** — what someone DOES, SAYS, DECIDES, ARGUES, REFUSES, FEELS, ACHIEVES.
- **Backdrop** — settings, era, surrounding events, places, dates, who-else-was-there.

The three answer types are defined by the narrative actions:

- **TRUE (T):** every described action is documented historical fact.
- **PT:** a mix — at least one action is real, at least one is invented.
- **FALSE (F):** every described action is invented or misattributed.

**Backdrop can be 100% real.** That's the brand voice — real people in real era at real settings doing invented things. Backdrop accuracy never contaminates F.

**One embedded real action contaminates F as PT.** If F describes ten things and nine are fictional but one is a real action by the real actor in the real context, it's PT-shaped.

### Worked example

> "Will Smith slapped Chris Rock at the Oscars while Smith yelled 'keep my wife's name out of your fucking mouth.'"

Two actions: slap (real) + quote (real). Both documented. **T-shaped — flag.**

> "Denzel Washington slapped Chris Rock at the Oscars while Smith yelled 'keep my wife's name out of your fucking mouth.'"

Slap (misattributed — Denzel didn't) + quote (real, by the real Smith). **PT-shaped — flag** because one real action is embedded.

> "Denzel Washington slapped Chris Rock at the Oscars while glancing back at Will Smith, who watched silently."

Slap (misattributed) + Smith watching silently (invented — he didn't sit silent at that moment in reality). Backdrop (the Oscars, Rock present) is real — that's fine. **Genuine F. Pass.**

### What the audit flags

- ❌ Any single described action is documented as having happened, by the actor described, in the context described.
- ❌ A real quote attributed verbatim (or near-verbatim) to its real speaker.
- ❌ A famous outcome contradicted (war winner reversed, famous death erased) — players reject by recognition.
- ❌ A personal name invented and presented as real (e.g., "Sergeant Pavel Orlov"). Real cast must be named; supporting cast must use generic descriptions ("a Wehrmacht quartermaster") with no invented name.

### What the audit does NOT flag

- ✓ Wrong actor doing a real action → that scenario didn't happen → F.
- ✓ Wrong era / impossible date → that scenario didn't happen → F.
- ✓ Real backdrop, settings, surrounding events, witnesses — eligible.
- ✓ Plausible undocumented scenarios consistent with character.
- ✓ Invented content attributed to real documents (fictional log entries, fabricated letter contents).
- ✓ Slight backdrop inaccuracies (wrong car number) when actions are invented.
- ✓ Stylistic preferences ("reportedly," obfuscation endings) — quality, not truth.

### The test

For each described action in the statement, ask: **"Did this actor do this thing in this context in real life?"**

- All actions answer NO → F → pass.
- One or more actions answer YES → PT or T → flag.
- Backdrop being real does not factor in.

### Why this calibration

We tried two earlier audit profiles:

- **Strict** (flag any "could have happened" + any stylistic tell): rejected 60–80% of generations on famous subjects (WW1, WW2, French Rev). Catastrophic fill rate. False positives dominated.
- **Loose** (only flag specific documented matches): missed wrong-role attributions and inverted facts. Shipped contamination.

The action-focused middle ground produced ~99%+ clean rates with viable fill rates (95%+ on top-100 of both EE and PW).

### Standalone audit script

[scripts/reaudit-loose.mjs](../scripts/reaudit-loose.mjs) — re-audits all shipped F's for a given game/range against the same prompt. Useful for ad-hoc accuracy checks without regeneration.

```bash
node scripts/reaudit-loose.mjs   # edit the SQL filter inside for game/range
```

---

## Stage 5 — Manual QA cleanup

After full pipeline run, residual rows have `false_text = 'pending'` (couldn't be filled cleanly even after retries) or were flagged by post-ship audits as factual errors.

**Why some rows resist automation:**

- Subjects with **stubborn model priors**: e.g., the model keeps writing "Himmler at Wannsee" (he wasn't there — Heydrich chaired). Five retries produced the same error pattern.
- Over-documented subjects where almost any plausible scene exists in the historical record (Glorious Revolution, JFK assassination — every documented detail is canonical).

**Planned tooling — Claude Max agents** (one per stage):

| Agent | Purpose | Source prompt |
|-------|---------|---------------|
| **F-Fixer** | Subject + T context in → one clean F out | Action-focused audit prompt from this pipeline |
| **PT-Fixer** | T in → narrative-altered PT out | `generate-partially-true.mjs` |
| **T-Harmonize** | story_fact in → brand-voice T out | `harmonize-truth.mjs` SYSTEM_PROMPT |
| **Research** | Subject in → Wikipedia-grounded story_facts | `research-vertical.mjs` Haiku prompt |

Workflow: agent generates content → user pastes into admin trivia review panel → DB write.

Status: not yet built. Plan is to wait until full corpus is in production and we see real-player failure modes before extracting prompts as agents.

---

## Database schema (relevant tables)

```sql
subjects
  id uuid PK
  firestore_id text UNIQUE
  game_id text
  list_type text
  popularity_rank int
  name, creator, year, genre, citation_url
  research_status text  -- 'pending' | 'ready' | 'error'

story_facts
  id uuid PK
  subject_id uuid FK → subjects
  fact_text text
  fact_year int
  emotional_register text
  -- one row per Haiku-extracted moment

question_sets
  id uuid PK
  subject_id uuid FK → subjects
  source_fact_id uuid FK → story_facts
  truth_text text          -- filled in stage 2
  partially_true_text text -- filled in stage 3
  false_text text          -- filled in stage 4 (or 'pending' for QA)
  reviewed bool
  approved bool
  rejection_reason text
  created_at timestamptz
```

---

## Operational notes

- **NEON connection drops:** Long Anthropic calls (60–90s each) can idle out NEON connections. Pipeline scripts use `pg.Pool` with auto-reconnect + retry-once on `57P01` errors. Single-`Client` patterns will fail mid-run.
- **JSON parse failures:** Sonnet occasionally emits malformed JSON in batch responses. Pipeline catches per-batch, marks affected subjects pending, lets next run retry. Don't re-run the failed batch immediately — the rest of the run continues.
- **'pending' is intentional state.** Don't auto-NULL it. The placeholder lets manual-QA tooling find unfilled slots without confusing them with not-yet-attempted slots (NULL).
- **Idempotent re-runs are safe.** All stage scripts only operate on rows where the relevant column is NULL. Re-running won't double-write.

## Total cost (top-100, both games)

Across the locked pipeline for EE + PW top-100 (885 question_sets):

| Stage | Approx cost |
|-------|-------------|
| Research (Haiku) | $4–6 |
| T harmonize (Sonnet) | $1–2 |
| PT (Sonnet) | $0.50–1 |
| F (Sonnet + audits) | $10–14 |
| **Total** | **~$15–20** |

Iteration / cleanup retries adds 10–20%. Manual QA on residual pending is per-row and doesn't auto-cost.

## Final outcomes (April 2026 corpus run)

- EE top-100: 439 / 441 filled (99.5%), 2 pending, ~99% audit-clean
- PW top-100: 444 / 444 filled (100%), 0 pending, ~99% audit-clean
- Combined: 883 / 885 (99.8% fill), ~$12 spent across all retries
