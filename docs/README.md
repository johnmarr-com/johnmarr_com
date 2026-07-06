# Docs Index

How to use this directory: **canonical** docs describe the live system and
must be kept accurate — trust them over memory or old commit messages.
**Strategy** docs carry maintained plans/status. **Historical** docs preserve
design rationale but are not how-to guides. **Parked** docs cover paused
efforts.

## Canonical (the live system)

| Doc | What it covers |
|---|---|
| [`GAME-DEVELOPMENT-GUIDE.md`](./GAME-DEVELOPMENT-GUIDE.md) | **Start here for game work.** End-to-end how-to: CMS definition → reducer → API route → factory page → rules → deploy. |
| [`SERVER-AUTHORITY-ENGINE.md`](./SERVER-AUTHORITY-ENGINE.md) | The server half: reducers, inbox, `seq`, effects (LLM judging), deadlines, three-layer client sync, rules posture, operational gotchas. |
| [`GAMECORE-ARCHITECTURE.md`](./GAMECORE-ARCHITECTURE.md) | The client half: `composeGame()`, phase slots GC0–GC5, variant registry, conventions. |
| [`DATA-ACCESS.md`](./DATA-ACCESS.md) | Site-wide rule: read-to-render over HTTPS, poll-backed listeners, writes via API routes, first-party auth domain. Why iOS doesn't freeze. |
| [`USER-LEVELS.md`](./USER-LEVELS.md) | The 10-level ladder (points, colors); shared with AI difficulty. |
| [`AI-PERSONA-MAP.md`](./AI-PERSONA-MAP.md) | The 14-persona roster — canonical Play/Voice prompts (Firestore `/aiPersonas` is canonical for live state). |
| [`autosave.md`](./autosave.md) | The shared `useAutosave` hook for editor forms. |

## Strategy / status (maintained plans)

| Doc | What it covers |
|---|---|
| [`SYSTEM-REVIEW.md`](./SYSTEM-REVIEW.md) | **The prioritized backlog** — verified gaps, fragility, and funnel blockers, each with a tackle-with-AI work order. |
| [`AI-PLAY-PLAN.md`](./AI-PLAY-PLAN.md) | Hybrid AI-opponent architecture (algorithms vs LLM) + audited per-game status table. |
| [`SCROLLYFOX.md`](./SCROLLYFOX.md) | ScrollyFox product spec. Partially implemented — see its status banner. |

## Historical design specs (rationale, not how-to)

`BOATY-BUILD-SPEC.md` · `WORDONKULOUS-BUILD-SPEC.md` · `BLARF-BUILD-SPEC.md`
· `BLUFF-BOX-BUILD-GUIDE.md` · `FYVE_build_spec_v2.md`

Each carries a banner: game rules/scoring/phase design are still valid; the
implementation guidance predates the server-authority engine. Some games also
keep a local doc next to their code (e.g. `src/app/games/bluffbox/BLUFFBOX.md`).

## Parked (paused efforts)

| Doc | What it covers |
|---|---|
| [`fast-casual-trivia-STATUS.md`](./fast-casual-trivia-STATUS.md) | **Canonical status** of the trivia effort (paused 2026-06-20, API funding). |
| `fast-casual-trivia-phase-one.md` / `-content-pipeline.md` / `-research-agent.md` | Trivia build plan, content pipeline, research agent. |
| [`trivia-claude-max-prompts.md`](./trivia-claude-max-prompts.md) | Claude Max prompts for the six unstarted verticals. |

## Removed docs (so stale links don't confuse you)

- `GAME-SYNC-RESILIENCE-PLAN.md` → superseded by `SERVER-AUTHORITY-ENGINE.md`
  (the pilot plan that became the engine).
- `GAMES-IMPROVEMENT-PLAN.md` → completed items deleted; open items live in
  `SYSTEM-REVIEW.md`.
