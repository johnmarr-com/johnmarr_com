# Game Sync Resilience — Pilot Plan (Sweep the Leg + Tap Smash Arena)

Make turn-based play survive weak/flaky mobile networks by moving round
**authority to the server**, delivered as a **reusable game-factory capability**
(a resolver registry + a game-agnostic Cloud Function + a one-line `composeGame`
opt-in) — not a one-off bolted onto two games. This pilot covers the two
chaptered-video 1v1 games, which share one round loop (`useMultiplayerRound`),
and is the template every future game ties into the same way.

## Decisions (locked)

- **Server-authoritative resolution for all modes** (friends *and* AI). The
  server is the sole resolver; clients never compute round outcomes.
- **Best practice for the use case = authoritative server + optimistic local
  feedback + render-from-snapshot.** No client-side prediction: these are
  turn-based simultaneous-reveal games, so the only latency a player feels is
  their own move registering (already instant/local). Predicting the *outcome*
  would add misprediction/rollback complexity for no perceivable gain. (A future
  twitch game could opt into prediction with isomorphic specs; the registry
  design allows it.)
- **Serverless Firestore trigger, not a callable** — fires server-side the moment
  moves complete, even if the triggering client drops; `minInstances: 1` keeps it
  warm so there's no cold-start stall. (A stateful realtime server is the
  standard for high-frequency games, but overkill for turn-based.)
- **Factory-delivered:** generic engine + declarative specs + `composeGame` opt-in.
- **Resilience-only scope:** NOT combined with the `useChapteredVideo` dedup refactor.

---

## The Model

- **Authority** (owns truth, advances state) → **the server** (one generic Cloud
  Function). No client resolves rounds.
- **Authorization** (may issue privileged commands) → the **host** (`ownerId`),
  via server-validated calls. Host buttons are requests; the server checks
  `uid === ownerId`.
- **Clients** render purely from the latest snapshot and keep their *own* move
  optimistic/instant locally. They never depend on having seen every intermediate
  state — `onSnapshot` delivers the current document on reconnect, so a dark phone
  catches up by itself.
- **`seq`** (monotonic counter) guards idempotency/ordering: clients apply side
  effects only when `seq` advances; the server commits only when `seq` is
  unchanged (optimistic concurrency).

### Why this fixes the bug

Today only the **host** resolves (`useMultiplayerRound.ts` — `if (!isHost) return`),
so weak host signal stalls **both** players. An always-online server resolver
removes that single point of failure. The bug bites **friends mode** (2 humans);
**AI mode** is one human whose device also makes the AI move — server resolution
still applies (one path for all modes), and the resilience basics (Phase 3) help
its own writes.

---

## The Reusable Capability (the factory piece)

Mirrors the existing GC variant registry (`registry/registry.ts`), but for round
resolution. **Adding a new game never edits the generic function** — it registers
a spec and flips one `composeGame` flag.

```
functions/src/roundEngine/
  registry.ts          // registerResolver(key, spec) / resolveByKey(key)
  resolveRound.ts       // generic onDocumentUpdated — reads resolverKey, runs spec in a txn
  makeSimultaneousMoveResolver.ts   // helper: build a spec from { sides, beats, scoring, pointsToWin, defaultMove }
  specs/
    rps.ts              // Tap Smash Arena  — one config of the helper
    hml.ts              // Sweep the Leg    — one config of the helper
  index.ts              // imports specs so they self-register
```

A **resolver spec** is a pure function `(pendingMoves, sessionState) => { roundEntry, scores, gameOver, winner }`.
The common "both submit → beats-table → score → first-to-N" shape is built
declaratively via `makeSimultaneousMoveResolver`, so Tap Smash and Sweep are two
configs of one engine (the "skins of one another," expressed as data). A game
with a different shape registers a custom spec function under its own key.

**Game opt-in — one line in the factory config:**
```typescript
composeGame({ slug: "tapsmasharena", round: { resolverKey: "rps" }, ... });
```
This makes `startGame` stamp `resolverKey` on the session and flips the shared
round hook into server-authoritative (render-only) mode.

### Per-game specs (ported verbatim from the current client resolvers)

| | Tap Smash Arena (`rps`) | Sweep the Leg (`hml`) |
|---|---|---|
| Sides | `p1` / `p2` | `red` / `white` |
| Beats | Rock>Scissors, Scissors>Paper, Paper>Rock | H>L, M>H, L>M |
| Default move (missing) | `R` | `H` |
| Normal score | winner +1 | winner +1 |
| Special scoring | none | Red +2 when Red=Low & White=Mid; White +2 when White=Low & Red=High |
| Points to win | 3 | 5 |
| Animation hint | cosmetic variant `1..3` (server picks; must not affect winner) | chapter `${red}-${white}` (derived) |

---

## Phase 1 — Resolver engine + schema (server authority)

**Files:** `functions/src/roundEngine/*` (new), `functions/src/index.ts`, `src/lib/game-sessions.ts`, `firestore.rules`

### New `gameSessions` fields

| Field | Type | Purpose |
|-------|------|---------|
| `seq` | number | Monotonic sync counter. Init `0` at `startGame`; +1 per server resolution. |
| `resolverKey` | string (optional) | Opt-in flag + selects the spec. **Absent = client-resolved (every other game untouched).** Set at `startGame` from `composeGame({ round })`. |
| `roundDeadline` | Timestamp (optional) | When current round's moves are due (Phase 4). |

### Tasks
- [ ] Build `roundEngine/`: registry, `makeSimultaneousMoveResolver`, `rps` + `hml` specs, self-registering index.
- [ ] Generic `resolveRound` `onDocumentUpdated("gameSessions/{id}")`: early-return unless `resolverKey` set; guard (status playing, all moves in, round not yet resolved); resolve via `resolveByKey` inside a `runTransaction` that commits only if `seq` unchanged; append `rounds`, advance `currentRound`, clear `pendingMoves`, write `winner`/`gameOver`, `seq + 1`. `minInstances: 1`.
- [ ] Add `seq` / `resolverKey` / `roundDeadline` to the `GameSession` type; stamp them in `startGame`.
- [ ] Wire `composeGame` `round.resolverKey` → `startGame`; add the two games' `page.tsx` configs.
- [ ] Tighten `firestore.rules` so clients can't write server-owned fields (`rounds`/`winner`/`seq`) on `resolverKey` sessions; still allow a player to write only their own `pendingMoves`.
- [ ] Unit-test specs: all beats/tie outcomes + Sweep's double-point cases + win thresholds.

---

## Phase 2 — Client hook becomes a pure reconciler

**Files:** `src/app/games/_gamecore/useMultiplayerRound.ts`, the two game components

- [ ] When `session.resolverKey` is set, **skip the host resolution effect entirely** (server owns it).
- [ ] **Delete** the now-dead client resolvers (`stlResolver`, `tsaResolver`) and the `RoundResolver` plumbing for these games — single source of truth lives in the specs. (No temporary duplication.)
- [ ] Keep the player's own move **optimistic/instant** locally (preserve `localSubmitted`); only the authoritative *outcome* waits on the server.
- [ ] Track `lastAppliedSeq`; fire `onRoundResolved` / animations only when `seq` advances; re-applying a snapshot is a no-op.
- [ ] **Jump to latest** on reconnect: if multiple rounds behind, fast-forward/skip the chapter animation to the current round. UI correct from the latest snapshot alone.
- [ ] In AI mode, the host writes the AI's move into `pendingMoves` (unchanged generation path) and lets the server resolve — one path for all modes.

---

## Phase 3 — Resilience basics (helps every mode and every game)

**Files:** `src/lib/firebase.ts`, `src/lib/game-sessions.ts`, `src/app/games/_gamecore/sessionHelpers.ts`, game components

- [ ] Enable Firestore offline persistence (`persistentLocalCache` + `persistentMultipleTabManager`) with graceful fallback when storage is blocked. Pending writes survive a blip/suspension and flush on reconnect.
- [ ] Retry-with-backoff on `submitMove` / `updateSessionFields`; stop swallowing errors — expose a "couldn't send, retrying" state.
- [ ] Resume-resync: on `visibilitychange` / `focus` / `online`, force a server `getDoc` and re-attach the listener if stale.
- [ ] Read `snapshot.metadata` (`fromCache` / `hasPendingWrites`) in `subscribeToSession`; surface a "Reconnecting… / Waiting for opponent" banner with manual Retry — never a silent freeze.

---

## Phase 4 — Bounded waits (no infinite stalls)

**Files:** `functions/src/roundEngine/*`, `useMultiplayerRound.ts`

- [ ] Set `roundDeadline` when a round opens.
- [ ] Server auto-resolves on deadline (absent player forfeits / takes default move) so a dark opponent can't wedge the match. Scheduled sweep, or a deadline-check inside the resolver.
- [ ] Optional host command: host-only "skip / advance" → server callable validated against `ownerId`.

---

## Rollout & Verification

- [ ] Wire and test **one** game end-to-end first (pick the one easiest to test on two real phones); confirm the other inherits it via the shared hook with only its `page.tsx` `resolverKey` added.
- [ ] Two-device test matrix (weak signal): airplane-toggle mid-turn; background/lock then resume; **host offline mid-round → round still resolves**; duplicate/late trigger → no double rounds (`seq` guard); throttled network for host and peer.
- [ ] Verify all modes: solo-vs-AI, friends, and friends with one weak-signal player.

---

## Explicitly NOT in this pilot

- `useChapteredVideo` de-duplication (GAMES-IMPROVEMENT-PLAN item 3) — separate change.
- Migrating other games to server authority — they keep their current path and the registry makes opt-in trivial later. Phase 3 resilience basics benefit them for free.
- Client-side prediction — not warranted for turn-based reveal; revisit only for a future twitch game.
