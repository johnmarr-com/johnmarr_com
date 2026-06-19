/**
 * Wordonkulous — server-authoritative reducer (engineKey "wordonkulous").
 *
 * Round-based group word game. The server owns ALL phase progression + scoring;
 * clients only submit words/votes (via the API route) and render server state.
 *
 *   pack-select → round-intro → submitting → voting → results → (loop) → final
 *
 * Transitions advance on a CONDITION (all players submitted / all voted) OR a
 * DEADLINE (`phaseDeadlineAt`), so one AFK player can never wedge a round. The
 * deadline is enforced by whichever fires the engine first: a player's own
 * submission/vote, a client nudge (`/api/games/engine-tick`) the instant the
 * clock passes, or the 1-minute `sweepDeadlines` safety net. Untimed phases
 * (pack-select waits on the host's pack choice; final is terminal) carry no
 * deadline. Returns `null` when nothing should advance (the no-op fence).
 *
 * No hidden info ⇒ no secret docs. Pure logic lives in `./logic` (copy of the
 * client's `wordonkulousTypes.ts`).
 */

import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { registerEngine } from "../../engine/registry";
import type { EngineSession, Reducer, StateUpdate } from "../../engine/types";
import { applyScoreDeltas, determineWinners, scoreRound, shuffleArray } from "./logic";

const ENGINE_KEY = "wordonkulous";

// Deadline durations (the no-show fallback; the game advances instantly when
// everyone has acted). Submit 75s / Vote 45s / Results ~20s / round intro ~3.5s.
const ROUND_INTRO_MS = 3_500;
const SUBMIT_MS = 75_000;
const VOTE_MS = 45_000;
const RESULTS_MS = 20_000;

const ACTIVE_PHASES = new Set([
  "pack-select",
  "round-intro",
  "submitting",
  "voting",
  "results",
]);

type StrMap = Record<string, string>;
type NumMap = Record<string, number>;

const wordonkulousReducer: Reducer = {
  shouldRun(s) {
    if (s.status !== "playing") return false;
    if ((s.players ?? []).length < 2) return false;
    return ACTIVE_PHASES.has((s["wkPhase"] as string) ?? "pack-select");
  },

  reduce(ctx): StateUpdate | null {
    const s: EngineSession = ctx.session;
    const now = ctx.now;
    const players = s.players ?? [];
    if (players.length < 2) return null;

    const phase = (s["wkPhase"] as string) ?? "pack-select";
    const deadline = (s["phaseDeadlineAt"] as number | undefined) ?? 0;
    const scores = (s["wkScores"] as NumMap | undefined) ?? {};
    const sid = ctx.sessionId;

    // pack-select: wait until the host's select-pack route write lands defs +
    // initial scores, then open round 1 (the engine owns the phase, not the route).
    if (phase === "pack-select") {
      const defs = (s["wkDefinitions"] as string[] | undefined) ?? [];
      if (defs.length > 0 && Object.keys(scores).length > 0) {
        logger.info(`[wordonkulous] ${sid}: pack-select → round-intro`);
        return {
          fields: { wkPhase: "round-intro", wkCurrentRound: 1, phaseDeadlineAt: now + ROUND_INTRO_MS },
        };
      }
      return null;
    }

    // round-intro: cosmetic animation; open submissions when its short timer passes.
    if (phase === "round-intro") {
      if (now < deadline) return null;
      return {
        fields: {
          wkPhase: "submitting",
          wkSubmissions: {},
          wkVotes: {},
          wkShuffledAuthors: [],
          wkSubmitDeadline: now + SUBMIT_MS,
          phaseDeadlineAt: now + SUBMIT_MS,
        },
      };
    }

    // submitting → voting: advance when all players submitted OR deadline passes.
    if (phase === "submitting") {
      const subs = (s["wkSubmissions"] as StrMap | undefined) ?? {};
      const allIn = players.every((p) => subs[p.uid] != null);
      if (!allIn && now < deadline) return null;

      const submittedUids = Object.keys(subs);
      if (submittedUids.length >= 2) {
        logger.info(`[wordonkulous] ${sid}: submitting → voting (${submittedUids.length} words)`);
        return {
          fields: {
            wkShuffledAuthors: shuffleArray(submittedUids),
            wkPhase: "voting",
            wkVoteDeadline: now + VOTE_MS,
            phaseDeadlineAt: now + VOTE_MS,
          },
        };
      }
      // <2 words → no meaningful vote; score (likely 0) and show results.
      const result = scoreRound({}, subs);
      logger.info(`[wordonkulous] ${sid}: submitting → results (skip vote, <2 words)`);
      return {
        fields: {
          wkScores: applyScoreDeltas(scores, result.deltas),
          wkPhase: "results",
          phaseDeadlineAt: now + RESULTS_MS,
        },
      };
    }

    // voting → results: advance when all submitters voted OR deadline passes.
    if (phase === "voting") {
      const subs = (s["wkSubmissions"] as StrMap | undefined) ?? {};
      const votes = (s["wkVotes"] as StrMap | undefined) ?? {};
      const allVoted = Object.keys(subs).every((uid) => votes[uid] != null);
      if (!allVoted && now < deadline) return null;

      const result = scoreRound(votes, subs);
      logger.info(`[wordonkulous] ${sid}: voting → results`);
      return {
        fields: {
          wkScores: applyScoreDeltas(scores, result.deltas),
          wkPhase: "results",
          phaseDeadlineAt: now + RESULTS_MS,
        },
      };
    }

    // results → next round or final: auto-advance when the results hold passes.
    if (phase === "results") {
      if (now < deadline) return null;
      const cur = (s["wkCurrentRound"] as number | undefined) ?? 1;
      const total = (s["wkTotalRounds"] as number | undefined) ?? 1;
      if (cur < total) {
        logger.info(`[wordonkulous] ${sid}: results → round-intro (round ${cur + 1}/${total})`);
        return {
          fields: {
            wkCurrentRound: cur + 1,
            wkSubmissions: {},
            wkVotes: {},
            wkShuffledAuthors: [],
            wkPhase: "round-intro",
            phaseDeadlineAt: now + ROUND_INTRO_MS,
          },
        };
      }
      const { winners, points } = determineWinners(scores);
      logger.info(`[wordonkulous] ${sid}: results → final — winners=[${winners.join(",")}] pts=${points}`);
      return {
        fields: {
          wkWinners: winners,
          wkWinnerPoints: points,
          wkPhase: "final",
          phaseDeadlineAt: FieldValue.delete(),
        },
        gameOver: true,
        winner: winners[0] ?? null,
      };
    }

    return null;
  },
};

registerEngine(ENGINE_KEY, wordonkulousReducer);
