# Games Architecture — Improvement Plan

Tracked issues from a full audit of `src/app/games/` and supporting modules.
Work each item in order. Check the box and note the date when done.

---

## 1. Secure the AI API route

**Priority:** Critical — real cost exposure  
**Files:** `src/app/api/games/ai/route.ts`

The `/api/games/ai` endpoint accepts arbitrary prompts with no authentication
or rate limiting. Anyone can call it directly and burn Anthropic/Replicate credits.

### Tasks
- [x] Verify the caller's Firebase ID token (`Authorization: Bearer <token>`) and reject unauthenticated requests with 401.
- [x] Add basic rate limiting (e.g. per-UID request cap via an in-memory map or Firestore counter).
- [x] Return proper error responses instead of silent `{ text: "" }` on failures.

---

## 2. ~~Eliminate the double-fire AI pattern~~ — INTENTIONAL

**Status:** Not a bug — deliberate latency optimisation.

The dual `Promise.any` pattern fires 2 requests and takes the first successful
response. With Haiku-level pricing the cost is negligible, and it avoids slow
timeout → retry loops that would stall gameplay. Now improved: if both calls in
a pair fail, the pair is retried once before falling back.

---

## 3. Extract shared "chaptered video game" abstraction

**Priority:** High — largest source of duplication  
**Files:**  
- `src/app/games/tapsmasharena/TapSmashArenaGame.tsx`  
- `src/app/games/sweeptheleg/SweepTheLegGame.tsx`  
- New: `src/app/games/_gamecore/useChapteredVideo.ts` (or similar)

Tap Smash Arena and Sweep the Leg are ~85% structurally identical. Duplicated
concerns include the RAF video loop, chapter playback, visibility handling,
multiplayer auto-start/restart detection, AI prefetch pattern, transcript
overlay, finished overlay, and phrase arrays.

### Tasks
- [ ] Create a `useChapteredVideo` hook in `_gamecore` that owns:
  - Video ref + RAF tick loop + chapter start/end enforcement
  - `playChapter(name, opts)` with freeze / loop / onEnd
  - Visibility change pause/resume
- [ ] Create a `useVideoGameRound` hook (or extend `useMultiplayerRound`) that owns:
  - Multiplayer auto-start + restart detection (`mpStartedRef`, `mpRoundsLenRef`, etc.)
  - AI move prefetch lifecycle (`prefetchRef`, `fetchAiMove`)
  - Post-game comment + `recordAIGameResult` flow
- [ ] Extract shared UI into small components:
  - `GameFinishedOverlay` (end message, play again, transcript button)
  - `GameTranscriptOverlay` (round-by-round log + AI reasoning)
  - Move `WIN_PHRASES`, `AI_WIN_PHRASES`, `AI_LOSE_PHRASES`, `pickRandom` to a shared util
- [ ] Refactor `TapSmashArenaGame` to use the new hooks and components.
- [ ] Refactor `SweepTheLegGame` to use the new hooks and components.
- [ ] Verify both games work identically after refactor (solo, vs AI, friends).

---

## 4. Fix the `joinGameSession` race condition

**Priority:** Medium — can exceed maxPlayers under concurrent joins  
**Files:** `src/lib/game-sessions.ts`

`joinGameSession` and `joinGameSessionById` both read-then-write without a
transaction. Two players joining at the same moment can both pass the capacity
check and both get added.

### Tasks
- [ ] Wrap the join logic in `runTransaction` (same pattern used by `addAIPlayerToSession`).
- [ ] Apply the same fix to `joinGameSessionById`.
- [ ] Verify joining still works: normal join, join when full, AI-replacement join.

---

## 5. Extract shared PlayerRow component in GameMultiplayerFlow

**Priority:** Medium — moderate duplication  
**Files:** `src/app/games/_gamecore/GameMultiplayerFlow.tsx`

The host lobby player list and the joined-player lobby list render nearly
identical avatar + gamertag + badge rows. Two copies to maintain.

### Tasks
- [ ] Extract a `LobbyPlayerRow` component (avatar, gamertag, host/AI/you badges, optional remove button).
- [ ] Use it in both the host lobby and the joined lobby sections.

---

## 6. Add error handling to Start Game and other unhandled async actions

**Priority:** Medium — silent failures break the flow  
**Files:** `src/app/games/_gamecore/GameMultiplayerFlow.tsx`, game components

The Start Game button's async `onClick` has no try/catch. Similar patterns exist
in a few other places.

### Tasks
- [ ] Wrap the Start Game handler in try/catch and surface errors via the existing `error` state.
- [ ] Audit other async click handlers in `GameMultiplayerFlow` for the same issue.
- [ ] Consider surfacing AI failures to the user (e.g. "AI couldn't respond, using random move") instead of silently falling back.

---

## 7. Remove or use GameState / GameEngine

**Priority:** Low — dead code  
**Files:**  
- `src/app/games/_gamecore/GameState.ts`  
- `src/app/games/_gamecore/GameEngine.ts`  
- `src/app/games/_gamecore/index.ts`

These classes are exported but unused by all three games. Either integrate them
into the chaptered video abstraction (item 3) or remove them.

### Tasks
- [ ] Decide: useful for future games or dead weight?
- [ ] If keeping, document intended usage and integrate into at least one game.
- [ ] If removing, delete the files and remove exports from `index.ts`.

---

## 8. Add session / invite code cleanup

**Priority:** Low — long-term hygiene  
**Files:** Firestore configuration or a new scheduled function

Abandoned `gameSessions` and `inviteCodes` docs accumulate forever. No TTL or
cleanup exists.

### Tasks
- [ ] Add a `cleanupAt` or `expiresAt` timestamp to sessions on creation.
- [ ] Implement a scheduled Cloud Function (or Firestore TTL policy) to delete expired sessions and their invite codes.
- [ ] Alternatively, add a TTL index if using Firestore's native TTL feature.

---

## Notes

- Work items are ordered by priority (critical → low).
- Items 1–2 are quick, high-impact wins. Item 3 is the largest refactor.
- After item 3, adding a new chaptered-video game should take a fraction of the
  current effort.
- Firestore security rules should be audited separately to ensure client-side
  writes are properly constrained.
