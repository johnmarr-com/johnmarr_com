# Game Development Guide

Everything an AI agent (or human) needs to know to create, edit, and maintain games on this platform. Read this before touching any game code.

---

## Architecture Overview

Games live at `src/app/games/{slug}/` and share a common toolkit at `src/app/games/_gamecore/`. Game **definitions** (metadata, splash art, player limits) are CMS documents in Firestore's `content` collection. Game **sessions** (live lobbies, match state) are separate Firestore documents in `gameSessions`.

```
src/
├── app/games/
│   ├── _gamecore/          ← shared hooks, components, AI bridge, music, types
│   ├── tapsmasharena/      ← chaptered-video 1v1 (Rock/Paper/Scissors)
│   ├── sweeptheleg/        ← chaptered-video 1v1 (High/Mid/Low)
│   └── megasketchy/        ← party drawing game (custom session model)
├── lib/
│   ├── game-sessions.ts    ← Firestore session CRUD, moves, rounds
│   ├── game-invites.ts     ← direct player invite system
│   ├── game-sketches.ts    ← Firebase Storage upload for sketches
│   ├── ai-personas.ts      ← AI persona CRUD + stat recording (callable)
│   ├── content-types.ts    ← JMContent type (game definition fields)
│   └── content.ts          ← content CRUD (getContentBySlug, etc.)
├── app/api/games/ai/       ← server-side AI proxy (Anthropic + Replicate)
├── app/api/user/points/    ← points awarding API
└── app/admin/              ← GameCreateModal, GameEditModal, AIPersonaEditModal
functions/
└── src/index.ts            ← Cloud Functions (cleanup scheduler, recordAIGameResult)
firestore.rules             ← security rules for all game collections
```

---

## Game Definition (CMS Content)

Each game is a document in Firestore `/content/{id}` with `contentType: "game"`. Created and edited via admin modals (`GameCreateModal.tsx`, `GameEditModal.tsx`).

### Key fields on `JMContent` for games

| Field | Purpose |
|-------|---------|
| `slug` | URL path segment → `/games/{slug}` |
| `title`, `subtitle`, `description` | Display text |
| `splashBgURL`, `splashIconURL`, `splashLogoURL` | Landing page visuals |
| `coverURL`, `bannerURL` | Thumbnails elsewhere in the site |
| `backgroundMusicURL`, `backgroundMusicVolume`, `bgMusicLandingOnly` | Audio config |
| `minPlayers`, `maxPlayers` | Lobby constraints |
| `trueSoloMode` | If true, solo play skips AI opponent selection |
| `retentionDays` | 1 (daily) or 30 (monthly) — controls `expiresAt` on sessions |

Game pages load this via `getContentBySlug("game", "slug")` on mount.

---

## `_gamecore` — The Shared Toolkit

Import from `@/app/games/_gamecore` (barrel at `index.ts`).

### Landing & Lobby

| Export | What it does |
|--------|-------------|
| `GameLandingPage` | Full-screen splash with Play button. Props control solo/AI/friends modes, music, side labels (versus) or party mode. |
| `GameMultiplayerFlow` | Dialog flow: choose host/join/solo → host lobby with invite code/QR → player list → start game. Handles AI invites, known-player invites, side assignment (versus or party), kicked-user UX. |
| `InviteKnownPlayersModal` | Select from previously played-with users and send invites. |
| `InviteAIModal` | Add/remove AI opponents in lobby (for multiplayer with AI slots). |
| `PickAIOpponentModal` | Solo-vs-AI: pick one AI opponent from the roster. |

### Multiplayer Round Loop

| Export | What it does |
|--------|-------------|
| `useMultiplayerRound` | Subscribes to a Firestore session, manages move submission, host-only round resolution, phase tracking. The game provides a `RoundResolver` function. |
| `RoundResolver` | Type: `(session) => ResolverOutput`. Game-specific logic that reads `pendingMoves` and returns round result, winner, game-over flag. |
| `MpPhase` | `"waiting"` \| `"submitted"` \| `"resolving"` \| `"animating"` |

### AI Player Bridge

| Export | What it does |
|--------|-------------|
| `simpleMove(prompt, opts?)` | POST to `/api/games/ai` with auth. Fires 2 parallel requests, takes first success. Parses `REASONING:` / `ACTION:` from response. |
| `postGameComment(prompt, opts?)` | Same endpoint, returns narrative text for post-game transcripts. |
| `getAIAuthHeaders()` | Builds `Authorization: Bearer <token>` headers for AI API calls. |

### AI Persona Data

| Export | What it does |
|--------|-------------|
| `AI_PERSONAS` | Static fallback roster (rarely used at runtime). |
| `isAiPlayer(uid)` | Returns true if UID starts with `ai-`. |
| `aiDisplayName(uid)` | Lookup display name from loaded personas. |
| `getPersona(uid)` | Get full persona object by UID. |
| `loadPersonasFromDB()` | Fetch active personas from Firestore, cache them, prefix IDs with `ai-`. |
| `PLAY_STYLE_COLORS` | Tailwind class map by play style. |

### UI Components

| Export | What it does |
|--------|-------------|
| `GameSectionHeader` | Centered section title with optional eyebrow text. |
| `GamePrimaryButton` | Full-width green CTA with loading spinner. |
| `GameStatusMessage` | Centered status/waiting text with optional spinner. |
| `GameGamertagBadge` | Fixed top-center banner showing current user's gamertag. |
| `SketchCanvas` | Drawing canvas with color palette, eraser, undo, JPEG export. |

### Music

| Export | What it does |
|--------|-------------|
| `useGameMusic` | Hook to start/stop background music. Handles visibility/focus. |
| `bgMusic` | Singleton Web Audio player. Can route `<video>` audio through it for iOS coexistence. |

---

## Game Session Lifecycle

All managed by `src/lib/game-sessions.ts`.

### Session Document (`gameSessions/{id}`)

```
{
  gameId, gameName, gameSlug, gameLogoURL,
  hostUid, inviteCode,
  maxPlayers,
  players: [{ uid, gamertag, avatarName? }],
  playerUids: ["uid1", "uid2", "ai-xxx"],   ← flat array for Firestore rules
  pendingInviteUids: [...],
  kickedUids: [...],
  playerSides: { "uid1": "p1", "uid2": "p2" },  ← or "red"/"white", "player-1", etc.
  status: "lobby" | "playing" | "finished",
  pendingMoves: { "uid1": <move>, "uid2": <move> },
  rounds: [{ moves: {...}, result: {...} }],
  currentRound: 0,
  transcript: [...],
  winner: "uid" | null,
  retentionDays: 1 | 30,
  expiresAt: Timestamp,
  createdAt, updatedAt
}
```

### Flow

1. **Create**: `createGameSession(input)` → writes session + invite code doc.
2. **Join**: `joinGameSession(code, userId, gamertag)` → transaction adds player, can replace AI if full.
3. **Start**: `startGame(sessionId, playerSides)` → sets status to `"playing"`, writes `playerSides`.
4. **Submit Move**: `submitMove(sessionId, uid, move)` → dot-path write to `pendingMoves.{uid}`.
5. **Resolve Round** (host only via `useMultiplayerRound`): `writeRoundResult(sessionId, result)` → appends to `rounds[]`, clears `pendingMoves`, increments `currentRound`.
6. **Finish**: Resolver returns `gameOver: true, winner: uid` → session status set to `"finished"`.

### AI Player Slots

- AI UIDs: `ai-{firestorePersonaId}` (e.g., `ai-abc123`).
- `addAIPlayerToSession(sessionId, aiId, aiName, avatarName)` — transaction, respects maxPlayers.
- `removeAIPlayerFromSession(sessionId, aiId)` — transaction, silent removal.
- When a human joins a full lobby, the last AI player is automatically evicted.

---

## The Two Game Patterns

### Pattern 1: Chaptered Video Game (Tap Smash Arena, Sweep the Leg)

Best for: 1v1 turn-based games with video-driven animation.

**Structure**: `page.tsx` + `{GameName}Game.tsx` (2 files).

**How it works**:
1. `page.tsx` loads CMS content, renders `GameLandingPage`, passes callbacks for solo/AI/friends modes.
2. Game component receives `mode` ("ai" | "friends") + `sessionId` + optional `aiPersona`.
3. Uses `useMultiplayerRound` with a custom `RoundResolver` for game logic.
4. Uses `useGameMusic` + `bgMusic.connectVideo(videoRef)` for audio.
5. Video element plays chapters by seeking to start time and stopping at end time via RAF loop.
6. AI moves via `simpleMove()` with game-specific prompt.

**Key conventions**:
- `CHAPTERS` object maps chapter names to `{ start, end }` timestamps.
- `playerSides` uses game-specific keys (`"p1"`/`"p2"` or `"red"`/`"white"`).
- Resolver reads `pendingMoves`, computes winner, returns `{ roundEntry, gameOver, winner }`.
- First to N points (configurable per game).

### Pattern 2: Custom Session Model (Mega Sketchy)

Best for: party games with complex multi-phase flows that don't fit the round/move model.

**Structure**: Many files — game component, phase screens, chain engine, AI player module, session hook.

**How it works**:
1. `page.tsx` loads content, renders `GameLandingPage` with `multiplayerFlowMode="party"`.
2. Uses `useMegaSketchySession` (custom hook) instead of `useMultiplayerRound`.
3. Session doc has custom fields (`skPhase`, `chains`, `message`, `votes`, etc.).
4. Host advances phases via `updateSessionFields` / `setPhase`.
5. AI tasks processed by host via `processAiQueue` (vision API for guessing, sketch API for drawing).
6. Sketches uploaded to Firebase Storage via `uploadSketch` from `src/lib/game-sketches.ts`.

**Mega Sketchy phases**: `lobby` → `briefing` → `active` → `madlibs` → `reveal` → `scoring` → `voting` (advanced/expert) → `done` → `share`.

---

## AI System

### Architecture

```
Game Component
    ↓ simpleMove(prompt, { persona, voice })
_gamecore/AIPlayerManager.ts
    ↓ POST /api/games/ai (with Firebase ID token)
src/app/api/games/ai/route.ts
    ↓ Anthropic (Claude Haiku) or Replicate (Flux)
External APIs
```

### API Route (`/api/games/ai`)

- **Auth**: Requires Firebase ID token via `Authorization: Bearer <token>`.
- **Rate limit**: 30 requests per 60 seconds per UID (in-memory).
- **Request types**:
  - Default/text: `{ prompt, type?: "move" | "comment", maxTokens?, temperature? }` → Claude text response.
  - `{ type: "vision", imageUrl, prompt? }` → Claude vision (image analysis).
  - `{ type: "sketch", subject }` → Replicate Flux image generation.

### AI Personas

Stored in Firestore `aiPersonas/{id}`. Each has:
- `name`, `avatarName`, `playStyle` ("aggressive" | "defensive" | "balanced" | "chaotic" | "adaptive")
- `prompt` (personality/behavior instructions injected into AI calls)
- `voice` (speech style descriptor)
- `stats` (`wins`, `losses`, `gamesPlayed`, `tournamentBestRound`)
- `avatarScale`, `order`, `isActive`

### Recording AI Game Results

`recordAIGameResult(personaId, won)` in `src/lib/ai-personas.ts` calls a **Cloud Function** (`functions/src/index.ts`) via `httpsCallable`. This is NOT a direct Firestore write — the `aiPersonas` collection is locked to admin-only updates in Firestore rules.

All call sites use fire-and-forget:
```typescript
import("@/lib/ai-personas").then(({ recordAIGameResult }) => {
  recordAIGameResult(docId, aiWon).catch(() => {});
});
```

### AI in Chaptered Video Games

1. Build a prompt describing the game state, valid moves, and AI personality.
2. Call `simpleMove(prompt, { persona: aiPersona.prompt, voice: aiPersona.voice })`.
3. Parse `ACTION:` from response to extract the move.
4. Fallback to random valid move on parse failure.
5. Prefetch next move after each round (before animation finishes) for responsiveness.
6. After game ends, call `postGameComment()` for transcript flavor text.

### AI in Mega Sketchy

1. Host runs `processAiQueue` which iterates AI tasks from `getPlayerQueue`.
2. For "guess" tasks: calls vision API to describe an image.
3. For "draw" tasks: calls sketch API to generate an image, then `uploadSketch`.
4. Results written to session `chains` via `appendChainEntry`.

---

## Points & Leveling

`POST /api/user/points` with `{ activityKey }` and Bearer token.

Game-relevant keys: `"play_game"`, `"host_game"`. The API looks up the point value from `pointActivities/{key}` and increments the user's `points` field, checking for level-ups.

---

## Firestore Security Rules (Game Collections)

| Collection | read | create | update | delete |
|------------|------|--------|--------|--------|
| `aiPersonas` | authenticated | admin | admin only (stats via Cloud Function) | admin |
| `gameSessions` | authenticated | authenticated | authenticated AND uid in post-update `playerUids` | admin |
| `inviteCodes` | authenticated | authenticated | admin | admin |
| `gameInvites` | sender or recipient | sender must be self | never | sender or recipient |
| `megasketchyMissions` | official/shared: all authed; private: creator; admin: all | creator must match; "official" requires admin | creator or admin; "official" requires admin | creator or admin |
| `cleanupLogs` | admin | never (Admin SDK only) | never | never |

**Important**: `gameSessions` update rule checks `request.resource.data.playerUids` (the post-update state), not the pre-update state. This allows joining players to add themselves while still blocking non-participants.

---

## Cloud Functions (`functions/src/index.ts`)

| Function | Trigger | What it does |
|----------|---------|-------------|
| `scheduledGameCleanup` | Daily at 03:00 UTC | Deletes expired sessions (by `expiresAt` or legacy 24h), associated Storage sketches, invite codes, game invites. Writes to `cleanupLogs`. |
| `recordAIGameResult` | Callable (authenticated) | Validates `{ personaId, won }`, increments persona stats via Admin SDK. |

---

## Data Retention & Cleanup

- Sessions get `expiresAt` based on `retentionDays` (1 = daily, 30 = monthly) set per game definition.
- Legacy sessions without `expiresAt` are cleaned up after 24 hours.
- Cleanup deletes: session doc, invite code doc, game invite docs, Storage files under `game-sketches/{sessionId}/`.
- Admin can manually trigger cleanup via the Data Cleanup panel or `POST /api/admin/game-cleanup`.

---

## Creating a New Game — Step by Step

### 1. Create the game definition in admin

Go to Admin → Games → Create Game. Set title, slug, splash art, player limits, retention, music.

### 2. Create the game directory

```
src/app/games/{slug}/
├── page.tsx              ← Next.js page, loads content, renders landing
└── {GameName}Game.tsx    ← main game component
```

### 3. Build `page.tsx`

Follow the pattern from existing games:

```typescript
"use client";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getContentBySlug } from "@/lib/content";
import type { JMContent } from "@/lib/content-types";
import type { CreateSessionInput } from "@/lib/game-sessions";
import { GameLandingPage, type GameMode } from "@/app/games/_gamecore";
import type { AIPersona } from "@/app/games/_gamecore";
import { YourGame } from "./YourGame";

export default function YourGamePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [gameData, setGameData] = useState<JMContent | null>(null);
  const [mode, setMode] = useState<GameMode | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [aiPersona, setAiPersona] = useState<AIPersona | null>(null);

  useEffect(() => {
    getContentBySlug("game", "your-slug").then(setGameData);
  }, []);

  // Handle ?sessionId= for invite links
  useEffect(() => {
    const sid = searchParams.get("sessionId");
    if (sid && !mode) {
      // Auto-join logic here (see existing games)
    }
  }, [searchParams, mode]);

  if (!gameData) return null;

  if (mode && sessionId) {
    return <YourGame mode={mode} sessionId={sessionId} aiPersona={aiPersona} />;
  }

  const multiplayerInput: CreateSessionInput = {
    gameId: gameData.id,
    gameName: gameData.title,
    gameSlug: gameData.slug,
    maxPlayers: gameData.maxPlayers ?? 2,
    ...(gameData.retentionDays != null ? { retentionDays: gameData.retentionDays } : {}),
  };

  return (
    <GameLandingPage
      game={gameData}
      multiplayerInput={multiplayerInput}
      allowAI
      onSoloVsAI={(sid, persona) => { setSessionId(sid); setAiPersona(persona); setMode("ai"); }}
      onMultiplayerStart={(sid) => { setSessionId(sid); setMode("friends"); }}
    />
  );
}
```

### 4. Build the game component

**For a turn-based 1v1 game**, use `useMultiplayerRound`:

```typescript
const { session, phase, mpSubmitMove, markAnimationDone } = useMultiplayerRound({
  sessionId,
  userId: user.uid,
  resolver: yourResolver,
  onRoundResolved: (entry) => { /* play animation, update local score */ },
});
```

Implement your `RoundResolver`:

```typescript
const yourResolver: RoundResolver = (session) => {
  const moves = session.pendingMoves;
  // Your game logic here
  return { roundEntry: { moves, result: { ... } }, gameOver: false, winner: null };
};
```

**For a party/complex game**, subscribe to the session directly via `subscribeToSession` and manage your own phase state (see Mega Sketchy for reference).

### 5. Add AI support

For turn-based games:
1. Build a prompt describing valid moves and game state.
2. Call `simpleMove(prompt, { persona: aiPersona.prompt, voice: aiPersona.voice })`.
3. Parse the `ACTION:` line from the response.
4. Handle failures gracefully (random fallback move).
5. Record results after game: `recordAIGameResult(personaId, won)`.

### 6. Award points

After a game completes, POST to `/api/user/points`:
```typescript
fetch("/api/user/points", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({ activityKey: "play_game" }),
});
```

---

## TypeScript Conventions

- `exactOptionalPropertyTypes` is enabled. When spreading optional fields, use:
  ```typescript
  ...(value != null ? { field: value } : {})
  ```
  Do NOT assign `undefined` to optional properties.

- All client-side Firebase imports are dynamic (`await import("firebase/firestore")`) for code splitting.

- Files that use browser APIs must have `"use client"` at the top.

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/app/games/_gamecore/index.ts` | Barrel — all shared game exports |
| `src/app/games/_gamecore/useMultiplayerRound.ts` | Round-based multiplayer hook |
| `src/app/games/_gamecore/AIPlayerManager.ts` | AI move/comment bridge |
| `src/app/games/_gamecore/GameLandingPage.tsx` | Shared landing page |
| `src/app/games/_gamecore/GameMultiplayerFlow.tsx` | Lobby/join dialog flow |
| `src/app/games/_gamecore/aiPersonas.ts` | Client-side persona cache and helpers |
| `src/lib/game-sessions.ts` | Session CRUD, moves, rounds |
| `src/lib/ai-personas.ts` | Persona CRUD + `recordAIGameResult` (callable) |
| `src/lib/game-sketches.ts` | Storage upload for sketch images |
| `src/lib/game-invites.ts` | Direct player invite system |
| `src/lib/content-types.ts` | `JMContent` type definition |
| `src/app/api/games/ai/route.ts` | Server-side AI proxy |
| `functions/src/index.ts` | Cloud Functions (cleanup + stats) |
| `firestore.rules` | Security rules |
| `GAMES-IMPROVEMENT-PLAN.md` | Tracked improvement backlog |

---

## Known Backlog

See `GAMES-IMPROVEMENT-PLAN.md` for tracked items. Notable remaining work:

- **Item 3**: Extract shared "chaptered video game" abstraction (`useChapteredVideo` hook) to reduce duplication between Tap Smash Arena and Sweep the Leg.
- **Server-side security Phase 3**: Move lobby operations (`startGame`, `removePlayerFromSession`, `addAIPlayerToSession`) to callable Cloud Functions with host-only validation.
