> **HISTORICAL DESIGN SPEC.** Kept for game-design rationale (rules, scoring,
> phases). Implementation details here predate the server-authority engine —
> the code plus [`GAME-DEVELOPMENT-GUIDE.md`](./GAME-DEVELOPMENT-GUIDE.md) and
> [`SERVER-AUTHORITY-ENGINE.md`](./SERVER-AUTHORITY-ENGINE.md) are canonical
> for how this game is built today.

# FYVE — Game Build Specification v2
### A Social Digital PWA Party Game — Fyve.ai
#### "Heists Are Us"

---

## Platform Context

FYVE lives on the Fyve.ai game platform alongside BLUFF BOX and MEGA SKETCHY.

- **Entry point:** The game's main landing page, consistent with platform patterns
- **Builder access:** Via the JMKit — a **PRO: Build Heists** button available to Pro and Admin users only. Follow the same JMKit builder pattern established in BLUFF BOX (Build Game Packs) and MEGA SKETCHY (Build Missions).
- **AI Card Image Generator:** Reuse the existing card image generator component from BLUFF BOX. Same generation flow, same output format. Feed it asset/civilian/bomb-specific prompts from the Heist Builder context. Do not rebuild this component.
- **Heist selection:** The game host selects the Heist from a library before the session starts. Not random. Follows the same pattern as BLUFF BOX (pack selection) and MEGA SKETCHY (mission selection).

---

## Branding

- **Game name:** FYVE
- **Subtitle:** Heists Are Us
- **Logo:** Astronaut whose body IS the number 7 — navy background, orange 7, gray/white astronaut suit, star field
- **Palette:** Navy `#0D1B2E`, Orange `#E84C1E`, Gray `#8C9BAD`, White `#FFFFFF`
- **Mission Prime** is the flagship intro Heist — a space mission that narratively justifies the astronaut logo. It is not a tutorial. Same rules as all other Heists.

---

## Overview

Two rival crime syndicates race to assemble 7 mission assets before THE BOMB drops. Every player uses their own device. All screens are role-scoped. The 4×5 grid holds 20 cards drawn randomly from a 50-word Heist-specific pool. The key (which cards belong to which syndicate, which are neutral, which is the Bomb) is generated server-side and never fully transmitted to any client.

---

## Data Structure

### Heist Object

```javascript
const heist = {
  id: "mission_prime",
  title: "The Ares Powder",
  briefing: "String — shown at session start and on win screen.",
  backgroundImageUrl: "https://firestore.../bg.jpg",
  targetObjectImageUrl: "https://firestore.../object.jpg", // shown at briefing + win screen

  setting: {
    location: "String",
    era: "String",
    atmosphere: "String"
  },

  clients: {
    syndicate1: {
      benefactor: "String — person or entity name",
      motivation: "String — punchy 1–2 sentences"
    },
    syndicate2: {
      benefactor: "String",
      motivation: "String"
    }
  },

  // Exactly 7 assets per mission.
  // At session start all 7 are used — both syndicates race to collect the same 7.
  // T1 gets all 7 rendered in T1 color, T2 gets all 7 rendered in T2 color.
  // Single asset image set per mission. Tint applied via CSS/canvas filter per team.
  // Only 7 card images need to be generated per mission.
  assets: [
    {
      id: "asset_1",
      name: "THE UPLINK CODE",
      description: "String — shown beneath card on reveal",
      imageUrl: "https://firestore.../asset_1.jpg"
      // number (1–7) assigned at runtime based on reveal order per team
    },
    // ... 6 more (total 7)
  ],

  // Exactly 5 civilians — all neutral.
  civilians: [
    {
      id: "civilian_1",
      name: "THE FLIGHT SURGEON",
      description: "String — shown beneath card on reveal",
      imageUrl: "https://firestore.../civilian_1.jpg"
    },
    // ... 4 more
  ],

  // The Bomb — one per Heist. Shared FBI image used in Mission Pack 1.
  // Future Heists may use a different bomb image/sound.
  bomb: {
    name: "THE BOMB",
    description: "String — mission-specific flavor text on reveal",
    imageUrl: "https://firestore.../bomb.jpg", // shared across Mission Pack 1
    soundEffect: "freeze_fbi" // sound effect key — see Sound Effects section
  },

  words: {
    tier1: ["WORD"], // ~20 words — deep theme, build the world
    tier2: ["WORD"], // ~20 words — dangerous doubles, multiple meanings
    tier3: ["WORD"]  // ~10 words — trojan words, reward lateral thinking
  }
}
```

---

## Word Pool Draw (server-side, session start)

```javascript
// Combine all tiers
const fullPool = [
  ...heist.words.tier1,
  ...heist.words.tier2,
  ...heist.words.tier3
]

// Draw 15 mission words
const missionWords = shuffle(fullPool).slice(0, 15)

// All 5 civilians always used
const civilians = heist.civilians

// Build 20-card board: 15 words + 5 civilian names
const board = shuffle([
  ...missionWords,
  ...civilians.map(c => c.name.toUpperCase())
])
// board[i] = display word, positions 0–19
```

---

## Key Generation (server-side only)

```javascript
const keyTemplate = [
  "T1","T1","T1","T1","T1","T1","T1", // 7 syndicate one
  "T2","T2","T2","T2","T2","T2","T2", // 7 syndicate two
  "N","N","N","N","N",                 // 5 neutral
  "BOMB"                               // 1 bomb
]

const key = shuffle(keyTemplate)
// key[i] maps to board[i]
// key is NEVER transmitted to operative clients
// Architects receive a color-coded render of the full board
// Operatives receive the board with zero color information
```

---

## Asset Assignment (server-side)

```javascript
// All 7 assets are used every game — no random draw needed
const sessionAssets = heist.assets // all 7

// Both teams race to collect the same 7 assets
// T1 sees all 7 tinted in T1 color
// T2 sees all 7 tinted in T2 color
// number (1–7) assigned per team as each asset is revealed in sequence
// t1RevealCount and t2RevealCount increment independently
```

---

## Session Flow

### 1. Heist Selection (Host Only)
- Host opens game lobby
- Selects a Heist from the library (same pattern as BLUFF BOX pack selection)
- Heist details not shown to other players yet

### 2. Lobby
- Players join via room code on their own devices
- Each player enters a Gamertag
- Host hits START when all players are in

### 3. Mission Briefing (all players)
- Background image fills all screens
- Target object image displayed prominently
- Mission title, location, era, atmosphere text
- Client reveal — each team sees only their own client:
  - **"Your client is {benefactor}. {motivation}"**
- Teams assigned randomly or by player choice (UI toggle: Random / Pick)

### 4. Architect Selection
- Each team selects their Architect via majority vote
- Each team member votes for one teammate
- Most votes wins. Tie = randomized between tied players
- Result shown: **"{Gamertag} is your Architect."**
- Role labels in-game:
  - Spymaster → **THE ARCHITECT**
  - Operatives → **OPERATIVE**

### 5. Game Start
- Board populates simultaneously on all screens
- Active team determined by coin flip (animated)
- Architect screens: full color-coded board
- Operative screens: plain word grid

---

## Screen Specifications

### Architect Screen
- Full 4×5 grid, color-coded by key:
  - **T1 color** — their 7 assets
  - **T2 color** — enemy's 7 assets
  - **Gray** — 5 neutral civilians
  - **Black + red border** — Bomb card
- Revealed cards shown in flipped/art state
- **Clue input panel** (active only on their turn):
  - Single word text field (validated — see Clue Validation)
  - Number selector: 1–7
  - SUBMIT button
  - Submitted clue broadcasts to all screens immediately
- Clue panel **hidden entirely** when not their turn
- **Read-only always** — no card interaction ever
- Top bar: Active syndicate name | Current clue | Guesses remaining

### Operative Screen
- Full 4×5 grid — plain words, no color
- Cards tappable only when their team's turn is active
- Non-active team: taps silently blocked (client + server enforced)
- **Pass Turn** button: visible only during their turn, only after ≥1 guess made
- Top bar: Active syndicate name | Current clue + number | Guesses remaining

### All Screens
- Heist background image behind grid (darkened overlay for readability)
- Score: T1 X/7 | T2 X/7
- Active syndicate name prominent
- Revealed cards visible in grid at all times (flipped state, art showing)

---

## Turn Mechanics

### Architect's Turn
1. Architect submits clue word + number
2. Clue broadcasts to all screens
3. Operative turn begins — board becomes tappable for active team only

### Operative Tap Flow
1. Operative taps a card
2. **Confirmation popup** on tapping operative's screen only:
   - **"{WORD}" — Are you sure?**
   - CONFIRM | CANCEL
3. On CONFIRM — broadcast to all teammates:
   - **"{Gamertag} picked {WORD}. You have 3 seconds to cancel."**
   - CANCEL button appears on all teammate screens
   - 3-second countdown with ticking sound
   - No cancel: card reveal sequence begins
   - Cancelled: card returns to tappable state, no penalty, no turn cost

---

## Card Reveal Sequence

1. Card **animates to center screen** — scales up, black blur overlay behind it
2. Card **flips** — CSS 3D flip animation
3. Reveal shows:
   - Card art (imageUrl from Firestore)
   - Card title as overlay along bottom of card
4. **Story content** appears below card:
   - Assets: asset name + description
   - Civilians: civilian name + description
   - Bomb: bomb name + description
5. Brief pause — card **animates back** to grid position in flipped/revealed state
6. Revealed asset cards show **{n}/7** at top in owning team's color

---

## Reveal Outcomes

### ✅ Own Asset
- **Sound:** Warm success chime
- Card tinted in team color, shows {n}/7
- Continue if guesses remain
- If 7th asset: **WIN SCREEN** triggers immediately
- Bonus: after exhausting clue-number guesses correctly, 1 optional extra guess. Pass Turn becomes available.

### ❌ Opponent's Asset
- **Sound:** Deflating failure tone
- Card tinted in opponent's color, shows their {n}/7
- Opponent count increments — if their 7th: opponent **WIN SCREEN**
- Turn passes to opponent immediately

### ⬜ Neutral Civilian
- **Sound:** Flat thud / neutral tone
- Civilian art revealed, name + description shown
- Turn passes to opponent immediately

### 💣 Bomb
- **Sound:** Heist-specific bomb sound (Mission Pack 1: squealing tires → gunfire → "FREEZE! FBI! NOBODY MOVE!")
- Screen floods red
- Guessing team loses immediately
- Transition to opponent WIN SCREEN

---

## Win Screen

### Winning Syndicate
- Target object image displayed large
- Mission title
- **"{Syndicate Name} pulled the job."**
- Client name + motivation
- All 7 assembled assets shown in sequence (1–7) with art
- Celebratory animation + sound

### Losing Syndicate (Bomb triggered)
- Bomb image large, screen red
- **"{Syndicate Name}"** — struck through
- Winning syndicate's assembled assets shown
- **"The job is over."**

---

## Turn State Machine

```
LOBBY
  → HEIST_SELECTION (host)
    → BRIEFING (all)
      → TEAM_FORMATION
        → ARCHITECT_VOTE
          → GAME_START
            → [ACTIVE]_ARCHITECT_CLUE
              → [ACTIVE]_OPERATIVE_GUESS
                → CONFIRM_TAP
                  → CANCEL → back to OPERATIVE_GUESS
                  → CONFIRM → CARD_REVEAL
                    → OWN_ASSET → continue | SWITCH_TEAM | WIN
                    → OPPONENT_ASSET → SWITCH_TEAM (or WIN if their 7th)
                    → NEUTRAL → SWITCH_TEAM
                    → BOMB → GAME_OVER → opponent WIN
                → PASS_TURN → SWITCH_TEAM
```

---

## Clue Validation Rules

Architect's clue must:
- Be a single word
- Not match any word currently visible on the board (case-insensitive)
- Not be a derivative of any board word (basic stemming check recommended)
- Not be empty or contain spaces

Validation failure: inline error, clue not submitted, Architect retries.

---

## Sound Effects

| Event | Sound |
|---|---|
| Own asset revealed | Warm success chime |
| Opponent asset revealed | Deflating failure tone |
| Neutral civilian revealed | Flat thud / neutral tone |
| Bomb — Mission Pack 1 | Squealing tires → gunfire → "FREEZE! FBI! NOBODY MOVE!" |
| Card tap confirmation | Soft click |
| 3-second countdown | Ticking |
| Turn pass | Whoosh / transition tone |
| Win screen | Triumphant heist sting |

> Bomb sound effect key stored per-Heist in `bomb.soundEffect`. Future Heists may define different sounds. Mission Pack 1 all use `"freeze_fbi"`.

---

## Heist Builder (Pro / Admin Only)

### Access
- Entry from FYVE's main landing page
- JMKit → **PRO: Build Heists** button
- Pro and Admin users only
- Follows same builder pattern as BLUFF BOX (Build Game Packs) and MEGA SKETCHY (Build Missions)

### Builder Sections

**1. Heist Identity**
- Title
- Briefing (long form text)
- Setting: location / era / atmosphere (separate fields)
- Background image upload → Firestore → `backgroundImageUrl`
- Target object image upload → Firestore → `targetObjectImageUrl`

**2. Clients**
- Syndicate 1: Benefactor name + motivation
- Syndicate 2: Benefactor name + motivation

**3. Assets (7 slots)**
- 7 slots — one per asset
- Each slot: asset name + description + AI image generator
- **AI image generator: reuse BLUFF BOX card image generator component**
  - Prompt constructed from: asset name + description + heist atmosphere
  - Output saved to Firestore, URL stored in `asset.imageUrl`
- At game time: all 7 asset images rendered with CSS tint overlay per team (T1 color or T2 color)
- Both syndicates race to collect the same 7 assets — tint is the only visual difference

**4. Civilians (5 slots)**
- Each slot: civilian name + description + AI image generator
- Same BLUFF BOX card image generator component
- Civilian names appear on the board as words — enter exactly as they should read (e.g. "THE CHAPLAIN")

**5. The Bomb**
- Bomb name (default: "THE BOMB")
- Bomb description (mission-specific flavor)
- Bomb image upload or AI generator
- Sound effect selector (dropdown of registered sound effect keys)

**6. Word Pool**
- Three tabs: Tier 1 / Tier 2 / Tier 3
- Tag-style input per tab (type word → enter to add, tap to remove)
- Guidance counts shown: Tier 1 ~20 / Tier 2 ~20 / Tier 3 ~10
- Minimum 30 total words required to publish
- Single words only, no duplicates within pool
- Optional: inline comment field per Tier 2/3 word for creator notes on the double-meaning (not shown in game)

**7. JSON Prefill (optional)**
- Upload `.json` matching the Heist object schema
- All text fields auto-populate:
  - briefing, setting, clients, asset names/descriptions, civilian names/descriptions, bomb name/description, word arrays
- Image fields remain empty — creator completes images one by one via generator
- **Recommended workflow:**
  1. Generate mission JSON externally (e.g. with Claude)
  2. Upload JSON to prefill all text
  3. Generate images asset by asset
  4. Save and publish

### Save / Publish
- Draft saves at any time
- Publish makes Heist available in host's library
- Admin-published → global library (all users)
- Pro-published → creator's personal library (shareable via link)

---

## Firebase Firestore Image Schema

```
/heists/{heistId}/
  backgroundImageUrl: string
  targetObjectImageUrl: string
  assets/{assetId}/
    imageUrl: string          // single base image, tinted at runtime per team
  civilians/{civilianId}/
    imageUrl: string
  bomb/
    imageUrl: string

/shared/
  bombSounds/{soundKey}: string   // audio file URLs keyed by soundEffect value
```

---

## Mission Pack 1 — Index

| ID | Title | Location | Era | Client 1 | Client 2 |
|---|---|---|---|---|---|
| mission_prime | The Ares Powder | Lunar Gateway | 2031 | Externe Labs | Kylie Jenner |
| mission_1 | Napoleon's Thumb | Paris Military Base | Present | Elon Musk | The Vatican |
| mission_2 | The Sunflower | The Louvre, Paris | Present | Taylor Swift | Kanye West |
| mission_3 | The Ghost Chip | Las Vegas Bunker | Present | Sam Altman | Mark Zuckerberg |
| mission_4 | The Empress Cut | Swiss Bank, Geneva | Present | Kim Kardashian | The British Royal Family |
| mission_5 | Project Chimera | Jay Leno's Garage | Present | Gordon Ramsay | Guy Fieri |
| mission_6 | The Satoshi Cache | Storage Unit, Idaho | Present | Warren Buffett | Oprah |
| mission_7 | The Tesla Codex | Branko's Kitchen, Serbia | Present | Tesla Motors | Greta Thunberg |

> Full mission data in `fyve_missions.js`

---

## Critical Notes For Opus

- All game state is **server-authoritative**. Key never leaves the server. Architect clients receive a color-coded render only — never raw key data.
- Card tap blocking for non-active teams: enforced both **client-side (UI) AND server-side (WebSocket message rejection)**. Never trust the client.
- The 3-second cancel window broadcasts to all teammates. Any teammate can cancel. The tapping operative cannot cancel their own pick.
- The Architect's clue input is **hidden entirely** — not just disabled — when not their turn.
- Revealed cards remain in grid at all times in flipped/art state.
- `{n}/7` on revealed asset cards always shows **owning team's color** regardless of who triggered the reveal.
- Pass Turn available only **after at least one guess** has been made in the current turn.
- Win condition checked **immediately** after every card reveal.
- Asset card images use a **single base image per asset** (7 per mission), tinted at render time via CSS filter or canvas. Do not generate or store separate images per team color.
- The Bomb card flavor (name, image, sound) is Heist-specific. The lose mechanic is universal.
- Civilian card names ARE the board words for neutral slots — they appear on the grid uppercased exactly as written in `civilians[].name`.
