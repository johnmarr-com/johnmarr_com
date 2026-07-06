# System Review — Prioritized Backlog

> Audited 2026-07-05 by a full doc + code review (two independent code sweeps:
> games/engine and platform/funnel). Every finding below was **verified in
> code** with file references. Work items are ordered for one-by-one execution
> with AI: each has a **Work order** you can hand to an agent as-is.
>
> **The business lens used for prioritization:** shows/content shared on
> social → traffic to the free site → emails collected in exchange for fun →
> email list markets a Kickstarter and/or Pro tier. Anything that breaks that
> chain outranks anything that doesn't.

Legend: 🔴 P0 funnel-blocking · 🟠 P1 integrity/cost/trust · 🟡 P2 reliability
& consistency · ⚪ P3 hygiene/polish

---

## 🔴 P0 — The funnel is currently broken at the front door

> **✅ P0 SHIPPED 2026-07-05** (commit `84be490`). Items 1–4 below are done as
> specified; kept for the record. What landed: `src/lib/detail-server.ts`
> (Admin-SDK serialized fetchers) + server shells with `generateMetadata` for
> show/story/artist/CMS/home; `SignupGateModal` soft gate (one released
> episode / full read as the anonymous taste, EPUB download sign-in-only,
> `source=show_gate|story_gate` funnel attribution); consent checkbox on
> /auth → `users/{uid}.marketingConsent` via `/api/user/consent`; CSV export
> at `/api/admin/email-export`.
> **Remaining follow-up:** existing users have no consent flag — only new
> signups record one. A one-time in-app backfill prompt is an open sub-task.

### 1. Shared links don't unfurl — zero Open Graph/Twitter metadata in the app
**Problem:** `src/app/layout.tsx` has the only metadata in the app (static
"John Marr — Personal website of John Marr", favicon only). `generateMetadata`
exists in **zero** files. Every show/story/artist/CMS link shared to
Facebook/iMessage/X/WhatsApp unfurls as a blank generic card.
**Impact:** This kills click-through on the single most important acquisition
channel. Nothing else in this document matters as much.
**Work order:** Convert `/show/[id]`, `/story/[slug]`, `/artist/[slug]`, and
`/[...slug]` to server-component shells with `generateMetadata()` that resolve
the content via the Admin-SDK path (`src/lib/content-server.ts`) and emit
`openGraph` (title, description, `backdropURL`/`coverURL` image) +
`twitter: { card: "summary_large_image" }`; add `metadataBase` and a real
site-level OG default in `layout.tsx`. Keep the interactive UI as nested
client components.

### 2. Content pages render an empty spinner to crawlers (and to LCP)
**Problem:** show/story/artist pages are `"use client"` and fetch via client
Firestore (`src/lib/content.ts` is client-only), so server HTML is the loading
spinner (`show/[id]/page.tsx:127-139`, `story/[slug]/page.tsx:107-116`,
`artist/[slug]/page.tsx:259-271`).
**Impact:** SEO ~zero on content pages; social scrapers that read the body get
nothing; LCP on funnel-entry pages waits for a client round-trip.
**Work order:** Same refactor as #1 — server-fetch the content and render the
hero/title/description server-side; hydrate interactivity client-side. Do
show pages first (they're the shared asset), then story, then artist.

### 3. No email capture on the shared surfaces
**Problem:** Story pages have **no auth gate at all** — anyone can read and
even download the EPUB (`story/[slug]/page.tsx:206,213-225`; Storage is
public-read). Show pages never reference `/auth`; anonymous visitors watch
released episodes freely. Only non-`openAccess` artist pages gate.
**Impact:** The "fun in exchange for email" trade never happens on the pages
social traffic lands on. The funnel has no capture step.
**Work order:** Design + implement a **soft gate**, mobile-first: anonymous
visitors get a taste (e.g. first episode / first chapter / N minutes), then a
friendly "keep watching free — sign in with one tap" prompt (Google + magic
link). Gate the EPUB download behind sign-in. Instrument it in the existing
`signup_funnel` logging so conversion is measurable.

### 4. Captured emails aren't marketing-ready — no consent flag, no export
**Problem:** `src/lib/user-init.ts` / `src/lib/auth.ts` store `email` with no
marketing-consent field; repo has no export path or ESP sync. (Emails live in
Firebase Auth + `users` + `signup_funnel`.)
**Impact:** When the Kickstarter/Pro push comes, bulk-emailing this list has
CAN-SPAM/GDPR/CASL exposure and no mechanical way to reach an ESP.
**Work order:** Add `marketingConsent: { granted, at, source }` to the user
doc, set at signup via a pre-checked-where-legal checkbox in the auth flow;
backfill existing users as unconsented; add an admin-gated
`/api/admin/email-export` (CSV of consented emails) using the existing
`requireAdmin` pattern.

---

## 🟠 P1 — Integrity, cost, and trust

> **✅ P1 SHIPPED 2026-07-05.** Items 5–8 done: points route now validates
> game awards against the session (`winnerUids` written by the engine at
> gameOver; per-replay `pointsAwarded` dedup; media-key cooldowns;
> `win_game` enabled — it was configured at 5 pts all along); legacy
> resolverKey rules are an allowlist (own `pendingMoves` slot only for
> non-hosts); `/api/games/ai` has a `max_tokens` ceiling, Firestore-backed
> shared rate limits (text 30/min; images 30/hr + 150/day), and a
> `persist-image` path allowlist (it previously accepted ANY storage path);
> PWA manifest + apple-touch-icon shipped (placeholder icons in
> `public/icons/` — swap the PNGs to rebrand).
> **Deployed 2026-07-05:** firestore rules + all functions (gameEngine,
> sweepDeadlines, scheduledGameCleanup, recordAIGameResult) released.
> Worth a spot-check: one SweepTheLeg solo-vs-AI game on a fresh session
> (the rules change touches the host-writes-AI-move path).

### 5. Points can be farmed, and `win_game` is silently dead
**Problem:** `POST /api/user/points` awards on any authed call — no
verification the activity happened, no idempotency, no rate limit
(`src/app/api/user/points/route.ts`). AND every game awards
`Activity.WIN_GAME`, but `"win_game"` is missing from the route's
`VALID_KEYS`, so winning silently grants 0 points (400 swallowed).
**Impact:** Levels — the spine of gamification and future Pro perks — are
both exploitable and under-rewarding. Two bugs, one fix.
**Work order:** Rework the points route: require `sessionId` for game keys,
verify caller is a participant and session `status == "finished"`, stamp
`pointsAwarded.{uid}.{key}` on the session for idempotency, add per-activity
cooldowns for media keys (watch/listen/read), and add `win_game` to
`VALID_KEYS` + ensure the `pointActivities/win_game` doc exists. Longer term:
award game points server-side from the engine at `gameOver`.

### 6. Legacy-game rules let a player forge opponents' moves
**Problem:** For `resolverKey` sessions (SweepTheLeg, TapSmashArena) the
Firestore rule is a **denylist** (`firestore.rules:448-455`); `pendingMoves`
isn't in it, so any participant can write the whole `pendingMoves` map —
including the opponent's move — and the server adapter resolves the forgery.
**Impact:** Cheating/griefing in both 1v1 games; also a fragile pattern (any
future field is client-writable by default).
**Work order:** Either (a) migrate both games to the `engineKey` regime with
an API-route submit (preferred; also retires the legacy path), or (b) tighten
the rule so a participant's update may only touch `pendingMoves.{their uid}`.
Do (b) immediately if (a) is deferred.

### 7. `/api/games/ai` has unbounded `max_tokens` and a per-instance rate limit
**Problem:** Client-supplied `maxTokens` is uncapped
(`src/app/api/games/ai/route.ts:333`); the 30 req/min limiter is an in-memory
Map, so Cloud Run scaling multiplies it (30·N), and the expensive
`generate-image` (Ideogram) / `sketch` (Replicate) types share that weak
limit.
**Impact:** Any authenticated user can run up real provider spend.
**Work order:** Clamp `max_tokens` to a hard ceiling; move rate limiting to a
Firestore counter (shared across instances) keyed by uid; give image/sketch
their own much stricter daily caps; log per-uid usage for visibility.

### 8. No PWA installability
**Problem:** No manifest, no service worker, no `apple-mobile-web-app-*`/
`apple-touch-icon`, nothing. (`output: "standalone"` is unrelated.)
**Impact:** The "PWA serving custom experiences" positioning isn't real yet:
no add-to-home-screen, no standalone chrome for retained visitors.
**Work order (minimal, ~1 session):** add `src/app/manifest.ts` (name, icons
192/512, `display: "standalone"`, theme/background colors from JMStyle),
`apple-touch-icon.png`, and `appleWebApp` metadata in `layout.tsx`. Defer the
service worker/offline shell to a later pass — the manifest alone unlocks
install.

---

## 🟡 P2 — Game reliability & platform consistency

> **✅ P2 SHIPPED 2026-07-05.** Items 9–15 done: FYVE now has self-arming
> turn deadlines (4 min/turn, auto-pass; 4 consecutive timeouts end the game
> for the score leader; 30-min setup abandonment closes the session); the
> session heartbeat keeps beating after `finished` (slower) and treats a
> polled `seq === 0` as the Play-Again reset; engine-session roster rules
> now let non-hosts remove only themselves or one AI seat (kicks are
> host-only); `runEffects` retries failed effects 3× with backoff;
> `getPageContent` is cached per slug (60s, tag-busted on publish alongside
> home); an hourly `aiHealthCheck` function probes Anthropic and writes
> `system/aiHealth` (admin view: `GET /api/admin/ai-health`, `?live=1` for an
> on-demand probe with the web key); and test infrastructure exists —
> `npm test` runs vitest at root (boaty client/server **parity test**, the
> long-promised one) + in `functions/` (FYVE deadline reducer tests).

### 9. FYVE has no deadlines — one AFK player wedges the game forever
**Problem:** FYVE is untimed by design: no `phaseDeadlineAt` is ever written
(`functions/src/games/fyve/fyve.spec.ts:22`), so `sweepDeadlines` never
sweeps it and a disconnected boss/operative stalls the session with no
recovery path. It's the one game where server authority has no liveness
backstop.
**Work order:** Add a generous per-turn `phaseDeadlineAt` (e.g. 3–5 min) with
an auto-pass/forfeit-turn on expiry in the reducer, plus a lightweight "still
there?" UI as the deadline nears.

### 10. Play-Again reset can't reach a wedged client over the heartbeat
**Problem:** `subscribeToSession`'s HTTPS heartbeat stops on
`status === "finished"` (`game-sessions.ts:562`) and only applies polls when
`seq > appliedSeq` (`:581`) — but Play Again resets `seq: 0`. The realtime
path special-cases seq 0; the poll path doesn't. Exactly the iOS-background
case the heartbeat exists for leaves the player stuck on the finished screen.
**Work order:** Keep the heartbeat alive (slower cadence) after `finished`;
treat a polled `seq === 0` or a `finished → playing` status transition as a
reset that always applies, mirroring the realtime gate.

### 11. Any participant can rewrite the roster on engine sessions (griefing)
**Problem:** The engine-session client allowlist
(`firestore.rules:390-395`) permits participants to write `players` /
`playerUids` / `kickedUids` wholesale — a player can drop opponents or kick
the host. State stays engine-owned; this is griefing, not forgery.
**Work order:** Constrain non-host roster writes to add/remove-own-uid only
(rules-level), or move join/leave/kick/add-AI to Admin-SDK API routes like
the move path already is.

### 12. No tests — and the promised reducer parity tests don't exist
**Problem:** No test runner anywhere (root or `functions/`); the
`*.spec.ts` files are engine registrations, not tests. Code comments promise
a `boaty.logic.test.ts` parity test between the 324-line client logic and
251-line server reducer — it doesn't exist.
**Impact:** Reducers are the authority for all gameplay; they're unverified,
and client/server logic can drift silently.
**Work order:** Add vitest + a `test` script (root and functions), write the
Boaty client/server parity test on shared fixtures first, then phase-
transition unit tests per reducer (each is pure — easy wins), then wire
`npm test` into the pre-commit hook alongside `check`.

### 13. Post-commit effects can be lost on phases with no deadline
**Problem:** A failed effect is logged and dropped
(`functions/src/engine/effects.ts:36-44`); recovery assumes a deadline
re-fires the engine. MegaSketchy's LLM effects degrade gracefully internally,
but any effect that throws early, on a phase without `phaseDeadlineAt`, is
gone.
**Work order:** Enforce the invariant "any phase that emits an effect also
stamps a deadline" (assert in the engine or lint the reducers), and/or add
bounded retry inside `runEffects`.

### 14. CMS catch-all pages re-render on every request
**Problem:** `/[...slug]` is `force-dynamic` and `getPageContent` isn't
cached (unlike `getHomeContent`'s `unstable_cache`).
**Impact:** Campaign landing pages — likely social targets — pay a fresh
Admin-SDK read per hit; slower TTFB where speed matters most.
**Work order:** Wrap `getPageContent(slug)` in `unstable_cache` with a
per-slug tag, 60s revalidate, busted by the existing admin `/api/revalidate`
on publish.

### 15. Silent AI degradation when the Anthropic org is out of credits
**Problem (known, recurring):** when the deployed key's org has no credits,
LLM effects/calls fail and games fall back to canned text with no surfaced
error (past incident: broke gamertag-adjacent flows at a meeting; documented
in memory + `SERVER-AUTHORITY-ENGINE.md` gotchas).
**Work order:** Add a startup/periodic health probe (cheap 1-token call) that
writes a status doc surfaced in the admin panel + a log-based alert, so
credit exhaustion is visible before players feel it.

---

## ⚪ P3 — Hygiene, polish, product decisions

> **✅ P3 SHIPPED 2026-07-05** (except the open product decision below).
> Story surface themed through `useJMStyle` (16); back-button audit clean —
> remaining `router.push("/")` in games are intentional exit-to-home actions
> (17); dead code removed: `submitEvent`, `writeRoundResult`, the
> never-executed client resolution branch in `useMultiplayerRound`, and the
> duplicate bluffbox `GameBgUnderlay` (18); `useChapteredVideo` extracted and
> both chaptered-video games refactored onto it (19); avatar dev endpoints
> gated behind `requireAdmin` (21).
>
> **Still open — item 20 is a product decision, not a bug:** should BluffBox
> and Wordonkulous get AI opponents back (engine-side, reducer/effect-driven)?
> If yes, wire `aiSkillDice` tiering into each LLM-native game at the same
> time (only TapSmashArena has it today; SweepTheLeg plays tier-blind).

### 16. Story surface ignores the theme system
Hard-coded `#0f0f0f`/`#e8c547`/rgba values in `story/[slug]/page.tsx` instead
of `useJMStyle()` tokens — reads as a different product than show/artist.
**Work order:** route story colors through the theme like the other surfaces.

### 17. Deep-link "Back" dumps social visitors to Home — ✅ mostly done in P0
Show/story back buttons now use `router.back()` with a home fallback, and the
old headerless loading states are gone (pages server-render). Remaining:
audit other surfaces for the same pattern.

### 18. Dead code from the engine migration
`submitEvent` (no callers; rules would block it), `useMultiplayerRound`'s
host-resolution branch + `writeRoundResult` (unreachable — both consumers set
`resolverKey`), duplicated `GameBgUnderlay` (bluffbox local copy vs
`_gamecore`).
**Work order:** delete all three paths; run `npm run check`.

### 19. SweepTheLeg/TapSmashArena still ~85% duplicated
The long-planned `useChapteredVideo` extraction (old improvement-plan item 3)
never happened. If #6 goes the migration route, fold this in — one refactor,
two wins.
**Work order:** extract `useChapteredVideo` + `useVideoGameRound` +
shared overlays into `_gamecore`, refactor both games, verify solo/AI/friends.

### 20. Product decision: AI seats and skill tiering are mostly dormant
`allowAI` is false for BluffBox and Wordonkulous (designs exist but seats are
off post-migration); `aiSkillDice` gated-history tiering is wired **only** in
TapSmashArena (SweepTheLeg plays tier-blind). The AI-PLAY-PLAN table now
reflects this.
**Work order (decide first, then wire):** choose per game whether AI seats
return (engine-side, reducer/effect-driven — never client-driven), then wire
`aiSkillDice` into each LLM-native game that gets them.

### 21. Unauthenticated avatar dev endpoints deployed
`/api/avatars/load-new`, `update-scale`, `rename-with-ids` have no auth and
write to the source filesystem (dead on Cloud Run's read-only FS, but they're
publicly exposed privileged-looking endpoints).
**Work order:** gate behind `requireAdmin` or exclude from production.

---

## Suggested attack order

Funnel first, then integrity, then reliability:
**1 → 2 → 3 → 4** (one connected refactor arc: server-render + metadata +
soft gate + consent) · **5** (points, quick) · **8** (PWA manifest, quick) ·
**6 + 19** (legacy-game migration, one arc) · **7** · **9 → 10 → 11** ·
**12 → 13** · **14 → 15** · then P3 as filler between bigger arcs.
