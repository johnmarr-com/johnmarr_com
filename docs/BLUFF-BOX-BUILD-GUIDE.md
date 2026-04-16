# Bluff Box — Complete Build Guide

Everything needed to build the Bluff Box game. Read `GAME-DEVELOPMENT-GUIDE.md` first for platform fundamentals. This document covers Bluff Box–specific architecture, data models, game logic, and build order.

---

## Table of Contents

1. [Game Overview](#1-game-overview)
2. [File Structure](#2-file-structure)
3. [Data Model — Bluff Packs & Cards](#3-data-model--bluff-packs--cards)
4. [Image Generation — Upgraded Replicate Model](#4-image-generation--upgraded-replicate-model)
5. [Pack & Card Creation System](#5-pack--card-creation-system)
6. [Game Session — Custom Fields](#6-game-session--custom-fields)
7. [Tournament Logic — Full Specification](#7-tournament-logic--full-specification)
8. [AI Player Behavior](#8-ai-player-behavior)
9. [UI Components & Screens](#9-ui-components--screens)
10. [Firestore Security Rules](#10-firestore-security-rules)
11. [Firebase Storage Paths](#11-firebase-storage-paths)
12. [Build Order](#12-build-order)

---

## 1. Game Overview

**Bluff Box** is a party bluffing/deduction game for 2–30 players (humans and AI).

**Concept**: Players take turns opening Bluff Boxes containing crazy objects (depicted on cards from pre-built packs). Only the opener sees the contents. They describe what's inside — truthfully or as a lie. Their opponent must guess: truth or lie? Guess correctly and you survive. Guess wrong and you're eliminated.

**Format**: Sequential tournament. Only 2 players compete at a time. Everyone else watches. Winners advance to the next round. Losers are eliminated. Last player standing wins.

**Key distinction from other games**: This game follows the **Custom Session Model** pattern (like Mega Sketchy), NOT the chaptered video pattern. It uses custom fields on the `gameSessions` document and a host-driven phase machine. It does NOT use `useMultiplayerRound`.

---

## 2. File Structure

```
src/
├── app/games/bluffbox/
│   ├── page.tsx                    ← Next.js page (landing + game entry)
│   ├── BluffBoxGame.tsx            ← Main game component (phase machine)
│   ├── useBluffBoxSession.ts       ← Custom session hook (like useMegaSketchySession)
│   ├── tournament.ts               ← Pure tournament logic (matchup selection, elimination, win conditions)
│   ├── aiBluffPlayer.ts            ← AI share/guess logic
│   ├── BluffPackPicker.tsx          ← Pack selection modal for lobby (like MissionPicker)
│   ├── screens/
│   │   ├── PackSelectScreen.tsx     ← Host selects pack before game starts
│   │   ├── RoundIntroScreen.tsx     ← "ROUND N" announcement
│   │   ├── MatchupScreen.tsx        ← VS display + player grid (main game screen)
│   │   ├── SharerViewScreen.tsx     ← Box reveal + Truth/Lie buttons (sharer only)
│   │   ├── OpponentGuessScreen.tsx  ← Truth/Lie guess buttons (opponent only)
│   │   ├── TurnResultScreen.tsx     ← "They told the TRUTH! You WIN/LOSE!"
│   │   ├── WinnerScreen.tsx         ← Champion display
│   │   └── GameOverScreen.tsx       ← Tie or Total Party Kill
│   └── packs/
│       └── page.tsx                 ← "PRO: Create Bluff Packs" route
├── JMKit/
│   ├── BluffPackCover.tsx           ← Reusable pack cover component (image + name overlay)
│   └── BluffCard.tsx                ← Reusable card display (image fills square)
├── lib/
│   ├── bluffbox-packs.ts           ← Firestore CRUD for bluffboxPacks collection
│   └── bluffbox-storage.ts         ← Firebase Storage upload for pack/card images
```

---

## 3. Data Model — Bluff Packs & Cards

### Firestore Collection: `bluffboxPacks/{packId}`

Mirrors the `megasketchyMissions` pattern exactly. Cards are stored as an array of image URLs directly in the pack document (Firestore docs support up to 1MB; even 500 card URLs is well under that).

```typescript
interface BluffBoxPack {
  id: string;
  name: string;
  subtitle?: string;
  description?: string;
  coverImageURL: string;
  cards: string[];               // Array of card image URLs
  visibility: "official" | "private" | "shared";
  creatorId: string;
  creatorGamertag: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface CreatePackInput {
  name: string;
  subtitle?: string;
  description?: string;
  coverImageURL: string;
  visibility: "official" | "private" | "shared";
}
```

### CRUD Functions (in `src/lib/bluffbox-packs.ts`)

Follow the exact pattern from `src/lib/megasketchy-missions.ts`:

| Function | Purpose |
|----------|---------|
| `createPack(input, userId, gamertag)` | Create a new pack |
| `getPack(packId)` | Get single pack by ID |
| `getOfficialPacks()` | Query `visibility == "official"`, ordered by `createdAt desc` |
| `getMyPacks(userId)` | Query `creatorId == userId`, ordered by `createdAt desc` |
| `getSharedPacks()` | Query `visibility == "shared"`, ordered by `createdAt desc` |
| `updatePack(packId, updates)` | Update name, subtitle, description, visibility |
| `deletePack(packId)` | Delete entire pack |
| `addCardToPack(packId, imageURL)` | Append image URL to `cards` array |
| `removeCardFromPack(packId, imageURL)` | Remove image URL from `cards` array |
| `copyCardToPack(targetPackId, imageURL)` | Append image URL to another pack's `cards` array |

All use the same dynamic `import("firebase/firestore")` pattern and async `getDb()` helper.

---

## 4. Image Generation — Upgraded Replicate Model

Bluff Box pack covers and cards require higher-quality image generation than Mega Sketchy's doodle sketches.

### New AI Route Type

Add a new `type: "generate-image"` handler in `src/app/api/games/ai/route.ts`:

```typescript
// ─── High-quality image generation (Bluff Box) ──────────
if (type === "generate-image") {
  const { prompt: imagePrompt } = body as { prompt: string };

  const output = await replicate.run(
    "black-forest-labs/flux-dev",     // Higher quality than flux-schnell
    {
      input: {
        prompt: imagePrompt,
        aspect_ratio: "1:1",
        num_outputs: 1,
        output_format: "jpg",
        output_quality: 90,
        guidance: 3.5,
        num_inference_steps: 28,
      },
    },
  );

  const rawUrl = Array.isArray(output) ? output[0] : output;
  const imageUrl = typeof rawUrl === "string" ? rawUrl : String(rawUrl ?? "");

  if (!imageUrl) {
    return NextResponse.json({ error: "Image generation failed" }, { status: 502 });
  }

  return NextResponse.json({ imageUrl, type: "image" });
}
```

**Model choice**: `flux-dev` provides significantly better quality than `flux-schnell` (28 inference steps vs 4) while remaining affordable (~$0.025/image). The `guidance: 3.5` parameter controls prompt adherence.

### Client-side Usage

Pack covers and cards call this via the same authenticated fetch pattern used by `simpleMove` in `_gamecore/AIPlayerManager.ts`:

```typescript
async function generateBluffImage(prompt: string): Promise<string | null> {
  const headers = await getAIAuthHeaders();
  const res = await fetch("/api/games/ai", {
    method: "POST",
    headers,
    body: JSON.stringify({ type: "generate-image", prompt }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.imageUrl ?? null;
}
```

### Prompt Templates

**Pack covers**: The user provides a free-text prompt. Wrap it for best results:
```
Vivid colorful game card pack cover art: {userPrompt}. Bold graphic style, 
eye-catching, square format, suitable as a collectible card game pack cover.
```

**Cards**: The user provides a free-text prompt describing the crazy object:
```
Vivid detailed illustration of: {userPrompt}. Centered on white/light background, 
clear subject, colorful, game card art style, square format.
```

---

## 5. Pack & Card Creation System

### Access Control

Same pattern as Mega Sketchy missions:
- **Admin**: Can create official packs, edit any pack, toggle `isOfficial`
- **PRO** (`userTier === "pro"`): Can create private/shared packs
- **Free users**: Can browse and use official/shared packs, cannot create

Gate check: `const canCreate = isAdmin || userTier === "pro";`

### Landing Page Integration

Add a "PRO: Create Bluff Packs" button to the Bluff Box landing page via the `landingExtra` prop on `GameLandingPage`, identical to how Mega Sketchy adds "PRO: Create Mission":

```typescript
import { JMProButton } from "@/JMKit";

const landingExtra = canCreate ? (
  <JMProButton
    title="Create Bluff Packs"
    onClick={() => router.push("/games/bluffbox/packs")}
  />
) : null;

<GameLandingPage
  {...splashProps}
  landingExtra={landingExtra}
  // ...
/>
```

This renders the gold "PRO: Create Bluff Packs" button in the top-right corner of the landing page.

### Route: `/games/bluffbox/packs/page.tsx`

Follow the pattern from `/games/megasketchy/missions/page.tsx`:
- Tabs: **Create a Pack** (if `canCreate`) | **Browse All Packs**
- Auth check: redirect unauthenticated users to `/games/bluffbox`
- Create tab shows `BluffPackEditor`
- Browse tab shows `BluffPackBrowser`

### Pack Editor (`BluffPackEditor.tsx`)

The create/edit modal for a bluff pack. Fields:

1. **Pack Name** — required text input
2. **Cover Image Prompt** — text input for the AI image generation prompt
3. **Generate Cover** button — calls `generateBluffImage()`, shows loading spinner
4. **Cover Preview** — renders `BluffPackCover` component with the generated image. If no image yet, show placeholder. User can "Use This" or "Regenerate"
5. **Subtitle** — optional text input
6. **Description** — optional text input
7. **Visibility toggles** — same pattern as `MissionEditor`:
   - Admin-only: "Make this an Official Pack" checkbox
   - Non-official: "Share this pack with everyone" checkbox
8. **Cards Grid** — grid of existing cards (see below)
9. **Save Pack** button

### Cards Grid (within Pack Editor or Pack Detail)

Displays all cards in the pack as a grid of square thumbnails using `BluffCard` component.

Each card grid item has:
- The card image (square, slightly rounded corners)
- A **Delete** button (trash icon) → confirm delete popup → calls `removeCardFromPack`
- A **Copy** button → opens a modal to select which of the user's other packs to copy to → calls `copyCardToPack`

If no cards exist, show an alert: "No cards yet. Create some cards for this pack!"

The grid's last cell is a **"+Card"** button that opens the **Create Card** flow.

### Create Card Flow

A modal/popup containing:

1. **Card Preview** — large square with slightly rounded corners. Empty/placeholder until image is generated
2. **Card Prompt Input** — text input for the AI prompt describing the crazy object
3. **Generate** button — calls `generateBluffImage()` with the card prompt template
4. After generation, three buttons:
   - **Save** — uploads image to Firebase Storage, gets permanent URL, calls `addCardToPack(packId, url)`, closes modal
   - **Recreate** — re-runs generation with same prompt
   - **Cancel** — discards and closes

**Important**: Only the image URL is saved. The prompt is NOT stored.

### Image Upload Flow

When saving a generated card or cover image:
1. Fetch the Replicate URL → get blob
2. Upload blob to Firebase Storage via `uploadBluffImage()` (in `src/lib/bluffbox-storage.ts`)
3. Return permanent public URL
4. Save that URL to the Firestore pack document

---

## 6. Game Session — Custom Fields

Bluff Box adds custom fields to the standard `gameSessions/{id}` document, just like Mega Sketchy adds `skPhase`, `chains`, etc.

### Custom Fields on Session Document

```typescript
interface BluffBoxSessionFields {
  // ─── Phase Machine ─────────────────────────────────────
  bbPhase: BluffBoxPhase;

  // ─── Pack Selection ────────────────────────────────────
  selectedPackId: string;
  selectedPackName: string;
  selectedPackCoverURL: string;
  cardPool: string[];              // Shuffled card URLs from the selected pack

  // ─── Tournament State ──────────────────────────────────
  roundNumber: number;             // Current round (1-indexed)
  bonusRoundCount: number;         // How many bonus rounds played (max 2)
  
  // Per-player status for the current round
  // "alive" = still in tournament, hasn't played this round
  // "played" = still in tournament, already played this round  
  // "eliminated" = out of the tournament
  playerStatuses: Record<string, "alive" | "played" | "eliminated">;

  // ─── Current Matchup ───────────────────────────────────
  matchup: {
    sharer: string;                // UID of current sharer
    opponent: string;              // UID of current opponent
    turn: 1 | 2;                   // Turn 1 = first sharer/opponent pair, Turn 2 = roles swapped
    isStandIn: boolean;            // True if sharer is a stand-in (eliminated player filling in)
    cardURL: string | null;        // The revealed card image URL (null until box is tapped)
    sharerChoice: "truth" | "lie" | null;
    opponentGuess: "truth" | "lie" | null;
    aiShareText: string | null;    // AI's verbal description (shown to all players)
    humanShareText: string | null; // Human's typed description (for AI opponent)
  } | null;

  // ─── Results History ───────────────────────────────────
  matchupLog: Array<{
    sharer: string;
    opponent: string;
    sharerChoice: "truth" | "lie";
    opponentGuess: "truth" | "lie";
    opponentSurvived: boolean;
    isStandIn: boolean;
    round: number;
  }>;

  // ─── End State ─────────────────────────────────────────
  bbWinner: string | null;                 // Single winner UID
  bbTiedWinners: string[];                 // Multiple winners (tie)
  bbEndType: "winner" | "tie" | "tpk" | null;  // How the game ended
}

type BluffBoxPhase =
  | "pack-select"       // Host choosing pack
  | "round-intro"       // "ROUND N" announcement (brief, auto-advance or host tap)
  | "matchup-reveal"    // Show who's competing in the VS boxes
  | "sharer-box"        // Sharer sees the BluffBox, taps to reveal
  | "sharer-decide"     // Sharer sees card + Truth/Lie buttons
  | "ai-share-display"  // AI sharer's text shown to all players
  | "human-to-ai-input" // Human sharer types description for AI opponent
  | "opponent-guess"    // Opponent sees Truth/Lie buttons
  | "turn-result"       // Result of this turn (opponent survived or eliminated)
  | "matchup-complete"  // Both turns done, update statuses
  | "round-end"         // All matchups done, evaluate round
  | "game-over";        // Winner, tie, or TPK — final screen
```

### Phase Transitions

The host drives all phase transitions by writing to the session via `updateSessionFields` (same helper as Mega Sketchy's `useMegaSketchySession`). All players subscribe to the session and render based on `bbPhase`.

```
pack-select
  ↓ (host selects pack)
round-intro
  ↓ (auto-advance after delay or host tap)
matchup-reveal
  ↓ (auto-advance after delay)
sharer-box
  ↓ (sharer taps box → card revealed)
sharer-decide
  ↓ (sharer taps Truth or Lie)
  ├── [if AI sharer] → ai-share-display → opponent-guess
  ├── [if human sharer, AI opponent] → human-to-ai-input → opponent-guess
  └── [if human sharer, human opponent] → opponent-guess
opponent-guess
  ↓ (opponent taps Truth or Lie)
turn-result
  ↓ (show result, delay)
  ├── [if turn 1 and not stand-in] → swap roles → sharer-box (turn 2)
  └── [if turn 2 or stand-in] → matchup-complete
matchup-complete
  ↓ (update player statuses)
  ├── [if more unplayed alive players] → matchup-reveal (next matchup)
  └── [if all played] → round-end
round-end
  ↓ (evaluate survivors)
  ├── [2+ survivors] → round-intro (next round)
  ├── [1 survivor] → game-over (winner)
  ├── [0 survivors, bonus rounds < 2] → round-intro (bonus round)
  └── [0 survivors, bonus rounds >= 2] → game-over (TPK)
  └── [after 2 bonus rounds with survivors] → game-over (tie)
```

---

## 7. Tournament Logic — Full Specification

Implement in `src/app/games/bluffbox/tournament.ts` as pure functions (no Firestore dependency — just logic).

### Matchup Selection

```typescript
function selectNextMatchup(
  playerStatuses: Record<string, "alive" | "played" | "eliminated">,
  allPlayerUids: string[],
): { sharer: string; opponent: string; isStandIn: boolean } | null
```

1. Get all players with status `"alive"` (haven't played this round yet, not eliminated).
2. If 2+ alive players: pick 2 at random. Randomly assign one as sharer, other as opponent. `isStandIn = false`.
3. If exactly 1 alive player: this is the **stand-in** case.
   - Pick a random **stand-in** from ALL players (including eliminated ones, excluding the final player).
   - The stand-in is the **sharer**. The final alive player is the **opponent**.
   - `isStandIn = true`.
4. If 0 alive players: return `null` (round is complete).

### Card Selection

```typescript
function selectCard(cardPool: string[]): { card: string; remainingPool: string[] }
```

Pop a card from the shuffled `cardPool`. If pool is empty, reshuffle original pack cards.

### Turn Resolution

```typescript
function resolveTurn(
  sharerChoice: "truth" | "lie",
  opponentGuess: "truth" | "lie",
): { opponentSurvived: boolean }
```

The opponent survives if `opponentGuess === sharerChoice`. That's it.

### Matchup Completion

After both turns of a matchup (or 1 turn for stand-in):
- For each player who was the **opponent** in a turn:
  - If they did NOT survive → set status to `"eliminated"`
  - If they survived → set status to `"played"`
- The stand-in's status does NOT change (they were already eliminated or played).

### Round Evaluation

```typescript
function evaluateRound(
  playerStatuses: Record<string, "alive" | "played" | "eliminated">,
  bonusRoundCount: number,
): {
  action: "next-round" | "winner" | "bonus-round" | "tie" | "tpk";
  survivors: string[];
  winner?: string;
}
```

1. Count players with status `"played"` (survivors of this round).
2. If **2+ survivors** → `"next-round"`. Reset all `"played"` to `"alive"` for next round.
3. If **exactly 1 survivor** → `"winner"`. That player wins.
4. If **0 survivors** (total elimination):
   - If `bonusRoundCount < 2` → `"bonus-round"`. Reset ALL players to `"alive"` (everyone gets another chance). Increment `bonusRoundCount`.
   - If `bonusRoundCount >= 2` → `"tpk"` (Total Party Kill). Nobody wins.
5. **After 2 bonus rounds with 2+ survivors** → `"tie"`. All survivors share the win.

### Round Reset

When starting a new round:
- All players with status `"played"` → reset to `"alive"`
- Players with status `"eliminated"` stay eliminated
- Increment `roundNumber`
- Clear `matchup` to `null`

When starting a **bonus round**:
- ALL players (including eliminated) → reset to `"alive"`
- Increment `roundNumber` and `bonusRoundCount`

---

## 8. AI Player Behavior

Implement in `src/app/games/bluffbox/aiBluffPlayer.ts`.

### AI as Sharer

When an AI player is the sharer:

1. The host reveals the card (writes `cardURL` to session).
2. The host calls the AI to decide truth or lie AND generate share text:

```typescript
async function aiShare(
  cardImageURL: string,
  persona: { prompt: string; voice: string },
): Promise<{ choice: "truth" | "lie"; shareText: string }>
```

**Strategy**: The AI randomly decides to tell the truth (~50%) or lie (~50%). Persona style can nudge this (chaotic personas lie more, balanced are 50/50).

**Prompt for TRUTH**:
```
You are playing a bluffing game. You opened a box and found the object shown.
You've decided to TELL THE TRUTH about what's inside.

Describe the object in 1-2 sentences in a fun, dramatic way. Be specific about 
what you see but make it entertaining. Your personality: {persona.prompt}
Your speaking style: {persona.voice}

Just output the description, nothing else.
```

This is sent as a `type: "vision"` request with the card image.

**Prompt for LIE**:
```
You are playing a bluffing game. You opened a box containing a secret object, 
but you've decided to LIE about what's inside.

Make up a completely different, believable but fun object. Describe it in 1-2 
sentences in a dramatic way. Your personality: {persona.prompt}
Your speaking style: {persona.voice}

Just output the fake description, nothing else.
```

This is sent as a regular text `type: "move"` request (no image needed since the AI is lying).

3. Host writes `aiShareText` and `sharerChoice` to the session.
4. All players see a popup with the AI's share text.

### AI as Opponent

When an AI player is the opponent:

1. The human sharer has already selected Truth or Lie and typed what they told the AI (stored in `humanShareText`).
2. The host calls the AI to guess:

```typescript
async function aiGuess(
  humanShareText: string,
  persona: { prompt: string; voice: string },
): Promise<"truth" | "lie">
```

**Prompt**:
```
You are playing a bluffing game. Your opponent opened a mystery box and told 
you what's inside. They said:

"{humanShareText}"

They might be telling the truth, or they might be lying. Based on how their 
description sounds, decide: are they telling the TRUTH or a LIE?

Your personality: {persona.prompt}

Respond with ONLY the word "TRUTH" or "LIE", nothing else.
```

Parse the response. Fallback to random if parse fails.

3. Host writes `opponentGuess` to session.

### AI vs AI

When both sharer and opponent are AI:
- Host runs AI sharer logic (vision + share text)
- Displays share text popup briefly
- Host runs AI opponent logic (guess based on share text)
- Auto-advances through result

---

## 9. UI Components & Screens

### JMKit Components

#### `BluffPackCover` (`src/JMKit/BluffPackCover.tsx`)

Reusable component that assembles a pack cover: image layer + name overlay.

```
Props:
  - coverImageURL: string
  - name: string
  - size: number (width = height, square)
  - subtitle?: string (shown below name if provided)
```

Visual: Square with slightly rounded corners. Cover image fills the square. Semi-transparent gradient from bottom (black/80 → transparent). Pack name in white bold font along the bottom. Optional subtitle in smaller white/70 below name.

#### `BluffCard` (`src/JMKit/BluffCard.tsx`)

Reusable card display component.

```
Props:
  - imageURL: string
  - size: number (width = height, square)
```

Visual: Square with slightly rounded corners. Card image fills the square.

### Game Screens

#### Main Game Screen (`MatchupScreen.tsx`)

The primary screen ALL players see during gameplay:

**Layout (top to bottom)**:
1. **Round indicator**: "ROUND {N}" (or "BONUS ROUND {N}") centered at top, bold white text
2. **VS Display**: Two large boxes (rounded corners, semi-transparent black bg) side by side with a vivid white "VS" between them. Each box shows:
   - Player's animated avatar (`JMAvatarView`)
   - Player's gamertag
   - Role label: "SHARING" or "GUESSING" (during active matchup)
   - "STAND-IN" label (if applicable)
   - "COMPETING" label shown briefly when first placed
3. **Player Grid**: Scrollable grid of ALL players with:
   - Animated avatar (`JMAvatarView`) — stops animating if eliminated
   - Gamertag below avatar
   - Grayed out if eliminated
   - Blue checkmark (lucide `CheckCircle`) in top-right if played this round
   - "COMPETING" label if currently in the VS boxes
   - "STAND-IN" label if serving as stand-in

#### Sharer View Screen (`SharerViewScreen.tsx`)

**ONLY shown on the sharer's device** (replaces MatchupScreen temporarily):

**Phase 1 — Box Closed**:
- Game background (splash bg with overlay)
- Large BluffBox image centered (`/images/bluffbox.png` — static asset, needs to be created/provided)
- Text: "Tap to view contents. But don't let anyone see."
- Tap anywhere → transitions to Phase 2

**Phase 2 — Card Revealed**:
- The card image displayed large and centered (using `BluffCard` component at large size)
- Text: "Describe what's in your box — truthfully, or make something up!"
- Two buttons at bottom, side by side:
  - **TRUTH** button (green)
  - **LIE** button (red)
  - **IMPORTANT**: Randomly assign left/right positions each time so the opponent can't read finger placement
- Sharer taps one → writes `sharerChoice` to session

#### Human-to-AI Input Screen

Shown when the sharer is human and the opponent is AI:
- Text: "What did you tell {AI name}?"
- Text input for the human to type their description
- Submit button → writes `humanShareText` to session

#### AI Share Display

Shown to ALL players when the sharer is AI:
- Modal/popup overlay
- AI avatar + name at top
- AI's share text in large quote format
- "They've made their choice..." at bottom
- Auto-dismiss after a few seconds or tap to continue

#### Opponent Guess Screen (`OpponentGuessScreen.tsx`)

**ONLY shown on the opponent's device**:

- Text: "Did they tell the TRUTH or a LIE?"
- Subtext: "You can ask up to 3 questions first" (only if sharer is human)
- Two large buttons:
  - **TRUTH** (green)
  - **LIE** (red)
- Opponent taps one → writes `opponentGuess` to session

#### Turn Result Screen (`TurnResultScreen.tsx`)

Shown to ALL players after opponent guesses:

- Large text announcing the result:
  - If sharer told truth: "They told the **TRUTH**!"
  - If sharer lied: "They **LIED**!"
- Below that:
  - If opponent guessed correctly: "{Opponent name} **SURVIVES**!" (green, celebratory)
  - If opponent guessed wrong: "{Opponent name} is **ELIMINATED**!" (red, dramatic)
- Sound effect plays on opponent's device
- Auto-advance after delay

#### Winner Screen (`WinnerScreen.tsx`)

- Large animated winner avatar (prominent, centered)
- Winner's gamertag
- "BLUFF BOX CHAMPION!" text
- Celebratory styling (could reuse animation patterns from existing games)
- Host-only: "Play Again" button

#### Game Over Screen (`GameOverScreen.tsx`)

**Tie**:
- Grid of tied winner avatars and gamertags
- "IT'S A TIE!" header
- Host-only: "Play Again" button

**Total Party Kill**:
- Dramatic text: "TOTAL PARTY KILL!"
- Subtext: "All players have been eliminated. Nobody won!"
- All player avatars grayed out
- Host-only: "Play Again" button

---

## 10. Firestore Security Rules

Add to `firestore.rules` alongside the existing game rules:

```
// ─────────────────────────────────────────────────────────────
// BLUFF BOX PACKS
// ─────────────────────────────────────────────────────────────

match /bluffboxPacks/{packId} {
  // Anyone authenticated can read official & shared packs,
  // creators can read their own private packs, admins read all
  allow read: if isAdmin()
    || resource.data.visibility == "official"
    || resource.data.visibility == "shared"
    || (isAuthenticated() && resource.data.creatorId == request.auth.uid);
  
  // Authenticated users can create packs (pro/admin gating is client-side).
  // creatorId must match the requesting user.
  // Only admins can create "official" packs.
  allow create: if isAuthenticated()
    && request.resource.data.creatorId == request.auth.uid
    && (request.resource.data.visibility != "official" || isAdmin());
  
  // Creator can update their own packs, admins can update any.
  // Only admins can set visibility to "official".
  allow update: if (isAuthenticated() && resource.data.creatorId == request.auth.uid || isAdmin())
    && (request.resource.data.visibility != "official" || isAdmin());
  
  // Creator can delete their own packs, admins can delete any
  allow delete: if (isAuthenticated() && resource.data.creatorId == request.auth.uid) || isAdmin();
}
```

These are identical to the `megasketchyMissions` rules, with `bluffboxPacks` substituted.

---

## 11. Firebase Storage Paths

```
bluffbox-packs/{packId}/cover.jpg          ← Pack cover image
bluffbox-packs/{packId}/cards/{index}.jpg  ← Card images (index = array position)
```

Upload function in `src/lib/bluffbox-storage.ts`:

```typescript
export async function uploadBluffImage(
  packId: string,
  type: "cover" | "card",
  blob: Blob,
  cardIndex?: number,
): Promise<string> {
  // Same pattern as src/lib/game-sketches.ts:
  // initializeFirebase → getStorage → ref → uploadBytes → return public URL
  const path = type === "cover"
    ? `bluffbox-packs/${packId}/cover.jpg`
    : `bluffbox-packs/${packId}/cards/${cardIndex}.jpg`;
  // ...
}
```

Firebase Storage rules should allow authenticated users to write to `bluffbox-packs/` paths. Read should be public (images served via public URLs).

---

## 12. Build Order

### Phase 1: Data Layer & Image Generation

**Files to create/modify:**

1. `src/lib/bluffbox-packs.ts` — Full Firestore CRUD (model on `megasketchy-missions.ts`)
2. `src/lib/bluffbox-storage.ts` — Firebase Storage upload helper (model on `game-sketches.ts`)
3. `src/app/api/games/ai/route.ts` — Add `type: "generate-image"` handler with `flux-dev`
4. `firestore.rules` — Add `bluffboxPacks` rules (copy `megasketchyMissions` rules, rename collection)

### Phase 2: JMKit Display Components

5. `src/JMKit/BluffPackCover.tsx` — Pack cover component (image + name overlay)
6. `src/JMKit/BluffCard.tsx` — Card display component (image only)
7. Export both from `src/JMKit/index.ts`

### Phase 3: Pack & Card Creation UI

8. `src/app/games/bluffbox/packs/page.tsx` — Route page with Create/Browse tabs (model on `megasketchy/missions/page.tsx`)
9. `BluffPackBrowser.tsx` — Browse official/my/shared packs (model on `MissionBrowser.tsx`)
10. `BluffPackEditor.tsx` — Create/edit pack with cover generation
11. `BluffCardCreator.tsx` — Create card modal with image generation
12. `BluffPackDetailView.tsx` — View pack details and card grid. **Pack picker** (`readOnlyCards`): no per-card actions; `BluffCard` uses `pointer-events: none` so the cell wrapper receives gestures. **Browse/edit**: owner gets copy/delete on cards when not read-only. **Note:** `JMSelectAsset` sets `document.body.style.overflow = "hidden"` while open; `AuthGate` clears `body` overflow on `pathname` change so SPA navigations do not leave the site non-scrollable.

### Phase 4: Landing Page Update

13. Update `src/app/games/bluffbox/page.tsx`:
    - Remove `disabled` prop (game is now real)
    - Add `landingExtra` for "PRO: Create Bluff Packs" button
    - Add multiplayer flow with `multiplayerFlowMode="party"` (since 2-30 players)
    - Add `lobbyExtra` for pack selection display
    - Wire `onMultiplayerStart` to transition to `BluffBoxGame`

### Phase 5: Game Session Hook & Tournament Logic

14. `src/app/games/bluffbox/tournament.ts` — Pure tournament functions
15. `src/app/games/bluffbox/useBluffBoxSession.ts` — Custom session hook (model on `useMegaSketchySession.ts`)

### Phase 6: Game Screens

16. `src/app/games/bluffbox/screens/PackSelectScreen.tsx`
17. `src/app/games/bluffbox/screens/RoundIntroScreen.tsx`
18. `src/app/games/bluffbox/screens/MatchupScreen.tsx` (main game view)
19. `src/app/games/bluffbox/screens/SharerViewScreen.tsx`
20. `src/app/games/bluffbox/screens/OpponentGuessScreen.tsx`
21. `src/app/games/bluffbox/screens/TurnResultScreen.tsx`
22. `src/app/games/bluffbox/screens/WinnerScreen.tsx`
23. `src/app/games/bluffbox/screens/GameOverScreen.tsx`

### Phase 7: Main Game Component & AI

24. `src/app/games/bluffbox/aiBluffPlayer.ts` — AI share/guess logic
25. `src/app/games/bluffbox/BluffBoxGame.tsx` — Phase machine wiring all screens
26. `src/app/games/bluffbox/BluffPackPicker.tsx` — Pack selection modal for lobby

### Phase 8: Polish & Integration

27. Sound effects for results
28. Points awarding (`PointsManager.award(Activity.PLAY_GAME)`)
29. AI persona stat recording (`recordAIGameResult`)
30. Static assets: `public/images/bluffbox.png` (the mystery box image)

---

## Key Patterns to Follow

| Pattern | Reference File | What to Copy |
|---------|---------------|-------------|
| Firestore CRUD lib | `src/lib/megasketchy-missions.ts` | Dynamic imports, `getDb()`, CRUD shape, `visibility` field |
| Storage uploads | `src/lib/game-sketches.ts` | `initializeFirebase`, `getStorage`, `uploadBytes`, public URL |
| Pack browser UI | `megasketchy/missions/MissionBrowser.tsx` | Official/My/Shared tabs, sort, edit/delete for "My" |
| Pack editor UI | `megasketchy/missions/MissionEditor.tsx` | Save logic, visibility toggles, validation |
| Lobby pack picker | `megasketchy/MissionPicker.tsx` | Modal with tabs, filter by criteria, select callback |
| Landing page extras | `megasketchy/page.tsx` | `landingExtra` prop with `JMProButton` |
| Custom session hook | `megasketchy/useMegaSketchySession.ts` | `subscribeToSession`, `updateSessionFields`, derived state |
| Phase machine game | `megasketchy/MegaSketchyGame.tsx` | Host-driven phases, render by phase, screen components |
| AI image generation | `megasketchy/aiPlayer.ts` | `fetchAI` pattern, Replicate integration, blob handling |
| AI text decisions | `_gamecore/AIPlayerManager.ts` | `simpleMove`, persona wrapping, `ACTION:` parsing |
| PRO access gating | `megasketchy/page.tsx` line 24 | `isAdmin \|\| userTier === "pro"` |
| Avatar rendering | `JMKit/JMAvatarView.tsx` | `<JMAvatarView width={N} avatarName={name} />` |
| Auth context | `src/lib/AuthProvider.tsx` | `useAuth()` → `{ user, gamertag, avatarName, isAdmin, userTier }` |

---

## TypeScript Reminders

- `exactOptionalPropertyTypes` is enabled. Use conditional spreads:
  ```typescript
  ...(value != null ? { field: value } : {})
  ```
- All client-side Firebase imports must be dynamic:
  ```typescript
  const { doc, updateDoc } = await import("firebase/firestore");
  ```
- Files using browser APIs need `"use client"` at the top.
- Do NOT assign `undefined` to optional properties.

---

## Static Assets Needed

| Asset | Path | Notes |
|-------|------|-------|
| BluffBox mystery box image | `public/images/bluffbox.png` | The closed box that sharers tap to reveal. Needs to be created or generated. Square, dramatic, mysterious box graphic. |

The game's splash art (icon, logo, background, music) is already configured in the CMS game definition created via Admin.
