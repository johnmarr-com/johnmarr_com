# Server-Authority Engine

> **Status: SHIPPED — this describes the live system.** All seven multiplayer
> games (Boaty, Wordonkulous, Blarf, BluffBox, FYVE, MegaSketchy, Lineup) run
> on the generic engine; SweepTheLeg and TapSmashArena run through the same
> engine via the legacy simultaneous-move adapter. This doc replaces the old
> `GAME-SYNC-RESILIENCE-PLAN.md` (the pilot plan that led here).
>
> Related: [`DATA-ACCESS.md`](./DATA-ACCESS.md) (the site-wide HTTPS/listener
> rule), [`GAME-DEVELOPMENT-GUIDE.md`](./GAME-DEVELOPMENT-GUIDE.md) (how to
> build a game), [`GAMECORE-ARCHITECTURE.md`](./GAMECORE-ARCHITECTURE.md)
> (the client-side factory).

## Why it exists

Before the engine, the **host's device** resolved rounds (`useMultiplayerRound`
ran resolution `if (isHost)`). A host on weak signal — or a wedged iOS WebKit
Firestore stream — stalled the match for everyone. The engine removes that
single point of failure: **the server is the sole authority; clients submit
intents and render snapshots.** No client ever computes or writes game
progression.

## The model in one diagram

```
CLIENT (any device)                    SERVER
───────────────────                    ──────
game UI action
  → POST /api/games/{game}  ──────►  API route (Next, Admin SDK)
      Bearer ID token                  - verifyIdToken, participant gate,
                                         rate limit, validate the action
                                       - write inbox.{channel}.{uid} = {eventId, …}
                                         and/or a secret doc
                                              │  (Firestore doc update)
                                              ▼
                                     gameEngine  (Cloud Function,
                                       onDocumentUpdated gameSessions/{id})
                                       - getReducer(engineKey)
                                       - shouldRun(session)?  cheap gate
                                       - runTransaction:
                                           re-read + re-validate
                                           read secretRefs docs
                                           out = reducer.reduce(ctx)   // pure
                                           apply out.fields + seq+1
                                           apply out.docWrites (same txn)
                                           gameOver → status:"finished"+winner
                                       - after commit: runEffects(out.effects)
                                              │
                                              ▼
render ◄──────── subscribeToSession ── gameSessions/{id} snapshot (seq fenced)
```

## Key files

| Piece | Path |
|---|---|
| Engine trigger | `functions/src/engine/gameEngine.fn.ts` |
| Reducer/StateUpdate types | `functions/src/engine/types.ts` |
| Reducer registry + legacy adapter | `functions/src/engine/registry.ts` |
| Post-commit effects | `functions/src/engine/effects.ts` |
| Deadline sweep | `functions/src/engine/sweepDeadlines.fn.ts` |
| Per-game reducers | `functions/src/games/{game}/{game}.spec.ts` (+ pure `logic.ts`) |
| Legacy hml/rps specs | `functions/src/roundEngine/` (served through the adapter) |
| Registration (side-effect imports) | `functions/src/index.ts` |
| Client session sync | `src/lib/game-sessions.ts` → `subscribeToSession` |
| Client event submit | the per-game API route (see below) |
| Deadline nudge (client) | `src/app/games/_gamecore/useEngineDeadline.ts` + `/api/games/engine-tick` |
| HTTPS session read | `/api/games/session-state` |
| Per-game API routes | `src/app/api/games/{game}/route.ts` |

## The Reducer contract

Each game registers a pure reducer keyed by its `engineKey`
(`registerEngine(key, reducer)` in `functions/src/engine/registry.ts`):

```ts
interface Reducer {
  /** Cheap, allocation-light pre-transaction gate. Pure. */
  shouldRun(s: EngineSession): boolean;
  /** Secret doc paths to read inside the transaction (e.g. hidden boards). */
  secretRefs?(s: EngineSession, sessionId: string): string[];
  /** Pure: the next atomic advance, or null when nothing should change. */
  reduce(ctx: ReduceContext): StateUpdate | null;
}

interface StateUpdate {
  fields: Record<string, unknown>;   // session-doc updates (dot-paths OK)
  docWrites?: DocWrite[];            // other docs, same transaction
  effects?: EngineEffect[];          // post-commit side-effects
  gameOver?: boolean;                // engine sets status:"finished" + winner
  winner?: string | null;
}

interface ReduceContext {
  session: EngineSession;
  sessionId: string;
  now: number;                       // injected for determinism/testability
  secrets: Record<string, Record<string, unknown> | null>;
}
```

Invariants the engine enforces (see the header comment in `gameEngine.fn.ts`):

- **Convergence** — `reduce` returns `null` when there is nothing to advance.
  The engine's own commit re-fires the trigger; a convergent reducer makes
  that re-fire a no-op instead of a self-write loop. (Multi-step AI turns
  deliberately exploit this: each commit re-fires the engine, which takes the
  next AI step until the reducer converges.)
- **`seq` monotonic fence** — every commit does `seq: increment(1)`. The
  transaction re-validates inside, so overlapping trigger fires can't
  double-commit a step. Clients apply snapshots only when `seq` advances.
- **Secrets stay server-side** — hidden state lives in separate collections:
  fully server-only (`fyveKeys`, `bluffSecrets`, `blarfSecret`,
  `lineupSecret`) or own-doc-read-only, write-denied (`boatyBoards`,
  `blarfRoles`, `lineupFacts`). Reducers declare them via `secretRefs` and
  receive them in `ctx.secrets`.

## engineKey vs resolverKey

- **`engineKey`** — the canonical routing key. Stamped on the session at
  creation by `composeGame({ authority: { engineKey } })` →
  `createGameSession`. The engine dispatches `getReducer(engineKey)`.
- **`resolverKey`** — back-compat alias for the two legacy simultaneous-move
  games (`hml` = SweepTheLeg, `rps` = TapSmashArena). `getReducer` wraps their
  old round-resolver specs in `simultaneousMoveAdapter` so they run through
  the same engine. An unknown key harmlessly no-ops.
- A session with **neither** key is ignored by the engine entirely.

## Client → server writes

Clients never write authoritative fields. Two submit paths:

1. **Per-game API route** (`src/app/api/games/{game}/route.ts`) — the norm.
   Verifies the Firebase ID token, checks the caller is a session participant,
   rate-limits per UID, validates the action server-side (e.g. Boaty's
   `validateBoard`), then uses the **Admin SDK** to write an inbox slot
   (`inbox.{channel}.{uid} = { eventId, … }`) and/or a secret doc. That write
   fires the engine.
2. **`submitEvent(sessionId, uid, channel, payload)`**
   (`src/lib/game-sessions.ts`) — a generic client-side inbox write that is
   currently **dead code**: no game calls it, and the engine-session rules
   don't allow client `inbox` writes anyway. All live games submit through
   their API route. (Slated for removal — see `SYSTEM-REVIEW.md`.)

Idempotency: every inbox event carries a client-generated `eventId`, and the
reducer deletes the inbox slot in the same transaction that consumes it. A
retried write lands in the same slot; a replayed trigger sees the slot gone.

## Post-commit effects (where the LLM lives)

`StateUpdate.effects` are dispatched **after** the transaction commits via
`runEffects` (`functions/src/engine/effects.ts`). Handlers register with
`registerEffect(kind, handler)`. Rules:

- Effects **never block or fail a step** — a throwing effect is logged and
  dropped; recovery is the deadline sweep plus idempotent re-issue.
- Effects that change state re-read the session, check it's still relevant
  (phase unchanged, verdict not already written), write via Admin SDK, and
  bump `seq` so clients reconcile.
- **LLM judging** runs here: e.g. MegaSketchy's `megasketchy-judge` /
  `megasketchy-score` effects call Anthropic (`@anthropic-ai/sdk`, Haiku).
  The `ANTHROPIC_API_KEY` secret is bound to the `gameEngine` function.
- **AI opponent turns** in engine games are synthesized **inside the reducer**
  (pure code — e.g. Boaty) or via effects; they never depend on any client
  device being awake.

## Timed phases: deadlines, nudges, sweeps

Reducers stamp `phaseDeadlineAt` (epoch ms) when opening a timed phase. Three
paths make the deadline fire without trusting any single channel:

1. **Client nudge** — `useEngineDeadline` fires `POST /api/games/engine-tick`
   the moment the local clock passes the deadline (with per-client jitter so a
   lobby doesn't stampede). The route just writes a `deadlineTick` field —
   never game state — which fires the engine; the reducer reads `now` and
   decides.
2. **Scheduled sweep** — `sweepDeadlines` runs every minute, queries
   `status == "playing" && phaseDeadlineAt in (0, now]`, and writes the same
   tick. This is the safety net when every participant's device is dark.
3. **Any other write** — since the reducer re-checks deadlines on every fire,
   any inbox event also advances an expired phase.

## Client sync: three-layer netcode

`subscribeToSession` (`src/lib/game-sessions.ts`) is the only way game UIs
read a session. Layers (see the block comment above it):

1. **PUSH** — `onSnapshot` websocket fast-path.
2. **MONOTONIC APPLY-GATE** — track the highest applied `seq`; drop any
   strictly-older mid-game snapshot (rejects stale offline-cache payloads
   after a socket flap). `seq === 0` is the reset shape (startGame /
   Play Again) and always passes.
3. **HTTPS HEARTBEAT** — every 3 s, a plain HTTPS `GET
   /api/games/session-state` (AbortController timeout 4 s). If the poll's
   `seq` is ahead of the push, the stream has wedged: render from the poll
   AND `kickFirestoreConnection()` (`src/lib/firebase.ts`,
   `disableNetwork → enableNetwork`) to rebuild it. Also kicked on
   `visibilitychange` / `online`. Stops when `status === "finished"`.

This is the game-specific application of the site-wide
[`DATA-ACCESS.md`](./DATA-ACCESS.md) rule; it is why iOS devices no longer
freeze matches.

## Firestore rules posture

`firestore.rules` (see `match /gameSessions/{sessionId}`) is regime-aware:

- **Engine sessions** (`engineKey` present): clients may only make
  lobby-shape updates (join/leave/invite fields), plus a **value-checked
  Play-Again reset** — recognized by `seq == 0` in the update, since the
  engine always bumps `seq` mid-game. Authoritative fields (`rounds`,
  `winner`, `currentRound`, `seq`, `transcript`, `status`) are otherwise
  server-only.
- **Legacy sessions** (no `engineKey`): the older field-mask rules apply.
- **Secret collections** (`boatyBoards/*`, `blarfRoles/*`, `fyveKeys/*`, …)
  are locked away from clients; only Admin SDK (API routes + engine) touches
  them.

When adding fields a client must write, extend the value-checked rule — do not
loosen the engine-owned field set.

## Adding a new engine game (summary)

Full walkthrough in [`GAME-DEVELOPMENT-GUIDE.md`](./GAME-DEVELOPMENT-GUIDE.md).

1. Pure logic in `functions/src/games/{game}/logic.ts` + reducer in
   `{game}.spec.ts` calling `registerEngine("{game}", reducer)`.
2. Side-effect import in `functions/src/index.ts`.
3. Client GC3 component + `page.tsx` with
   `composeGame({ authority: { engineKey: "{game}" }, … })`.
4. API route `src/app/api/games/{game}/route.ts` for validated submits.
5. Stamp `phaseDeadlineAt` on every timed phase; mount `useEngineDeadline`.
6. Optional effects (`registerEffect`) for LLM judging.
7. Deploy functions **and** the App Hosting frontend, then **test with a
   freshly created session** (see gotcha below).

## Operational gotchas (learned the hard way)

- **Deploy timing:** sessions created before the App Hosting frontend rollout
  lack `engineKey`, so the engine silently ignores them (no logs) and submits
  400. After deploying a new engine game, always test a **fresh** session.
- **Silent AI degradation:** if the deployed Anthropic key's **org** is out of
  credits, LLM effects/calls fail and games fall back to non-AI text without
  an obvious error. Check Cloud Run / Functions logs and verify which org the
  deployed key belongs to.
- **Both engines must not run:** `gameEngine` fully replaces the old
  `resolveRound` trigger. The hml/rps specs are served through the adapter —
  never re-export a separate trigger for them or rounds double-resolve.
