// Boaty self-play harness.
//
// Runs N headless games between two AI strategies and prints win rates + turn
// statistics. Purely synchronous — no Firestore, no React, no network.
//
// Usage:
//   npx tsx scripts/boatySelfPlay.ts                             # default suite
//   npx tsx scripts/boatySelfPlay.ts 500                         # 500 games per pairing
//   npx tsx scripts/boatySelfPlay.ts 200 sharp standard          # tier vs tier
//   npx tsx scripts/boatySelfPlay.ts 200 sharp:aggressive sharp  # style vs no-style

import {
  GRID_SIZE,
  TOTAL_RAFT_SQUARES,
  SQUARE_FIXED_ROTATION,
  randomPlacement,
  randomGatorPosition,
  resolveAttack,
  moveGator,
  checkWin,
  posKey,
} from "../src/app/games/boaty/boatyLogic";
import {
  rankCandidates,
  applyStyleBias,
  type BoatySkillTier,
} from "../src/app/games/boaty/boatyAI";
import type { AIPlayStyle } from "../src/app/games/_gamecore/aiPersonas";
import type {
  PlayerBoard,
  AttackRecord,
  AttackResult,
} from "../src/app/games/boaty/boatyTypes";

// ─── Strategy (tier + optional style) ─────────────────────────

interface Strategy {
  tier: BoatySkillTier;
  style: AIPlayStyle;
}

function parseStrategy(s: string): Strategy {
  // "tier" or "tier:style"
  const [tierRaw, styleRaw] = s.split(":");
  const tier = (tierRaw ?? "standard") as BoatySkillTier;
  const style = (styleRaw ?? "balanced") as AIPlayStyle;
  return { tier, style };
}

function formatStrategy(s: Strategy): string {
  return s.style === "balanced" ? s.tier : `${s.tier}:${s.style}`;
}

function pickFor(attacks: AttackRecord, s: Strategy) {
  const ranked = rankCandidates(attacks, s.tier);
  return applyStyleBias(s.style, ranked, attacks);
}

// ─── One simulated game ───────────────────────────────────────

interface GameOutcome {
  winner: 0 | 1;
  turns: number;
  hitsForWinner: number;
  hitsForLoser: number;
  missesForWinner: number;
  missesForLoser: number;
  gatorHitsForWinner: number;
  gatorHitsForLoser: number;
}

function emptyAttacks(): AttackRecord {
  return { hits: [], misses: [], gatorHits: [] };
}

function freshBoard(): PlayerBoard {
  const rafts = randomPlacement().map((r) =>
    r.type === "square" ? { ...r, rotation: SQUARE_FIXED_ROTATION } : r,
  );
  const gator = randomGatorPosition(rafts);
  return { rafts, gator };
}

function applyResult(
  attacks: AttackRecord,
  target: { row: number; col: number },
  result: AttackResult,
): AttackRecord {
  const next: AttackRecord = {
    hits: [...attacks.hits],
    misses: [...attacks.misses],
    gatorHits: [...attacks.gatorHits],
  };
  if (result === "hit") next.hits.push(target);
  else if (result === "miss") next.misses.push(target);
  else next.gatorHits.push(target);
  return next;
}

function simulateGame(
  s0: Strategy,
  s1: Strategy,
  maxTurns = 500,
): GameOutcome {
  const boards: [PlayerBoard, PlayerBoard] = [freshBoard(), freshBoard()];
  const attacksOn: [AttackRecord, AttackRecord] = [emptyAttacks(), emptyAttacks()];
  let current: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
  let turns = 0;

  while (turns < maxTurns) {
    turns++;
    const attacker = current;
    const defender: 0 | 1 = attacker === 0 ? 1 : 0;
    const strat = attacker === 0 ? s0 : s1;

    const target = pickFor(attacksOn[defender], strat);
    // Safety: a style could theoretically pick an already-explored cell.
    const already = new Set<string>([
      ...attacksOn[defender].hits.map(posKey),
      ...attacksOn[defender].misses.map(posKey),
      ...attacksOn[defender].gatorHits.map(posKey),
    ]);
    const finalTarget = already.has(posKey(target))
      ? pickFor(attacksOn[defender], { tier: "basic", style: "balanced" })
      : target;

    const result = resolveAttack(finalTarget.row, finalTarget.col, boards[defender]);
    attacksOn[defender] = applyResult(attacksOn[defender], finalTarget, result);

    boards[defender] = {
      ...boards[defender],
      gator: moveGator(boards[defender].gator, boards[defender].rafts),
    };

    if (result === "hit" && checkWin(attacksOn[defender])) {
      const w = attacker;
      const l = defender;
      return {
        winner: w,
        turns,
        hitsForWinner: attacksOn[l].hits.length,
        missesForWinner: attacksOn[l].misses.length,
        gatorHitsForWinner: attacksOn[l].gatorHits.length,
        hitsForLoser: attacksOn[w].hits.length,
        missesForLoser: attacksOn[w].misses.length,
        gatorHitsForLoser: attacksOn[w].gatorHits.length,
      };
    }
    if (result !== "gator") current = defender;
  }
  throw new Error(
    `Game timed out after ${maxTurns} turns — ${formatStrategy(s0)} vs ${formatStrategy(s1)}`,
  );
}

// ─── Batch runner ─────────────────────────────────────────────

interface BatchResult {
  s0: Strategy;
  s1: Strategy;
  games: number;
  s0Wins: number;
  s1Wins: number;
  avgTurnsS0Wins: number;
  avgTurnsS1Wins: number;
  accuracyS0: number;
  accuracyS1: number;
}

function runBatch(s0: Strategy, s1: Strategy, games: number): BatchResult {
  let s0Wins = 0;
  let s1Wins = 0;
  let turnsWhenS0 = 0;
  let turnsWhenS1 = 0;
  let hitsS0 = 0;
  let attemptsS0 = 0;
  let hitsS1 = 0;
  let attemptsS1 = 0;

  for (let i = 0; i < games; i++) {
    const r = simulateGame(s0, s1);
    if (r.winner === 0) {
      s0Wins++;
      turnsWhenS0 += r.turns;
    } else {
      s1Wins++;
      turnsWhenS1 += r.turns;
    }
    const h0 = r.winner === 0 ? r.hitsForWinner : r.hitsForLoser;
    const m0 = r.winner === 0 ? r.missesForWinner : r.missesForLoser;
    const g0 = r.winner === 0 ? r.gatorHitsForWinner : r.gatorHitsForLoser;
    const h1 = r.winner === 1 ? r.hitsForWinner : r.hitsForLoser;
    const m1 = r.winner === 1 ? r.missesForWinner : r.missesForLoser;
    const g1 = r.winner === 1 ? r.gatorHitsForWinner : r.gatorHitsForLoser;
    hitsS0 += h0;
    attemptsS0 += h0 + m0 + g0;
    hitsS1 += h1;
    attemptsS1 += h1 + m1 + g1;
  }

  return {
    s0,
    s1,
    games,
    s0Wins,
    s1Wins,
    avgTurnsS0Wins: s0Wins > 0 ? turnsWhenS0 / s0Wins : 0,
    avgTurnsS1Wins: s1Wins > 0 ? turnsWhenS1 / s1Wins : 0,
    accuracyS0: attemptsS0 > 0 ? hitsS0 / attemptsS0 : 0,
    accuracyS1: attemptsS1 > 0 ? hitsS1 / attemptsS1 : 0,
  };
}

function printResult(r: BatchResult): void {
  const winPct0 = ((r.s0Wins / r.games) * 100).toFixed(1);
  const winPct1 = ((r.s1Wins / r.games) * 100).toFixed(1);
  const acc0 = (r.accuracyS0 * 100).toFixed(1);
  const acc1 = (r.accuracyS1 * 100).toFixed(1);
  const l = formatStrategy(r.s0).padEnd(22);
  const rhs = formatStrategy(r.s1).padEnd(22);
  console.log(
    `  ${l} vs ${rhs} ` +
      `→ ${r.s0Wins.toString().padStart(4)}w / ${r.s1Wins.toString().padStart(4)}w ` +
      `(${winPct0}% / ${winPct1}%)  ` +
      `acc ${acc0}% / ${acc1}%  ` +
      `turns ${r.avgTurnsS0Wins.toFixed(1)} / ${r.avgTurnsS1Wins.toFixed(1)}`,
  );
}

// ─── Entry point ──────────────────────────────────────────────

function main(): void {
  const argv = process.argv.slice(2);
  const games = Number(argv[0]) > 0 ? Number(argv[0]) : 500;

  const s0Arg = argv[1];
  const s1Arg = argv[2];

  console.log(
    `\nBoaty self-play — ${games} games per pairing (${GRID_SIZE}×${GRID_SIZE} grid, ${TOTAL_RAFT_SQUARES} raft cells)\n`,
  );

  let pairings: Array<[Strategy, Strategy]>;
  if (s0Arg && s1Arg) {
    pairings = [[parseStrategy(s0Arg), parseStrategy(s1Arg)]];
  } else {
    // Default suite: tier baselines + every style variant vs its balanced tier
    // baseline. Quick read on whether style biases stay within the 5pp strength
    // guardrail from the plan.
    const tiers: BoatySkillTier[] = ["basic", "standard", "sharp"];
    const styles: AIPlayStyle[] = [
      "aggressive",
      "cautious",
      "creative",
      "analytical",
      "chaotic",
      "balanced",
    ];
    pairings = [];
    // Tier baselines (no style).
    pairings.push([
      { tier: "basic", style: "balanced" },
      { tier: "standard", style: "balanced" },
    ]);
    pairings.push([
      { tier: "standard", style: "balanced" },
      { tier: "sharp", style: "balanced" },
    ]);
    // Each style at sharp tier vs sharp balanced (does the bias preserve strength?).
    for (const style of styles) {
      if (style === "balanced") continue;
      for (const tier of tiers) {
        pairings.push([
          { tier, style },
          { tier, style: "balanced" },
        ]);
      }
    }
  }

  for (const [a, b] of pairings) {
    const t = Date.now();
    const r = runBatch(a, b, games);
    const ms = Date.now() - t;
    printResult(r);
    if (ms / games > 3) console.log(`    (${(ms / games).toFixed(1)}ms/game)`);
  }
  console.log();
}

main();
