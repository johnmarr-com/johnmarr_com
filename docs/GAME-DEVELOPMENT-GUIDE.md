# Game Development Guide

Everything an AI agent (or human) needs to create, edit, and maintain games on
this platform. Read this before touching any game code.

**The three canonical docs** (this one is the how-to; the other two are the
reference for each half):

- [`GAMECORE-ARCHITECTURE.md`](./GAMECORE-ARCHITECTURE.md) — the client-side
  game factory (`composeGame`, phase slots GC0–GC5, variant registry).
- [`SERVER-AUTHORITY-ENGINE.md`](./SERVER-AUTHORITY-ENGINE.md) — the
  server-side engine (reducers, inbox, seq, effects, deadlines, sync).
- [`DATA-ACCESS.md`](./DATA-ACCESS.md) — the site-wide data-access rule
  (read-to-render over HTTPS; poll-backed listeners; writes via API routes).

---

## Architecture Overview

A game is four things:

1. **A CMS document** — `contentType: "game"` in Firestore `/content`,
   authored in the admin portal. Branding, art, music, colors, player limits.
2. **A client page** — `src/app/games/{slug}/page.tsx`, a ~40-line
   `composeGame()` call. The factory supplies splash/gate/lobby/result/replay;
   the game supplies only the **GC3 game board**.
3. **A server reducer** — `functions/src/games/{slug}/` registered under an
   `engineKey`. Owns ALL game-state progression. Clients submit intents and
   render snapshots; they never resolve outcomes.
4. **An API route** — `src/app/api/games/{slug}/route.ts` that validates and
   forwards client intents to Firestore via the Admin SDK.

```
src/
├── app/games/
│   ├── _gamecore/            ← factory, registry, shared hooks/components, AI bridge
│   └── {slug}/               ← page.tsx (factory call) + GC3 board + screens
├── app/api/games/
│   ├── {slug}/route.ts       ← per-game validated submit route
│   ├── session-state/        ← HTTPS session read (heartbeat fallback)
│   ├── engine-tick/          ← deadline nudge
│   ├── ai/                   ← client-facing AI proxy (Anthropic/Replicate)
│   ├── active-sessions/ known-players/ profiles/
├── lib/
│   ├── game-sessions.ts      ← session CRUD, subscribeToSession
│   ├── game-invites.ts       ← direct player invites
│   ├── ai-personas.ts        ← persona CRUD + stat recording (callable)
│   ├── content-types.ts      ← JMContent (game definition fields)
│   └── content.ts            ← content CRUD (getContentBySlug, …)
functions/src/
├── engine/                   ← generic engine (see SERVER-AUTHORITY-ENGINE.md)
├── games/{slug}/             ← per-game reducer + pure logic
├── roundEngine/              ← legacy hml/rps specs (adapter-served)
└── index.ts                  ← registration imports + exported functions
```

### Games in production

| Game | engineKey | Mode | AI opponents (`allowAI`) |
|---|---|---|---|
| Boaty | `boaty` | versus | ✅ procedural, reducer-side |
| Wordonkulous | `wordonkulous` | party | ❌ off (LLM-native design exists; not wired post-migration) |
| Blarf | `blarf` | party | ❌ none by design |
| BluffBox | `bluffbox` | party | ❌ off (AI-sharer phases exist in the flow; seats disabled) |
| FYVE | `fyve` | party/teams | ❌ none by design |
| MegaSketchy | `megasketchy` | party | ❌ seats off; LLM as judge via engine effects |
| Lineup | `lineup` | party | ❌ none |
| SweepTheLeg | `resolverKey: "hml"` (legacy) | versus | ✅ LLM-native |
| TapSmashArena | `resolverKey: "rps"` (legacy) | versus | ✅ LLM-native |

`fast_casual_trivia` is a separate, currently **parked** effort
(see `fast-casual-trivia-STATUS.md`).

---

## Game Definition (CMS Content)

Each game is a `/content/{id}` doc with `contentType: "game"`, edited via
`GameCreateModal.tsx` / `GameEditModal.tsx` in the admin portal.

### Key `JMContent` fields for games

| Field | Purpose |
|-------|---------|
| `slug` | URL path segment → `/games/{slug}` |
| `title`, `subtitle`, `description` | Display text |
| `splashBgURL`, `splashIconURL`, `splashLogoURL` | Landing visuals |
| `coverURL`, `bannerURL` | Thumbnails elsewhere on the site |
| `backgroundMusicURL`, `backgroundMusicVolume`, `bgMusicLandingOnly` | Audio |
| `minPlayers`, `maxPlayers` | Lobby constraints |
| `trueSoloMode` | Solo play skips AI-opponent selection |
| `retentionDays` | 1 (daily) or 30 (monthly) → `expiresAt` on sessions |
| `primaryColor`, `secondaryColor`, `tertiaryColor`, `dangerColor` | Game palette |
| `modalBgColor`, `modalAccentColor`, `modalTabColor`, `modalBorderColor` | Picker/modal 4-role palette |
| `assembly` | Per-slot variant selection (Game Assembly editor) |

**Colors are CMS-driven, never hard-coded per game.** They flow
`colorsFromGameData()` → `GameColorsProvider` → `useGameColors()`, and
`toPickerColors()` maps the modal quartet onto pack/asset pickers. If you're
writing a hex color inside a game folder, something is wrong.

---

## Creating a New Game — Step by Step

### 0. Design first

Answer these before code (the factory handles everything outside the board):

game name + slug · player count · content packs? · round structure · internal
phases (the GC3 state machine) · scoring model · AI players? · timers per
phase · win condition · session fields (pick a unique 2–3 letter prefix) ·
visual identity.

### 1. CMS content

Admin → Games → Create Game. Set title, slug, art, colors, player limits,
retention, music. Defaults work for the assembly config.

### 2. Server reducer (the authority)

```
functions/src/games/{slug}/
├── logic.ts        ← pure game logic (no Firebase imports)
├── types.ts        ← session-field + event types
└── {slug}.spec.ts  ← the Reducer + registerEngine("{slug}", reducer)
```

- Implement `shouldRun` (cheap gate: is there an unconsumed inbox event / an
  AI turn / an expired deadline?), optional `secretRefs` (hidden docs to read
  in-transaction), and pure `reduce(ctx) → StateUpdate | null`.
- Return `null` whenever there is nothing to advance — this is what prevents
  self-write loops.
- Stamp `phaseDeadlineAt` (epoch ms) whenever you open a timed phase.
- Consume inbox events by deleting the slot in the same `StateUpdate`.
- Add the side-effect import to `functions/src/index.ts`:
  `import "./games/{slug}/{slug}.spec";`

The functions package is standalone (no `@/` alias). If the client needs the
same logic (e.g. optimistic rendering), copy it and keep a parity test.

### 3. API route (validated submits)

`src/app/api/games/{slug}/route.ts`, following any existing game's route:

1. `verifyIdToken` from the `Authorization: Bearer` header → 401 otherwise.
2. Confirm the caller is in `playerUids` for the session.
3. Rate-limit per UID.
4. Validate the action server-side (never trust the client's math).
5. Admin-SDK write: `inbox.{channel}.{uid} = { eventId, …payload }` and/or a
   secret doc. The write fires the engine.

The API route is the ONLY submit path — Firestore rules block client `inbox`
writes on engine sessions. (`submitEvent` in `game-sessions.ts` is dead code
slated for removal.)

### 4. Client page — the factory call

```typescript
"use client";

import { composeGame } from "../_gamecore";
import YourGame from "./YourGame";

export default composeGame({
  slug: "yourgame",
  GameComponent: YourGame,                       // GC3 — the only custom UI
  authority: { engineKey: "yourgame" },          // server authority opt-in
  allowAI: true,                                 // AI seats in the lobby
  multiplayerFlowMode: "party",                  // or "versus" + sideLabels
  lobbyExtra: ({ session }) => <YourPackPicker sessionId={session.id} />,
  lobbyCanStart: ({ session }) => Boolean(session["ygLobbyPackId"]),
  resultOptions: { showAIPostGameComments: true },
  resetFields: () => ({                          // Play-Again reset shape
    ygPhase: "setup",
    ygScores: {},
    // …every game field at its initial value
  }),
});
```

See `ComposeGameInput` in `src/app/games/_gamecore/registry/types.ts` for the
full contract (including `contentSlugFromQueryParam` for skinnable engines,
`landingExtra`, icon animation flags).

**Remember the lobby/settings separation:** the lobby is invite + Start only.
Pack, rounds, and other configuration belong AFTER Start, in the game's own
setup phase / the Play-Again (GC5) picker.

### 5. The GC3 game board

Receives `GC3Props { sessionId, gameData, onGameEnd }`.

- Subscribe with `subscribeToSession(sessionId, cb)` — never a bare
  `onSnapshot` (you'd lose the seq fence and the iOS heartbeat).
- Mount `useEngineDeadline(session)` so timed phases advance promptly.
- Render purely from the latest snapshot. Keep the player's OWN pending
  action optimistic/instant locally; the authoritative outcome always comes
  from the server.
- When the session shows the game is over, call `onGameEnd({ winners,
  winnerPoints, allPlayers, scores })` — the factory transitions to GC4.

### 6. Firestore rules

If clients write anything directly (packs, `submitEvent` inboxes), extend
`firestore.rules`. On engine sessions, clients get lobby-shape updates plus
the value-checked Play-Again reset only — never widen the server-owned field
set (`rounds`, `winner`, `currentRound`, `seq`, `transcript`, `status`).
Secret docs (hidden boards/roles/keys) get their own locked collection.

### 7. Deploy & verify

Deploy functions AND the App Hosting frontend, then **test with a freshly
created session** — sessions created before the frontend rollout lack
`engineKey`, so the engine silently ignores them (no logs, 400 submits).
Two-device test matrix: airplane-toggle mid-turn, background/lock then
resume, host offline mid-round (round must still resolve), duplicate submits
(no double rounds).

---

## Session Lifecycle

All in `src/lib/game-sessions.ts`.

### Session document (`gameSessions/{id}`)

```
{
  gameId, gameName, gameSlug, gameLogoURL,
  ownerId, inviteCode, maxPlayers,
  players: [{ uid, gamertag, avatarName? }],
  playerUids: [...],                    ← flat array for Firestore rules
  pendingInviteUids, kickedUids,
  playerSides: { uid: "red" | "p1" | ... },
  status: "lobby" | "playing" | "finished",
  engineKey,                            ← reducer routing (or resolverKey, legacy)
  seq,                                  ← monotonic sync counter (0 = reset shape)
  inbox: { channel: { uid: { eventId, ... } } },  ← client→server intents
  phaseDeadlineAt,                      ← epoch ms; timed-phase deadline
  winner, replayCount,
  retentionDays, expiresAt, createdAt, updatedAt,
  …game-specific prefixed fields (bt*, wk*, bf*, …)
}
```

### Flow

1. **Create** — `createGameSession(input)`: session (status `"lobby"`) +
   `inviteCodes/{code}` doc; stamps `engineKey` from the factory config.
2. **Join** — `joinGameSession(code, …)` / `joinGameSessionById(…)`:
   transactional, capacity-checked; a full lobby evicts an AI seat for a
   joining human. Invite docs cleaned up on join.
3. **Start** — host-only; `startGame(sessionId, playerSides)` sets
   `status:"playing"`, resets round state, and re-arms `seq: 0`.
4. **Play** — clients submit via the API route / `submitEvent`; the engine
   advances state; clients render snapshots (see
   [`SERVER-AUTHORITY-ENGINE.md`](./SERVER-AUTHORITY-ENGINE.md)).
5. **Finish** — the reducer returns `gameOver` → engine writes
   `status:"finished"` + `winner`; GC3 calls `onGameEnd` → GC4 result.
6. **Play Again** — GC4/GC5 host action applies `resetFields()` (the
   value-checked `seq == 0` write shape allowed by rules) and re-enters.
7. **Cleanup** — `scheduledGameCleanup` (daily 03:00 UTC) deletes expired
   sessions + invite codes + invites + Storage sketches, logging to
   `cleanupLogs`. Manual: admin Data Cleanup panel or
   `POST /api/admin/game-cleanup`.

---

## AI System

Two distinct AI surfaces — don't conflate them:

### 1. Server-side (engine) AI — authoritative

- **AI opponent turns in engine games** run inside the reducer (pure code,
  e.g. Boaty's tiered targeting) or as post-commit **effects**. No client
  device involved.
- **LLM judging** (MegaSketchy verdicts/scoring) runs as effects calling
  Anthropic; `ANTHROPIC_API_KEY` is bound to the `gameEngine` function.

### 2. Client-facing AI proxy — flavor & LLM-native moves

`POST /api/games/ai` (`src/app/api/games/ai/route.ts`): Firebase-token
gated, per-UID rate-limited. Request types: text move/comment (Anthropic),
`vision` (image analysis), `sketch` (Replicate image gen). Client bridge:
`simpleMove(prompt, opts)` / `postGameComment(prompt, opts)` in
`_gamecore/AIPlayerManager.ts` (fires 2 parallel requests, first success
wins; retries once).

### Personas & difficulty

- Roster: 14 personas in a diamond (4 Enthusiast / 6 Champion / 4 Game
  Master) — canonical prompts in
  [`AI-PERSONA-MAP.md`](./AI-PERSONA-MAP.md); live state in Firestore
  `/aiPersonas` (admin-editable, synced via `scripts/syncAIPersonas.ts`).
- **Play Prompt** shapes decisions; **Voice Prompt** shapes language.
- Skill: user levels 1–10 map to engine tiers via `aiEngineTierForLevel()`
  (`basic`/`standard`/`sharp`) for procedural games, and to **gated history**
  via `_gamecore/aiSkillDice.ts` for LLM-native games (lower tiers literally
  see less history — no performative bad play).
- Strategy doc: [`AI-PLAY-PLAN.md`](./AI-PLAY-PLAN.md) (hybrid
  algorithm/LLM architecture + per-game status table).
- Stats: `recordAIGameResult(personaId, won)` → callable Cloud Function
  (`aiPersonas` is admin-only in rules). Fire-and-forget from game code.

---

## Points & Leveling

`POST /api/user/points` with `{ activityKey }` + Bearer token. Game keys:
`play_game`, `host_game`, `win_game`. Values live in
`/pointActivities/{key}` (admin-editable); the route increments
`users/{uid}.points`, recomputes level from `/levels`, and sets `levelledUp`
(surfaced by `JMLevelUpPopup`).

---

## Firestore Security Rules (game collections)

| Collection | Posture |
|------------|---------|
| `gameSessions` | Regime-aware: engine sessions allow lobby-shape client updates + value-checked `seq == 0` Play-Again reset; authoritative fields server-only. Legacy sessions use field-mask rules. |
| `boatyBoards`, `blarfRoles`, `fyveKeys`, … | Secret docs — no client access; Admin SDK only. |
| `aiPersonas` | Read authed; write admin (stats via callable). |
| `inviteCodes` | Read/create authed; mutate admin. |
| `gameInvites` | Sender/recipient only. |
| `{game}Packs` / `megasketchyMissions` / `fyveHeists` … | Creator-owned; "official" requires admin. |

---

## TypeScript & Code Conventions

- `exactOptionalPropertyTypes` is on: spread optionals as
  `...(v != null ? { field: v } : {})`; never assign `undefined`.
- Client Firebase imports are dynamic (`await import("firebase/firestore")`).
- Browser-API files need `"use client"`.
- Session fields are prefixed per game (`bt*`, `wk*`, `bf*`, `sk*`, …).
- Max-strict TS + lint: warnings are errors; the pre-commit hook enforces
  `npm run check` (type-check + eslint).
- Mobile-first always: large tap targets, generous padding, readable text.

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/app/games/_gamecore/composeGame.tsx` | The factory |
| `src/app/games/_gamecore/registry/types.ts` | All slot + factory contracts |
| `src/app/games/_gamecore/useGameFlow.ts` | Outer GC0–GC5 phase machine |
| `src/app/games/_gamecore/useEngineDeadline.ts` | Deadline nudge hook |
| `src/app/games/_gamecore/GameColorsProvider.tsx` | CMS color plumbing |
| `src/app/games/_gamecore/AIPlayerManager.ts` | Client AI bridge |
| `src/app/games/_gamecore/aiSkillDice.ts` | Gated-history skill tiers |
| `src/lib/game-sessions.ts` | Sessions, subscribeToSession |
| `functions/src/engine/*` | The server-authority engine |
| `functions/src/games/{slug}/*` | Per-game reducers |
| `firestore.rules` | Security rules |
| `docs/SYSTEM-REVIEW.md` | Prioritized backlog of known issues |

---

## Legacy Paths (know they exist; don't build on them)

- **`useMultiplayerRound` + client `RoundResolver`** — the pre-engine round
  loop. Still mounted by SweepTheLeg/TapSmashArena, but host-side resolution
  is skipped whenever `resolverKey` is set (i.e. always, for these games) —
  the server's `simultaneousMoveAdapter` resolves. Do not use for new games.
- **`pendingMoves`** — the legacy simultaneous-move field consumed by the
  adapter; new games use the namespaced `inbox` instead.
- **Chaptered-video duplication** — TapSmashArena and SweepTheLeg still carry
  ~85%-identical video/round plumbing (`useChapteredVideo` extraction never
  happened; tracked in `SYSTEM-REVIEW.md`).
