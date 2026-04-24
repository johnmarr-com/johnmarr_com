# Hybrid AI Play — Build Plan

Plan for maxing out AI opponent quality across every game on johnmarr.com
while spending as few LLM tokens as possible. Algorithms do the heavy lifting;
LLMs appear only where *the act of thinking out loud is itself the content*.

## Guiding principles

1. **Classify the game type first.** Three kinds:
   - **Deterministic strategy** (Boaty, Fyve). The move is a choice among
     defined options on a state. Algorithms dominate. LLM adds flavor only.
   - **LLM-native** (Wordonkulous, SweepTheLeg, TapSmashArena). The LLM's
     output is part of the move itself — a fake definition, a combat
     narration, a bomb-disarm monologue. There is no "pure algorithm"
     alternative, because the text itself is what the player experiences.
     Tokens are a design requirement, not an inefficiency to minimize.
     Personas genuinely shape gameplay here via prompt.
   - **Human-performance** (Blarf, MegaSketchy). The move is a spoken line,
     a sketch, a physical performance. AI opponents don't fit — **the game
     doesn't have AI players**. Skip these from this plan entirely.
2. **Algorithms first for deterministic strategy.** Any behavior that can be
   expressed as code should be. Grid games are math problems. LLMs are
   statistically worse at them and cost money to use.
3. **LLMs earn their tokens in strategy games.** They're used only when their
   output is the UX — persona commentary in a transcript, in-character
   reactions to events, and optionally move-selection for play styles where
   "what they'd do" matters more than "what's optimal" (creative, chaotic).
4. **LLMs are the product in LLM-native games.** Wordonkulous, SweepTheLeg,
   TapSmashArena — the AI's text output is what the player sees and reacts
   to. There is no algorithmic alternative, only prompt sophistication.
   "Sharp" and "Basic" tiers here map to prompt framing (richer vocabulary,
   more constraints, deeper persona integration), not to bypassing the model.
3. **Skill is universal.** Level 1–10 on the user ladder is the same vocabulary
   for player progression and AI difficulty. Add a persona at any level; the
   visual banding, the difficulty mapping, and the level icon come for free.
4. **Play style is per-game.** "Aggressive" in Boaty (always hunt hits) is not
   "aggressive" in Blarf (play bold cards). The shared schema names the style;
   each game supplies its own bias table.
5. **Self-play is the quality gate.** Before shipping a tier, run it against
   the tier below to confirm the difficulty jump is real. No hand-waving.
6. **Transcript is the primary LLM value.** Players remember the AI that said
   funny things during a loss more than the one that won the round.

## The four layers

Every game's AI opponent is composed of up to four layers. Games add layers
from the top down as their budget / needs grow.

```
┌─────────────────────────────────────────────┐
│ 4. (optional) LLM move override             │  creative / chaotic styles only
├─────────────────────────────────────────────┤
│ 3. LLM per-turn commentary (transcript)     │  fires after every move, ~150 tokens
├─────────────────────────────────────────────┤
│ 2. Play-style bias                          │  algorithmic reweight of layer 1
├─────────────────────────────────────────────┤
│ 1. Skill tier — basic / standard / sharp    │  pure algorithm, level-derived
└─────────────────────────────────────────────┘
```

**Layer 1 (Skill Tier)** — game-specific implementation of three pure
algorithms. Chosen by `aiEngineTierForLevel(persona.skillLevel)`.

**Layer 2 (Style Bias)** — a per-game bias table that reweights the candidate
set Layer 1 produces. Six play styles × N candidate cells = a small reweight
step. Zero tokens. No network.

**Layer 3 (Commentary)** — after the move is chosen by Layers 1-2, the game
calls `aiComment(persona, turnContext)` which fires one short LLM call (~150
in/out tokens) to produce one in-character line. Stored in a per-session
transcript. Shown at game end (or streamed inline if the game wants).

**Layer 4 (Move Override)** — for personas whose **play style** is the whole
point (creative, chaotic), we can optionally route the move decision itself
through an LLM instead of Layer 1. This trades strength for character —
accepted only for the two styles where that's desirable.

## Cost envelope

At ~30 turns/game, Sonnet pricing:

| Configuration | Tokens/game | $/game approx |
|---|---|---|
| Algorithm only (no transcript) | 0 | $0.0000 |
| + per-turn commentary | ~4.5k | ~$0.002 |
| + move override for 2 styles | ~20k | ~$0.008 |
| Full LLM moves (current SweepTheLeg) | ~45k | ~$0.02 |

Hybrid hits the sweet spot at roughly **10× cheaper than full-LLM**, with
**better win rates** (algorithms beat LLMs at deterministic games) and a
richer transcript than algorithms alone produce.

## Shared infrastructure

### Schema — already exists

- `AIPersona` in `src/app/games/_gamecore/aiPersonas.ts`: `id`, `name`,
  `playStyle`, `skillLevel`, `description`, `prompt`, `voice`, `avatarName`,
  `avatarScale`, `stats`.
- `AIPersonaDoc` in `src/lib/ai-personas.ts`: Firestore-side twin.
- `aiEngineTierForLevel(level: number)` — L1-3 → `basic`, L4-7 → `standard`,
  L8+ → `sharp`.

### Need to build — shared

1. **Transcript service** (`src/app/games/_gamecore/aiTranscript.ts`)
   - `aiComment(persona, context, opts?) → Promise<string>` — wraps `simpleMove`
     but for commentary, shorter prompt, explicit "respond with one line in
     character" instruction. Uses `persona.prompt` + `persona.voice`.
   - `pushTranscript(sessionId, personaId, line, turn)` — Firestore write.
   - `subscribeTranscript(sessionId) → …` — read side for end-of-game view.
2. **Transcript UI component** (`JMAITranscriptList` or similar in JMKit) —
   used by every game's end-of-game screen.
3. **Style-bias protocol** — not code, but a convention: every game's AI
   module exports `applyStyleBias(playStyle, candidates)` that takes a
   pre-ranked list and reshuffles it per style. Same signature means we can
   eventually write shared testing + self-play harnesses that compare styles
   across games.

## Per-game implementation pattern

Each game's AI module (`{game}/aiLogic.ts` or similar) exports:

```ts
// Layer 1: three strategies, empirically tier-validated
export function basicPick(state): Move;
export function standardPick(state): Move;
export function sharpPick(state): Move;

// Dispatcher
export function pickMoveForLevel(state, skillLevel: number): Move;

// Layer 2: play style bias (algorithmic)
export function applyStyleBias(
  playStyle: AIPlayStyle,
  rankedCandidates: Move[],
  state,
): Move[];

// Layer 3: state summary for transcript prompts
export function describeStateForAI(state, moveTaken): string;

// Layer 4 (optional, only if LLM-override is supported in this game)
export function llmPickMove?(state, persona): Promise<Move>;
```

This shape is the contract. Anything else is game-specific and stays inside
the module.

## Implementation status by game

### Deterministic strategy games (four-layer pattern applies)

| Game | L1 tiers | L2 style-bias | L3 transcript | L4 LLM override | Uses current LLM? |
|---|---|---|---|---|---|
| **Boaty** | ✅ done, self-play verified | ✅ done, self-play verified | ❌ | ❌ | no |
| **Fyve** | ❌ | ❌ | ❌ | ❌ | no, yet |

### LLM-native games (text output IS the game)

| Game | Pattern | Per-turn cost |
|---|---|---|
| **Wordonkulous** | Every AI turn is an LLM call producing a full fake definition. The word IS the move; no algorithmic alternative exists. | Full LLM call per AI turn; design requirement. |
| **SweepTheLeg** | Each AI move currently generates in-character combat/bomb narration that's part of the UX. The text is the transcript, the transcript is the experience. Keep as-is. | Full LLM call per AI turn; design requirement. |
| **TapSmashArena** | Same pattern — AI moves produce narrated arena action. Keep as-is. | Full LLM call per AI turn; design requirement. |

**LLM-native pattern** in brief:

- `AIPersona.skillLevel` maps to prompt sophistication, not to algorithm
  switches. A Level 10 "Game Master" gets richer instructions (reference
  obscure patterns, read the opponent's tendencies, use more vivid imagery);
  a Level 3 "Enthusiast" gets simpler framing (straightforward choices,
  plainer voice).
- `AIPersona.playStyle` genuinely colors output the way it can't in a grid
  game — an "aggressive" Wordonkulous AI writes definitions that dunk on
  rivals; a "cautious" one writes safe plausible bluffs. An aggressive
  SweepTheLeg AI narrates its bombs with taunt and tempo; a cautious one
  makes methodical callouts.
- Transcript = the game itself. No separate commentary pass needed; the
  move output already serves that role.
- Quality gate is human blind-tasting at each skill level, not self-play
  (no "win rate" to measure for generated content).

### Human-performance games (no AI opponents at all)

| Game | Why no AI |
|---|---|
| **Blarf** | Game of spoken performance between humans. AI can't meaningfully produce the game's core output. Exclude from AI plan. |
| **MegaSketchy** | Visual collaborative drawing. Similar constraint. |

## Phased roadmap

### Phase 1 — Complete Boaty hybrid (proof of pattern)

Effort: ~1 day.

1. Write `applyStyleBias(playStyle, candidates, state)` in `boatyAI.ts`.
   - aggressive: boost cells adjacent to hits (increase hunt weight).
   - cautious: boost heat-map densest cells (most confident probes).
   - analytical: use sharp unchanged (already heat-map).
   - creative: shuffle top-3 candidates, pick one (non-obvious but strong).
   - chaotic: pick from any unexplored cell, any tier (random-ish).
   - balanced: no-op.
2. Call `applyStyleBias` in `BoatyGame.tsx#executeAiTurn` after
   `pickTargetForLevel`.
3. Run the self-play harness with every play-style vs standard at each tier.
   Confirm win rates don't regress more than 5pp for the tier's strength.
4. Build `aiTranscript.ts` shared module + `aiComment` wrapper.
5. Fire `aiComment` at `executeAiTurn` completion; write to Firestore.
6. Render transcript in GC4 result screen.

### Phase 2 — Extract reusable layer

Effort: ~0.5 day. Lift the transcript service, UI, and style-bias protocol
to `_gamecore/` so every future game is a drop-in.

### Phase 3 — LLM-native prompt tiering (Wordonkulous, SweepTheLeg, TapSmashArena)

These three games stay fully LLM-driven by design — the text output IS
the game. The work here is making skill level and play style actually
influence prompts.

Deliverable per game: a `{game}AIPrompts.ts` module that returns a prompt
string given `(persona, round context)`, with meaningful variation by
`skillLevel` (prompt sophistication, vocabulary budget, allowed creative
latitude) and `playStyle` (tone, which tactical directions the persona
leans into).

Quality gate: human blind-tasting outputs at each tier. Compare
"Level 3 Enthusiast VIZOR" vs "Level 10 Game Master VIZOR" — both should
read as the same character, one noticeably more polished than the other.

### Phase 4 — Fyve

Fresh deterministic-strategy implementation using the four-layer pattern.

## Self-play as a quality gate

Every game with algorithmic tiers must ship with a self-play harness:

- N=1000 games per pairing at minimum.
- **Sharp vs Basic** should win ≥80% of the time.
- **Sharp vs Standard** should win ≥55%.
- **Standard vs Basic** should win ≥70%.
- **Sharp vs Sharp** and Standard vs Standard within ~5pp of 50/50
  (confirms no first-move-advantage bug or draw traps).

After adding play-style biases, each style-tier must still beat the tier
below by a meaningful margin:

- `aggressive`, `cautious`, `analytical`, `balanced` → within **5pp** of the
  pure tier's win rate (same-strength, different flavor).
- `creative`, `chaotic` → within **10pp** (these styles intentionally trade
  strength for character; tightening further flattens the persona difference).
- Every style-tier must still beat the tier-below's balanced baseline >50%,
  i.e. the tier ladder holds even with flavor applied.

**Boaty's verified result (N=1000 per pairing):**

| Pairing | Baseline vs tier-below | With style bias | Drop |
|---|---|---|---|
| sharp vs standard | 62% | — | — |
| sharp:aggressive | — | ~55% | 7pp |
| sharp:creative | — | 54% | 8pp |
| sharp:chaotic | — | 54% | 8pp |
| sharp:analytical | — | ~62% | 0pp |
| standard vs basic | 90% | — | — |
| standard:chaotic | — | 86% | 5pp |
| standard:creative | — | 80% | 10pp |

Harness pattern: `scripts/{game}SelfPlay.ts`. Boaty's already at
[scripts/boatySelfPlay.ts](scripts/boatySelfPlay.ts).

## How to add a new game's AI

1. Add a `{game}/aiLogic.ts` exporting `basicPick`, `standardPick`,
   `sharpPick`, `pickMoveForLevel`, `applyStyleBias`, `describeStateForAI`.
2. Write a self-play harness at `scripts/{game}SelfPlay.ts`. Validate tiers.
3. In the game's turn handler, call `pickMoveForLevel` then `applyStyleBias`.
4. (Optional) Call the shared `aiComment` after each AI move. No game code
   needed beyond passing `{persona, stateDescription}`.
5. (Optional) For creative / chaotic personas, wrap Layer 1 behind an
   `llmPickMove` call and pick from the top-K candidates the algorithm
   produced. This gives the LLM just enough latitude to feel creative
   without letting it make illegal / obviously-bad moves.

## Open questions / deferred decisions

- **Is Balanced worth a separate bias?** Right now it's a no-op which is fine
  but feels like a free slot. Could collapse Balanced into Standard's vanilla
  output forever, or give it a mild "safe pick" bias. Decide after Phase 1
  field-testing.
- **Transcript length.** Target ~1 line per turn. If personas get
  chatty, add a word budget in the comment prompt.
- **LLM rate limiting.** If per-turn commentary hits provider quotas during
  a tournament, fall back to a cached library of persona lines per
  persona × event-type. Already precedented — we have the per-player MP3
  taunts in Boaty. This is cheap insurance.
- **Multi-AI games.** If two AI personas play each other (party mode vs
  tournament), transcript multi-tracks cleanly; commentary calls parallelize.

## TL;DR

Classify every game before applying this plan:

1. **Deterministic strategy** (Boaty, Fyve, SweepTheLeg, TapSmashArena) →
   four-layer hybrid. Algorithms do the moves. LLM handles flavor. Cheap.
2. **Generative content** (Wordonkulous) → full LLM each turn, no apology.
   Skill tiers live in the prompt, not in an algorithm. Tokens are the game.
3. **Human-performance** (Blarf, MegaSketchy) → no AI players. Exclude.

Within category 1, the cheapest way to make every AI feel distinct:

- Skill from algorithm + level. Already done in Boaty, portable to others.
- Play style from algorithmic bias on top of the tier's ranked candidates.
- Flavor from cheap LLM commentary — build once, use everywhere.
- Heavy tokens only for `creative` and `chaotic` personas where the flavor
  is the whole game.

Boaty is the pilot (Layers 1 + 2 verified). Lift shared pieces into
`_gamecore` next (Phase 2). Apply LLM-native prompt tiering to
Wordonkulous / SweepTheLeg / TapSmashArena (Phase 3). Build Fyve fresh on
the deterministic pattern (Phase 4). Self-play verifies deterministic
tiers; blind-tasting verifies LLM-native tiers.
