# GameCore Architecture

## Overview

GameCore (`_gamecore`) is the shared engine that powers Spectavo games. Every game follows the same 6-phase flow, with only **Phase 3 (the game board)** being custom per game. Everything else is assembled from a registry of swappable prefab components.

**The promise:** New games only build the game board. Everything else snaps in via `composeGame()`.

---

## Phase Flow

```
GC0         GC1        GC2          GC3         GC4          GC5
Landing  →  Gate   →   Lobby    →   GAME    →   Result   →   Replay
(splash)    (host/     (config,     (custom)    (winners,     (reset,
             join)      players)                 scores)      rematch)
                                                    ↓
                                                  EXIT
```

---

## How It Works

### The Assembly Model

Each phase slot (GC0-GC5) has a **registry of available variants** — different implementations that can be swapped per game. A game's assembly config (stored on its CMS document) declares which variant to use per slot. `composeGame()` reads that config and wires the selected variants together at runtime.

```
Admin Portal — Game Assembly Editor
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│   GC0    │   GC1    │   GC2    │   GC3    │   GC4    │   GC5    │
│ Landing  │  Gate    │  Lobby   │  GAME    │  Result  │  Replay  │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ ▼ Pick   │ ▼ Pick   │ ▼ Pick   │ (custom) │ ▼ Pick   │ ▼ Pick   │
│ variant  │ variant  │ variant  │ per game │ variant  │ variant  │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
                         ↓ stored as ↓
              assembly config on JMContent doc
                         ↓ consumed by ↓
                    composeGame(config)
```

GC3 is never in the assembly config — it's the custom `GameComponent` passed to `composeGame()` in code.

### Assembly Config

Stored as an `assembly` field on the game's JMContent document in Firestore:

```typescript
assembly?: {
  gc0: { variantId: string };   // e.g. "splash-cinematic"
  gc1: { variantId: string };   // e.g. "gate-modal"
  gc2: { variantId: string };   // e.g. "lobby-party-packs"
  gc4: { variantId: string };   // e.g. "result-leaderboard"
  gc5: { variantId: string };   // e.g. "replay-standard"
}
```

If a game has no assembly config, the default variants are used automatically.

---

## Current Variants

| Slot | Variant ID | Behavior |
|------|-----------|----------|
| **GC0** | `splash-cinematic` | Full-bleed bg, floating logo, music, "Play" button. Wraps GameLandingPage. |
| **GC1** | `gate-modal` | Dialog: Solo / Host / Join. Creates session on "Host", code input on "Join". |
| **GC2** | `lobby-party-packs` | Party lobby: invite code, player list, AI invites, lobbyExtra slot for pack picker. |
| **GC4** | `result-leaderboard` | Winner card(s) via JMWinnerLoserCard, ranked leaderboard, confetti. Colors from CMS. |
| **GC5** | `replay-standard` | Host-only "Play Again" trigger. Resets session fields, re-enters game. |

More variants can be built over time (video splash, team lobby, bracket result, etc.) and they appear in the admin assembly editor automatically.

---

## Slot Interfaces

### GC3: Game (the only custom part)

```typescript
interface GC3Props {
  sessionId: string;
  gameData: JMContent;
  onGameEnd: (result: GameEndResult) => void;
}

interface GameEndResult {
  winners: GameSessionPlayer[];
  winnerPoints: number;
  allPlayers: GameSessionPlayer[];
  scores: Record<string, number>;
}
```

When the game board determines a winner, it calls `onGameEnd(result)` and the factory transitions to GC4.

### Other Slots (for building new variants)

```typescript
// GC0: Landing
interface GC0Props {
  gameData: JMContent;
  onPlay: () => void;
  onSoloPlay?: () => void;
  onSoloVsAI?: (persona: AIPersona) => void;
}

// GC1: Gate
interface GC1Props {
  gameData: JMContent;
  onHost: (sessionId: string) => void;
  onJoin: (sessionId: string) => void;
  onSolo?: () => void;
  onSoloVsAI?: (persona: AIPersona) => void;
}

// GC2: Lobby
interface GC2Props {
  gameData: JMContent;
  session: GameSession;
  isHost: boolean;
  lobbyExtra?: ReactNode | ((ctx: { session: GameSession }) => ReactNode);
  lobbyCanStart?: (ctx: { session: GameSession }) => boolean;
  onGameStart: (sessionId: string) => void;
}

// GC4: Result
interface GC4Props {
  gameData: JMContent;
  session: GameSession;
  result: GameEndResult;
  isHost: boolean;
  onPlayAgain: () => void;
  onExit: () => void;
}

// GC5: Replay
interface GC5Props {
  gameData: JMContent;
  session: GameSession;
  isHost: boolean;
  lobbyExtra?: ReactNode | ((ctx: { session: GameSession }) => ReactNode);
  onRestart: (sessionId: string) => void;
  onExit: () => void;
}
```

---

## Folder Structure (Actual)

```
src/app/games/
├── _gamecore/
│   ├── registry/
│   │   ├── types.ts              # All slot interfaces, GameAssembly, ComposeGameInput
│   │   ├── registry.ts           # Variant registry: register, resolve, list
│   │   ├── variants/
│   │   │   ├── gc0-splash-cinematic.tsx
│   │   │   ├── gc1-gate-modal.tsx
│   │   │   ├── gc2-lobby-party-packs.tsx
│   │   │   ├── gc4-result-leaderboard.tsx
│   │   │   └── gc5-replay-standard.tsx
│   │   └── index.ts              # Barrel + auto-registration
│   ├── useGameFlow.ts            # Outer phase state machine hook
│   ├── composeGame.tsx           # The factory function
│   ├── GameLandingPage.tsx       # Shared splash + dialog (used by GC0/GC1/GC2 variants)
│   ├── GameMultiplayerFlow.tsx   # Shared host/join/lobby flow
│   ├── sessionHelpers.ts         # Firestore session update helpers
│   └── index.ts                  # Public exports
│
├── blarf/                        # ← Uses composeGame
│   ├── page.tsx                  # ~46 lines — composeGame config
│   ├── BlarfGame.tsx             # GC3 custom game board
│   ├── BlarfPackLobbySelector.tsx # Passed as lobbyExtra
│   ├── screens/                  # GC3 internal sub-screens
│   └── useBlarfSession.ts        # GC3 internal state
│
├── wordonkulous/                 # ← Uses composeGame
│   ├── page.tsx                  # ~44 lines — composeGame config
│   ├── WordonkulousGame.tsx      # GC3 custom game board
│   └── ...
│
├── bluffbox/                     # ← Legacy pattern (not migrated)
├── fyve/                         # ← Legacy pattern
├── megasketchy/                  # ← Legacy pattern
├── sweeptheleg/                  # ← Legacy pattern
└── tapsmasharena/                # ← Legacy pattern
```

---

## Creating a New Game

### What You Need to Decide (Game Design)

Before any code, the game concept needs these answers:

| Question | Why It Matters | Example (Blarf) |
|----------|---------------|-----------------|
| **Game name + slug** | URL, Firestore collection, branding | "BLARF!", slug: `blarf` |
| **Player count** | min/max, affects lobby and AI logic | 3-12 players |
| **Content packs?** | If yes, needs a pack picker (lobbyExtra) | Yes — prompt packs |
| **Round structure?** | Single game or multi-round? Game length options? | Multi-round: Quick/Standard/Long |
| **Game phases** | The internal screens/steps of gameplay | Role reveal → Speaking → Voting → Scores |
| **Scoring model** | Points per round? Cumulative? Winner-take-all? | Points for correct votes + fooling others |
| **AI players?** | Can AI fill empty seats? What's their behavior? | No (Wordonkulous: yes) |
| **Real-time or turn-based?** | Firestore write patterns, timer needs | Turn-based with timers |
| **Win condition** | How is the winner determined? | Most points after N rounds |
| **Session fields** | What Firestore fields does the game need? | Phase, assignments, votes, scores, etc. |
| **Visual identity** | Primary/secondary colors, splash art concept | Blue/gold, spy theme |

### What the Ideating AI Should Produce

If you're using an AI to help design the game, have it output a spec that includes:

1. **Game concept** — 2-3 sentence pitch
2. **Player experience flow** — what each player sees/does at each step, from the player's perspective
3. **Phase list** — the internal GC3 phases (these become your game's state machine)
4. **Firestore session fields** — every field the game reads/writes, with types and initial values
5. **Scoring rules** — exact formula, who gets points for what
6. **Timer behavior** — which phases are timed, durations, what happens on timeout
7. **AI player behavior** (if applicable) — decision logic per phase
8. **Pack/content structure** (if applicable) — what a pack contains, schema
9. **Edge cases** — what happens when a player disconnects, when everyone votes the same way, etc.

The spec does NOT need to describe: splash screens, host/join flow, lobby UI, winner screens, play-again behavior, or any flow outside the game board. The factory handles all of that.

### Step 1: Create CMS Content

In the admin portal, create a new Game content entry with:
- Name, slug, description, subtitle
- Splash background, logo, and icon images
- Primary and secondary colors (used by the shared result screen)
- Min/max players
- The assembly config (use the Game Assembly editor — defaults work for most games)

### Step 2: Create the Game Folder

```
src/app/games/yourgame/
├── page.tsx                    # Factory config (~40 lines)
├── YourGame.tsx                # GC3 game board (the big one)
├── screens/                    # Internal sub-screens
│   ├── SetupScreen.tsx
│   ├── PlayScreen.tsx
│   └── ScoreRevealScreen.tsx
├── useYourGameSession.ts       # Firestore subscription + derived state
├── yourGameTypes.ts            # Type definitions
└── YourGamePackPicker.tsx      # Only if your game has content packs
```

### Step 3: Write `page.tsx`

This is the only file that touches the factory. Everything else is your custom game code.

```typescript
"use client";

import { composeGame } from "../_gamecore";
import YourGame from "./YourGame";
import YourPackPicker from "./YourPackPicker";  // only if needed
import type { GC3Props } from "../_gamecore/registry/types";

function YourGameAdapter({ sessionId, gameData, onGameEnd }: GC3Props) {
  return (
    <YourGame
      sessionId={sessionId}
      gameData={gameData}
      onGameEnd={onGameEnd}
      // Pass any CMS fields your game board needs:
      {...(gameData.splashBgURL ? { splashBgURL: gameData.splashBgURL } : {})}
      gameLogoURL={gameData.splashLogoURL ?? gameData.coverURL}
    />
  );
}

export default composeGame({
  slug: "yourgame",
  GameComponent: YourGameAdapter,

  // Optional: AI players allowed
  allowAI: true,

  // Optional: pack picker in lobby
  lobbyExtra: ({ session }) => <YourPackPicker sessionId={session.id} />,

  // Optional: block "Start Game" until a condition is met
  lobbyCanStart: ({ session }) =>
    !!(session as unknown as Record<string, unknown>)["ygLobbyPackId"],

  // Required: fields to reset when "Play Again" is triggered
  resetFields: () => ({
    ygPhase: "setup",
    ygCurrentRound: 1,
    ygScores: {},
    ygWinners: [],
    ygWinnerPoints: 0,
    // ... all your game's session fields at their initial values
  }),
});
```

### Step 4: Build the Game Board (GC3)

Your game component receives `GC3Props`:

```typescript
interface GC3Props {
  sessionId: string;           // Firestore session document ID
  gameData: JMContent;         // CMS content (colors, images, settings)
  onGameEnd: (result: GameEndResult) => void;  // Call this when the game is over
}
```

The game board is fully custom. Use `useYourGameSession(sessionId)` to subscribe to Firestore, manage internal phases, render screens. When a winner is determined:

```typescript
onGameEnd({
  winners: winningPlayers,      // GameSessionPlayer[]
  winnerPoints: topScore,       // number
  allPlayers: allSessionPlayers,// GameSessionPlayer[]
  scores: scoreRecord,          // Record<string, number> (keyed by odisplayName)
});
```

This transitions the outer flow to GC4 (result screen) automatically.

### Step 5: Done

The factory handles:
- Splash screen with background, logo, music (GC0)
- Host/Join dialog (GC1)
- Lobby with player list, invite code, AI invites, your pack picker (GC2)
- Winner cards, leaderboard, confetti, themed to your CMS colors (GC4)
- Play Again reset (GC5)

You wrote zero lines of code for any of those.

---

## Conventions

### Session Field Prefixes

Each game prefixes its Firestore session fields to avoid collisions:

| Game | Prefix | Example |
|------|--------|---------|
| Blarf | `bf` | `bfPhase`, `bfScores`, `bfVotes` |
| Wordonkulous | `wk` | `wkPhase`, `wkScores`, `wkDefinitions` |
| Your Game | `yg` | Pick a 2-3 letter prefix unique to your game |

### Internal Phase State Machine

Games manage their own phase internally (not the outer GC0-GC5 flow). A typical pattern:

```typescript
type YourGamePhase = "setup" | "play" | "voting" | "scores" | "final";
```

The `"final"` phase (or equivalent) is where you call `onGameEnd()`. The game can still render a brief score reveal before calling it — the transition to GC4 only happens when `onGameEnd` fires.

### Shared Utilities

Available from `_gamecore` and `JMKit`:

- `JMWinnerLoserCard` — winner presentation card with avatar, confetti
- `JMConfettiOverlay` — full-screen confetti animation
- `JMAvatarView` — player avatar rendering
- `updateSessionFields(sessionId, fields)` — batch Firestore update
- `subscribeToSession(sessionId, callback)` — real-time session listener

---

## The 5 Legacy Games

BluffBox, FYVE, MegaSketchy, SweepTheLeg, and TapSmashArena use the older pattern (importing GameLandingPage and GameMultiplayerFlow directly). They work fine and don't need migration. Over time, as new variants are built, they can opt in.

---

## The Rule

> **New games only build GC3.**
>
> Everything before (GC0-GC2) and after (GC4-GC5) is automatic.
>
> If you're writing splash screens, host/join dialogs, lobby layouts, or winner screens in a game folder, something is wrong.
