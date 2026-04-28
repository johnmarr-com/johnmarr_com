# Fast Casual Trivia — Phase 1 Build Spec

## Game Engine: `fast_casual_trivia`

**What this covers:** Everything that happens AFTER the game owner
presses "Start Game" with invites accepted — up to but NOT including
actual trivia gameplay. This is the game shell: mode selection, team
setup, game board layout, hot-swap theming, tag filtering, and
leaderboard display.

**What this does NOT cover:** The trivia question/answer mechanic
itself. That is Phase 2.

---

## Architecture Context

### Existing Infrastructure

- The game engine `fast_casual_trivia` already exists and loads a
  `?game={game}` parameter from the URL on launch.
- The game object (skin) is already fetched and applied — imagery,
  fonts, colors.
- The game factory system handles: splash screen, invites, lobby,
  interstitials, leaderboards, win/lose screens.
- FYVE already has a Team Selector experience for 2-team assignment.
- JMKit provides shared UI components across all games.
- Wordonkulous has a text display card that auto-sizes to content.

### What Needs to Be Built

1. **Game Mode Screen** — new screen in the game factory flow
2. **Team Leads Assignment Page** — new team setup flow
3. **Adapted Team Selector** — extend FYVE's 2-team selector to
   support 2-4 teams
4. **Game Board Shell** — the play field layout with logo, menu,
   tags, card, and leaderboard
5. **Hot-Swap Theme System** — mid-game skin switching with
   coordinated animations
6. **Tag Filter UI** — interactive tag toggle system
7. **Updated JMKit Leaderboard** — extend to support team display

---

## Screen Flow

```
[Game Factory: Splash → Invite → Lobby → Owner taps "Start Game"]
                          │
                          ▼
              ┌─ GAME MODE SCREEN ─┐
              │  (Owner only sees   │
              │   mode options.     │
              │   Players stay on   │
              │   waiting/epic page)│
              └─────────┬──────────┘
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
     Single Play    Full Team     Team Leads
          │             │             │
          │             ▼             ▼
          │      Team Selector   Team Leads
          │      (2-4 teams)     Assignment
          │      (adapted from   (new page)
          │       FYVE)               │
          │             │             │
          └─────────────┼─────────────┘
                        │
                        ▼
              ┌─ GAME BOARD ─────────┐
              │  Logo (top right)    │
              │  Menu (top left,     │
              │    owner only)       │
              │  Trivia Card (center)│
              │  Leaderboard (below) │
              └──────────────────────┘
```

---

## Section 1: Game Mode Screen

### When It Appears

Immediately after the game owner taps "Start Game" in the lobby.
This screen is shown ONLY to the game owner. All other players
remain on the existing waiting/epic page until the owner completes
mode selection and team setup.

### Layout

```
┌─────────────────────────────────────────┐
│                                         │
│  ┌─ SINGLE PLAY ─────────────────────┐  │
│  │                                   │  │
│  │  [Graphical Button]               │  │
│  │  "Single Play"                    │  │
│  │  Every person's device is         │  │
│  │  connected & Every player         │  │
│  │  plays for themself.              │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌─ TEAMS ───────────────────────────┐  │
│  │                                   │  │
│  │  [Graphical Button]               │  │
│  │  "Full Team"                      │  │
│  │  Every person's device is         │  │
│  │  connected & Every player         │  │
│  │  is part of a team.              │  │
│  │                                   │  │
│  │  [Graphical Button]               │  │
│  │  "Team Leads"                     │  │
│  │  Only Team Leads' devices are     │  │
│  │  connected. Team players gather   │  │
│  │  around their team lead.          │  │
│  │                                   │  │
│  │  ┌──────────────┐ ┌───────────┐  │  │
│  │  │ # of Teams: 2│ │   Next    │  │  │
│  │  └──────────────┘ └───────────┘  │  │
│  │  (both disabled on mount)         │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

### Behavior

#### On Mount

- Single Play button: active, tappable
- Full Team button: active, tappable
- Team Leads button: active, tappable
- Number of Teams button: **disabled, grayed out**, displays "2"
- Next button: **disabled, grayed out**
- No mode is pre-selected

#### On Tap: Single Play

- All players immediately transition to the Game Board.
- No team setup needed.
- Game mode is set to `'single'`.
- Leaderboard will display individual players.

#### On Tap: Full Team

- Full Team button becomes visually selected (highlighted state).
- Team Leads button becomes unselected if it was selected.
- Number of Teams button becomes **active**.
- Next button becomes **active**.
- Number of Teams defaults to **2**.
- Number of Teams tap cycles: **2 → 3 → 4 → 2** (loops).
- Game mode is set to `'full_team'`.

#### On Tap: Team Leads

- Team Leads button becomes visually selected (highlighted state).
- Full Team button becomes unselected if it was selected.
- Number of Teams button becomes **active**.
- Next button becomes **active**.
- Number of Teams defaults to **2**.
- Number of Teams tap cycles: **2 → 3 → 4 → 5 → ... → 20 → 2**
  (loops).
- Game mode is set to `'team_leads'`.

#### On Tap: Next (Full Team selected)

- Navigate to the **Team Selector** (adapted from FYVE).
- Pass `numberOfTeams` to the Team Selector component.

#### On Tap: Next (Team Leads selected)

- Navigate to the **Team Leads Assignment Page** (new page).
- Pass `numberOfTeams` to the assignment page.

### State

```typescript
interface GameModeState {
  mode: 'single' | 'full_team' | 'team_leads' | null
  numberOfTeams: number  // default 2
}
```

---

## Section 2: Team Selector (Adapted from FYVE)

### Current State

FYVE's Team Selector currently supports exactly 2 teams. Players
are assigned to Team A or Team B through an interactive selection
experience.

### Required Adaptation

Extend the Team Selector to support 2, 3, or 4 teams. The number
of teams is passed in from the Game Mode Screen.

```typescript
interface TeamSelectorProps {
  numberOfTeams: 2 | 3 | 4
  players: Player[]
  onComplete: (teams: Team[]) => void
}
```

### Behavior

- The existing 2-team flow remains the default and unchanged.
- For 3 or 4 teams, the UI expands to show additional team
  columns/sections.
- Players are distributed across teams through the same interactive
  drag/tap mechanism FYVE currently uses.
- Each team gets a distinct color from the team color roster.
- Each team gets a random team logo from the team logo roster,
  colorized to match the team color.

### On Complete

- Teams are assigned and stored in the game session.
- All players transition to the Game Board.
- The continue button label should match whatever FYVE's Team
  Selector currently uses.

---

## Section 3: Team Leads Assignment Page (New)

### When It Appears

After the game owner taps "Next" on the Game Mode Screen with
"Team Leads" selected.

### Context

In Team Leads mode, only the team leads have connected devices.
Their team members gather physically around them. This mode is
designed for large groups (up to 20 teams) where not everyone
needs a phone — like a bar trivia night or a classroom.

### Layout

```
┌─────────────────────────────────────────┐
│                                         │
│  Team Leads                             │
│                                         │
│  ┌─ Player 1 ───────────────────────┐   │
│  │  [Color Dot] [Logo] PlayerName   │   │
│  └──────────────────────────────────┘   │
│                                         │
│  ┌─ Player 2 ───────────────────────┐   │
│  │  [Color Dot] [Logo] PlayerName   │   │
│  └──────────────────────────────────┘   │
│                                         │
│  ┌─ Player 3 ───────────────────────┐   │
│  │  [Color Dot] [Logo] PlayerName   │   │
│  └──────────────────────────────────┘   │
│                                         │
│  ...                                    │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │         [Continue Button]         │   │
│  └──────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### On Mount

- All connected players are listed vertically.
- Every player is a team lead (all players are included).
- Each player is automatically assigned:
  - A **random color** from the team color roster (see below).
  - A **random team logo** from the team logo roster, colorized
    to match that team's assigned color.

### Team Color Roster

```typescript
const TEAM_COLORS = [
  { name: 'Red',    hex: '#E53E3E' },
  { name: 'Blue',   hex: '#3182CE' },
  { name: 'Green',  hex: '#38A169' },
  { name: 'Orange', hex: '#DD6B20' },
  { name: 'Purple', hex: '#805AD5' },
  { name: 'Pink',   hex: '#D53F8C' },
  { name: 'Yellow', hex: '#D69E2E' },
  { name: 'White',  hex: '#E2E8F0' },
  { name: 'Black',  hex: '#1A202C' },
  { name: 'Teal',   hex: '#319795' },
]
```

Colors are randomly assigned without repetition. If more teams
than colors (unlikely with 10 colors and max 20 teams), colors
can repeat but should be maximally distributed.

### Interactions

#### Tap Color Dot

Opens a simple color picker popup showing the Team Color Roster
as a grid of colored circles.

- Colors currently assigned to OTHER teams are displayed as
  **semi-transparent and not tappable** (unavailable).
- The current team's color is highlighted.
- Tapping an available color assigns it to this team.
- The team logo automatically re-colorizes to match the new color.
- The color picker dismisses on selection.

#### Tap Team Logo

Opens the existing logo selector component (from the team logo
roster).

- All logos are displayed colorized to match this team's current
  assigned color.
- Tapping a logo assigns it to this team.
- The logo selector dismisses on selection.

### On Continue

- Team assignments are stored in the game session.
- Each team has: `leadPlayerId`, `color`, `logo`, `teamName`
  (auto-generated from color: "Team Red", "Team Blue", etc.)
- All players transition to the Game Board.
- The continue button should use the same label as FYVE's Team
  Selector continue button.

### State

```typescript
interface TeamLeadAssignment {
  playerId: string
  playerName: string
  color: TeamColor
  logo: TeamLogo        // colorized to match team color
  teamName: string      // "Team Red", "Team Blue", etc.
}
```

---

## Section 4: Game Board Shell

### When It Appears

After mode selection and team setup (if applicable) are complete.
All players see the Game Board simultaneously.

### Layout

```
┌─────────────────────────────────────────┐
│                                         │
│  [Menu]                    [Game Logo]  │
│  (owner only)              (animated)   │
│                                         │
│  ┌─ TRIVIA CARD ────────────────────┐   │
│  │                                  │   │
│  │  (auto-sizing text display)      │   │
│  │  (Phase 2: trivia question here) │   │
│  │                                  │   │
│  └──────────────────────────────────┘   │
│                                         │
│  ┌─ LEADERBOARD ────────────────────┐   │
│  │                                  │   │
│  │  Players or Teams                │   │
│  │  (sorted by score or alpha)      │   │
│  │                                  │   │
│  └──────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### 4.1 Game Logo (Top Right)

- Displays the animated logo for the current game skin (e.g.,
  the Nabster logo, the OutTakes logo, etc.).
- Refer to other game boards for how animated logos work.
- On game launch, the logo animates IN (slides or fades from
  off-screen).
- On hot-swap (theme change), the logo animates OUT, swaps to
  the new game's logo, then animates back IN.
- The logo should be appropriately sized — prominent but not
  dominant. It's branding, not the main content.

### 4.2 Menu Button (Top Left, Owner Only)

- Visible ONLY to the game owner. Other players do not see this
  button.
- Standard button treatment — tappable, clear icon or "Menu"
  label.
- On tap: opens the **Game Control Popup** (see Section 5).

### 4.3 Trivia Card (Center)

- Use the same auto-sizing text display card component from
  Wordonkulous.
- **Make this a JMKit component** if it isn't already. It should
  be reusable across any game that needs to display variable-
  length text content in a card format.
- Component name suggestion: `JMTextCard` or `JMContentCard`.
- The card auto-sizes vertically to fit the text content.
- For Phase 1, the card can display placeholder text or the
  game name / "Waiting for first question..." message.
- Phase 2 will populate this with actual trivia questions.

```typescript
interface JMTextCardProps {
  text: string
  fontSize?: 'sm' | 'md' | 'lg' | 'xl'  // auto-determined if omitted
  theme?: GameTheme                        // for color/font matching
  maxLines?: number                        // optional truncation
}
```

### 4.4 Leaderboard (Below Card)

- Header text: **"Players"** (if Single Play mode) or **"Teams"**
  (if Full Team or Team Leads mode).
- See Section 8 for the updated JMKit Leaderboard component spec.

---

## Section 5: Game Control Popup (Owner Only)

### Trigger

Owner taps the Menu button (top left of Game Board).

### Popup Style

Use the commonly used JMKit dark gray popup with the red close
button with the white X in the top right corner.

### Layout

```
┌─────────────────────────────────────[X]─┐
│                                         │
│  ┌─ Current Game Skin ──────────────┐   │
│  │                                  │   │
│  │  [Current Game Icon/Thumbnail]   │   │
│  │   Current Game Name              │   │
│  │   (tappable — opens skin picker) │   │
│  │                                  │   │
│  └──────────────────────────────────┘   │
│                                         │
│  ┌─ Tags ───────────────────────────┐   │
│  │                                  │   │
│  │  Tap to focus on certain areas   │   │
│  │  of information.                 │   │
│  │                                  │   │
│  │  [tag] [tag] [tag] [tag] [tag]   │   │
│  │  [tag] [tag] [tag] [tag]         │   │
│  │  [tag] [tag] [tag]        [↺]    │   │
│  │                                  │   │
│  └──────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### 5.1 Current Game Skin Display

- Shows the current game's icon/thumbnail and name.
- The entire area is tappable.
- On tap: opens the **Skin Picker Popup** (see Section 6).

### 5.2 Tag Filter UI

- Displays all tags available for the current game skin.
- Tags are displayed as pills/chips in a flowing wrap layout.
- Above the tags, display instructional text: "Tap to focus on
  certain areas of information."
- A small reset button (↺) is positioned at the bottom right
  of the tag area.

#### Tag Toggle Logic

**Default state (on mount / on reset):**
- ALL tags are ON (full color, full opacity).
- This means no filtering — all questions from all tags are
  eligible.

**First tap on any tag (when all tags are ON):**
- ALL tags switch OFF (grayscale, semi-transparent) EXCEPT the
  tapped tag.
- The tapped tag becomes the ONLY focused tag (full color, full
  opacity).
- Questions will be filtered to only this tag.

**Subsequent taps (when NOT all tags are ON):**

- If a tag is OFF and is tapped → turn it ON (add to focus).
- If a tag is ON and is tapped:
  - If it is NOT the only ON tag → turn it OFF (remove from
    focus).
  - If it IS the only ON tag → turn ALL tags ON (return to
    default / no filter).

**Reset button (↺):**
- Turns ALL tags back ON (default state, no filtering).

#### Tag Visual States

```
ON (focused):     Full color, full opacity, matches game theme
OFF (unfocused):  Grayscale, semi-transparent (~0.3 opacity)
```

#### Tag Data Source

Tags come from the trivia content database for the current game
skin. They are loaded when the game skin is set and reloaded on
hot-swap.

```typescript
interface TagFilterState {
  allTags: string[]
  activeTags: string[]       // empty means "all active" (default)
  isDefaultState: boolean    // true when all tags are on
}
```

**Logic helper:**

```typescript
function handleTagTap(tag: string, state: TagFilterState): TagFilterState {
  const { allTags, activeTags, isDefaultState } = state

  if (isDefaultState) {
    // First tap when all are on — focus only this tag
    return {
      allTags,
      activeTags: [tag],
      isDefaultState: false,
    }
  }

  const isActive = activeTags.includes(tag)

  if (isActive) {
    if (activeTags.length === 1) {
      // Last active tag tapped — return to default (all on)
      return {
        allTags,
        activeTags: [],
        isDefaultState: true,
      }
    }
    // Remove this tag from active
    return {
      allTags,
      activeTags: activeTags.filter(t => t !== tag),
      isDefaultState: false,
    }
  }

  // Tag is off — turn it on
  const newActive = [...activeTags, tag]

  // If all tags are now active, return to default state
  if (newActive.length === allTags.length) {
    return {
      allTags,
      activeTags: [],
      isDefaultState: true,
    }
  }

  return {
    allTags,
    activeTags: newActive,
    isDefaultState: false,
  }
}

function handleReset(state: TagFilterState): TagFilterState {
  return {
    allTags: state.allTags,
    activeTags: [],
    isDefaultState: true,
  }
}
```

### 5.3 Close Button

- Standard JMKit red close button with white X.
- Positioned in the top right corner of the popup.
- On tap: dismisses the popup, returns to the Game Board.

---

## Section 6: Skin Picker Popup

### Trigger

Owner taps the Current Game Skin area in the Game Control Popup.

### Layout

A popup grid showing all 12 Fast Casual Trivia game skins.

```
┌─────────────────────────────────────[X]─┐
│                                         │
│  Switch Game                            │
│                                         │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│  │Nabstr│ │OutTks│ │Plated│ │Extra │   │
│  │      │ │      │ │      │ │Extra │   │
│  └──────┘ └──────┘ └──────┘ └──────┘   │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│  │Pwn   │ │1stEd │ │Geek  │ │Ctrl  │   │
│  │Stars │ │      │ │Freak │ │Alt   │   │
│  └──────┘ └──────┘ └──────┘ └──────┘   │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│  │Papar │ │Pop   │ │Seasn │ │Where │   │
│  │azza  │ │Wow   │ │Tix   │ │InThe │   │
│  └──────┘ └──────┘ └──────┘ └──────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### Grid Cell Content

Each cell displays:
- The game's icon/thumbnail image
- The game's display name below
- The currently active game has a visible selected state
  (border highlight, checkmark, or similar indicator)

### Grid Layout

- 4 columns, 3 rows
- Each cell is a square or near-square tappable area
- Scrollable if needed (it shouldn't be with 12 items in 4x3)

### On Tap: Game Cell

1. Dismiss the Skin Picker Popup.
2. Dismiss the Game Control Popup.
3. Execute the **Hot-Swap Animation Sequence** (see Section 7).
4. If the tapped game is already the current game, do nothing
   (dismiss popups only).

### Close Button

- Standard JMKit red close button with white X.
- Positioned in the top right corner of the popup.
- On tap: dismisses the Skin Picker only, returns to the Game
  Control Popup.

---

## Section 7: Hot-Swap Theme System

### Trigger

Owner selects a different game skin from the Skin Picker.

### What Changes

Everything visual about the game board changes to match the new
skin:
- Game logo (top right)
- Background image
- Primary, secondary, tertiary, and danger colors
- Tags (reloaded from new game's tag set)
- The game session's active game ID

### Animation Sequence

The hot-swap is a coordinated animation that happens for ALL
players simultaneously. The sequence is:

```
Step 1: Logo animates OUT
        (slide off-screen to the right, or fade + scale down)
        Duration: ~300ms

Step 2: Background image fades to transparent
        (concurrent with Step 1)
        Duration: ~400ms

Step 3: Swap assets (no visual change yet — everything is hidden)
        - Set new game logo
        - Set new background image
        - Set new color palette
        - Reload tags for new game skin
        Duration: 0ms (instant, happens while screen is
        in transition state)

Step 4: Background image fades IN (new background)
        Duration: ~400ms

Step 5: Update all UI colors
        (primary, secondary, tertiary, danger)
        Transition smoothly via CSS transitions
        (concurrent with Step 4)
        Duration: ~400ms

Step 6: Logo animates IN (new logo)
        (slide in from right, or fade + scale up)
        Duration: ~300ms
```

Total perceived duration: ~700-800ms. Steps overlap for a smooth,
cinematic feel.

### Broadcast

The game owner's skin selection is broadcast to all connected
players. Every player's device executes the same animation
sequence simultaneously.

```typescript
// Owner triggers
function hotSwapTheme(newGameId: string) {
  // Update game session
  session.currentGameId = newGameId

  // Broadcast to all players
  broadcast('theme_swap', {
    newGameId,
    timestamp: Date.now(),  // for sync
  })
}

// All players receive
function onThemeSwap({ newGameId }) {
  // 1. Load new game object
  const newGame = await loadGameObject(newGameId)

  // 2. Execute animation sequence
  await animateLogoOut()          // Step 1
  await animateBackgroundOut()    // Step 2 (concurrent)
  applyNewTheme(newGame)          // Step 3
  await animateBackgroundIn()     // Step 4
  await animateColorsTransition() // Step 5 (concurrent)
  await animateLogoIn()           // Step 6
}
```

### Edge Cases

- If the owner selects the same game that's already active,
  no animation occurs. Popups simply dismiss.
- If a hot-swap is triggered while a previous swap animation
  is still running, queue the new swap to execute after the
  current one completes (don't interrupt mid-animation).
- Tags reset to default state (all ON) after a hot-swap, since
  the new game may have different tags.
- Leaderboard scores persist across theme swaps. The collection
  cards from different themes mix together in the final results.

---

## Section 8: JMKit Leaderboard Update

### Current State

The JMKit Leaderboard currently displays individual players:
- Player Avatar (left)
- Player Name (center)
- Player Score (right)
- Sorted by score descending (or alphabetically if no scores)

### Required Update

The Leaderboard component needs to support two display modes:
**Players** and **Teams**.

### Updated Component Interface

```typescript
interface JMLeaderboardProps {
  mode: 'players' | 'teams'
  entries: LeaderboardEntry[]
  title?: string              // defaults to "Players" or "Teams"
}

interface LeaderboardEntry {
  // Player mode
  playerId?: string
  playerName?: string
  playerAvatar?: string       // avatar image/component

  // Team mode
  teamId?: string
  teamName?: string           // "Team Red", "Team Blue", etc.
  teamLogo?: TeamLogo         // colorized logo component
  teamColor?: string          // hex color for accent/highlight

  // Shared
  score: number
}
```

### Player Mode Display

```
┌─────────────────────────────────────────┐
│  Players                                │
├─────────────────────────────────────────┤
│  [Avatar]  PlayerName              120  │
│  [Avatar]  PlayerName               95  │
│  [Avatar]  PlayerName               80  │
│  [Avatar]  PlayerName               45  │
└─────────────────────────────────────────┘
```

- Player Avatar at the left (existing behavior)
- Player Name next to avatar
- Player Score at the right, right-aligned
- Sorted by score descending
- If all scores are 0 (game start), sort alphabetically by name

### Team Mode Display

```
┌─────────────────────────────────────────┐
│  Teams                                  │
├─────────────────────────────────────────┤
│  [Logo]  Team Red                  120  │
│  [Logo]  Team Blue                  95  │
│  [Logo]  Team Green                 80  │
│  [Logo]  Team Orange                45  │
└─────────────────────────────────────────┘
```

- Team Logo at the left (colorized to team color)
- Team Name next to logo
- Team Score at the right, right-aligned
- Sorted by score descending
- If all scores are 0 (game start), sort alphabetically by name
- Optional: a subtle left border or background tint matching the
  team color for quick visual identification

### Sorting Logic

```typescript
function sortLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  const hasScores = entries.some(e => e.score > 0)

  if (hasScores) {
    // Sort by score descending
    return [...entries].sort((a, b) => b.score - a.score)
  }

  // No scores yet — sort alphabetically
  const nameField = entries[0].playerName ? 'playerName' : 'teamName'
  return [...entries].sort((a, b) =>
    (a[nameField] || '').localeCompare(b[nameField] || '')
  )
}
```

---

## Section 9: Game Session State

### Complete State Object

The game session stores all state needed for the game board and
is shared across all connected players.

```typescript
interface FastCasualTriviaSession {
  // Game identity
  gameEngineId: 'fast_casual_trivia'
  currentGameId: string          // 'nabster', 'outtakes', etc.
  ownerId: string                // player who owns the session

  // Mode
  mode: 'single' | 'full_team' | 'team_leads'

  // Players
  players: Player[]

  // Teams (only populated if mode !== 'single')
  teams: Team[]

  // Tags
  availableTags: string[]        // all tags for current game
  activeTags: string[]           // currently focused tags (empty = all)
  tagFilterDefault: boolean      // true when all tags are on

  // Scores
  scores: Record<string, number> // keyed by playerId or teamId

  // Phase 2 additions (placeholder)
  // currentQuestion: Question | null
  // questionHistory: QuestionResult[]
  // roundNumber: number
}

interface Team {
  id: string
  name: string                   // "Team Red"
  color: TeamColor
  logo: TeamLogo
  leadPlayerId: string           // the team lead's player ID
  memberPlayerIds: string[]      // all team member player IDs
}
```

---

## Section 10: Component Summary

### New Components to Build

1. **GameModeScreen** — Mode selection (Single/Full Team/Team Leads)
   with team count selector.
2. **TeamLeadsAssignment** — New page for assigning colors and
   logos to team leads.
3. **GameControlPopup** — Owner-only popup with skin display and
   tag filter.
4. **SkinPickerPopup** — 4x3 grid of all 12 FCT game skins.
5. **TagFilter** — Interactive tag toggle system with the
   specified on/off logic.
6. **GameBoardShell** — The main play field layout (logo, menu,
   card, leaderboard).

### Existing Components to Adapt / Extend

7. **TeamSelector** (from FYVE) — Extend to support 2-4 teams
   instead of only 2.
8. **JMLeaderboard** (JMKit) — Add team mode display with team
   logo, team name, team color.
9. **Wordonkulous Text Card** — Extract to JMKit as a shared
   component (`JMTextCard` or `JMContentCard`) if not already.
   Must auto-size to fit text content.

### Existing Components Used As-Is

10. **Color Picker** — For team color assignment (may need to be
    constrained to the Team Color Roster).
11. **Logo Selector** — For team logo assignment (existing, with
    colorization to match team color).
12. **JMKit Dark Gray Popup** — Standard popup container with red
    close button / white X.

---

## Section 11: Data Flow Summary

```
Game Factory (existing)
    │
    ▼
Game Mode Screen (NEW)
    │
    ├─ Single Play ──────────────────────► Game Board
    │
    ├─ Full Team + Next ──► Team Selector (ADAPTED)
    │                              │
    │                              ▼
    │                        Game Board
    │
    └─ Team Leads + Next ──► Team Leads Assignment (NEW)
                                   │
                                   ▼
                             Game Board

Game Board (NEW shell)
    │
    ├─ Logo (top right) ◄──── game object imagery
    │
    ├─ Menu (top left, owner only)
    │       │
    │       ▼
    │   Game Control Popup (NEW)
    │       │
    │       ├─ Skin Display ──► Skin Picker (NEW)
    │       │                       │
    │       │                       ▼
    │       │               Hot-Swap Animation
    │       │               (all players sync)
    │       │
    │       └─ Tag Filter (NEW)
    │
    ├─ Trivia Card (center) ◄──── JMTextCard (JMKit)
    │       (Phase 2: questions)
    │
    └─ Leaderboard (below) ◄──── JMLeaderboard (ADAPTED)
            (Players or Teams)
```

---

## Section 12: Build Order

### Step 1: JMKit Component Updates
- Extract Wordonkulous text card to JMKit (`JMTextCard`).
- Update `JMLeaderboard` to support team mode.
- Verify color picker can be constrained to Team Color Roster.

### Step 2: Game Mode Screen
- Build the three-button layout with team count selector.
- Wire up routing to Team Selector or Team Leads Assignment.
- Wire up Single Play direct-to-Game-Board.

### Step 3: Team Setup
- Adapt FYVE Team Selector for 2-4 teams.
- Build Team Leads Assignment page (color/logo assignment).
- Both routes lead to Game Board on completion.

### Step 4: Game Board Shell
- Build the layout: logo (top right), menu (top left),
  card (center), leaderboard (below).
- Implement animated logo entrance.
- Display placeholder content in the trivia card.
- Display leaderboard in correct mode (players or teams).

### Step 5: Game Control Popup
- Build popup with current skin display and tag filter.
- Implement tag toggle logic with all specified behaviors.
- Wire up skin display tap to Skin Picker.

### Step 6: Skin Picker & Hot-Swap
- Build 4x3 skin picker grid.
- Implement hot-swap animation sequence.
- Implement broadcast to all connected players.
- Verify tag reset on theme swap.

### Step 7: Integration Test
- Test Single Play → Game Board flow.
- Test Full Team (2, 3, 4 teams) → Team Selector → Game Board.
- Test Team Leads (2-20 teams) → Assignment → Game Board.
- Test hot-swap animation on all connected devices.
- Test tag filter toggle logic (all states).
- Test leaderboard in both player and team modes.
- Test score persistence across theme swaps.

---

## Phase 2 Preview (Not in This Build)

Phase 2 will add:
- Trivia question display in the `JMTextCard`
- T / PT / F answer buttons
- Answer timing and scoring logic
- Question selection from database (with tag filtering)
- Collection card rewards on correct answers
- Round progression and game completion
- Results screen with mixed collection display
- Social share card generation
