/**
 * Sweep the Leg (resolverKey "hml") — High / Mid / Low, first to 5, with
 * double points on the two "Low" upset chapters. Reproduces the client
 * stlResolver's roundEntry.result + transcript byte-for-byte.
 */

import { registerResolver } from "./registry";
import { makeSimultaneousMoveResolver } from "./makeSimultaneousMoveResolver";

const ATTACK_FULL: Record<string, string> = { H: "High", M: "Mid", L: "Low" };

registerResolver(
  "hml",
  makeSimultaneousMoveResolver({
    sides: ["red", "white"],
    beats: { H: "L", M: "H", L: "M" },
    defaultMove: "H",
    pointsToWin: 5,
    // chapter = `${redMove}-${whiteMove}`. Red doubles on L-M, White doubles on L-H.
    scoreDelta: (winnerSide, redMove, whiteMove) => {
      const chapter = `${redMove}-${whiteMove}`;
      if (winnerSide === "red") return chapter === "L-M" ? 2 : 1;
      if (winnerSide === "white") return chapter === "L-H" ? 2 : 1;
      return 0;
    },
    buildResult: (ctx) => ({
      chapter: `${ctx.sideAMove}-${ctx.sideBMove}`,
      winner: ctx.winnerSide,
      redDelta: ctx.aDelta,
      whiteDelta: ctx.bDelta,
      redScore: ctx.aScore,
      whiteScore: ctx.bScore,
    }),
    buildTranscript: (ctx) => {
      const redTag = ctx.aTag ?? "Red";
      const whiteTag = ctx.bTag ?? "White";
      const lines: string[] = [
        `Round ${ctx.round + 1} — Red (${redTag}): ${ATTACK_FULL[ctx.sideAMove]}, White (${whiteTag}): ${ATTACK_FULL[ctx.sideBMove]}`,
      ];
      if (ctx.winnerSide) {
        const delta = ctx.winnerSide === "red" ? ctx.aDelta : ctx.bDelta;
        lines.push(
          `${ctx.winnerSide === "red" ? "Red" : "White"} wins — ${delta} point${delta > 1 ? "s" : ""} (${ctx.aScore}-${ctx.bScore})`,
        );
      } else {
        lines.push(`Tie (${ctx.aScore}-${ctx.bScore})`);
      }
      if (ctx.gameOver) {
        lines.push(
          `Game over — ${ctx.winnerSide === "red" ? `Red (${redTag})` : `White (${whiteTag})`} wins!`,
        );
      }
      return lines;
    },
  }),
);
