> **HISTORICAL DESIGN SPEC.** Kept for game-design rationale (rules, scoring,
> phases). Implementation details here predate the server-authority engine —
> the code plus [`GAME-DEVELOPMENT-GUIDE.md`](./GAME-DEVELOPMENT-GUIDE.md) and
> [`SERVER-AUTHORITY-ENGINE.md`](./SERVER-AUTHORITY-ENGINE.md) are canonical
> for how this game is built today.

# BOATY McBOATFACE — Build Spec for Claude/Cursor

## Overview

Boaty McBoatFace is a 2-player (or 1v AI) swamp Battleship game. Hide your bootleg distillery rafts, throw molotov cocktails, sink the competition.

**Tagline:** Sink the Competition

**Location:** `/games/boaty/`

**Image Assets:** `/public/images/games/boaty/` (placeholders for now)

---

## Game Flow

```
GC0_Landing → GC1_Gate → GC2_Lobby → GC2_Epic → SETUP → PLAY → GC4_Result
                                                  ↑              ↓
                                                  └── GC5_Replay ┘
```

**This spec covers only:** SETUP and PLAY phases (GC3_Game)

Everything else is handled by GameCore components.

---

## Grid Specifications

| Property | Value |
|----------|-------|
| Grid size | 5×5 (25 squares) |
| Raft coverage | 9 squares (36%) |
| Grid margins | Nice spacing between squares |
| Coordinate labels | None needed (auto-communicated) |

---

## Layout

```
┌─────────────────────────────────────────────────┐
│  ┌──────┐                          ┌──────┐    │
│  │  P1  │                          │  P2  │    │
│  │Avatar│                          │Avatar│    │
│  └──────┘                          └──────┘    │
│  PlayerName                        PlayerName  │
│  (left-aligned)                (right-aligned) │
│                                                 │
│            ┌─────────────────┐                 │
│            │   "MY SWAMP"    │  ← Banner       │
│            │    (yellow)     │    3:1 ratio    │
│            └────────┬────────┘    overlaps     │
│         ┌───┬───┬───┬───┬───┐                  │
│         │   │   │   │   │   │                  │
│         ├───┼───┼───┼───┼───┤                  │
│         │   │   │   │   │   │                  │
│         ├───┼───┼───┼───┼───┤  ← Swamp Grid   │
│         │   │   │   │   │   │    (gray bg)     │
│         ├───┼───┼───┼───┼───┤                  │
│         │   │   │   │   │   │                  │
│         ├───┼───┼───┼───┼───┤                  │
│         │   │   │   │   │   │                  │
│         └───┴───┴───┴───┴───┘                  │
│                                                 │
│              [ DONE ]  ← Setup only            │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Phase 1: SETUP

### What Players See

- Banner: "MY SWAMP" (3:1 ratio, yellow bg placeholder, centered, overlaps top edge of grid)
- Swamp grid: 5×5 (gray bg placeholder)
- 3 rafts: pre-placed randomly, can be moved/rotated
- 1 gator: moving around autonomously
- "DONE" button: locks in placement

### Rafts

| Raft | Shape | Squares | Aspect Ratio | Placeholder Color |
|------|-------|---------|--------------|-------------------|
| Square Still | ⬛⬛<br>⬛⬛ | 4 | 1:1 | Purple |
| L-Shape | ⬛<br>⬛⬛ | 3 | Variable | Purple |
| Shorty | ⬛⬛ | 2 | 2:1 or 1:2 | Purple |

### Raft Placement Rules

1. **Initial state:** All 3 rafts randomly placed and rotated on grid
2. **Drag to move:** Touch and drag raft to new position
3. **Overlap not allowed:** If dropped on another raft, snap back to origin
4. **Selection:** Tapped raft shows outer glow
5. **Rotate button:** Appears below selected raft (except Square Still)
6. **Rotation logic:**
   - Tap rotate → 90° clockwise
   - If blocked by another raft → try another 90°
   - Repeat until valid position or return to original rotation

### Square Still (2×2)

- No rotate button (rotation doesn't change footprint)
- Drag only

### L-Shape (3 squares)

```
Rotations:
   ⬛        ⬛⬛      ⬛⬛        ⬛
   ⬛⬛        ⬛      ⬛          ⬛⬛
```

### Shorty (2 squares)

```
Rotations:
   ⬛⬛     ⬛
           ⬛
```

### Pet Gator

- Placeholder: Green square
- Moves 1 square at a time (N, S, E, or W — random)
- **SETUP:** Moves on timed interval (~1.5 sec) — ambient swamp life
- **PLAY:** Moves once after each incoming attack resolves
- Cannot overlap rafts — moves out of the way if raft placed on it
- If cornered, stays put until path opens

```typescript
function moveGator(pos: Position, board: Board): Position {
  const directions = ['N', 'S', 'E', 'W'];
  const shuffled = shuffle(directions);
  
  for (const dir of shuffled) {
    const newPos = applyDirection(pos, dir);
    if (inBounds(newPos) && !hasRaft(newPos, board)) {
      return newPos;
    }
  }
  return pos; // Stay put if trapped
}
```

### Done Button

- Both players must press "DONE"
- When both ready → transition to PLAY phase
- Show waiting state if one player ready

---

## Phase 2: PLAY

### Core Loop

1. Current player's view flips from "MY SWAMP" to "THEIR SWAMP"
2. Player taps square to throw molotov
3. Result resolves (miss / hit raft / hit gator)
4. **Opponent's gator moves one square** (they see it)
5. If game not over → turn passes
6. Opponent's view flips to "THEIR SWAMP"
7. Repeat until winner

### View Flipping

| Your Turn | Opponent's Turn |
|-----------|-----------------|
| See "THEIR SWAMP" (enemy grid) | See "MY SWAMP" (your grid) |
| Tap to attack | Watch incoming attack |
| Throw from RIGHT side | Receive from LEFT side |

### "THEIR SWAMP" View (Attacking)

- Empty swamp grid
- Shows accumulated hit markers:
  - 💧 Blue ripple = miss (water)
  - 🔥 Red flames = hit (raft)
  - (No marker for gator hits — that's the catch)
- Tap empty square to throw molotov

### "MY SWAMP" View (Defending)

- Your rafts visible
- Your gator visible (moving)
- Accumulated damage:
  - Ripples on missed squares
  - Flames on hit raft squares
- Watch incoming molotov land

### Molotov Animation

**Throwing (your attack):**
- Animated sprite enters from OFF-SCREEN LEFT
- Arcs across screen (large → small as it "travels")
- Lands on selected grid square
- Placeholder: Orange square

**Receiving (their attack):**
- Animated sprite enters from OFF-SCREEN LEFT
- Same arc animation
- Lands on target square
- You watch the result on your board

### Hit Results

#### MISS (Hit Water)

```typescript
{
  result: 'miss',
  sound: 'bubbling_water.mp3',
  visual: 'ripple_sprite', // Loops forever
  marker: true,            // Leave blue ripple marker
  turnEnds: true
}
```
- Placeholder: Blue background
- Permanent ripple marker stays on grid

#### HIT RAFT

```typescript
{
  result: 'hit',
  sound: 'explosion.mp3',
  visual: 'flames_sprite', // Loops forever
  marker: true,            // Leave red flames marker
  turnEnds: true,
  checkWin: true           // Check if all 9 squares hit
}
```
- Placeholder: Red background
- Permanent flames marker stays on grid
- Check win condition after each raft hit

#### HIT GATOR

```typescript
{
  result: 'gator',
  sound: randomPick(gatorSounds), // Array of voice lines
  visual: 'dazed_gator_sprite',   // Shows briefly
  marker: false,                   // NO MARKER LEFT
  turnEnds: false,                 // FREE TURN
  popup: "YOU HIT THEIR GATOR! Go again!"
}
```
- Placeholder: Green background (briefly)
- Dazed gator appears, then fades
- **NO RIPPLE LEFT** — square returns to normal
- Player gets popup notification
- Player gets another turn
- Gator resumes moving from that position

**Gator Sound Array (placeholder IDs):**
```typescript
const gatorSounds = [
  'gator_screech_1.mp3',
  'gator_screech_2.mp3',
  'hey_my_gator.mp3',
  'stop_that_gator.mp3',
  'leave_my_gator_alone.mp3'
];
```

### Win Condition

- All 9 raft squares hit (4 + 3 + 2)
- Immediately transition to GC4_Result
- Both players see winner announcement

---

## Game State Model

```typescript
interface BoatyGameState {
  phase: 'setup' | 'play' | 'finished';
  players: [Player, Player];
  
  // Each player's board
  boards: [PlayerBoard, PlayerBoard];
  
  // Turn management
  currentTurn: 0 | 1;
  
  // Result
  winner: string | null;
}

interface PlayerBoard {
  rafts: Raft[];
  gator: Position;
  
  // Squares that have been attacked
  hits: Position[];      // Raft hits (show flames)
  misses: Position[];    // Water hits (show ripples)
  gatorHits: Position[]; // For internal tracking only (no visual)
}

interface Raft {
  type: 'square' | 'lshape' | 'shorty';
  position: Position;    // Top-left anchor
  rotation: 0 | 90 | 180 | 270;
  squares: Position[];   // All occupied squares (computed)
  hitSquares: Position[]; // Which squares have been hit
  sunk: boolean;         // All squares hit?
}

interface Position {
  row: number; // 0-4
  col: number; // 0-4
}

interface Player {
  id: string;
  name: string;
  avatar: string;
  ready: boolean; // Setup complete?
}
```

---

## Component Structure

```
games/boaty/
├── BoatyGame.tsx           # Main GC3 wrapper
├── components/
│   ├── SetupPhase.tsx      # Raft placement UI
│   ├── PlayPhase.tsx       # Attack/defend UI
│   ├── SwampGrid.tsx       # 5×5 grid component
│   ├── Raft.tsx            # Draggable raft component
│   ├── Gator.tsx           # Animated gator sprite
│   ├── MolotovAnimation.tsx # Throw animation
│   ├── HitMarker.tsx       # Ripple or flames
│   └── Banner.tsx          # "MY SWAMP" / "THEIR SWAMP"
├── hooks/
│   ├── useBoatyGame.ts     # Game state management
│   ├── useRaftPlacement.ts # Drag/drop logic
│   └── useGatorMovement.ts # Autonomous gator AI
├── utils/
│   ├── raftShapes.ts       # Shape definitions
│   ├── collision.ts        # Overlap detection
│   └── winCheck.ts         # Victory condition
├── types.ts
├── constants.ts
└── boaty.config.ts         # GameCore config
```

---

## Placeholder Colors (Debug Mode)

| Element | Color |
|---------|-------|
| Swamp grid background | Gray `#808080` |
| "MY SWAMP" banner | Yellow `#FFD700` |
| Rafts | Purple `#800080` |
| Gator | Green `#228B22` |
| Molotov | Orange `#FF8C00` |
| Miss (ripple) | Blue `#4169E1` |
| Hit (flames) | Red `#DC143C` |
| Dazed gator | Light green `#90EE90` |

---

## Animation Specs

### Molotov Throw

```typescript
{
  entry: 'off-screen-left',    // Attacking: left. Receiving: left.
  startScale: 1.5,
  endScale: 0.5,
  arc: 'parabolic',
  duration: 600, // ms
  easing: 'ease-out'
}
```

### Gator Movement

**Hybrid approach:**

| Phase | Movement Trigger |
|-------|------------------|
| SETUP | Timed (~1.5 sec interval) — ambient life |
| PLAY | Once per incoming attack — after hit resolves |

```typescript
// Setup phase - timed
{
  trigger: 'interval',
  interval: 1500,    // ms between moves
  moveDuration: 300, // ms for slide animation
  easing: 'ease-in-out'
}

// Play phase - per attack
{
  trigger: 'after-attack-resolves',
  moveDuration: 300,
  easing: 'ease-in-out'
}
```

**Play phase rhythm:**
1. Opponent attacks your swamp
2. Molotov lands → result resolves
3. Gator takes one step (visible)
4. Turn passes

If gator is hit: dazed animation → gator moves to new square → attacker goes again

### Grid Flip (MY SWAMP ↔ THEIR SWAMP)

```typescript
{
  type: '3d-flip-horizontal',
  duration: 400,
  easing: 'ease-in-out'
}
```

---

## Sound Effects (Placeholder IDs)

| Event | Sound |
|-------|-------|
| Molotov throw | `whoosh.mp3` |
| Miss (water) | `splash_bubbles.mp3` |
| Hit (raft) | `explosion.mp3` |
| Raft sunk | `sinking.mp3` |
| Gator hit | `gator_screech.mp3` + voice line |
| Win | `victory_holler.mp3` |
| Lose | `sad_banjo.mp3` |

---

## Edge Cases

| Situation | Behavior |
|-----------|----------|
| Tap already-hit square | Nothing happens (ignore) |
| Tap square with ripple | Nothing happens (already missed) |
| Gator trapped in corner | Stays put until path opens |
| Both players tap DONE simultaneously | Normal — both ready, game starts |
| Player disconnects | TBD — GameCore handles? |

---

## AI Opponent (1 Player Mode)

Simple AI for solo play:

```typescript
function aiTurn(board: OpponentBoardView): Position {
  // 1. If we have a hit, hunt adjacent squares
  const lastHit = getLastHit(board);
  if (lastHit) {
    const adjacent = getAdjacentUnhit(lastHit, board);
    if (adjacent.length) return randomPick(adjacent);
  }
  
  // 2. Otherwise, random unhit square
  const unhit = getAllUnhit(board);
  return randomPick(unhit);
}
```

AI setup: Random raft placement (already implemented for initial state).

---

## Build Order

1. **SwampGrid** — 5×5 grid rendering
2. **Raft** — Shapes, rendering, drag/drop, rotation
3. **SetupPhase** — Grid + rafts + gator + DONE button
4. **Gator** — Autonomous movement during setup
5. **Banner** — "MY SWAMP" / "THEIR SWAMP" with flip
6. **MolotovAnimation** — Throw arc animation
7. **HitMarker** — Ripple / flames sprites
8. **PlayPhase** — Attack UI, turn management
9. **useBoatyGame** — Full game state hook
10. **BoatyGame** — Wire phases together
11. **boaty.config.ts** — GameCore integration
12. **AI opponent** — Simple hunt logic
13. **Polish** — Real sprites, sounds, timing

---

## Config for GameCore

```typescript
// boaty.config.ts

export const boatyConfig: GameConfig = {
  id: 'boaty',
  
  landing: {
    title: 'Boaty McBoatface',
    tagline: 'Sink the Competition',
    coverImage: '/images/games/boaty/cover.jpg',
    description: 'Battleship meets Moonshine',
  },
  
  epic: {
    loreImage: '/images/games/boaty/epic.jpg',
    instructions: [
      'Hide your stills in the swamp',
      'Throw molotovs to find theirs',
      'Sink all 3 rafts to win',
      'Watch out for the gator!',
    ],
  },
  
  lobby: {
    packPicker: null,      // No packs
    lengthPresets: null,   // Single game
    modeSelector: ['2-player', 'vs-AI'],
  },
  
  game: BoatyGame,
  
  result: {
    showLeaderboard: false,
    winMessage: "YOU SUNK 'EM!",
    loseMessage: "YOUR SHINE'S SUNK!",
  },
  
  replay: {
    enabled: true,
  },
};
```

---

## Summary

| Metric | Value |
|--------|-------|
| Grid | 5×5 |
| Rafts | 3 (9 squares total) |
| Gator | 1 per player (roaming) |
| Avg turns | 12-18 |
| Game time | ~2 minutes |
| Build scope | ~2-3 days |

**BOATY McBOATFACE**
*Sink the Competition*
