// RPS spot-check harness for the gated-history skill mechanism.
//
// Plays headless Rock-Paper-Scissors games between two AI tiers and logs
// every move's reasoning so we can eyeball whether tier gating actually
// changes how the LLM thinks. NOT a statistical test — that's the next
// step. This is the "is it wired correctly" check.
//
// Round 1 is always random for both sides (no history exists yet).
// Rounds 2+ call the LLM with each side's tier-gated history slice.
//
// Usage:
//   node --env-file=.env.local --import tsx scripts/rpsSpotCheck.ts
//   node --env-file=.env.local --import tsx scripts/rpsSpotCheck.ts 5 none full
//
// Requires ANTHROPIC_API_KEY in .env.local.

import Anthropic from "@anthropic-ai/sdk";
import {
  aiHistoryTierForLevel,
  sliceHistoryByTier,
  TIER_PROMPT_DIRECTIVE,
  type AIHistoryTier,
} from "../src/app/games/_gamecore/aiSkillDice";

// ─── Config ──────────────────────────────────────────────────

const MODEL = "claude-haiku-4-5-20251001"; // matches production /api/games/ai
const MAX_TOKENS = 256;
const TEMPERATURE = 0.3;
const POINTS_TO_WIN = 3;
/** History clip for Champion (recent tier). Default 5 in production aiSkillDice;
 *  testing lower values shifts the differentiation onset earlier in the game.
 *  Override via env var: RECENT_N=2 ... */
const RECENT_N = process.env["RECENT_N"]
  ? parseInt(process.env["RECENT_N"], 10)
  : 5;

const PERSONA = {
  name: "TestBot",
  prompt:
    "You are a focused, competitive Rock-Paper-Scissors player. You think " +
    "carefully, look for patterns in your opponent's behavior, and play to win.",
  voice: "Direct, brief, confident.",
};

// Map tier → numeric skill level so we can drive aiHistoryTierForLevel.
const TIER_TO_LEVEL: Record<AIHistoryTier, number> = {
  none: 2, // Enthusiast (L1-3)
  recent: 5, // Champion (L4-7)
  full: 10, // Game Master (L8+)
};

/** Research-backed Level-k directive for testing against the stock "full" tier.
 *  Sourced from Wang et al 2014 + standard RPS game theory. RPS-specific. */
const RESEARCH_DIRECTIVE_RPS =
  "You are a Game Master Rock-Paper-Scissors opponent. You have access to the full game history. " +
  "Your goal is to win, not merely to be unexploitable. " +
  "Reason explicitly about opponent biases: humans tend to repeat winning moves and shift after losses, " +
  "often shifting in the cyclic direction (rock→paper→scissors→rock); they over-play rock, especially early; " +
  "they avoid playing the same move three times in a row. " +
  "Model the opponent at level-1 (reactive to your last move) or level-2 (anticipating your reaction), " +
  "and play one level above their apparent depth. " +
  "When you detect a confident pattern, exploit it about two-thirds of the time; " +
  "otherwise fall back to uniform 1/3-1/3-1/3 randomization to avoid becoming readable yourself. " +
  "Never play a deterministic sequence the opponent can lock onto. " +
  "If the read is ambiguous, prefer the move that beats their most-frequent recent play. " +
  "Stay in character but play to win.";

/** Master-3 directive: same Game Master framing, but doesn't claim full history. */
const MASTER_RECENT_DIRECTIVE =
  "You are a Game Master-level player: elite competitor. You have access " +
  "to the most recent rounds of play and deep awareness of opponent " +
  "decision patterns. Leverage your understanding of psychology, opponent " +
  "tendencies, and game theory to select the optimal move. Stay in " +
  "character but play to win.";

/** Simpler directives — less prescriptive, more room for the LLM to use judgment. */
const SIMPLE_CHAMPION_DIRECTIVE =
  "You are a moderately skilled Rock-Paper-Scissors player. Your opponent " +
  "is an average human — they have habits and tendencies you can spot from " +
  "their recent moves. Make your best guess based on what they're showing " +
  "you. Don't be too clever; just respond to their behavior.";

const SIMPLE_MASTER_DIRECTIVE =
  "You are a true master of Rock-Paper-Scissors. Your opponent is a human " +
  "with habits and tendencies. You can see this game's moves AND moves " +
  "from your previous games against this same opponent — patterns become " +
  "clearer the longer you play them. Anticipate their moves based on what " +
  "they tend to do. Don't overthink it. Follow the pattern, make your best " +
  "guess against their tendencies.";

/** Master-flavored playbook: same Wang biases + cross-game framing. */
const PLAYBOOK_MASTER_DIRECTIVE =
  "You are a Master-level Rock-Paper-Scissors player. You have deeply " +
  "studied human play patterns and have a competitive-analysis playbook. " +
  "Your opponent is an average human. You can see this game's moves AND " +
  "moves from recent prior games against this same opponent. Use the " +
  "playbook AND your accumulated history to anticipate their next move:\n\n" +
  "• WIN-STAY: humans repeat winning moves more than chance (~36% vs 33%).\n" +
  "• LOSE-SHIFT CYCLIC: after losing with X, humans tend to shift in the " +
  "cyclic direction (Rock→Paper→Scissors→Rock) ~38% of the time.\n" +
  "• OPENING ROCK BIAS: humans open with Rock ~36% of the time. Lean Paper.\n" +
  "• TRIPLE AVERSION: humans rarely play the same move three times in a row.\n\n" +
  "Across multiple games, individual quirks emerge — track how THIS player " +
  "deviates from the baselines. The longer you play them, the better you " +
  "predict them. Combine playbook priors with the actual data you have. " +
  "Make confident predictions, play the move that beats their predicted move.";

/** Explicit human-play playbook framed as competitive analysis.
 *  Names the specific Wang et al biases the LLM should look for. */
const PLAYBOOK_CHAMPION_DIRECTIVE =
  "You are a Champion-level Rock-Paper-Scissors player. You have studied " +
  "human play patterns and have a competitive-analysis playbook. Your " +
  "opponent is an average human. Use this playbook to anticipate their " +
  "next move:\n\n" +
  "• WIN-STAY: humans repeat winning moves more than chance (~36% vs 33% " +
  "baseline). If your opponent just won with Rock, expect Rock again at " +
  "elevated probability.\n" +
  "• LOSE-SHIFT CYCLIC: after losing, humans tend to shift in the cyclic " +
  "direction Rock→Paper→Scissors→Rock (~38%). If your opponent just lost " +
  "with Rock, expect Paper next.\n" +
  "• OPENING ROCK BIAS: humans open with Rock ~36% of the time (vs 32% " +
  "Paper, 32% Scissors). On round 1, lean toward Paper.\n" +
  "• TRIPLE AVERSION: humans rarely play the same move three times in a " +
  "row. If your opponent has played the same move twice, expect a switch.\n\n" +
  "Look at the recent moves. Predict their next move using the playbook. " +
  "Then play the move that beats your prediction. Trust the playbook unless " +
  "the data in this game clearly contradicts it.";

/** A "preset" is a tier (history slice) + a directive (prompt framing).
 *  Letting these decouple lets us A/B-test directives at the same tier.
 *  `recentN` overrides the global RECENT_N for this preset (only used
 *  when tier = "recent"). */
interface Preset {
  tier: AIHistoryTier;
  directive: string;
  label: string;
  recentN?: number;
  /** Bypass the LLM entirely — pick uniformly at random each turn.
   *  Used for control tests against LLM-without-history (Enthusiast). */
  isRandom?: boolean;
  /** Ranked-options mechanism: LLM ranks all 3 moves best-to-worst with
   *  full history; this preset always picks the rank at this index (0=best,
   *  1=second, 2=worst). When set, this preset uses the ranked LLM call
   *  instead of the standard one. tier/recentN/directive are ignored. */
  pickRank?: 0 | 1 | 2;
  /** Bypass LLM, play algorithmic human-style with Wang et al biases.
   *  Win-stay/lose-shift cyclic, opening rock bias, triple-aversion. */
  isHumanSim?: boolean;
  /** Cross-game memory: include up to N prior completed games' moves in
   *  this preset's history at the start of each new game. Master tier idea:
   *  patterns become clearer the more you play the same opponent. */
  crossGames?: number;
  /** Override the default model for this preset. Use to test Sonnet for
   *  Master while keeping Haiku elsewhere. */
  model?: string;
  /** Use the algorithmic Iocaine Powder ensemble instead of an LLM. */
  isIocaine?: boolean;
}

const PRESETS: Record<string, Preset> = {
  none: {
    tier: "none",
    directive: TIER_PROMPT_DIRECTIVE.none,
    label: "Enthusiast",
  },
  recent: {
    tier: "recent",
    directive: TIER_PROMPT_DIRECTIVE.recent,
    label: "Champion",
  },
  full: {
    tier: "full",
    directive: TIER_PROMPT_DIRECTIVE.full,
    label: "Master-stock",
  },
  "full+r": {
    tier: "full",
    directive: RESEARCH_DIRECTIVE_RPS,
    label: "Master-research",
  },
  // New presets: Champion gets last 1 round, Master gets last 3 rounds.
  // Tests the hypothesis that recency dominates — more history past 3
  // dilutes signal, and 1 round narrows Champion-vs-Enthusiast gap.
  champ1: {
    tier: "recent",
    directive: TIER_PROMPT_DIRECTIVE.recent,
    label: "Champion-1",
    recentN: 1,
  },
  master3: {
    tier: "recent",
    directive: MASTER_RECENT_DIRECTIVE,
    label: "Master-3",
    recentN: 3,
  },
  random: {
    tier: "none",
    directive: "",
    label: "Random",
    isRandom: true,
  },
  // Algorithmic human-style player. Wang et al biases. No LLM call.
  // Used as the Enthusiast tier in production: legible, beatable, free.
  humanSim: {
    tier: "none",
    directive: "",
    label: "Human-Sim",
    isHumanSim: true,
  },
  // Champion at recent-3 explicitly (independent of global RECENT_N).
  champ3: {
    tier: "recent",
    directive: TIER_PROMPT_DIRECTIVE.recent,
    label: "Champion-3",
    recentN: 3,
  },
  // New designs: simpler directives + (Master) cross-game memory.
  simpleChamp: {
    tier: "recent",
    directive: SIMPLE_CHAMPION_DIRECTIVE,
    label: "Simple-Champion-3",
    recentN: 3,
  },
  simpleMasterX: {
    tier: "full",
    directive: SIMPLE_MASTER_DIRECTIVE,
    label: "Simple-Master-X4",
    crossGames: 3, // current game + 3 prior = 4 total
  },
  // Explicit human playbook + recent-3 memory. Champion that knows the
  // Wang biases by name and uses them as predictive priors.
  playbookChamp: {
    tier: "recent",
    directive: PLAYBOOK_CHAMPION_DIRECTIVE,
    label: "Playbook-Champion-3",
    recentN: 3,
  },
  // Sonnet-powered Master with playbook + cross-game memory. The most
  // informed Master configuration — every lever stacked.
  sonnetMaster: {
    tier: "full",
    directive: PLAYBOOK_MASTER_DIRECTIVE,
    label: "Sonnet-Master-X4",
    crossGames: 3,
    model: "claude-sonnet-4-6",
  },
  // Iocaine Powder (Egnor 1999) — algorithmic ensemble. No LLM call.
  // Multiple predictors, ε=0 (full strength).
  iocaine: {
    tier: "full",
    directive: "",
    label: "Iocaine",
    isIocaine: true,
  },
  // Ranked-options mechanism. All three see full history; rank choice
  // determines tier strength. Master always plays the LLM's #1, Champion
  // its #2, Enthusiast its #3 (worst).
  rankedMaster: {
    tier: "full",
    directive: "",
    label: "Ranked-Master",
    pickRank: 0,
  },
  rankedChampion: {
    tier: "full",
    directive: "",
    label: "Ranked-Champion",
    pickRank: 1,
  },
  rankedEnthusiast: {
    tier: "full",
    directive: "",
    label: "Ranked-Enthusiast",
    pickRank: 2,
  },
};

// ─── Types ───────────────────────────────────────────────────

type Attack = "R" | "P" | "S";
const ATTACKS: Attack[] = ["R", "P", "S"];
const ATTACK_NAME: Record<Attack, string> = {
  R: "Rock",
  P: "Paper",
  S: "Scissors",
};

interface MoveRecord {
  player: Attack; // self
  opponent: Attack; // other side
  winner: "player" | "opponent" | "tie";
}

interface MoveResult {
  attack: Attack;
  reasoning: string;
  random: boolean;
}

// ─── RPS rules ──────────────────────────────────────────────

const BEATS: Record<Attack, Attack> = { R: "S", S: "P", P: "R" };

function roundWinner(a: Attack, b: Attack): "A" | "B" | "tie" {
  if (a === b) return "tie";
  return BEATS[a] === b ? "A" : "B";
}

// ─── Prompt builder (mirrors TapSmashArenaGame.buildMovePrompt) ────

/** A completed game's record — used for cross-game history (Master tier). */
interface CompletedGame {
  moves: MoveRecord[];
  scoreSelf: number;
  scoreOpp: number;
  won: boolean;
}

/** Render a list of completed prior games as a prompt prefix.
 *  Most-recent first. Empty array → empty string. */
function formatPriorGames(priorGames: readonly CompletedGame[]): string {
  if (priorGames.length === 0) return "";
  const lines: string[] = ["", "Previous games against this opponent (most recent first):"];
  // Reverse so most recent appears first.
  const ordered = [...priorGames].reverse();
  ordered.forEach((g, gi) => {
    const ago = gi + 1; // 1 = previous, 2 = before that, etc.
    const outcome = g.won ? `you won ${g.scoreSelf}-${g.scoreOpp}` : `you lost ${g.scoreSelf}-${g.scoreOpp}`;
    lines.push(`\nGame -${ago} (${outcome}, ${g.moves.length} rounds):`);
    g.moves.forEach((m, ri) => {
      const result = m.winner === "tie" ? "Tie" : m.winner === "player" ? "You won" : "Opponent won";
      lines.push(`  R${ri + 1}: You=${ATTACK_NAME[m.player]}, Opp=${ATTACK_NAME[m.opponent]} → ${result}`);
    });
  });
  return lines.join("\n");
}

function buildMovePrompt(
  history: MoveRecord[],
  preset: Preset,
  priorGames: readonly CompletedGame[] = [],
): string {
  const effectiveRecentN = preset.recentN ?? RECENT_N;
  const sliced = sliceHistoryByTier(history, preset.tier, effectiveRecentN);

  const system = `You are playing Rock Paper Scissors against a human.

RULES:
- Rock beats Scissors
- Scissors beats Paper
- Paper beats Rock
- Same = tie

First to ${POINTS_TO_WIN} points wins. Study the player's patterns and choose the move most likely to beat them. Look for tendencies, repeats, sequences, and post-win/post-loss habits.

CRITICAL: Your ACTION must match your reasoning. If you want to counter their Rock, play Paper. If you want to counter their Paper, play Scissors. If you want to counter their Scissors, play Rock.

${preset.directive}

Format your response EXACTLY as:
REASONING: <1 brief sentence for the player to read after the game>
ACTION: <Rock, Paper, or Scissors>`;

  const priorBlock = formatPriorGames(priorGames);

  if (sliced.length === 0) {
    if (preset.tier === "none" && history.length > 0) {
      return system + priorBlock + "\n\nYou don't recall earlier rounds — pick your move on instinct.";
    }
    // First round opening — inject documented human opening bias so the AI
    // can exploit it instead of opening blindly.
    return (
      system +
      priorBlock +
      `\n\nThis is the first round of the current game — no current-game ` +
      `history yet. Note: in casual Rock-Paper-Scissors, humans show a ` +
      `documented opening bias toward Rock (~36%) over Paper or Scissors ` +
      `(~32% each). Consider exploiting this if you think your opponent is ` +
      `human-like.`
    );
  }

  const lines = sliced.map((m, i) => {
    const result =
      m.winner === "tie"
        ? "Tie"
        : m.winner === "player"
          ? "You won"
          : "Opponent won";
    const roundNum = history.length - sliced.length + i + 1;
    return `Round ${roundNum}: You=${ATTACK_NAME[m.player]}, Opponent=${ATTACK_NAME[m.opponent]} → ${result}`;
  });
  return (
    system +
    priorBlock +
    `\n\nCurrent game so far:\n${lines.join("\n")}\n\nRound ${history.length + 1} — what do you play?`
  );
}

function wrapWithPersona(gamePrompt: string): string {
  return (
    `You are playing a game as an agentic player. This is your player identity:\n\n${PERSONA.prompt}\n\n` +
    `This is the current game situation. Consider these details, and make a decision in line with your given identity:\n\n${gamePrompt}` +
    `\n\nIMPORTANT — All communication must be brief and written in this voice/style: ${PERSONA.voice}`
  );
}

// ─── LLM call ────────────────────────────────────────────────

const client = new Anthropic({ apiKey: process.env["ANTHROPIC_API_KEY"]! });

function parseAttack(text: string): Attack | null {
  const upper = text.toUpperCase();
  if (upper.includes("ROCK")) return "R";
  if (upper.includes("PAPER")) return "P";
  if (upper.includes("SCISSOR")) return "S";
  return null;
}

async function getLlmMove(
  history: MoveRecord[],
  preset: Preset,
  priorGames: readonly CompletedGame[] = [],
): Promise<MoveResult> {
  const prompt = wrapWithPersona(buildMovePrompt(history, preset, priorGames));
  const res = await client.messages.create({
    model: preset.model ?? MODEL,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    messages: [{ role: "user", content: prompt }],
  });
  const text = res.content[0]?.type === "text" ? res.content[0].text : "";
  const reasonMatch = text.match(/REASONING:\s*([\s\S]+?)(?=\nACTION:)/i);
  const actionMatch = text.match(/ACTION:\s*(.+)/i);
  const reasoning = reasonMatch ? reasonMatch[1]!.trim() : "(no reasoning)";
  const action = actionMatch ? actionMatch[1]!.trim() : "";
  const attack = parseAttack(action);
  if (attack) return { attack, reasoning, random: false };
  // Couldn't parse — fall back to random and flag it
  return {
    attack: ATTACKS[Math.floor(Math.random() * ATTACKS.length)]!,
    reasoning: `(LLM parse failure: "${text.slice(0, 80)}")`,
    random: true,
  };
}

// ─── Ranked-options LLM call ─────────────────────────────────
// Asks the LLM to rank all 3 moves best-to-worst given full history.
// The Preset's pickRank field then selects which rank to play.

function buildRankedPrompt(history: MoveRecord[]): string {
  const system = `You are playing Rock Paper Scissors against a human.

RULES:
- Rock beats Scissors
- Scissors beats Paper
- Paper beats Rock
- Same = tie

First to ${POINTS_TO_WIN} points wins. Study the player's patterns. Look for tendencies, repeats, sequences, and post-win/post-loss habits.

Your task: rank ALL THREE moves (Rock, Paper, Scissors) from most likely to win this round to least likely. Each rank must be a different move.

Format your response EXACTLY as:
RANK_1: <Rock, Paper, or Scissors>
REASONING_1: <one brief sentence>
RANK_2: <Rock, Paper, or Scissors>
REASONING_2: <one brief sentence>
RANK_3: <Rock, Paper, or Scissors>
REASONING_3: <one brief sentence>`;

  if (history.length === 0) {
    return (
      system +
      `\n\nThis is the first round — no game history yet. Note: in casual ` +
      `Rock-Paper-Scissors, humans show a documented opening bias toward ` +
      `Rock (~36%) over Paper or Scissors (~32% each). Rank accordingly.`
    );
  }
  const lines = history.map((m, i) => {
    const result =
      m.winner === "tie" ? "Tie" : m.winner === "player" ? "You won" : "Opponent won";
    return `Round ${i + 1}: You=${ATTACK_NAME[m.player]}, Opponent=${ATTACK_NAME[m.opponent]} → ${result}`;
  });
  return system + `\n\nMove history:\n${lines.join("\n")}\n\nRound ${history.length + 1} — rank your three options.`;
}

async function getRankedLlmMove(
  history: MoveRecord[],
  pickRank: 0 | 1 | 2,
): Promise<MoveResult> {
  const prompt = wrapWithPersona(buildRankedPrompt(history));
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 400, // larger budget — three reasonings
    temperature: TEMPERATURE,
    messages: [{ role: "user", content: prompt }],
  });
  const text = res.content[0]?.type === "text" ? res.content[0].text : "";

  // Parse three ranks
  const ranks: { attack: Attack; reasoning: string }[] = [];
  for (let i = 1; i <= 3; i++) {
    const rankMatch = text.match(new RegExp(`RANK_${i}:\\s*(.+)`, "i"));
    const reasonMatch = text.match(new RegExp(`REASONING_${i}:\\s*([^\\n]+)`, "i"));
    const action = rankMatch ? rankMatch[1]!.trim() : "";
    const reasoning = reasonMatch ? reasonMatch[1]!.trim() : "(no reasoning)";
    const attack = parseAttack(action);
    if (attack) ranks.push({ attack, reasoning });
  }

  const picked = ranks[pickRank];
  if (picked) {
    const rankLabel = ["best", "2nd", "worst"][pickRank];
    return {
      attack: picked.attack,
      reasoning: `[rank=${rankLabel}] ${picked.reasoning}`,
      random: false,
    };
  }
  // Parse failure — fall back to random
  return {
    attack: ATTACKS[Math.floor(Math.random() * ATTACKS.length)]!,
    reasoning: `(ranked-LLM parse failure — got ${ranks.length}/3 valid ranks)`,
    random: true,
  };
}

// ─── Human-style simulator (Wang et al 2014 biases) ─────────
// Plays like an average human: opening rock bias, win-stay, lose-shift in
// cyclic direction, triple-aversion. No LLM call — pure local code.

const CYCLIC_NEXT: Record<Attack, Attack> = { R: "P", P: "S", S: "R" };
const ANTI_CYCLIC: Record<Attack, Attack> = { R: "S", P: "R", S: "P" };

function weightedPickAttack(probs: Record<Attack, number>): Attack {
  // Renormalize defensively
  const total = probs.R + probs.P + probs.S;
  const r = Math.random() * total;
  let cum = 0;
  cum += probs.R;
  if (r <= cum) return "R";
  cum += probs.P;
  if (r <= cum) return "P";
  return "S";
}

function simulateHumanMove(history: MoveRecord[]): MoveResult {
  // Opening: ~36% rock, ~32% paper, ~32% scissors
  if (history.length === 0) {
    const attack = weightedPickAttack({ R: 0.36, P: 0.32, S: 0.32 });
    return {
      attack,
      reasoning: "(human-sim opening: rock-biased)",
      random: false,
    };
  }

  const last = history[history.length - 1]!;
  const myLast = last.player;
  const result = last.winner;

  let probs: Record<Attack, number>;
  let reason: string;

  if (result === "player") {
    // Win-stay (~36% repeat winner)
    const others = (["R", "P", "S"] as Attack[]).filter((a) => a !== myLast);
    probs = { R: 0, P: 0, S: 0 };
    probs[myLast] = 0.36;
    probs[others[0]!] = 0.32;
    probs[others[1]!] = 0.32;
    reason = `won with ${ATTACK_NAME[myLast]} → win-stay`;
  } else if (result === "opponent") {
    // Lose-shift cyclic (~38%) > anti-cyclic (~30%) > stay (~32%)
    const cyc = CYCLIC_NEXT[myLast];
    const anti = ANTI_CYCLIC[myLast];
    probs = { R: 0, P: 0, S: 0 };
    probs[cyc] = 0.38;
    probs[anti] = 0.30;
    probs[myLast] = 0.32;
    reason = `lost with ${ATTACK_NAME[myLast]} → cyclic shift to ${ATTACK_NAME[cyc]}`;
  } else {
    // Tie — slight shift away from tied move
    const others = (["R", "P", "S"] as Attack[]).filter((a) => a !== myLast);
    probs = { R: 0, P: 0, S: 0 };
    probs[myLast] = 0.30;
    probs[others[0]!] = 0.35;
    probs[others[1]!] = 0.35;
    reason = `tied with ${ATTACK_NAME[myLast]} → slight shift`;
  }

  // Triple-aversion: if I just played the same move twice, dampen the
  // probability of playing it a third time by 85%.
  if (history.length >= 2) {
    const prev = history[history.length - 2]!;
    if (prev.player === myLast) {
      probs[myLast] *= 0.15;
      reason += ` (triple-averted)`;
    }
  }

  const attack = weightedPickAttack(probs);
  return {
    attack,
    reasoning: `(human-sim: ${reason})`,
    random: false,
  };
}

// ─── Iocaine Powder (Egnor 1999) — algorithmic RPS opponent ─
//
// Idea: track multiple predictors of the opponent's next move. For each
// predictor's guess G, also consider P+1 (counter their counter of G) and
// P+2 (counter-counter-counter). At each turn, pick whichever strategy has
// performed best over the recent history of "what would have been played
// if I'd been using this strategy."

const COUNTERS: Record<Attack, Attack> = { R: "P", P: "S", S: "R" };
function counter(a: Attack): Attack {
  return COUNTERS[a];
}

/** Score decay so recent performance dominates older data. */
const IOCAINE_DECAY = 0.9;

function frequencyMostCommon(moves: Attack[]): Attack | null {
  if (moves.length === 0) return null;
  const counts: Record<Attack, number> = { R: 0, P: 0, S: 0 };
  for (const m of moves) counts[m]++;
  let best: Attack = "R";
  let bestCount = -1;
  for (const a of ["R", "P", "S"] as Attack[]) {
    if (counts[a] > bestCount) {
      best = a;
      bestCount = counts[a];
    }
  }
  return best;
}

/** Find the longest suffix of `seq` that appears earlier in `seq`, and
 *  return the move that followed that earlier occurrence. */
function patternMatch(seq: Attack[], maxLen: number): Attack | null {
  if (seq.length < 2) return null;
  const limit = Math.min(maxLen, seq.length - 1);
  for (let len = limit; len >= 1; len--) {
    const suffix = seq.slice(seq.length - len);
    // Search for this pattern earlier (don't overlap suffix)
    for (let i = seq.length - len - 1; i >= 0; i--) {
      let match = true;
      for (let j = 0; j < len; j++) {
        if (seq[i + j] !== suffix[j]) {
          match = false;
          break;
        }
      }
      if (match && i + len < seq.length) {
        return seq[i + len]!;
      }
    }
  }
  return null;
}

interface IocaineConfig {
  /** Pattern-match max length. Higher = stronger but needs more history. */
  patternMaxLen: number;
  /** Probability of playing uniform random instead of best strategy.
   *  Used to dial down strength for lower tiers. */
  epsilon: number;
}

const IOCAINE_FULL: IocaineConfig = { patternMaxLen: 5, epsilon: 0 };

/** Generate all candidate strategy-keyed predictions for current turn. */
function generateIocaineCandidates(
  history: MoveRecord[],
  config: IocaineConfig,
): Map<string, Attack> {
  const out = new Map<string, Attack>();
  const oppMoves = history.map((h) => h.opponent);
  const myMoves = history.map((h) => h.player);

  // Predictor 1: opponent's most-frequent move
  const oppFreq = frequencyMostCommon(oppMoves);
  if (oppFreq) {
    out.set("freq-opp-P0", counter(oppFreq));
    out.set("freq-opp-P1", counter(counter(oppFreq)));
    out.set("freq-opp-P2", counter(counter(counter(oppFreq))));
  }

  // Predictor 2: my most-frequent move (anti-self-pattern)
  const myFreq = frequencyMostCommon(myMoves);
  if (myFreq) {
    out.set("freq-me-P0", counter(myFreq));
    out.set("freq-me-P1", counter(counter(myFreq)));
    out.set("freq-me-P2", counter(counter(counter(myFreq))));
  }

  // Predictor 3+: pattern matching on opponent's history at lengths 1..N
  for (let len = 1; len <= config.patternMaxLen; len++) {
    const predOpp = patternMatch(oppMoves, len);
    if (predOpp) {
      out.set(`pat-opp-${len}-P0`, counter(predOpp));
      out.set(`pat-opp-${len}-P1`, counter(counter(predOpp)));
      out.set(`pat-opp-${len}-P2`, counter(counter(counter(predOpp))));
    }
  }
  // Pattern matching on my history (predicts what they think I'll do)
  for (let len = 1; len <= config.patternMaxLen; len++) {
    const predMe = patternMatch(myMoves, len);
    if (predMe) {
      // If I'm predictable per pattern, opponent counters → I should counter their counter
      out.set(`pat-me-${len}-P1`, counter(counter(predMe)));
    }
  }

  return out;
}

/** Score each strategy by retrospectively replaying it across history.
 *  At each historical turn, what would this strategy have predicted, and
 *  would that have won against the actual opponent move? Weighted decay. */
function scoreIocaineStrategies(
  history: MoveRecord[],
  config: IocaineConfig,
): Map<string, number> {
  const scores = new Map<string, number>();
  // Walk through history, at each point compute what each strategy
  // would have played given the slice up to that point, vs what actually
  // happened in that round.
  for (let i = 1; i < history.length; i++) {
    const slice = history.slice(0, i);
    const candidates = generateIocaineCandidates(slice, config);
    const actualOpp = history[i]!.opponent;
    candidates.forEach((predictedMove, key) => {
      const w = roundWinner(predictedMove, actualOpp);
      const delta = w === "A" ? 1 : w === "B" ? -1 : 0;
      const prev = scores.get(key) ?? 0;
      scores.set(key, prev * IOCAINE_DECAY + delta);
    });
  }
  return scores;
}

function iocaineMove(
  history: MoveRecord[],
  config: IocaineConfig = IOCAINE_FULL,
): MoveResult {
  // ε-greedy noise for weakened tiers
  if (Math.random() < config.epsilon) {
    return {
      attack: ATTACKS[Math.floor(Math.random() * ATTACKS.length)]!,
      reasoning: "(iocaine: ε-noise)",
      random: false,
    };
  }
  // Round 1: no info, default to Paper (counters human opening rock-bias)
  if (history.length === 0) {
    return { attack: "P", reasoning: "(iocaine: opening anti-rock)", random: false };
  }
  const candidates = generateIocaineCandidates(history, config);
  if (candidates.size === 0) {
    return { attack: "P", reasoning: "(iocaine: no candidates)", random: false };
  }
  const scores = scoreIocaineStrategies(history, config);
  // Pick the strategy with highest historical score (among current candidates)
  let bestKey = "";
  let bestScore = -Infinity;
  candidates.forEach((_move, key) => {
    const s = scores.get(key) ?? 0;
    if (s > bestScore) {
      bestScore = s;
      bestKey = key;
    }
  });
  const move = candidates.get(bestKey)!;
  return {
    attack: move,
    reasoning: `(iocaine: ${bestKey}, score=${bestScore.toFixed(2)})`,
    random: false,
  };
}

function randomMove(): MoveResult {
  return {
    attack: ATTACKS[Math.floor(Math.random() * ATTACKS.length)]!,
    reasoning: "(random — round 1 has no history)",
    random: true,
  };
}

// ─── Game loop ───────────────────────────────────────────────

interface GameOutcome {
  winner: "A" | "B";
  rounds: number;
  scoreA: number;
  scoreB: number;
}

interface GameOutcomeWithHistory extends GameOutcome {
  historyA: MoveRecord[];
  historyB: MoveRecord[];
}

async function playGame(
  presetA: Preset,
  presetB: Preset,
  gameLabel: string,
  verbose: boolean,
  priorGamesA: readonly CompletedGame[] = [],
  priorGamesB: readonly CompletedGame[] = [],
): Promise<GameOutcomeWithHistory> {
  const historyA: MoveRecord[] = [];
  const historyB: MoveRecord[] = [];
  let scoreA = 0;
  let scoreB = 0;
  let round = 0;

  if (verbose) {
    console.log("\n" + "═".repeat(72));
    console.log(`${gameLabel}: A=${presetA.label} vs B=${presetB.label}`);
    if (priorGamesA.length > 0 || priorGamesB.length > 0) {
      console.log(`  (cross-game memory: A=${priorGamesA.length} prior games, B=${priorGamesB.length} prior games)`);
    }
    console.log("═".repeat(72));
  }

  while (scoreA < POINTS_TO_WIN && scoreB < POINTS_TO_WIN) {
    round++;

    // Each preset uses its own logic. Cross-game presets see priorGames in
    // their prompt; non-cross presets ignore priorGames.
    const fetchMove = (
      history: MoveRecord[],
      preset: Preset,
      priorGames: readonly CompletedGame[],
    ): Promise<MoveResult> => {
      if (preset.isRandom) return Promise.resolve(randomMove());
      if (preset.isHumanSim) return Promise.resolve(simulateHumanMove(history));
      if (preset.isIocaine) return Promise.resolve(iocaineMove(history));
      if (preset.pickRank !== undefined) return getRankedLlmMove(history, preset.pickRank);
      return getLlmMove(history, preset, priorGames);
    };
    const [moveA, moveB] = await Promise.all([
      fetchMove(historyA, presetA, priorGamesA),
      fetchMove(historyB, presetB, priorGamesB),
    ]);

    const winner = roundWinner(moveA.attack, moveB.attack);
    const winnerLabel =
      winner === "tie" ? "TIE" : winner === "A" ? "A wins" : "B wins";
    if (winner === "A") scoreA++;
    else if (winner === "B") scoreB++;

    if (verbose) {
      console.log(`\nRound ${round}:`);
      console.log(`  A [${presetA.label}, history=${sliceHistoryByTier(historyA, presetA.tier, presetA.recentN ?? RECENT_N).length} of ${historyA.length}]`);
      console.log(`    → ${ATTACK_NAME[moveA.attack]}  ${moveA.random ? "" : `«${moveA.reasoning}»`}`);
      console.log(`  B [${presetB.label}, history=${sliceHistoryByTier(historyB, presetB.tier, presetB.recentN ?? RECENT_N).length} of ${historyB.length}]`);
      console.log(`    → ${ATTACK_NAME[moveB.attack]}  ${moveB.random ? "" : `«${moveB.reasoning}»`}`);
      console.log(`  RESULT: ${winnerLabel}  (running score A=${scoreA} B=${scoreB})`);
    }

    historyA.push({
      player: moveA.attack,
      opponent: moveB.attack,
      winner: winner === "tie" ? "tie" : winner === "A" ? "player" : "opponent",
    });
    historyB.push({
      player: moveB.attack,
      opponent: moveA.attack,
      winner: winner === "tie" ? "tie" : winner === "B" ? "player" : "opponent",
    });
  }

  const winner: "A" | "B" = scoreA >= POINTS_TO_WIN ? "A" : "B";
  if (verbose) {
    console.log(`\n  ▶ FINAL: A=${scoreA} B=${scoreB} — ${winner} wins (${round} rounds)`);
  }

  return { winner, rounds: round, scoreA, scoreB, historyA, historyB };
}

// ─── Pairing runner ──────────────────────────────────────────

async function runPairing(
  presetA: Preset,
  presetB: Preset,
  games: number,
): Promise<void> {
  let aWins = 0;
  let bWins = 0;
  let totalRounds = 0;

  // Cross-game memory: maintained per-side, only used by presets with
  // crossGames set. We always track records but only feed them to the
  // prompt for cross-game presets.
  const allCrossA: CompletedGame[] = [];
  const allCrossB: CompletedGame[] = [];

  console.log("\n" + "█".repeat(72));
  console.log(`PAIRING START: ${presetA.label} vs ${presetB.label} (${games} games)`);
  if (presetA.crossGames || presetB.crossGames) {
    console.log(`  Cross-game memory: A=${presetA.crossGames ?? 0}, B=${presetB.crossGames ?? 0}`);
  }
  console.log("█".repeat(72));

  for (let i = 1; i <= games; i++) {
    // Verbose output only for game 1 of each pairing — eyeball check.
    const verbose = i === 1;
    // Slice cross-game window per preset's crossGames setting (most recent N).
    const priorA = presetA.crossGames ? allCrossA.slice(-presetA.crossGames) : [];
    const priorB = presetB.crossGames ? allCrossB.slice(-presetB.crossGames) : [];
    const outcome = await playGame(presetA, presetB, `GAME ${i}/${games}`, verbose, priorA, priorB);
    if (outcome.winner === "A") aWins++;
    else bWins++;
    totalRounds += outcome.rounds;
    // Append the completed game to both sides' cross-history (each from its own POV).
    allCrossA.push({
      moves: outcome.historyA,
      scoreSelf: outcome.scoreA,
      scoreOpp: outcome.scoreB,
      won: outcome.winner === "A",
    });
    allCrossB.push({
      moves: outcome.historyB,
      scoreSelf: outcome.scoreB,
      scoreOpp: outcome.scoreA,
      won: outcome.winner === "B",
    });
    // Compact one-liner per game so progress is visible.
    console.log(
      `  [${i.toString().padStart(3)}/${games}] ${presetA.label} vs ${presetB.label} → ${outcome.winner} (${outcome.scoreA}-${outcome.scoreB}, ${outcome.rounds} rounds) | running A=${aWins} B=${bWins}`,
    );
  }

  console.log("\n" + "█".repeat(72));
  console.log(`PAIRING SUMMARY: ${presetA.label} vs ${presetB.label}`);
  console.log(`  A (${presetA.label}) wins: ${aWins}/${games}  (${((aWins / games) * 100).toFixed(0)}%)`);
  console.log(`  B (${presetB.label}) wins: ${bWins}/${games}  (${((bWins / games) * 100).toFixed(0)}%)`);
  console.log(`  Avg rounds/game: ${(totalRounds / games).toFixed(1)}`);
  console.log("█".repeat(72));
}

// ─── Entry ───────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const games = args[0] ? parseInt(args[0]) : 5;
  const presetAName = args[1] ?? null;
  const presetBName = args[2] ?? null;

  console.log(`\nRPS Spot-Check — ${games} games per pairing\n`);
  console.log(`Model: ${MODEL}\n`);
  console.log(
    `Tier mapping: none=L${TIER_TO_LEVEL.none}, recent=L${TIER_TO_LEVEL.recent}, full=L${TIER_TO_LEVEL.full}`,
  );
  console.log(`Available presets: ${Object.keys(PRESETS).join(", ")}`);
  console.log(`Champion (recent) history clip: last ${RECENT_N} rounds`);
  console.log(`(round 1 is always random — no history exists)\n`);

  // Sanity check tier mapping ↔ aiHistoryTierForLevel
  for (const [tier, level] of Object.entries(TIER_TO_LEVEL)) {
    const derived = aiHistoryTierForLevel(level);
    if (derived !== tier)
      throw new Error(`tier mismatch: L${level} → ${derived} (expected ${tier})`);
  }

  if (presetAName && presetBName) {
    const a = PRESETS[presetAName];
    const b = PRESETS[presetBName];
    if (!a) throw new Error(`unknown preset: ${presetAName}`);
    if (!b) throw new Error(`unknown preset: ${presetBName}`);
    await runPairing(a, b, games);
    return;
  }

  // Default suite: three pairings
  await runPairing(PRESETS["none"]!, PRESETS["full"]!, games);
  await runPairing(PRESETS["recent"]!, PRESETS["full"]!, games);
  await runPairing(PRESETS["none"]!, PRESETS["recent"]!, games);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
