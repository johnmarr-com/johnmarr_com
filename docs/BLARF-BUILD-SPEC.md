> **HISTORICAL DESIGN SPEC.** Kept for game-design rationale (rules, scoring,
> phases). Implementation details here predate the server-authority engine —
> the code plus [`GAME-DEVELOPMENT-GUIDE.md`](./GAME-DEVELOPMENT-GUIDE.md) and
> [`SERVER-AUTHORITY-ENGINE.md`](./SERVER-AUTHORITY-ENGINE.md) are canonical
> for how this game is built today.

# BLARF — Build Spec for Claude/Cursor

## Overview

BLARF is a fast-paced social deduction game where players speak made-up Dr. Seuss-style words aloud. One or more players are secretly "Blarfers" who don't have a real word — they must make one up and blend in. Everyone votes to find the Blarfer(s).

**Tagline:** A game of yells and spells

**The Call:** "Find the Blarfer!"

**Core Loop:**
1. Everyone secretly receives a nonsense word (Blarfers only get the starting letter as a hint)
2. Screens flash yellow one-by-one — players speak their word aloud
3. Everyone votes on who they think was faking
4. Blarfers are revealed, points awarded
5. Repeat for selected number of rounds
6. Final scores, winner crowned

---

## The Lore (Intro Screen / Loading Text)

*In the land of Wozzle-Woo, where the Zinkles all grew,*
*Every creature had a word that was perfectly true.*
*The Snozzwangs said "Snozzwang!" The Quibbles said "Quib!"*
*Every word was just right, from the tail to the bib.*

*But one day came a creature who didn't belong,*
*Who opened his mouth and got everything wrong.*
*He didn't have a word, not one of his own,*
*So he made something up in a bumbly tone.*

*"BLARF!" said the creature, with a wiggle and grin,*
*And the Zinkles all gasped at the state he was in.*
*"That's not a real word!" cried the eldest Quiblee,*
*"You're a BLARFER! A faker! As fake as can be!"*

*And so it was spoken, and so it was known:*
*A Blarfer's a faker who blarfs on their own.*

---

## Leverage Wordonkulous

BLARF shares significant architecture with Wordonkulous. Reuse and adapt:

| Wordonkulous Component | BLARF Equivalent |
|------------------------|------------------|
| Landing page | Same structure, BLARF branding |
| Pack selector | Blarf Pack selector |
| Pack builder (PRO) | Blarf Pack builder (rounds of words) |
| Lobby flow | Same flow |
| Player list / leaderboard | Same component |
| Waiting overlays | Adapt for "Players are speaking..." |
| Voting UI | Adapt for multi-vote (1/2/3 votes) |
| Round results | Blarfer reveal screen |
| Final winner screen | Same component |
| Game state model | Adapt for BLARF mechanics |

**Directive to Claude:** Study the Wordonkulous implementation first. Extract and reuse all shared components. BLARF is a sibling game — most UI patterns should be inherited, not rebuilt.

---

## Player Scaling

| Players | Blarfers | Votes per Player |
|---------|----------|------------------|
| 3–6     | 1        | 1                |
| 7–12    | 2        | 2                |
| 13–15   | 3        | 3                |

---

## Round Options

| Mode | Rounds | Vibe |
|------|--------|------|
| Learn | 1 | Tutorial, first-timers |
| Quick | 2 | Fast game, warm-up |
| Standard | 4 | Default experience |
| Long | 6 | Party night |

---

## Pack Structure

A Blarf Pack contains multiple rounds. Each round is an array of 16 strings:

```typescript
type VoiceStyle = 
  | 'normal' 
  | 'shout' 
  | 'whisper' 
  | 'sing' 
  | 'robot' 
  | 'opera' 
  | 'cowboy' 
  | 'baby' 
  | 'dramatic' 
  | 'bored'
  | 'pirate'
  | 'british'
  | 'valley_girl';

interface BlarfRound {
  // Index 0: The letter hint (shown to Blarfers)
  // Index 1-15: The 15 nonsense words (all start with same letter)
  words: [string, ...string[]]; // [letter, word1, word2, ..., word15]
  voiceStyle?: VoiceStyle;      // How players must say their word this round
}

interface BlarfPack {
  id: string;
  name: string;
  icon: string;              // AI-generated pack icon
  rounds: BlarfRound[];      // Array of rounds
  createdBy: string;
  isPublic: boolean;
}
```

**Voice Style Display Names:**

| Value | Display Text |
|-------|--------------|
| normal | Say your word |
| shout | SHOUT your word! |
| whisper | Whisper your word... |
| sing | 🎵 Sing your word! |
| robot | Say it like a robot 🤖 |
| opera | Opera singer style! 🎭 |
| cowboy | Say it like a cowboy 🤠 |
| baby | Baby voice 👶 |
| dramatic | DRAMATICALLY! 🎬 |
| bored | Say it like you're bored 😑 |
| pirate | Arrr! Pirate voice! 🏴‍☠️ |
| british | Posh British accent 🎩 |
| valley_girl | Like, totally say it? 💅 |

**Example Round:**
```typescript
{
  words: [
    "S",           // Index 0: Letter hint for Blarfers
    "Snozzwang",   // Index 1-15: Real words
    "Snipplefrix",
    "Snoofledorp",
    "Skwibbleflop",
    "Snurtlegurk",
    "Splindlewonk",
    "Squazzlebert",
    "Snibblewicket",
    "Splotchkinz",
    "Skrunkledorf",
    "Snifferwhump",
    "Spazzlequirk",
    "Slurpledink",
    "Snorklefizz",
    "Swomplegust"
  ]
}
```

---

## Pack Builder (PRO Feature)

### UI Flow:
1. Pack name input
2. Pack icon (AI generate or upload)
3. Round builder:
   - Select a letter (A-Z)
   - Add 15 words starting with that letter
   - [ + Add Word Manually ]
   - [ ✨ Generate Words with AI ] — generates 15 Seuss-style words for selected letter
4. Add as many rounds as desired
5. Save pack

### AI Word Generation Prompt:
```
Generate 15 made-up Dr. Seuss-style nonsense words that all begin with the letter "{LETTER}".

Requirements:
- Each word should be 2-4 syllables
- They should sound playful, silly, and speakable aloud
- Mix of sounds: hard consonants, soft sounds, unusual combinations
- They should feel like they could be creatures, things, or actions from a Seuss book
- No real English words
- No offensive-sounding combinations

Examples of the style:
- Snozzwang, Quibble, Zinkle, Flummox, Grickle, Blorft, Wumbus

Output format: One word per line, no numbering.
```

---

## Game Flow (Detailed)

### Phase 1: Role Assignment (Hidden)

When round starts:
1. Server randomly selects Blarfer(s) based on player count
2. Server randomly assigns words from round array (indices 1-15) to non-Blarfers
3. No word is repeated

**Non-Blarfer Screen:**
```
┌─────────────────────────────────────┐
│                                     │
│      You're NOT the Blarfer!        │
│                                     │
│   Say this word out loud when       │
│   your screen flashes YELLOW:       │
│                                     │
│        ┌─────────────────┐          │
│        │   SNOZZWANG     │          │
│        └─────────────────┘          │
│                                     │
│         [ Got it! ]                 │
│                                     │
└─────────────────────────────────────┘
```

**Blarfer Screen:**
```
┌─────────────────────────────────────┐
│                                     │
│    😈 You're the BLARFER! 😈        │
│                                     │
│   Make up a word! Say it out loud   │
│   when your screen flashes YELLOW.  │
│                                     │
│   Hint: Words this round start      │
│   with the letter:                  │
│                                     │
│            ┌─────┐                  │
│            │  S  │                  │
│            └─────┘                  │
│                                     │
│         [ Got it! ]                 │
│                                     │
└─────────────────────────────────────┘
```

Players tap "Got it!" to confirm they've seen their role. Server waits for all confirmations before proceeding.

### Phase 2: Speaking Round (The Yellow Flash)

1. All players see a "Get Ready..." screen
2. Players are randomized into a speaking order
3. One by one, each player's screen flashes YELLOW for 3 seconds
4. During their yellow flash, they speak their word (or blarf one)
5. Other players see: "[Player Name]'s turn..." with their avatar highlighted
6. After all players have spoken, proceed to voting

**Active Speaker Screen (Yellow Flash):**
```
┌─────────────────────────────────────┐
│█████████████████████████████████████│
│█████████████████████████████████████│
│█████████████████████████████████████│
│███████                       ███████│
│███████    🎤 SPEAK NOW! 🎤   ███████│
│███████                       ███████│
│███████      SNOZZWANG        ███████│  ← (Blarfers see nothing here)
│███████                       ███████│
│█████████████████████████████████████│
│█████████████████████████████████████│
│█████████████████████████████████████│
└─────────────────────────────────────┘
```
(Entire screen is yellow with text overlay)

**Observer Screen (Watching others speak):**
```
┌─────────────────────────────────────┐
│                                     │
│           Round 1 of 4              │
│                                     │
│        [ Player3's turn ]           │
│             👤                      │
│          @player3                   │
│                                     │
│     ━━━━━●━━━━━━━━━━━━━━━           │
│     3 of 8 players                  │
│                                     │
└─────────────────────────────────────┘
```

### Phase 3: Voting

After all players have spoken:

**Voting Screen:**
```
┌─────────────────────────────────────┐
│                                     │
│       🔍 FIND THE BLARFER! 🔍       │
│                                     │
│   You have 2 votes. Tap to vote.    │
│   (You cannot vote for yourself)    │
│                                     │
│   ┌─────────┐  ┌─────────┐          │
│   │  👤     │  │  👤     │          │
│   │ Player1 │  │ Player2 │          │
│   │         │  │  ✓ (1)  │          │
│   └─────────┘  └─────────┘          │
│   ┌─────────┐  ┌─────────┐          │
│   │  👤     │  │  👤     │          │
│   │ Player3 │  │  YOU    │          │
│   │  ✓ (1)  │  │  ───    │          │
│   └─────────┘  └─────────┘          │
│                                     │
│   Votes remaining: 0                │
│                                     │
│         [ Confirm Votes ]           │
│                                     │
└─────────────────────────────────────┘
```

**Voting Rules:**
- Players have 1, 2, or 3 votes based on player count
- Can stack multiple votes on same player
- Cannot vote for self
- Tap player to add vote, tap again to remove
- Confirm when done
- Timer: 30 seconds? (Or wait for all confirmations)

**After Voting — Waiting Screen:**
```
┌─────────────────────────────────────┐
│                                     │
│   ⏳ Waiting for votes...           │
│                                     │
│   Your votes:                       │
│   • Player2 (1 vote)                │
│   • Player3 (1 vote)                │
│                                     │
└─────────────────────────────────────┘
```

### Phase 4: Blarfer Reveal & Scoring

**Reveal Screen:**
```
┌─────────────────────────────────────┐
│                                     │
│      🎭 THE BLARFER WAS... 🎭       │
│                                     │
│              👤                     │
│           Player3!                  │
│                                     │
│    They said: "SNURFLEWUMP"         │
│    (The real words started with S)  │
│                                     │
│  ──────────────────────────────     │
│                                     │
│  Detected by: Player1, Player5      │
│  (2 people — Blarfer loses 1 pt)    │
│                                     │
│  Correct votes:                     │
│  • Player1: +1 pt                   │
│  • Player5: +1 pt                   │
│                                     │
│        [ Next Round ]               │
│                                     │
└─────────────────────────────────────┘
```

**If Multiple Blarfers:**
Show each Blarfer reveal sequentially, or side-by-side.

### Scoring Logic:

```typescript
function calculateRoundScores(
  blarfers: string[],           // Player IDs of Blarfers
  votes: Record<string, string[]> // { odId: [oderId, oderId, ...] }
): ScoreChanges {
  const changes: Record<string, number> = {};
  
  // Initialize all players to 0 change
  // ...
  
  // Score correct votes (+1 per correct vote)
  for (const votedForId of Object.keys(votes)) {
    if (blarfers.includes(votedForId)) {
      for (const voterId of votes[votedForId]) {
        changes[voterId] = (changes[voterId] || 0) + 1;
      }
    }
  }
  
  // Score Blarfers
  for (const blarferId of blarfers) {
    const detectCount = votes[blarferId]?.length || 0;
    const uniqueDetectors = new Set(votes[blarferId] || []).size;
    
    if (uniqueDetectors === 0) {
      // Undetected: +3 points
      changes[blarferId] = (changes[blarferId] || 0) + 3;
    } else if (uniqueDetectors <= 5) {
      // Detected by 1-5 people: -1 point
      changes[blarferId] = (changes[blarferId] || 0) - 1;
    } else {
      // Detected by 6+ people: -2 points
      changes[blarferId] = (changes[blarferId] || 0) - 2;
    }
  }
  
  // Wrong votes: -1 point (OPTIONAL — confirm with John)
  // for (const [votedForId, voters] of Object.entries(votes)) {
  //   if (!blarfers.includes(votedForId)) {
  //     for (const voterId of voters) {
  //       changes[voterId] = (changes[voterId] || 0) - 1;
  //     }
  //   }
  // }
  
  return changes;
}
```

**Scoring Summary:**

| Action | Points |
|--------|--------|
| Correct vote (found a Blarfer) | +1 |
| Blarfer undetected (0 voters) | +3 |
| Blarfer detected by 1-5 | -1 |
| Blarfer detected by 6+ | -2 |
| Wrong vote | 0 (or -1 if penalty enabled) |

---

## Phase 5: Final Winner Screen

After final round reveal → tap to continue → Final screen

Reuse Wordonkulous/Box Bluff winner screen:
- Featured winner with large avatar
- Total score
- Leaderboard of all players
- Confetti animation
- BLARF theme music
- Exit button → return to landing

---

## Game State Model

```typescript
interface BlarfGameState {
  gameId: string;
  packId: string;
  players: Player[];
  rounds: BlarfRound[];           // Selected rounds for this game
  totalRounds: number;            // 1, 2, 4, or 6
  currentRound: number;           // 0-indexed
  phase: 'role_reveal' | 'speaking' | 'voting' | 'results' | 'final';
  
  // Current round state
  blarfers: string[];             // Player IDs of current Blarfers
  wordAssignments: Record<string, string>;  // playerId → word (empty for Blarfers)
  speakingOrder: string[];        // Randomized player IDs
  currentSpeakerIndex: number;
  
  votes: Record<string, string[]>; // votedForId → array of voter IDs
  
  scores: Record<string, number>;  // Cumulative scores
  
  roleConfirmations: string[];    // Players who tapped "Got it!"
  voteConfirmations: string[];    // Players who confirmed votes
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

## UI Components to Create / Adapt

### From Wordonkulous (adapt):
- Landing page → BLARF branding, lore intro
- Pack selector → Blarf Packs
- Pack builder → Round/word builder with AI generation
- Lobby flow → Same
- Player leaderboard → Same
- Voting UI → Adapt for multi-vote + stacking
- Results screen → Blarfer reveal
- Final winner screen → Same

### New for BLARF:
- **RoleRevealScreen** — "You're the Blarfer!" / "You're NOT the Blarfer!"
- **SpeakingPhaseScreen** — Yellow flash for active speaker, observer view for others
- **BlarferRevealScreen** — Dramatic reveal of who was faking
- **MultiVoteSelector** — Vote UI that supports 1/2/3 votes with stacking

---

## File Structure (suggested)

```
src/
├── games/
│   └── blarf/
│       ├── BlarfLanding.tsx
│       ├── BlarfLobby.tsx
│       ├── BlarfGame.tsx
│       ├── components/
│       │   ├── RoleRevealScreen.tsx
│       │   ├── SpeakingPhase.tsx
│       │   ├── YellowFlashScreen.tsx
│       │   ├── MultiVoteSelector.tsx
│       │   ├── BlarferReveal.tsx
│       │   └── BlarfPackBuilder.tsx
│       ├── hooks/
│       │   └── useBlarfGame.ts
│       ├── types.ts
│       ├── constants.ts
│       └── lore.ts              // The Seussian tale text
├── _gamecore/
│   └── (shared components from Wordonkulous)
└── JMKit/
    └── ...
```

---

## Build Order

1. **Study Wordonkulous** — Identify all reusable components
2. **Data models** — BlarfPack, BlarfRound, BlarfGameState
3. **Pack system** — Pack structure, storage, AI word generation
4. **Landing page** — BLARF branding + lore intro
5. **Pack builder** — Letter selection, word input, AI generation
6. **Lobby** — Pack selector + round count selector
7. **Role reveal phase** — Blarfer vs non-Blarfer screens
8. **Speaking phase** — Yellow flash mechanic, turn rotation
9. **Voting phase** — Multi-vote UI with stacking
10. **Results phase** — Blarfer reveal + scoring
11. **Final screen** — Winner celebration
12. **Polish** — Animations, sound effects, timing
13. **Test** — Full flow with various player counts (3, 7, 13)

---

## Timing Estimates

| Phase | Duration |
|-------|----------|
| Role reveal + confirmations | ~10-15 sec |
| Speaking (per player) | ~3-4 sec |
| Speaking (8 players) | ~30 sec |
| Voting | ~20-30 sec |
| Results reveal | ~10-15 sec |
| **Total per round** | **~1.5-2 min** |

| Mode | Rounds | Total Time |
|------|--------|------------|
| Learn | 1 | ~2 min |
| Quick | 2 | ~4 min |
| Standard | 4 | ~8 min |
| Long | 6 | ~12 min |

---

## Visual Style Guide

### Brand Colors (from cover art)
```css
:root {
  --blarf-red: #C93C3C;        /* Primary — titles, accents */
  --blarf-yellow: #F7D047;     /* Secondary — highlights, flash screen */
  --blarf-blue: #4BA3C7;       /* Accent — sky, backgrounds */
  --blarf-cream: #F5F0E1;      /* Speech bubbles, cards */
  --blarf-navy: #2B4B6F;       /* Text, dark accents */
  --blarf-orange: #E8734A;     /* Towers, warm elements */
}
```

### Halftone Style
- Apply halftone/Ben-Day dot texture to backgrounds and large color blocks
- Gives vintage Seuss-meets-comic-book aesthetic
- Can be CSS filter, SVG pattern overlay, or baked into background assets
- Subtle — don't overpower text readability

### Hand-Drawn Word Bubbles
- Words displayed to players appear in hand-drawn speech bubble frames
- Slightly wobbly/organic outlines — not perfect geometric shapes
- Cream/off-white fill (#F5F0E1)
- Dark navy stroke (#2B4B6F)
- The word inside uses a playful hand-drawn or rounded font

**Example bubble styles:**
```
   ╭─────────────────╮
  │   SNOZZWANG    │
   ╰───────╥────────╯
           ╙─╮
```

Consider SVG bubbles with slight randomization so each feels unique.

### Typography
- Title/Logo: Bold, playful, Seuss-style (match cover art)
- Words: Hand-drawn or rounded sans-serif (readable but whimsical)
- UI text: Clean sans-serif for legibility
- Consider: Fredoka One, Baloo, or custom hand-lettered font

### Yellow Flash Screen
- Bright solid yellow (#F7D047) fills entire screen
- Halftone texture overlay for consistency
- Word appears in large hand-drawn bubble, centered
- High contrast for unmistakable "YOUR TURN" signal

---

## Audio / Visual Polish

- **Yellow flash** — Should be BRIGHT, unmistakable, maybe with a "ding" sound
- **Blarfer reveal** — Dramatic pause, then reveal with sound effect
- **Theme music** — Playful, Seuss-ish, whimsical
- **Vote confirmation** — Satisfying click/tap sound
- **Correct vote** — Celebratory ding
- **Blarfer caught** — Comedic "busted" sound
- **Blarfer escaped** — Sneaky/mischievous sound

---

## Questions for Clarification

1. **Wrong vote penalty?** Should wrong votes cost -1 point? (Adds tension but may frustrate casual players)
2. **Timer on voting?** Hard timer (30 sec) or wait for all confirmations?
3. **Blarfers see each other?** In 2-3 Blarfer games, do Blarfers know who the other Blarfers are? (Probably no — more chaotic)
4. **Reveal order** — For multiple Blarfers, reveal one at a time or all at once?
5. **Speaking order visible?** Should players see the full speaking order, or just who's next?

---

## Default Pack Requirements

Ship with at least one default pack containing:
- 6+ rounds (enough for a Long game)
- Each round: 15 words, all starting with same letter
- Variety of letters (not all S and Z)
- Words tested for "speakability" — fun to say out loud

---

## AI Pack Generation Note

When generating Blarf Packs with AI:
- Generate one round at a time (select letter, generate 15 words)
- Allow regeneration if words don't feel right
- Preview: show all 15 words, allow individual replacement
- Save rounds to pack, build up to 6+ rounds
