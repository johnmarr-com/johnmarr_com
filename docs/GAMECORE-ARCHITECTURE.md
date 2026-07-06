# GameCore Architecture (the client-side game factory)

## Overview

GameCore (`src/app/games/_gamecore`) is the shared client framework that
powers every game page. Every game follows the same 6-phase flow, with only
**Phase 3 (the game board)** being custom per game. Everything else is
assembled from a registry of swappable prefab components.

**The promise:** New games only build the game board. Everything else snaps
in via `composeGame()`.

The server half — who owns game state — is documented in
[`SERVER-AUTHORITY-ENGINE.md`](./SERVER-AUTHORITY-ENGINE.md). The end-to-end
how-to is [`GAME-DEVELOPMENT-GUIDE.md`](./GAME-DEVELOPMENT-GUIDE.md).

---

## Phase Flow

```
GC0         GC1        GC2          GC3         GC4          GC5
Landing  →  Gate   →   Lobby    →   GAME    →   Result   →   Replay
(splash)    (host/     (invite +    (custom)    (winners,     (reset,
             join)      Start)                   scores)      rematch)
                                                    ↓
                                                  EXIT
```

**Lobby/settings separation (locked decision):** GC2 is invite + Start only.
Pack, round-count, and other configuration happen AFTER Start, inside the
game's own setup phase and the Play-Again (GC5) picker.

---

## The Assembly Model

Each phase slot (GC0–GC5 except GC3) has a **registry of variants** —
implementations that can be swapped per game. A game's assembly config
(stored on its CMS document) declares which variant to use per slot;
`composeGame()` reads it and wires the selected variants at runtime.

- Registry: `registry/registry.ts` (`registerVariant` / `resolveVariant` /
  `listVariants`). Variants self-register at import time.
- Assembly config: the `assembly` field on the game's JMContent doc, edited
  with the admin **Game Assembly editor** (`GameAssemblyEditor`). Missing
  config → `DEFAULT_ASSEMBLY` in `composeGame.tsx`.
- GC3 is never in the assembly config — it's the `GameComponent` passed to
  `composeGame()` in code.

### Current variants

| Slot | Variant ID | Behavior |
|------|-----------|----------|
| **GC0** | `splash-cinematic` | Full-bleed bg, floating logo, music, "Play". Wraps `GameLandingPage`. |
| **GC1** | `gate-modal` | Dialog: Solo / Host / Join. Creates session on Host; code input on Join. |
| **GC2** | `lobby-party-packs` | Party lobby: invite code + QR, player list, AI invites, `lobbyExtra` slot. |
| **GC4** | `result-leaderboard` | Winner card(s), ranked leaderboard, confetti. Colors from CMS; honors `GC4ResultOptions`. |
| **GC5** | `replay-standard` | Host-only "Play Again". Applies `resetFields`, re-enters game. |

New variants (video splash, team lobby, bracket result, …) appear in the
admin assembly editor automatically once registered.

> Note: GC0–GC2 currently delegate to the shared `GameLandingPage` +
> `GameMultiplayerFlow` implementations under the hood; the variant layer is
> where alternatives will slot in.

---

## Slot Contracts

All interfaces live in `registry/types.ts` — that file is the source of
truth. Summary:

- **GC3 (the custom part):** `GC3Props { sessionId, gameData, onGameEnd }`.
  When the session shows a winner, call
  `onGameEnd({ winners, winnerPoints, allPlayers, scores })` → factory
  transitions to GC4.
- **GC0/GC1/GC2/GC4/GC5:** see `GC0Props`…`GC5Props` in `registry/types.ts`.
  GC4 accepts per-game `GC4ResultOptions` (`hideScores`, `playMusic`,
  `showAIPostGameComments`, `sideColors`, `logoRight`).
- **`ComposeGameInput`** — the full factory config: `slug`,
  `contentSlugFromQueryParam` (skinnable engines), `GameComponent`,
  `lobbyExtra`, `landingExtra`, `lobbyCanStart`, `resetFields` (required),
  `allowAI`, `pulseIcon`/`rockIcon`, `multiplayerFlowMode`
  (`"versus" | "party"`), `sideLabels`, `resultOptions`,
  `authority: { engineKey }` (server-authority opt-in — use for all new
  games), `round: { resolverKey }` (legacy hml/rps only).

---

## Folder Structure

```
src/app/games/
├── _gamecore/
│   ├── registry/
│   │   ├── types.ts              # All slot interfaces, GameAssembly, ComposeGameInput
│   │   ├── registry.ts           # Variant registry
│   │   ├── variants/             # gc0-…, gc1-…, gc2-…, gc4-…, gc5-…
│   │   └── index.ts              # Barrel + auto-registration
│   ├── composeGame.tsx           # The factory function
│   ├── useGameFlow.ts            # Outer phase state machine
│   ├── GameLandingPage.tsx       # Shared splash (used by GC0/GC1/GC2)
│   ├── GameMultiplayerFlow.tsx   # Shared host/join/lobby flow
│   ├── GameColorsProvider.tsx    # CMS color context (+ toPickerColors)
│   ├── useEngineDeadline.ts      # Timed-phase nudge → /api/games/engine-tick
│   ├── sessionHelpers.ts         # Firestore session update helpers
│   ├── AIPlayerManager.ts        # Client AI bridge (simpleMove, postGameComment)
│   ├── aiPersonas.ts / aiSkillDice.ts / aiPostGameComments.ts
│   ├── useMultiplayerRound.ts    # LEGACY round loop (hml/rps render-only)
│   └── index.ts                  # Public exports
│
├── boaty/ wordonkulous/ blarf/ bluffbox/ fyve/ megasketchy/ lineup/
│   │                             # ← engine-authority games (composeGame + engineKey)
│   ├── page.tsx                  # ~40 lines — composeGame config
│   ├── {Name}Game.tsx            # GC3 custom board
│   ├── screens/                  # GC3 internal sub-screens
│   ├── use{Name}Session.ts       # subscribeToSession + derived state
│   ├── {name}Api.ts              # client for /api/games/{name}
│   └── {Name}PackPicker.tsx      # only if the game has content packs
│
├── sweeptheleg/ tapsmasharena/   # ← legacy chaptered-video 1v1 (resolverKey)
└── fast_casual_trivia/           # ← parked (see fast-casual-trivia-STATUS.md)
```

---

## Conventions

### Session field prefixes

Each game prefixes its Firestore session fields to avoid collisions:
`bt*` (Boaty), `wk*` (Wordonkulous), `bf*` (Blarf), `bb*` (BluffBox),
`sv*` (FYVE), `sk*` (MegaSketchy), `lu*` (Lineup). New game → pick a unique
2–3 letter prefix.

### Internal phase state machine

Games manage their own GC3 phases (not the outer GC0–GC5 flow):

```typescript
type YourGamePhase = "setup" | "play" | "voting" | "scores" | "final";
```

On the engine, the **reducer** owns phase transitions; the client renders
whatever phase the snapshot says. The `"final"` phase is where GC3 calls
`onGameEnd()`.

### Colors

All game/picker colors are CMS-driven via `GameColorsProvider` /
`useGameColors()` / `toPickerColors()`. Never hard-code a game color.

### Shared utilities

From `_gamecore` and `JMKit`: `JMWinnerLoserCard`, `JMConfettiOverlay`,
`JMAvatarView`, `PhaseTimerBar`, `updateSessionFields(sessionId, fields)`,
`subscribeToSession(sessionId, cb)` (seq-fenced + HTTPS heartbeat — always
use this, never a bare `onSnapshot`).

---

## The Rule

> **New games only build GC3** — plus their server reducer and API route.
>
> Everything before (GC0–GC2) and after (GC4–GC5) is automatic.
>
> If you're writing splash screens, host/join dialogs, lobby layouts, winner
> screens, or client-side round resolution in a game folder, something is
> wrong.
