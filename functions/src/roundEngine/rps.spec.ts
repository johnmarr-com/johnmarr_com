/**
 * Tap Smash Arena (resolverKey "rps") — Rock / Paper / Scissors, first to 3.
 * Reproduces the client tsaResolver's roundEntry.result + transcript.
 *
 * Registered now for parity; Tap Smash is not yet server-resolved (its sessions
 * carry no resolverKey), so this never fires until Tap Smash opts in later.
 */

import { registerResolver } from "./registry";
import { makeSimultaneousMoveResolver } from "./makeSimultaneousMoveResolver";

const ATTACK_FULL: Record<string, string> = { R: "Rock", P: "Paper", S: "Scissors" };

registerResolver(
  "rps",
  makeSimultaneousMoveResolver({
    sides: ["p1", "p2"],
    beats: { R: "S", S: "P", P: "R" },
    defaultMove: "R",
    pointsToWin: 3,
    scoreDelta: () => 1,
    buildResult: (ctx) => ({
      p1Attack: ctx.sideAMove,
      p2Attack: ctx.sideBMove,
      winner: ctx.winnerSide,
      // Cosmetic animation pick — 0 on a tie, else 1..3. Math.random is fine in
      // the functions runtime; this server-chosen value is now authoritative.
      variant: ctx.sideAMove === ctx.sideBMove ? 0 : Math.floor(Math.random() * 3) + 1,
      p1Delta: ctx.aDelta,
      p2Delta: ctx.bDelta,
      p1Score: ctx.aScore,
      p2Score: ctx.bScore,
    }),
    buildTranscript: (ctx) => {
      const p1Tag = ctx.aTag ?? "P1";
      const p2Tag = ctx.bTag ?? "P2";
      const lines: string[] = [
        `Round ${ctx.round + 1} — ${p1Tag}: ${ATTACK_FULL[ctx.sideAMove]}, ${p2Tag}: ${ATTACK_FULL[ctx.sideBMove]}`,
      ];
      if (ctx.winnerSide) {
        const tag = ctx.winnerSide === "p1" ? p1Tag : p2Tag;
        lines.push(`${tag} wins — 1 point (${ctx.aScore}-${ctx.bScore})`);
      } else {
        lines.push(`Tie (${ctx.aScore}-${ctx.bScore})`);
      }
      if (ctx.gameOver) {
        lines.push(`Game over — ${ctx.winnerSide === "p1" ? p1Tag : p2Tag} wins!`);
      }
      return lines;
    },
  }),
);
