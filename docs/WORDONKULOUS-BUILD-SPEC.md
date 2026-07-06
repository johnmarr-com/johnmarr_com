> **HISTORICAL DESIGN SPEC.** Kept for game-design rationale (rules, scoring,
> phases). Implementation details here predate the server-authority engine —
> the code plus [`GAME-DEVELOPMENT-GUIDE.md`](./GAME-DEVELOPMENT-GUIDE.md) and
> [`SERVER-AUTHORITY-ENGINE.md`](./SERVER-AUTHORITY-ENGINE.md) are canonical
> for how this game is built today.

# WORDONKULOUS — Build Spec for Claude/Cursor

## Overview

Wordonkulous is a party game where players invent words for absurd definitions. It's "reverse Balderdash" — the definition is given, players create the word.

**Core Loop:**
1. All players see a wild definition
2. Each player submits a made-up word
3. Players vote on their favorite (can't vote for own)
4. Points awarded: 1 per vote received, +1 bonus for 1st place, 0.5 per vote for 2nd (rounded down)
5. Repeat for 10 rounds
6. Final leaderboard, winner celebrated

---

## Step 0: Study Existing Games & Extract Shared Components

Before building, analyze these existing JohnMarr games:

### Games to Study:
- **Box Bluff** — Primary reference for leaderboard UI, player list, focus area layout, winner screen
- **Other _gamecore games** — Landing page patterns, lobby flow, invite system, pack selector

### Components to Identify & Extract (if not already reusable):

| Component | Source | Reuse In Wordonkulous |
|-----------|--------|----------------------|
| Animated logo landing | All games | Landing page |
| Play button + player count | All games | Landing page |
| Music toggle | All games | Landing page |
| Lobby flow | _gamecore | Pre-game lobby |
| Invite friends UI | _gamecore | Lobby |
| Pack selector | Existing games | Lobby (definition packs) |
| Player list (leaderboard style) | Box Bluff | Main game screen |
| Focus area (top section) | Box Bluff | Definition display |
| Alert overlay ("waiting for players") | Box Bluff | Voting/submission phases |
| Winner reveal screen | Box Bluff | Round winner + final winner |
| Confetti animation | Box Bluff | Final win screen |
| PRO badge / button | Existing games | Pack creator access |

### Action Items:
1. Audit each component above in existing codebase
2. If component is game-specific, refactor into `_gamecore` or `JMKit`
3. Document props/interfaces for each shared component
4. Create any missing abstractions before building Wordonkulous

---

## Step 1: Landing Page

### Layout:
```
┌─────────────────────────────────────┐
│ [PRO: Create Custom Pack]    (top R)│
│                                     │
│         [Animated Logo]             │
│          WORDONKULOUS               │
│                                     │
│   "Invent words for ridiculous     │
│    definitions. Vote for glory."    │
│                                     │
│          [ ▶ PLAY ]                 │
│         "X players online"          │
│                                     │
│            🔊 / 🔇                   │
└─────────────────────────────────────┘
```

### Specifications:
- Use existing landing page component pattern from _gamecore
- Animated logo: Wordonkulous branding (create asset)
- Description text: Short, punchy
- Play button: Standard _gamecore styling
- Player count: Live count from server
- Music: Theme song loops, toggle in corner
- **PRO button (top right):** Opens Pack Creator (see Step 2)

---

## Step 2: Pack Creator (PRO Feature)

### Access:
- Button in top-right of landing page: "PRO: Create Custom Pack"
- Opens modal/full-screen builder

### Pack Data Model:
```typescript
interface DefinitionPack {
  id: string;
  name: string;
  icon: string;              // URL to AI-generated pack icon (card back)
  cardColor: string;         // Hex color for gradient on card front
  cardColorSecondary?: string; // Optional second color for gradient
  definitions: string[];     // Array of crazy definitions
  createdBy: string;         // User ID
  isPublic: boolean;         // Shareable with others?
}
```

### Builder UI:
```
┌─────────────────────────────────────┐
│ ← Back              CREATE PACK     │
├─────────────────────────────────────┤
│                                     │
│  Pack Name: [__________________]    │
│                                     │
│  Card Color: [Color Picker]         │
│                                     │
│  Pack Icon:                         │
│  [ Generate with AI ] [ Upload ]    │
│  ┌─────────┐                        │
│  │  Icon   │                        │
│  │ Preview │                        │
│  └─────────┘                        │
│                                     │
│  Definitions:                       │
│  ┌─────────────────────────────┐    │
│  │ 1. "The crunchy bits of..." │ ✕  │
│  │ 2. "When you wave back..."  │ ✕  │
│  │ 3. "The anxiety of..."      │ ✕  │
│  └─────────────────────────────┘    │
│  [ + Add Definition ]               │
│  [ ✨ Generate with AI ]            │
│                                     │
│  ────────────────────────────────   │
│  [ Save Pack ]  [ Preview Card ]    │
└─────────────────────────────────────┘
```

### AI Integration:
- **Icon generation:** Use existing AI icon generation pattern from other games
- **Definition generation:** Prompt template that creates specific, sensory, "begging for a word" definitions

### Definition AI Prompt Template:
```
Generate 5 original, hilarious definitions for things that don't have words yet.

Requirements:
- Be specific and sensory (not vague)
- Create the "why isn't there a word for this?" feeling
- Vary the tone: some gross, some wholesome, some relatable, some absurd
- No actual words — these must be definition-only

Examples of good definitions:
- "The crunchy bits of burnt and scummy bacon left in the pan after cooking"
- "The panic when you wave back at someone who wasn't waving at you"
- "The specific frustration of a USB plug not going in on the first two tries"

Generate definitions only. No words. One per line.
```

---

## Step 3: Lobby

### Flow:
1. Standard _gamecore lobby flow
2. Wordonkulous logo at top
3. Invite friends functionality (existing)
4. **Pack Selector:** Choose which definition pack to use
5. Host starts game when ready

### Pack Selector UI:
- Grid or list of available packs
- Show pack icon, name, definition count
- Selected pack highlighted
- Default pack pre-selected

---

## Step 4: Main Game Screen Layout

### Structure (matches Box Bluff pattern):
```
┌─────────────────────────────────────┐
│           FOCUS AREA                │
│  (Logo initially, then Definition)  │
├─────────────────────────────────────┤
│                                     │
│           LIST AREA                 │
│  (Player leaderboard / Word list)   │
│                                     │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

### Focus Area States:
| State | Content |
|-------|---------|
| Pre-round | Wordonkulous logo |
| During round | Definition card with pack background color |
| Voting | Definition card |
| Results | Definition card (smaller) + winner display |

### List Area States:
| State | Content |
|-------|---------|
| Waiting for submissions | Player leaderboard (name, avatar, score) |
| Voting | Randomized word list as buttons |
| Vote locked | Word list (semi-transparent, non-interactive) |
| Results | Winner display |

---

## Step 5: Round Flow (Detailed)

### Phase 1: Definition Popup
```
┌─────────────────────────────────────┐
│                                     │
│   ┌─────────────────────────────┐   │
│   │    [Pack gradient background]│   │
│   │                             │   │
│   │  "The crunchy bits of burnt │   │
│   │   and scummy bacon left in  │   │
│   │   the pan after cooking a   │   │
│   │   full pound of extra thick │   │
│   │   peppered bacon."          │   │
│   │                             │   │
│   └─────────────────────────────┘   │
│                                     │
│   Your word:                        │
│   [________________________]        │
│                                     │
│          [ Submit ]                 │
│                                     │
└─────────────────────────────────────┘
```

- Modal/popup over game screen
- Definition in styled card (rounded corners, pack gradient)
- Text input for player's made-up word
- Submit button
- On submit: close popup, return to game screen

### Phase 2: Waiting for Submissions
```
┌─────────────────────────────────────┐
│   ┌─────────────────────────────┐   │
│   │      DEFINITION CARD        │   │
│   └─────────────────────────────┘   │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │ ⏳ Players are creating words │  │
│  └───────────────────────────────┘  │
│                                     │
│  👤 Player1          12 pts        │
│  👤 Player2           8 pts        │
│  👤 Player3           8 pts        │
│  👤 Player4           4 pts        │
│                                     │
└─────────────────────────────────────┘
```

- Focus area: Definition card
- Alert overlay: "Players are creating words..."
- List area: Player leaderboard (sorted by score)

### Phase 3: Voting
```
┌─────────────────────────────────────┐
│   ┌─────────────────────────────┐   │
│   │      DEFINITION CARD        │   │
│   └─────────────────────────────┘   │
├─────────────────────────────────────┤
│                                     │
│   ┌─────────────────────────────┐   │
│   │       CRUNCH-WADDLES        │   │ ← Tappable
│   └─────────────────────────────┘   │
│   ┌─────────────────────────────┐   │
│   │         PIGTERIA            │   │ ← Tappable
│   └─────────────────────────────┘   │
│   ┌─────────────────────────────┐   │
│   │      SPICY PIG NUTS         │   │ ← Tappable
│   └─────────────────────────────┘   │
│   ┌─────────────────────────────┐   │
│   │        BACONALIA            │   │ ← Tappable
│   └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

- Words displayed as large, centered buttons
- Randomized order (no player attribution yet)
- Player's own word is shown but NOT tappable (or hidden — design decision)
- Scroll if needed
- On tap: Confirmation popup

### Vote Confirmation Popup:
```
┌─────────────────────────────────────┐
│                                     │
│   Vote for "CRUNCH-WADDLES"?        │
│                                     │
│   [ Cancel ]        [ Confirm ]     │
│                                     │
└─────────────────────────────────────┘
```

- On confirm: Lock vote, return to waiting state

### Phase 4: Waiting for Votes
```
┌─────────────────────────────────────┐
│   ┌─────────────────────────────┐   │
│   │      DEFINITION CARD        │   │
│   └─────────────────────────────┘   │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │   ⏳ Players are voting...    │  │
│  └───────────────────────────────┘  │
│                                     │
│   ┌─────────────────────────────┐   │
│   │       CRUNCH-WADDLES        │   │ ← Semi-transparent
│   └─────────────────────────────┘   │
│   ┌─────────────────────────────┐   │
│   │         PIGTERIA            │   │ ← Semi-transparent
│   └─────────────────────────────┘   │
│            ...                      │
└─────────────────────────────────────┘
```

- Same word list but non-interactive, semi-transparent
- Alert: "Players are voting..."

### Phase 5: Round Results
```
┌─────────────────────────────────────┐
│   ┌─────────────────────────────┐   │
│   │      DEFINITION CARD        │   │ ← Smaller
│   └─────────────────────────────┘   │
├─────────────────────────────────────┤
│                                     │
│           🥇 1ST PLACE              │
│             👤 👤                   │ ← Avatar(s)
│        Player1, Player3             │
│       "CRUNCH-WADDLES"              │
│          +4 points each             │
│                                     │
│           🥈 2nd Place              │
│              👤                     │
│           Player2                   │
│          "PIGTERIA"                 │
│           +1 point                  │
│                                     │
│        [ Tap to continue ]          │
└─────────────────────────────────────┘
```

### Scoring Logic:
```typescript
function calculateRoundScores(votes: Record<string, string[]>): RoundResult {
  // votes = { wordId: ["voterPlayerId1", "voterPlayerId2"] }
  
  const sorted = Object.entries(votes)
    .map(([wordId, voters]) => ({ wordId, voteCount: voters.length }))
    .sort((a, b) => b.voteCount - a.voteCount);
  
  const firstPlaceCount = sorted[0]?.voteCount || 0;
  const firstPlaceWinners = sorted.filter(w => w.voteCount === firstPlaceCount);
  
  const secondPlaceCount = sorted.find(w => w.voteCount < firstPlaceCount)?.voteCount || 0;
  const secondPlaceWinners = sorted.filter(w => w.voteCount === secondPlaceCount && secondPlaceCount > 0);
  
  // Points: 1 per vote + 1 bonus for 1st place
  // 2nd place: 0.5 per vote, rounded down
  
  return {
    firstPlace: firstPlaceWinners.map(w => ({
      ...w,
      points: w.voteCount + 1  // votes + bonus
    })),
    secondPlace: secondPlaceWinners.map(w => ({
      ...w,
      points: Math.floor(w.voteCount * 0.5)
    }))
  };
}
```

---

## Step 6: Final Win Screen

After round 10 results → tap to continue → Final screen

### Layout (match Box Bluff):
```
┌─────────────────────────────────────┐
│  ✕                                  │
│                                     │
│          🎉 WINNER! 🎉              │
│                                     │
│             👤                      │ ← Large avatar
│          Player1                    │
│          24 points                  │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  2. Player3 ............ 18 pts    │
│  3. Player2 ............ 12 pts    │
│  4. Player4 ............  8 pts    │
│                                     │
│        🎊 [Confetti] 🎊             │
│                                     │
└─────────────────────────────────────┘
```

- Reuse Box Bluff winner screen component
- Featured winner with large avatar, name, total score
- Simplified leaderboard below
- Confetti animation
- Theme song plays
- Exit button (top left) → returns to landing page

---

## Step 7: Game State Model

```typescript
interface WordonkulousGameState {
  gameId: string;
  packId: string;
  players: Player[];
  definitions: string[];        // 10 randomly selected from pack
  currentRound: number;         // 0-9
  phase: 'submitting' | 'voting' | 'results' | 'final';
  
  submissions: {
    [roundIndex: string]: {
      [playerId: string]: string; // word submitted
    }
  };
  
  votes: {
    [roundIndex: string]: {
      [wordId: string]: string[];  // wordId → array of voter player IDs
    }
  };
  
  scores: {
    [playerId: string]: number;
  };
}

interface Player {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  isConnected: boolean;
}
```

---

## Step 8: New _gamecore Components to Create

If these don't exist as reusable components, create them:

1. **DefinitionCard** — Styled card with gradient background, rounded corners, definition text
2. **WordButton** — Large centered text button for voting
3. **RoundResultsDisplay** — 1st/2nd place layout with avatars and points
4. **PackSelector** — Grid/list picker for definition packs
5. **PackCreator** — Full builder UI for PRO users

---

## Step 9: New JMKit Components (if needed)

1. **GradientCard** — Generic card with configurable gradient background
2. **VoteConfirmationModal** — Reusable "confirm action" popup
3. **WaitingAlert** — Overlay alert for "waiting for players" states

---

## File Structure (suggested)

```
src/
├── games/
│   └── wordonkulous/
│       ├── WordonkulousLanding.tsx
│       ├── WordonkulousLobby.tsx
│       ├── WordonkulousGame.tsx
│       ├── components/
│       │   ├── DefinitionCard.tsx
│       │   ├── DefinitionPopup.tsx
│       │   ├── WordVoteList.tsx
│       │   ├── RoundResults.tsx
│       │   └── PackCreator.tsx
│       ├── hooks/
│       │   └── useWordonkulousGame.ts
│       ├── types.ts
│       └── constants.ts
├── _gamecore/
│   ├── components/
│   │   ├── PackSelector.tsx      ← New/extracted
│   │   ├── WinnerScreen.tsx      ← Extracted from Box Bluff
│   │   └── WaitingOverlay.tsx    ← New/extracted
│   └── ...
└── JMKit/
    └── ...
```

---

## Build Order

1. **Audit & Extract:** Study Box Bluff and other games, extract shared components
2. **Data Models:** Define TypeScript interfaces for game state, packs
3. **Pack System:** Build pack data model, storage, basic selector
4. **Landing Page:** Assemble from existing components + Wordonkulous branding
5. **Pack Creator:** Build PRO feature with AI integration
6. **Lobby:** Standard flow + pack selector
7. **Game Screen Shell:** Focus area + list area layout
8. **Round Flow:** Implement all 5 phases
9. **Scoring:** Implement point calculation
10. **Final Screen:** Winner display with confetti
11. **Polish:** Animations, transitions, sound effects
12. **Test:** Full game flow with multiple players

---

## Questions for Clarification

1. Should players see their own word in the voting list (greyed out) or hidden entirely?
2. Timer on word submission? (e.g., 60 seconds max)
3. Timer on voting? (e.g., 30 seconds max)
4. What happens if a player disconnects mid-round?
5. Can late-joiners spectate?
6. Default pack content — how many definitions to ship with v1?
