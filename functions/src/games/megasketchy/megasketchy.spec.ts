/**
 * MegaSketchy — server-authoritative reducer (engineKey "megasketchy").
 *
 * Telestrations / "Eat Poop You Cat": each element of a secret mission seeds a
 * chain; players alternate drawing the previous entry and guessing the previous
 * sketch. The engine owns the LIVE GAME — play-order shuffle, mission load +
 * chain seeding, the draw/guess append loop with a 60s-per-task hourglass
 * (auto-skipping an AFK player so a chain can't freeze the table), and every
 * phase transition. The two LLM steps run as post-commit effects:
 *  - active → madlibs: request "megasketchy-judge" (Y/N per element → elementMatches)
 *  - → scoring:        request "megasketchy-score" (pass/fail + debrief narrative)
 *
 *   lobby → briefing → active → madlibs → [reveal] → scoring → [voting] → done → share
 *
 * Chains live on the public session doc (cooperative game; low cheat stakes).
 * No secret doc. Moves arrive as inbox events from /api/games/megasketchy:
 * reorder / beginMission (host), transmit / vote (players), advance (host).
 */

import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { registerEngine } from "../../engine/registry";
import type { EngineSession, Reducer, ReduceContext, StateUpdate } from "../../engine/types";
import {
  type Chains,
  type ChainEntry,
  type MissionSegment,
  buildInitialChains,
  getPlayerForStep,
  isChainComplete,
  missionToSecretMessage,
  shuffle,
  taskTypeFromInput,
  timeoutEntry,
} from "./logic";

const ENGINE_KEY = "megasketchy";
const TASK_MS = 60_000; // the Telestrations hourglass — 60s per draw/guess

const ACTIVE_PHASES = new Set([
  "lobby",
  "briefing",
  "active",
  "madlibs",
  "reveal",
  "scoring",
  "voting",
  "done",
]);

const missionPath = (id: string): string => `megasketchyMissions/${id}`;

interface BeginEvent {
  missionId?: string;
}

const megaSketchyReducer: Reducer = {
  shouldRun(s) {
    if (s.status !== "playing") return false;
    return ACTIVE_PHASES.has((s["skPhase"] as string) ?? "lobby");
  },

  secretRefs(s) {
    // At begin-mission the reducer needs the chosen mission doc to seed chains.
    const begin = (s.inbox?.["beginMission"] as Record<string, BeginEvent> | undefined);
    const missionId = begin ? Object.values(begin)[0]?.missionId : undefined;
    return missionId ? [missionPath(missionId)] : [];
  },

  reduce(ctx: ReduceContext): StateUpdate | null {
    const s: EngineSession = ctx.session;
    const now = ctx.now;
    const sid = ctx.sessionId;
    const phase = (s["skPhase"] as string) ?? "lobby";
    const players = s.players ?? [];
    const uids = players.map((p) => p.uid);
    const playOrder = (s["playOrder"] as string[] | undefined) ?? [];
    const gameMode = (s["gameMode"] as string | undefined) ?? "basic";
    const inbox = s.inbox ?? {};

    // ── lobby → briefing: shuffle play order, reset round state (auto). ──
    if (phase === "lobby") {
      if (uids.length < 2) return null;
      logger.info(`[megasketchy] ${sid}: lobby → briefing`);
      return {
        fields: {
          skPhase: "briefing",
          playOrder: shuffle(uids),
          message: null,
          chains: {},
          chainDeadlines: {},
          gameMode: "basic",
          moleId: null,
          eliminatedPlayers: [],
          votes: {},
          elementMatches: null,
          scoringResult: null,
          phaseDeadlineAt: FieldValue.delete(),
        },
      };
    }

    // ── briefing: begin-mission (build chains) or reorder play order. ──
    if (phase === "briefing") {
      const begin = inbox["beginMission"] as Record<string, BeginEvent> | undefined;
      if (begin && Object.keys(begin).length > 0) {
        const missionId = Object.values(begin)[0]?.missionId;
        if (!missionId) return { fields: { "inbox.beginMission": FieldValue.delete() } };
        const mission = ctx.secrets[missionPath(missionId)] as unknown as
          | { segments?: MissionSegment[] }
          | null;
        if (!mission?.segments) return null; // await mission read
        const N = playOrder.length || uids.length;
        const msg = missionToSecretMessage(mission.segments, missionId, N);
        const chains = buildInitialChains(msg.elements, now);
        const chainDeadlines: Record<string, number> = {};
        for (let k = 0; k < msg.elements.length; k++) chainDeadlines[String(k)] = now + TASK_MS;
        logger.info(`[megasketchy] ${sid}: briefing → active (${msg.elements.length} chains)`);
        return {
          fields: {
            skPhase: "active",
            message: { id: msg.sourceId, template: msg.template, elements: msg.elements },
            chains,
            chainDeadlines,
            phaseDeadlineAt: now + TASK_MS,
            "inbox.beginMission": FieldValue.delete(),
          },
        };
      }
      const reorder = inbox["reorder"] as Record<string, { order?: string[] }> | undefined;
      if (reorder && Object.keys(reorder).length > 0) {
        const order = Object.values(reorder)[0]?.order;
        if (Array.isArray(order) && order.length === uids.length && order.every((u) => uids.includes(u))) {
          return { fields: { playOrder: order, "inbox.reorder": FieldValue.delete() } };
        }
        return { fields: { "inbox.reorder": FieldValue.delete() } };
      }
      return null;
    }

    // ── active: process draw/guess submissions + 60s timeouts, then advance. ──
    if (phase === "active") {
      const message = s["message"] as { elements: string[] } | null;
      if (!message) return null;
      const N = playOrder.length;
      const elementCount = message.elements.length;
      const chains: Chains = JSON.parse(JSON.stringify(s["chains"] ?? {}));
      const deadlines: Record<string, number> = { ...((s["chainDeadlines"] as Record<string, number>) ?? {}) };
      const fields: Record<string, unknown> = {};
      let changed = false;

      const appendTo = (k: number, entry: ChainEntry): void => {
        const chain = chains[String(k)] ?? [];
        chain.push(entry);
        chains[String(k)] = chain;
        changed = true;
        if (isChainComplete(chain, N)) delete deadlines[String(k)];
        else deadlines[String(k)] = now + TASK_MS;
      };

      // 1) Submissions (any active player whose turn it is on that chain).
      const tx = inbox["transmit"] as Record<string, { elementIndex?: number; value?: string }> | undefined;
      if (tx) {
        for (const uid of Object.keys(tx)) {
          fields[`inbox.transmit.${uid}`] = FieldValue.delete();
          const ev = tx[uid]!;
          const k = ev.elementIndex;
          if (k == null) continue;
          const chain = chains[String(k)];
          if (!chain || isChainComplete(chain, N)) continue;
          if (getPlayerForStep(k, chain.length, playOrder) !== uid) continue; // not their turn
          const taskType = taskTypeFromInput(chain[chain.length - 1]!);
          appendTo(k, {
            type: taskType === "draw" ? "image" : "text",
            value: String(ev.value ?? ""),
            playerId: uid,
            timestamp: now,
          });
        }
      }

      // 2) Timeouts — auto-skip any chain whose hourglass ran out.
      for (let k = 0; k < elementCount; k++) {
        const chain = chains[String(k)];
        if (!chain || isChainComplete(chain, N)) continue;
        const dl = deadlines[String(k)] ?? 0;
        if (dl === 0 || dl > now) continue;
        const assigned = getPlayerForStep(k, chain.length, playOrder);
        const taskType = taskTypeFromInput(chain[chain.length - 1]!);
        logger.info(`[megasketchy] ${sid}: chain ${k} timed out (${taskType}) → auto-skip`);
        appendTo(k, timeoutEntry(taskType, assigned, now));
      }

      if (!changed) return Object.keys(fields).length > 0 ? { fields } : null;

      // 3) All chains done → madlibs (+ request the LLM judge); else re-arm.
      const done = (() => {
        for (let k = 0; k < elementCount; k++) {
          const c = chains[String(k)];
          if (!c || !isChainComplete(c, N)) return false;
        }
        return true;
      })();

      if (done) {
        logger.info(`[megasketchy] ${sid}: active → madlibs (chains complete, requesting judge)`);
        return {
          fields: {
            ...fields,
            chains,
            chainDeadlines: {},
            elementMatches: null,
            skPhase: "madlibs",
            phaseDeadlineAt: FieldValue.delete(),
          },
          effects: [{ kind: "megasketchy-judge" }],
        };
      }

      const nextDeadline = Math.min(...Object.values(deadlines).filter((d) => d > 0));
      return {
        fields: {
          ...fields,
          chains,
          chainDeadlines: deadlines,
          phaseDeadlineAt: Number.isFinite(nextDeadline) ? nextDeadline : FieldValue.delete(),
        },
      };
    }

    // ── madlibs / reveal → scoring (host proceeds; request the scoring LLM). ──
    if (phase === "madlibs" || phase === "reveal") {
      const adv = inbox["advance"];
      if (!adv || Object.keys(adv).length === 0) return null;
      logger.info(`[megasketchy] ${sid}: ${phase} → scoring (requesting score)`);
      return {
        fields: { skPhase: "scoring", scoringResult: null, "inbox.advance": FieldValue.delete() },
        effects: [{ kind: "megasketchy-score" }],
      };
    }

    // ── scoring → voting (advanced/expert) or done (basic). ──
    if (phase === "scoring") {
      const adv = inbox["advance"];
      if (!adv || Object.keys(adv).length === 0) return null;
      const toVoting = gameMode === "advanced" || gameMode === "expert";
      logger.info(`[megasketchy] ${sid}: scoring → ${toVoting ? "voting" : "done"}`);
      const update: StateUpdate = {
        fields: { skPhase: toVoting ? "voting" : "done", "inbox.advance": FieldValue.delete() },
      };
      if (!toVoting) {
        update.gameOver = true;
        update.winner = (s["scoringResult"] as { passed?: boolean } | null)?.passed ? "agents" : null;
      }
      return update;
    }

    // ── voting: collect votes; host advance → done. ──
    if (phase === "voting") {
      const vote = inbox["vote"] as Record<string, { targetUid?: string }> | undefined;
      const adv = inbox["advance"];
      const fields: Record<string, unknown> = {};
      let changed = false;
      if (vote) {
        for (const uid of Object.keys(vote)) {
          fields[`inbox.vote.${uid}`] = FieldValue.delete();
          const target = vote[uid]?.targetUid;
          if (target) {
            fields[`votes.${uid}`] = target;
            changed = true;
          }
        }
      }
      if (adv && Object.keys(adv).length > 0) {
        logger.info(`[megasketchy] ${sid}: voting → done`);
        return {
          fields: { ...fields, skPhase: "done", "inbox.advance": FieldValue.delete() },
          gameOver: true,
          winner: (s["scoringResult"] as { passed?: boolean } | null)?.passed ? "agents" : null,
        };
      }
      return changed || Object.keys(fields).length > 0 ? { fields } : null;
    }

    // ── done → share (host). ──
    if (phase === "done") {
      const adv = inbox["advance"];
      if (!adv || Object.keys(adv).length === 0) return null;
      logger.info(`[megasketchy] ${sid}: done → share`);
      return { fields: { skPhase: "share", "inbox.advance": FieldValue.delete() } };
    }

    return null;
  },
};

registerEngine(ENGINE_KEY, megaSketchyReducer);

// Register the LLM effect handlers (judge + scoring).
import "./effects";
