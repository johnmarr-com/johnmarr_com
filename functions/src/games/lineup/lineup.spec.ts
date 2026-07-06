/**
 * Lineup — server-authoritative reducer (engineKey "lineup").
 *
 * "Guess whose fun fact this is." The server owns ALL progression + scoring;
 * clients only submit their fact and cast a guess (via the API route) and
 * render server state.
 *
 *   collecting → voting → results → (loop, one round per fact) → final
 *
 * One collection phase (everyone writes a fact about themselves), then one
 * voting round per submitted fact: a single fact is shown (author hidden),
 * everyone else guesses who wrote it, and each correct guesser scores +1.
 *
 * Hidden info (closes the cheat vector where authorship would be readable on
 * the public doc):
 *  - `lineupFacts/{sid}/facts/{uid}` (owner-readable): each player's OWN fact.
 *    Written by the submit-fact route; read here. A player can read only their
 *    own (so their client knows "this is your fact" without leaking it).
 *  - `lineupSecret/{sid}` (server-only): the shuffled `factOrder` (index →
 *    author), persisted so it can't leak and stays stable across rounds.
 *  The engine publishes only the CURRENT fact's text (`luCurrentFact`, no
 *  author) for voting, and reveals the author in `luReveal` at `results`.
 *
 * Transitions advance on a CONDITION (everyone submitted / everyone eligible
 * voted) OR a DEADLINE (`phaseDeadlineAt`), so one AFK player can never wedge a
 * round — enforced by whichever fires the engine first: a player's own action,
 * the `/api/games/engine-tick` client nudge, or the 1-minute `sweepDeadlines`
 * safety net. `final` is terminal (no deadline). Returns `null` when nothing
 * should advance (the no-op fence that prevents self-write loops).
 *
 * No AI players and no content packs: facts come from the humans in the room.
 * Pure logic lives in `./logic` (copy of the client's `lineupTypes.ts`).
 */

import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { registerEngine } from "../../engine/registry";
import type { EngineSession, Reducer, StateUpdate } from "../../engine/types";
import {
  applyScoreDeltas,
  determineWinners,
  initScores,
  scoreGuessRound,
  shuffleArray,
} from "./logic";

const ENGINE_KEY = "lineup";

// Deadline durations. Collecting has NO visible timer — it's a silent no-show
// net (generous, so writing a fun fact isn't rushed) and advances the instant
// everyone has submitted. Results auto-advances as a fallback, but the host can
// ADVANCE early (inbox.advance). Voting keeps a visible timer.
const COLLECT_MS = 120_000;
const VOTE_MS = 40_000;
const RESULTS_MS = 60_000;

const ACTIVE_PHASES = new Set(["collecting", "voting", "results"]);

type NumMap = Record<string, number>;
type StrMap = Record<string, string>;

const secretPath = (sid: string): string => `lineupSecret/${sid}`;
const factPath = (sid: string, uid: string): string => `lineupFacts/${sid}/facts/${uid}`;

interface LineupReveal {
  authorUid: string;
  authorGamertag: string;
  fact: string;
  correctVoterUids: string[];
  roundDeltas: Record<string, number>;
}

const lineupReducer: Reducer = {
  shouldRun(s) {
    if (s.status !== "playing") return false;
    if ((s.players ?? []).length < 2) return false;
    // `|| "collecting"` so an unset phase (first boot) AND the "" sentinel that
    // Play Again resets to both route through the collecting branch.
    return ACTIVE_PHASES.has((s["luPhase"] as string) || "collecting");
  },

  secretRefs(s, sessionId) {
    return [
      secretPath(sessionId),
      ...(s.players ?? []).map((p) => factPath(sessionId, p.uid)),
    ];
  },

  reduce(ctx): StateUpdate | null {
    const s: EngineSession = ctx.session;
    const now = ctx.now;
    const sid = ctx.sessionId;
    const players = s.players ?? [];
    if (players.length < 2) return null;
    const uids = players.map((p) => p.uid);

    // Treat an unset phase (first boot) and the "" Play-Again sentinel as
    // "collecting" — both should open a fresh collection window.
    const phase = (s["luPhase"] as string) || "collecting";
    const deadline = (s["phaseDeadlineAt"] as number | undefined) ?? 0;
    const scores = (s["luScores"] as NumMap | undefined) ?? {};

    const secret = ctx.secrets[secretPath(sid)] as { factOrder?: string[] } | null;
    const factOf = (uid: string): string =>
      ((ctx.secrets[factPath(sid, uid)] as { fact?: string } | null)?.fact ?? "").trim();

    // collecting: open the submission window once (covers both the initial
    // boot — when luPhase is unset — and a "Play Again" reset, which clears the
    // deadline). Then wait for facts; advance when everyone submitted OR the
    // deadline passes. We read facts from the per-player secret docs, never a
    // public field, so authorship can't be peeked while collecting.
    if (phase === "collecting") {
      if (deadline === 0) {
        logger.info(`[lineup] ${sid}: open collecting window`);
        return {
          fields: {
            luPhase: "collecting",
            luScores: initScores(uids),
            luSubmitted: {},
            luVotes: {},
            luWagers: {},
            luReveal: null,
            luCurrentIndex: 0,
            luCurrentFact: "",
            luTotalRounds: 0,
            luWinners: [],
            luWinnerPoints: 0,
            phaseDeadlineAt: now + COLLECT_MS,
          },
        };
      }

      // Detect submissions via the PUBLIC marker (reset each game), not the
      // secret fact docs — so last game's facts can't be mistaken for new ones
      // on Play Again. `luSubmitted.{uid}` and the fact doc are written together
      // by the API, so a marked player always has a fresh fact to read.
      const submitted = (s["luSubmitted"] as Record<string, boolean> | undefined) ?? {};
      const submittedUids = uids.filter((uid) => submitted[uid] === true);
      const allIn = uids.every((uid) => submitted[uid] === true);
      if (!allIn && now < deadline) return null;

      if (submittedUids.length < 1) {
        // Nobody submitted a fact — nothing to vote on. End with no winner.
        logger.info(`[lineup] ${sid}: collecting → final (no facts submitted)`);
        return {
          fields: {
            luPhase: "final",
            luWinners: [],
            luWinnerPoints: 0,
            phaseDeadlineAt: FieldValue.delete(),
          },
          gameOver: true,
          winner: null,
        };
      }

      // One voting round per submitted fact, in a hidden shuffled order.
      const order = shuffleArray(submittedUids);
      const firstAuthor = order[0]!;
      logger.info(`[lineup] ${sid}: collecting → voting (${order.length} facts)`);
      return {
        fields: {
          luPhase: "voting",
          luTotalRounds: order.length,
          luCurrentIndex: 0,
          luCurrentFact: factOf(firstAuthor),
          luVotes: {},
          luWagers: {},
          luReveal: null,
          phaseDeadlineAt: now + VOTE_MS,
        },
        docWrites: [{ path: secretPath(sid), fields: { factOrder: order }, merge: true }],
      };
    }

    // voting → results: advance when every eligible voter (everyone but the
    // author) has guessed OR the deadline passes. Score, then publish the
    // reveal (author + who guessed right).
    if (phase === "voting") {
      const order = secret?.factOrder ?? [];
      if (order.length === 0) return null; // await the same-txn factOrder write (defensive)
      const idx = (s["luCurrentIndex"] as number | undefined) ?? 0;
      const authorUid = order[idx];
      if (!authorUid) return null;

      // EVERYONE votes — including the author of the current fact — so an
      // abstention can't out them (the count reaches N/N like any other round).
      // The author stays out of `eligibleVoters`, so their vote scores nothing;
      // it exists purely to hide their identity.
      const eligibleVoters = uids.filter((uid) => uid !== authorUid);
      const votes = (s["luVotes"] as StrMap | undefined) ?? {};
      const wagers = (s["luWagers"] as NumMap | undefined) ?? {};
      const allVoted = uids.every((uid) => votes[uid] != null);
      if (!allVoted && now < deadline) return null;

      const { deltas, correctVoterUids } = scoreGuessRound(votes, wagers, authorUid, eligibleVoters);
      const reveal: LineupReveal = {
        authorUid,
        authorGamertag: players.find((p) => p.uid === authorUid)?.gamertag ?? "Someone",
        fact: factOf(authorUid) || ((s["luCurrentFact"] as string) ?? ""),
        correctVoterUids,
        roundDeltas: deltas,
      };
      logger.info(`[lineup] ${sid}: voting → results (fact ${idx + 1}/${order.length})`);
      return {
        fields: {
          luScores: applyScoreDeltas(scores, deltas),
          luReveal: reveal,
          luPhase: "results",
          phaseDeadlineAt: now + RESULTS_MS,
        },
      };
    }

    // results → next fact or final: auto-advance when the results hold passes,
    // OR immediately when the host taps ADVANCE (inbox.advance, host-validated
    // by the API route). The deadline remains the fallback if the host never taps.
    if (phase === "results") {
      const advanceReq = Object.keys(s.inbox?.["advance"] ?? {}).length > 0;
      if (now < deadline && !advanceReq) return null;
      const clearAdvance: Record<string, unknown> = advanceReq
        ? { "inbox.advance": FieldValue.delete() }
        : {};
      const order = secret?.factOrder ?? [];
      const idx = (s["luCurrentIndex"] as number | undefined) ?? 0;
      if (idx + 1 < order.length) {
        const nextIdx = idx + 1;
        const nextAuthor = order[nextIdx]!;
        logger.info(
          `[lineup] ${sid}: results → voting (fact ${nextIdx + 1}/${order.length})${advanceReq ? " [host advance]" : ""}`,
        );
        return {
          fields: {
            ...clearAdvance,
            luCurrentIndex: nextIdx,
            luCurrentFact: factOf(nextAuthor),
            luVotes: {},
            luWagers: {},
            luReveal: null,
            luPhase: "voting",
            phaseDeadlineAt: now + VOTE_MS,
          },
        };
      }
      const { winners, points } = determineWinners(scores);
      logger.info(`[lineup] ${sid}: results → final — winners=[${winners.join(",")}] pts=${points}`);
      return {
        fields: {
          ...clearAdvance,
          luWinners: winners,
          luWinnerPoints: points,
          luPhase: "final",
          phaseDeadlineAt: FieldValue.delete(),
        },
        gameOver: true,
        winner: winners[0] ?? null,
        winnerUids: winners,
      };
    }

    return null;
  },
};

registerEngine(ENGINE_KEY, lineupReducer);
