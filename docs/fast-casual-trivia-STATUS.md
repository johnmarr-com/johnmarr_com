# Fast Casual Trivia — Project Status (snapshot 2026-06-20)

> **STATUS: PARKED.** The trivia content effort is paused as of 2026-06-20. The game is being
> pulled from the front end (see [Front-end: pulling / restoring the game](#front-end-pulling--restoring-the-game)).
> Reason: the Claude API account is out of usable funds for the remaining content runs
> (see [Claude API account & funding](#claude-api-account--funding)).
>
> This is the **single source of truth for where the work actually stands.** The "Final outcomes"
> section of [fast-casual-trivia-content-pipeline.md](fast-casual-trivia-content-pipeline.md) is an
> April-2026 snapshot and is superseded by this file.

For the *how* (architecture, prompts, scripts), see:
- [fast-casual-trivia-content-pipeline.md](fast-casual-trivia-content-pipeline.md) — the 4-stage T/PT/F generation pipeline
- [fast-casual-trivia-research-agent.md](fast-casual-trivia-research-agent.md) — the subject-discovery research agent
- [fast-casual-trivia-phase-one.md](fast-casual-trivia-phase-one.md) — the game shell (Phase 1)

---

## TL;DR

- **2 of 12 verticals** have generated T/PT/F content in the pipeline DB (NEON): **Pop Wow** and **Extra Extra**.
- **Pop Wow** top-100 is **100% complete**. **Extra Extra** top-100 is complete, but its rank ~101–175 tail (**581 question_sets**) has only the TRUE statement — no PT/F yet.
- The **other 10 verticals have subject catalogs seeded in Firestore but nothing in the pipeline DB** — they need the **full pipeline starting at Stage 1 (research)**, not just "write the TRUE statements."
- Finishing the 10 at top-100 depth costs ~**$150–200** in Claude API spend. The account has **$19** — not enough. Effort parked.

---

## The two meanings of "research" (important — this is the trap)

When we say "research is done," there are **two different operations** and they are not the same:

1. **Subject discovery** — the research agent finds popular ranked subjects and writes them to
   **Firestore `trivia-content`** (name, rank, citations, tags). **This is done for all 12 verticals.**
   This is what "we have the topics seeded" refers to.
2. **Pipeline Stage 1** — [`scripts/research-vertical.mjs`](../scripts/research-vertical.mjs) (Haiku)
   reads those Firestore subjects, pulls Wikipedia, and extracts **`story_facts`** + empty
   `question_sets` rows into **NEON**. **This has only run for Extra Extra and Pop Wow.**

You cannot write a TRUE statement (Stage 2 harmonize) until Stage 1 has produced a `story_fact` to
rewrite. So for the 10 remaining verticals, the next step is **Stage 1**, then T → PT → F.

---

## Current state by vertical

### Subject catalogs — Firestore `trivia-content` (all 12 seeded, 5,494 docs)

| Vertical | Subjects | Lists | In pipeline (NEON)? |
|---|---:|---|---|
| nabster | 993 | songs:496, albums:497 | ❌ |
| outtakes | 500 | films:500 | ❌ |
| first_ed | 500 | books:500 | ❌ |
| paparazza | 500 | celebrities:500 | ❌ |
| season_tix | 499 | athletes:499 | ❌ |
| pwn_stars | 444 | games:444 | ❌ |
| where_in_the | 404 | places:404 | ❌ |
| geek_freak | 368 | discoveries:368 | ❌ |
| ctrl_alt_defeat | 364 | milestones:364 | ❌ |
| plated | 308 | dishes:308 | ❌ |
| **pop_wow** | 342 | moments:342 | ✅ |
| **extra_extra** | 272 | events:272 | ✅ |

### Pipeline content — NEON `question_sets` (only 2 verticals)

| Vertical | Subjects loaded | question_sets | TRUE | Partially-True | FALSE | F-pending |
|---|---:|---:|---:|---:|---:|---:|
| **pop_wow** | 100 of 342 | 444 | 444 | 444 | 444 | 0 |
| **extra_extra** | 175 of 272 | 1022 | 1022 | 441 | 441 | 0 |

Reading the Extra Extra row: every row has a harmonized TRUE statement, but PT and FALSE were only
generated for the top-100 (441 rows). **581 rows (the rank ~101–175 tail) are TRUE-only.** There are
**0 `pending` FALSE rows** — the 2 stubborn rows noted in the April pipeline doc have since been filled.

---

## What's left to do (when this resumes)

**The 10 unstarted verticals** — run the full pipeline per game/list, in order:

```bash
node scripts/research-vertical.mjs <gameId> <listType> [maxRank]   # Stage 1 (Haiku) → story_facts + empty question_sets
node scripts/harmonize-truth.mjs --game <gameId>                   # Stage 2 (Sonnet) → TRUE
node scripts/generate-partially-true.mjs --game <gameId>           # Stage 3 (Sonnet) → Partially-True
node scripts/generate-false-ee-top50.mjs --game <gameId> --min-rank 1 --max-rank 100   # Stage 4 (Sonnet + audit) → FALSE
```
Stages 3 and 4 are independent and can run concurrently after Stage 2.

**Extra Extra cleanup (cheap, optional)** — fill PT + FALSE for the 581 TRUE-only tail rows
(`generate-partially-true.mjs` + `generate-false-ee-top50.mjs` with `--max-rank 175`). No new
research or harmonize needed; TRUE already exists.

**Hand-fixing individual rows** — after an audit run, fix/fill T/PT/F by hand in the **admin trivia
review panel**: [src/app/admin/AdminTriviaReviewPanel.tsx](../src/app/admin/AdminTriviaReviewPanel.tsx),
backed by [src/app/api/admin/trivia-review/](../src/app/api/admin/trivia-review/)
(GET subjects/question-sets, PATCH text fields, approve/reject). Nothing is in a `pending` state right now.

---

## Where everything is stored

| Thing | Location |
|---|---|
| **Subject catalogs** (all 12) | Firestore collections `trivia-content`, `trivia-tags`, `trivia-agent-state` |
| **Generated T/PT/F content** | NEON Postgres — tables `subjects`, `story_facts`, `question_sets` (+ tag join tables). Schema in [scripts/migrate-neon.mjs](../scripts/migrate-neon.mjs). |
| **Generation scripts** | [scripts/](../scripts/) — `research-vertical.mjs`, `harmonize-truth.mjs`, `generate-partially-true.mjs`, `generate-false*.mjs`, `reaudit-loose.mjs` |
| **Game code (shell / Phase 1)** | [src/app/games/fast_casual_trivia/](../src/app/games/fast_casual_trivia/) |
| **Admin review UI** | [src/app/admin/AdminTriviaReviewPanel.tsx](../src/app/admin/AdminTriviaReviewPanel.tsx) |
| **Credentials** | `.env.local` — `NEON_URL`, `ANTHROPIC_API_KEY`, `FIREBASE_*` (service account) |

Models used (current code): Stage 1 = `claude-haiku-4-5-20251001`; Stages 2/3/4 = `claude-sonnet-4-6`.
(Note: Haiku does extraction; Sonnet writes all of T, PT, and F — there is no "more powerful model for FALSE";
the FALSE stage just has more machinery — oversample +4, two-pass action-focused audit, top-up.)

---

## Claude API account & funding

- **Billing account:** `jm@jonmar.co`
- **Credits available (2026-06-20):** **$19** — confirmed insufficient for the remaining runs.
- **Cost to finish the 10 verticals (top-100 depth):** ~**$150–200** (doc estimate ~$15–20/game). Going 500-deep per game is multiples of that.
- **There is no API to read the credit balance.** The Anthropic Admin API exposes usage/cost *spend*
  (`/v1/organizations/cost_report`, requires an `sk-ant-admin…` key — this project only has a standard
  `sk-ant-api03…` key) but **no remaining-balance endpoint**. The dollar balance is viewable only in
  **Console → Settings → Billing** ([platform.claude.com/settings/billing](https://platform.claude.com/settings/billing)).
- A live test call on 2026-06-20 succeeded, so the org was funded/active at snapshot time; current
  rate limits ~1,000 RPM / 540k TPM (450k in, 90k out).

---

## Front-end: pulling / restoring the game

Trivia is **engine-backed**: each playable skin is a CMS **game content doc** (`contentType: "game"`)
with `engineSlug: "fast_casual_trivia"` and a `gameSlug` (e.g. `popwow`), played at
`/games/fast_casual_trivia?game={gameSlug}` (see [src/lib/composite-game-slug.ts](../src/lib/composite-game-slug.ts)).

Visibility is controlled by flags on the content doc (see `src/lib/content-types.ts`):
- `isPublished: false` → fully hidden (draft).
- `tease: true` → visible in the list but greyed-out and unplayable.

**To pull it now:** in the admin Game editor ([src/app/admin/GameEditModal.tsx](../src/app/admin/GameEditModal.tsx)),
set the trivia game doc(s) to `isPublished: false` (or `tease: true`). This is a reversible CMS toggle —
**no code change and no content loss.** All NEON/Firestore content stays intact for when this resumes.
