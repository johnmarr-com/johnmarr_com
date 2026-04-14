# Bluff Box — Game Design & Architecture

## How the Game Works

Bluff Box is a points-based group bluffing game. Players take turns as the **Sharer**, who reveals a mystery card and describes it to the group — either truthfully or as a lie. All other players then guess whether the Sharer told the truth or lied. Correct guesses earn +1 point. The Sharer earns nothing; their goal is to fool everyone.

After a fixed number of rounds, the player(s) with the most points win.

## Game Flow

```
pack-select → round-intro → sharing → [human-to-ai-input] → guessing → result →
  ├─ next turn in round → sharing
  ├─ round complete, more rounds → round-intro
  └─ all rounds complete → game-over
```

### Phases

| Phase | What happens |
|---|---|
| `pack-select` | Host picks a bluff pack (card set). Can be pre-selected from lobby. |
| `round-intro` | "ROUND X of Y" splash, 2.5s auto-advance. |
| `sharing` | Current sharer sees card flip screen, picks Truth or Lie. Everyone else sees the main game view (single sharer panel + leaderboard). |
| `ai-share-display` | AI sharer only — shows the AI's generated share text to the group, 6s timeout. |
| `human-to-ai-input` | Human sharer + AI guessers in group — sharer types what they said so AI can process it. |
| `guessing` | Popup appears for all non-sharers with Truth/Lie buttons. Each player submits independently and async. Host auto-runs AI guesses. |
| `result` | Personalized result modal: sharer avatar, verdict, the actual card, and "+1 POINT!" or "YOU GOOFED!" per player. Scores already updated in Firestore before this phase. |
| `game-over` | Winner screen with scaling layout. Host can replay. |

### Round Counts

Tuned to produce a meaningful point spread:

| Players | Rounds | Max possible points per player |
|---|---|---|
| 2 | 5 | 5 |
| 3 | 4 | 8 |
| 4 | 3 | 9 |
| 5-8 | 2 | 8-14 |
| 9+ | 1 | 8-29 |

### Turn Structure

Each round, all players are shuffled into a random turn order. Every player shares exactly once per round. Within each turn:

1. Sharer sees card, shares verbally with the group, picks Truth or Lie
2. If AI guessers exist and sharer is human: sharer types what they said
3. All non-sharers guess (Truth or Lie) independently
4. Once all guesses are in: scores are calculated and written, result modal shown
5. After ~4s (or host tap): advance to next turn

## Scoring

- Correct guess = **+1 point**
- Wrong guess = 0 points
- Sharer always gets 0 points for their own turn
- Winner = player(s) with the highest score after all rounds

## Architecture

### Key Files

| File | Purpose |
|---|---|
| `BluffBoxGame.tsx` | Main game component — phase orchestration, callbacks, effects |
| `useBluffBoxSession.ts` | Firestore subscription hook, state derivation, `updateFields`/`setPhase` |
| `tournament.ts` | Pure functions: scoring, round calculation, turn order, card selection |
| `aiBluffPlayer.ts` | AI sharer (vision API) and AI guesser (text API) logic |
| `recordGameStats.ts` | Increments gamesPlayed/Won/Lost/Hosted in user docs at game end |

### Screen Components (`screens/`)

| Component | Used during | Description |
|---|---|---|
| `MatchupScreen` | sharing, guessing, result, ai-share-display, human-to-ai-input | Main game view: OneVsAll in solo mode (single sharer panel) + LeaderboardPanel |
| `SharerViewScreen` | sharing | Card flip animation + Truth/Lie choice (sharer only) |
| `GroupGuessModal` | guessing | Full-screen overlay with Truth/Lie buttons for non-sharers |
| `TurnResultModal` | result | Personalized result overlay (verdict, card, point outcome) |
| `LeaderboardPanel` | (child of MatchupScreen) | Sorted player list: points desc, then alpha; 0-point hidden |
| `RoundIntroScreen` | round-intro | "ROUND X of Y" splash |
| `WinnerScreen` | game-over | Scaling winner display (1=large, 2=side-by-side, 3+=grid) |
| `AIShareDisplay` | ai-share-display | Modal showing AI sharer's generated text |
| `HumanToAIInput` | human-to-ai-input | Text input for human sharer to describe what they said |
| `PlayerGrid` | (not used in Bluff Box) | Extracted legacy grid for potential reuse elsewhere |

### Shared UI (`JMKit/`)

- **`JMOneVsAll`** — Supports two modes:
  - **VS mode** (`left`/`right` props): Two-sided bracket layout with VS emblem. Used by other games.
  - **Solo mode** (`sharer` prop): Single centered panel for the active sharer. Used by Bluff Box.
- **`JMTruthLieChoice`** — Randomized Truth/Lie button pair with locked/disabled states.

### Firestore Data Model

All game state lives on a single `gameSessions/{sessionId}` document.

**Bluff Box fields:**

```
bbPhase: BluffBoxPhase
selectedPackId / selectedPackName / selectedPackCoverURL: string | null
cardPool: string[]              — remaining card URLs
roundNumber: number             — current round (1-based)
totalRounds: number             — based on player count
turnOrder: string[]             — shuffled player UIDs for current round
currentTurnIndex: number        — index into turnOrder
cardURL: string | null          — current card being shared
sharerChoice: "truth" | "lie" | null
guesses: Record<string, "truth" | "lie">  — each player's guess
aiShareText: string | null      — AI sharer's generated text
humanShareText: string | null   — human sharer's typed text for AI guessers
scores: Record<string, number>  — cumulative points per player
winners: string[]               — winner UID(s) at game end
winnerPoints: number            — winning score
```

### Host Authority

The session host (game creator) controls all phase transitions and runs AI logic. Non-host players can:
- Submit their own guess during `guessing` phase (dot-path write: `guesses.${uid}`)
- Tap to reveal their card during `sharing` phase (if they're the sharer)
- Dismiss the result modal locally (client-side state)

### AI Opponents

AI players (UIDs starting with `ai-`) participate as both sharers and guessers:
- **AI as Sharer**: Host auto-deals card, calls `aiShare()` (vision API for truth, text API for lies), shows result via `ai-share-display` phase
- **AI as Guesser**: Host runs `aiGuess()` for each AI guesser during `guessing` phase, writes their guesses sequentially
- Each AI has a persona (name, prompt, voice, play style) from the persona system

### Stats Recording

At game end, `recordGameStats()` increments per-player Firestore fields:
- `gamesPlayed` — all human players
- `gamesHosted` — the host
- `gamesWon` — winner(s)
- `gamesLost` — non-winners

### Legacy Files (no longer imported, safe to delete)

- `screens/ListenerViewScreen.tsx` — old 1v1 listener waiting screen
- `screens/OpponentGuessScreen.tsx` — old 1v1 opponent guess screen
- `screens/GameOverScreen.tsx` — old tie/TPK screen
- `screens/TurnResultScreen.tsx` — old 1v1 turn result screen
