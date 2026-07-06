/**
 * BluffBox — server-authoritative reducer (engineKey "bluffbox").
 *
 * Truth/lie party game. Each turn a SHARER (rotating, not the host) gets a card
 * and secretly picks truth/lie; everyone else guesses. The server owns all
 * progression + scoring + card dealing + the rotation.
 *
 *   pack-select → round-intro → sharing → guessing → result → … → game-over
 *
 * Hidden answer (closes the cheat vector — sharerChoice used to sit on the public
 * doc): `bluffSecrets/{sid}` (Admin-only) holds `{ cardPool, sharerChoice }`.
 * The engine deals the next card from the secret pool (writes `cardURL` public)
 * and reads `sharerChoice` to score; the sharer-choice route writes it there.
 * NOTE the engine only fires on gameSessions writes, so the route also writes a
 * non-revealing `bbChoiceMade` flag on the session to trigger this reducer; the
 * reducer reads the actual choice from the secret doc. The answer is published
 * (`bbRevealChoice`) only at `result`.
 *
 * Timers (phaseDeadlineAt + client nudge + sweep): sharing 30s (advance on the
 * sharer's tap; a stalled sharer just skips the turn — no verbal claim to guess),
 * guessing 15s, results ~20s, round-intro ~3.5s.
 */

import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { registerEngine } from "../../engine/registry";
import type { EngineSession, Reducer, StateUpdate } from "../../engine/types";
import {
  applyScoreDeltas,
  determineWinners,
  scoreTurn,
  selectCard,
  shuffleTurnOrder,
} from "./logic";

const ENGINE_KEY = "bluffbox";

const ROUND_INTRO_MS = 3_500;
const SHARE_MS = 30_000;
const GUESS_MS = 15_000;
const RESULT_MS = 20_000;

const ACTIVE_PHASES = new Set([
  "pack-select",
  "round-intro",
  "sharing",
  "guessing",
  "result",
]);

const secretPath = (sid: string): string => `bluffSecrets/${sid}`;

interface Secret {
  cardPool?: string[];
  sharerChoice?: "truth" | "lie" | null;
}

const bluffBoxReducer: Reducer = {
  shouldRun(s) {
    if (s.status !== "playing") return false;
    if ((s.players ?? []).length < 2) return false;
    return ACTIVE_PHASES.has((s["bbPhase"] as string) ?? "pack-select");
  },

  secretRefs(_s, sessionId) {
    return [secretPath(sessionId)];
  },

  reduce(ctx): StateUpdate | null {
    const s: EngineSession = ctx.session;
    const now = ctx.now;
    const sid = ctx.sessionId;
    const players = s.players ?? [];
    if (players.length < 2) return null;
    const uids = players.map((p) => p.uid);

    const phase = (s["bbPhase"] as string) ?? "pack-select";
    const deadline = (s["phaseDeadlineAt"] as number | undefined) ?? 0;
    const scores = (s["scores"] as Record<string, number> | undefined) ?? {};
    const secret = ctx.secrets[secretPath(sid)] as unknown as Secret | null;
    const turnOrder = (s["turnOrder"] as string[] | undefined) ?? [];
    const idx = (s["currentTurnIndex"] as number | undefined) ?? 0;

    const gameOver = (): StateUpdate => {
      const { winners, points } = determineWinners(scores);
      logger.info(`[bluffbox] ${sid}: → game-over winners=[${winners.join(",")}]`);
      return {
        fields: {
          bbPhase: "game-over",
          winners,
          winnerPoints: points,
          phaseDeadlineAt: FieldValue.delete(),
        },
        gameOver: true,
        winner: winners[0] ?? null,
        winnerUids: winners,
      };
    };

    // Deal the next card from the secret pool and enter `sharing` for `forIdx`.
    const dealOrEnd = (forIdx: number): StateUpdate => {
      const pool = secret?.cardPool ?? [];
      if (pool.length === 0) return gameOver(); // ran out of cards
      const { card, remainingPool } = selectCard(pool);
      return {
        fields: {
          bbPhase: "sharing",
          currentTurnIndex: forIdx,
          cardURL: card,
          guesses: {},
          bbChoiceMade: false,
          bbRevealChoice: null,
          phaseDeadlineAt: now + SHARE_MS,
        },
        docWrites: [
          { path: secretPath(sid), fields: { cardPool: remainingPool, sharerChoice: null }, merge: true },
        ],
      };
    };

    // After a finished/skipped turn: next sharer, next round, or game over.
    const advanceTurn = (): StateUpdate => {
      const nextIdx = idx + 1;
      if (nextIdx < turnOrder.length) return dealOrEnd(nextIdx);
      const round = (s["roundNumber"] as number | undefined) ?? 1;
      const total = (s["totalRounds"] as number | undefined) ?? 1;
      if (round < total && (secret?.cardPool?.length ?? 0) > 0) {
        logger.info(`[bluffbox] ${sid}: round ${round} → ${round + 1}`);
        return {
          fields: {
            roundNumber: round + 1,
            turnOrder: shuffleTurnOrder(uids),
            currentTurnIndex: 0,
            bbPhase: "round-intro",
            phaseDeadlineAt: now + ROUND_INTRO_MS,
          },
        };
      }
      return gameOver();
    };

    // pack-select → wait for the host's select-pack route (secret cardPool +
    // scores + turnOrder written), then start round 1.
    if (phase === "pack-select") {
      if ((secret?.cardPool?.length ?? 0) > 0 && Object.keys(scores).length > 0) {
        logger.info(`[bluffbox] ${sid}: pack-select → round-intro`);
        return { fields: { bbPhase: "round-intro", roundNumber: 1, phaseDeadlineAt: now + ROUND_INTRO_MS } };
      }
      return null;
    }

    if (phase === "round-intro") {
      if (now < deadline) return null;
      return dealOrEnd(idx);
    }

    // sharing → guessing when the sharer has locked a choice (in the secret doc,
    // triggered via the bbChoiceMade session write) OR skip the turn on stall.
    if (phase === "sharing") {
      const choice = secret?.sharerChoice;
      if (choice === "truth" || choice === "lie") {
        logger.info(`[bluffbox] ${sid}: sharing → guessing (turn ${idx})`);
        return { fields: { bbPhase: "guessing", phaseDeadlineAt: now + GUESS_MS } };
      }
      if (now >= deadline) {
        logger.info(`[bluffbox] ${sid}: sharer stalled — skip turn ${idx}`);
        return advanceTurn();
      }
      return null;
    }

    // guessing → result when all non-sharer players guessed OR deadline; score it.
    if (phase === "guessing") {
      const sharer = turnOrder[idx];
      const guesses = (s["guesses"] as Record<string, "truth" | "lie"> | undefined) ?? {};
      const guessers = uids.filter((u) => u !== sharer);
      const allIn = guessers.every((u) => guesses[u] === "truth" || guesses[u] === "lie");
      if (!allIn && now < deadline) return null;

      const choice = secret?.sharerChoice;
      if ((choice !== "truth" && choice !== "lie") || !sharer) {
        // No recorded choice (shouldn't happen) — skip without scoring.
        return advanceTurn();
      }
      const deltas = scoreTurn(choice, guesses, sharer);
      const turnRecord = {
        sharerUid: sharer,
        cardURL: (s["cardURL"] as string | null) ?? null,
        sharerChoice: choice,
        guesses,
        roundNumber: (s["roundNumber"] as number | undefined) ?? 1,
      };
      logger.info(`[bluffbox] ${sid}: guessing → result (sharer ${sharer} = ${choice})`);
      return {
        fields: {
          scores: applyScoreDeltas(scores, deltas),
          bbHistory: FieldValue.arrayUnion(turnRecord),
          bbRevealChoice: choice, // publish the answer for the result screen
          bbPhase: "result",
          phaseDeadlineAt: now + RESULT_MS,
        },
      };
    }

    if (phase === "result") {
      if (now < deadline) return null;
      return advanceTurn();
    }

    return null;
  },
};

registerEngine(ENGINE_KEY, bluffBoxReducer);
