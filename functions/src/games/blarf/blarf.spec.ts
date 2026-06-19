/**
 * Blarf — server-authoritative reducer (engineKey "blarf").
 *
 * Social-deduction word game. The server owns ALL progression + role assignment
 * + scoring; clients only confirm their role, signal "done speaking", and vote
 * (via the API route), and render server state.
 *
 *   pack-select → round-intro → role-reveal → speaking → voting → results → … → final
 *
 * Hidden info (closes the cheat vector where Blarfers were readable on the
 * public doc):
 *  - `blarfSecret/{sid}` (Admin-only): the pack's per-round data (letter + word
 *    pool). Written by the select-pack route; read here to assign roles.
 *  - `blarfRoles/{sid}/roles/{uid}` (owner-readable): each player's OWN role
 *    this round ({word,isBlarfer,letter}). Written here at role-reveal.
 *  The Blarfer list stays server-side until `results`, when the engine writes
 *  the public reveal (`bfBlarfers` + `bfReveal`).
 *
 * Timers (server-enforced via `phaseDeadlineAt` + client nudge + sweep): the
 * active speaker has 15s + a DONE button; advance on DONE or timeout — a frozen
 * speaker can't stall the table (replaces the host "Next Speaker"). Vote 60s,
 * role-reveal 30s, round-intro ~3.5s, results auto-advance ~25s.
 */

import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { registerEngine } from "../../engine/registry";
import type { EngineSession, Reducer, StateUpdate } from "../../engine/types";
import {
  applyScoreDeltas,
  assignRoles,
  determineWinners,
  getCurrentRound,
  scoreBlarfRound,
  shuffleArray,
  type BlarfRoundData,
} from "./logic";

const ENGINE_KEY = "blarf";

const ROUND_INTRO_MS = 3_500;
const ROLE_REVEAL_MS = 30_000;
const SPEAK_MS = 15_000;
const VOTE_MS = 60_000;
const RESULTS_MS = 25_000;

const ACTIVE_PHASES = new Set([
  "pack-select",
  "round-intro",
  "role-reveal",
  "speaking",
  "voting",
  "results",
]);

const secretPath = (sid: string): string => `blarfSecret/${sid}`;
const rolePath = (sid: string, uid: string): string => `blarfRoles/${sid}/roles/${uid}`;

interface Role {
  word: string;
  isBlarfer: boolean;
  letter: string;
}

const blarfReducer: Reducer = {
  shouldRun(s) {
    if (s.status !== "playing") return false;
    if ((s.players ?? []).length < 2) return false;
    return ACTIVE_PHASES.has((s["bfPhase"] as string) ?? "pack-select");
  },

  secretRefs(s, sessionId) {
    return [
      secretPath(sessionId),
      ...(s.players ?? []).map((p) => rolePath(sessionId, p.uid)),
    ];
  },

  reduce(ctx): StateUpdate | null {
    const s: EngineSession = ctx.session;
    const now = ctx.now;
    const sid = ctx.sessionId;
    const players = s.players ?? [];
    if (players.length < 2) return null;
    const uids = players.map((p) => p.uid);

    const phase = (s["bfPhase"] as string) ?? "pack-select";
    const deadline = (s["phaseDeadlineAt"] as number | undefined) ?? 0;
    const scores = (s["bfScores"] as Record<string, number> | undefined) ?? {};

    const secret = ctx.secrets[secretPath(sid)] as unknown as { rounds?: BlarfRoundData[] } | null;
    const roleOf = (uid: string): Role | null =>
      ctx.secrets[rolePath(sid, uid)] as unknown as Role | null;

    // pack-select: wait for the host's select-pack route write (secret rounds +
    // initial scores), then open round 1.
    if (phase === "pack-select") {
      if ((secret?.rounds?.length ?? 0) > 0 && Object.keys(scores).length > 0) {
        logger.info(`[blarf] ${sid}: pack-select → round-intro`);
        return {
          fields: { bfPhase: "round-intro", bfCurrentRound: 1, phaseDeadlineAt: now + ROUND_INTRO_MS },
        };
      }
      return null;
    }

    // round-intro → role-reveal: assign roles from the secret round data, write
    // each player's owner-readable role doc (Blarfer list never hits the public doc).
    if (phase === "round-intro") {
      if (now < deadline) return null;
      const round = getCurrentRound(secret?.rounds ?? [], (s["bfCurrentRound"] as number) ?? 1);
      if (!round) return null; // await secret doc
      const { blarfers, assignments, blarferLetter } = assignRoles(uids, round);
      const docWrites = uids.map((uid) => ({
        path: rolePath(sid, uid),
        fields: {
          word: assignments[uid] ?? "",
          isBlarfer: blarfers.includes(uid),
          letter: blarferLetter,
        } as Record<string, unknown>,
        merge: false,
      }));
      logger.info(`[blarf] ${sid}: round-intro → role-reveal (${blarfers.length} blarfer(s))`);
      return {
        fields: {
          bfPhase: "role-reveal",
          bfRoleConfirmed: {},
          bfVoiceStyle: round.voiceStyle ?? null,
          phaseDeadlineAt: now + ROLE_REVEAL_MS,
        },
        docWrites,
      };
    }

    // role-reveal → speaking: all confirmed OR deadline.
    if (phase === "role-reveal") {
      const confirmed = (s["bfRoleConfirmed"] as Record<string, boolean> | undefined) ?? {};
      const allConfirmed = players.every((p) => confirmed[p.uid]);
      if (!allConfirmed && now < deadline) return null;
      logger.info(`[blarf] ${sid}: role-reveal → speaking`);
      return {
        fields: {
          bfSpeakingOrder: shuffleArray(uids),
          bfCurrentSpeaker: 0,
          bfPhase: "speaking",
          phaseDeadlineAt: now + SPEAK_MS,
        },
      };
    }

    // speaking: advance the speaker on their DONE inbox event OR the 15s timer.
    if (phase === "speaking") {
      const order = (s["bfSpeakingOrder"] as string[] | undefined) ?? [];
      const idx = (s["bfCurrentSpeaker"] as number | undefined) ?? 0;
      const curUid = order[idx];
      if (!curUid) return null;
      const done = (s.inbox?.["speakerDone"] as Record<string, unknown> | undefined)?.[curUid];
      if (!done && now < deadline) return null;
      const clearDone = { [`inbox.speakerDone.${curUid}`]: FieldValue.delete() };
      if (idx + 1 < order.length) {
        return { fields: { bfCurrentSpeaker: idx + 1, phaseDeadlineAt: now + SPEAK_MS, ...clearDone } };
      }
      logger.info(`[blarf] ${sid}: speaking → voting`);
      return {
        fields: {
          bfPhase: "voting",
          bfVotes: {},
          bfVoteDeadline: now + VOTE_MS,
          phaseDeadlineAt: now + VOTE_MS,
          ...clearDone,
        },
      };
    }

    // voting → results: all voted OR deadline. Derive Blarfers from role docs,
    // score, and publish the reveal.
    if (phase === "voting") {
      const votes = (s["bfVotes"] as Record<string, string[]> | undefined) ?? {};
      const allVoted = players.every((p) => Array.isArray(votes[p.uid]));
      if (!allVoted && now < deadline) return null;

      const blarfers = uids.filter((uid) => roleOf(uid)?.isBlarfer);
      const result = scoreBlarfRound(votes, blarfers, uids);
      const reveal: Record<string, { word: string; isBlarfer: boolean }> = {};
      for (const uid of uids) {
        const r = roleOf(uid);
        reveal[uid] = { word: r?.word ?? "", isBlarfer: !!r?.isBlarfer };
      }
      logger.info(`[blarf] ${sid}: voting → results — blarfers=[${blarfers.join(",")}]`);
      return {
        fields: {
          bfScores: applyScoreDeltas(scores, result.deltas),
          bfRoundDeltas: result.deltas,
          bfVoteCounts: result.voteCounts,
          bfBlarfers: blarfers,
          bfReveal: reveal,
          bfPhase: "results",
          phaseDeadlineAt: now + RESULTS_MS,
        },
      };
    }

    // results → next round or final (auto, no host).
    if (phase === "results") {
      if (now < deadline) return null;
      const cur = (s["bfCurrentRound"] as number | undefined) ?? 1;
      const total = (s["bfTotalRounds"] as number | undefined) ?? 1;
      if (cur < total) {
        logger.info(`[blarf] ${sid}: results → round-intro (round ${cur + 1}/${total})`);
        return {
          fields: {
            bfCurrentRound: cur + 1,
            bfRoleConfirmed: {},
            bfSpeakingOrder: [],
            bfCurrentSpeaker: 0,
            bfVotes: {},
            bfVoteDeadline: 0,
            bfRoundDeltas: {},
            bfVoteCounts: {},
            bfBlarfers: [],
            bfReveal: {},
            bfPhase: "round-intro",
            phaseDeadlineAt: now + ROUND_INTRO_MS,
          },
        };
      }
      const { winners, points } = determineWinners(scores);
      logger.info(`[blarf] ${sid}: results → final — winners=[${winners.join(",")}]`);
      return {
        fields: {
          bfWinners: winners,
          bfWinnerPoints: points,
          bfPhase: "final",
          phaseDeadlineAt: FieldValue.delete(),
        },
        gameOver: true,
        winner: winners[0] ?? null,
      };
    }

    return null;
  },
};

registerEngine(ENGINE_KEY, blarfReducer);
