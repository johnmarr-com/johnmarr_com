/**
 * Boaty McBoatface — server-authoritative reducer (engineKey "boaty").
 *
 * Turn-based 1v1 battleship with hidden boards. The server owns all
 * progression: init, setup→play transition, attack resolution against the
 * SECRET board, gator slither, win detection, and turn advance. The pure-code
 * AI is driven server-side: when it's an AI's turn the reducer synthesizes +
 * resolves its move, and the trigger's own write re-fires the engine to take
 * the next AI step — so AI play never depends on the host. Returns `null`
 * whenever it's a human's turn with no pending attack (the no-op that halts the
 * self-re-fire loop).
 *
 * Hidden boards live in per-player secret docs `boatyBoards/{sessionId}/boards/{uid}`
 * (owner-readable so a player can see their OWN board on reconnect; the opponent's
 * is never client-readable). Written by the Boaty API route (setup) and the
 * reducer (gator slither). Client inbox: `inbox.attacks.{uid} = { targetUid, row, col }`.
 */

import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { registerEngine } from "../../engine/registry";
import type { EngineSession, Reducer, StateUpdate, SessionPlayer } from "../../engine/types";
import type { AttackRecord, AttackResult, PlayerBoard } from "./types";
import {
  aiPickTarget,
  checkWin,
  findRaftAt,
  isRaftDestroyed,
  moveGator,
  randomGatorPosition,
  randomPlacement,
  resolveAttack,
} from "./logic";

const ENGINE_KEY = "boaty";

interface AttackEvent {
  eventId?: string;
  targetUid: string;
  row: number;
  col: number;
}

const isAi = (uid: string): boolean => uid.startsWith("ai-");
const boardPath = (sessionId: string, uid: string): string =>
  `boatyBoards/${sessionId}/boards/${uid}`;

function emptyRecord(): AttackRecord {
  return { hits: [], misses: [], gatorHits: [] };
}

function opponentOf(players: SessionPlayer[], uid: string): string | null {
  return players.find((p) => p.uid !== uid)?.uid ?? null;
}

/** Deterministic, unforgeable first-turn pick seeded by the session id. */
function pickFirstTurn(players: SessionPlayer[], sessionId: string): string {
  let h = 0;
  for (let i = 0; i < sessionId.length; i++) h = (h * 31 + sessionId.charCodeAt(i)) | 0;
  return players[Math.abs(h) % players.length]!.uid;
}

/** Resolve a single attack and produce the state advance (shared by human + AI). */
function resolveOne(
  s: EngineSession,
  sessionId: string,
  boards: Record<string, PlayerBoard>,
  attackerUid: string,
  targetUid: string,
  row: number,
  col: number,
  consumeInbox: boolean,
): StateUpdate | null {
  const targetBoard = boards[targetUid];
  if (!targetBoard) {
    logger.warn(`[boaty] ${sessionId}: cannot resolve — secret board missing for target ${targetUid}`);
    return null; // board not yet written — wait
  }

  const result: AttackResult = resolveAttack(row, col, targetBoard);
  const prev = (s.btAttacks as Record<string, AttackRecord> | undefined)?.[targetUid];
  const rec: AttackRecord = {
    hits: [...(prev?.hits ?? [])],
    misses: [...(prev?.misses ?? [])],
    gatorHits: [...(prev?.gatorHits ?? [])],
  };

  const lastAttack: Record<string, unknown> = { attackerUid, targetUid, row, col, result };
  const docWrites: StateUpdate["docWrites"] = [];

  if (result === "hit") {
    rec.hits.push({ row, col });
    const hitRaft = findRaftAt(targetBoard.rafts, row, col);
    if (hitRaft && isRaftDestroyed(hitRaft, rec.hits)) {
      lastAttack["sunk"] = true;
      lastAttack["sunkType"] = hitRaft.type;
    }
  } else if (result === "miss") {
    rec.misses.push({ row, col });
  } else {
    rec.gatorHits.push({ row, col });
    lastAttack["defenderGatorBefore"] = targetBoard.gator;
    const newGator = moveGator(targetBoard.gator, targetBoard.rafts);
    docWrites.push({
      path: boardPath(sessionId, targetUid),
      fields: { gator: newGator },
      merge: true,
    });
  }

  const won = result === "hit" && checkWin(rec);
  const keepTurn = result === "gator" && !won;
  const nextTurn = keepTurn ? attackerUid : opponentOf(s.players ?? [], attackerUid);

  const fields: Record<string, unknown> = {
    [`btAttacks.${targetUid}`]: rec,
    btLastAttack: lastAttack,
    btCurrentTurn: won ? attackerUid : nextTurn,
  };
  // On a win the engine also sets the GENERIC status/winner (below), but the
  // Boaty client renders its end flow off the bt* fields — set both, or the
  // win resolves server-side yet neither device ever leaves the play screen.
  if (won) {
    fields["btPhase"] = "finished";
    fields["btWinner"] = attackerUid;
  }
  if (consumeInbox) fields[`inbox.attacks.${attackerUid}`] = FieldValue.delete();

  logger.info(
    `[boaty] ${sessionId}: ${attackerUid} → (${row},${col}) = ${result}` +
      (won ? " — WIN" : ` — turn→${nextTurn}`),
  );
  return { fields, docWrites, gameOver: won, ...(won ? { winner: attackerUid } : {}) };
}

const boatyReducer: Reducer = {
  shouldRun(s) {
    if (s.status !== "playing") return false;
    const players = s.players ?? [];
    if (players.length < 2) return false;
    const phase = s["btPhase"] as string | undefined;

    if (phase === undefined) return true; // needs server init
    if (phase === "setup") {
      const ready = (s["btReady"] as Record<string, boolean> | undefined) ?? {};
      const anyAiUnready = players.some((p) => isAi(p.uid) && !ready[p.uid]);
      const allReady = players.every((p) => ready[p.uid]);
      return anyAiUnready || allReady;
    }
    if (phase === "play") {
      const cur = s["btCurrentTurn"] as string | null | undefined;
      if (!cur) return false;
      if (isAi(cur)) return true; // drive the AI's turn
      return !!s.inbox?.attacks?.[cur]; // a human submitted their attack
    }
    return false;
  },

  secretRefs(s, sessionId) {
    return (s.players ?? []).map((p) => boardPath(sessionId, p.uid));
  },

  reduce(ctx): StateUpdate | null {
    const s = ctx.session;
    const players = s.players ?? [];
    if (players.length < 2) return null;
    const phase = s["btPhase"] as string | undefined;

    // Build the uid→board map from the per-player secret docs.
    const boards: Record<string, PlayerBoard> = {};
    for (const p of players) {
      const b = ctx.secrets[boardPath(ctx.sessionId, p.uid)] as unknown as PlayerBoard | null;
      if (b && Array.isArray(b.rafts)) boards[p.uid] = b;
    }

    // Server-init the game state when play begins (engine, not the host).
    if (phase === undefined) {
      return { fields: { btPhase: "setup", btReady: {}, btAttacks: {} } };
    }

    if (phase === "setup") {
      const ready = (s["btReady"] as Record<string, boolean> | undefined) ?? {};

      // Place any AI player's board server-side (pure code), then re-fire.
      const ai = players.find((p) => isAi(p.uid) && !ready[p.uid]);
      if (ai) {
        const rafts = randomPlacement();
        const gator = randomGatorPosition(rafts);
        const board: PlayerBoard = { rafts, gator };
        return {
          fields: { [`btReady.${ai.uid}`]: true },
          docWrites: [
            {
              path: boardPath(ctx.sessionId, ai.uid),
              fields: board as unknown as Record<string, unknown>,
              merge: true,
            },
          ],
        };
      }

      // Both ready + both boards present → start play, deterministic first turn.
      if (players.every((p) => ready[p.uid])) {
        if (!players.every((p) => boards[p.uid])) return null; // await board writes
        return {
          fields: {
            btPhase: "play",
            btCurrentTurn: pickFirstTurn(players, ctx.sessionId),
            btAttacks: { [players[0]!.uid]: emptyRecord(), [players[1]!.uid]: emptyRecord() },
          },
        };
      }
      return null;
    }

    if (phase === "play") {
      const cur = s["btCurrentTurn"] as string | null | undefined;
      if (!cur) return null;
      const targetUid = opponentOf(players, cur);
      if (!targetUid) return null;

      if (isAi(cur)) {
        // Synthesize + resolve the AI's attack from public knowledge only.
        const myRecord =
          (s.btAttacks as Record<string, AttackRecord> | undefined)?.[targetUid] ?? emptyRecord();
        const pick = aiPickTarget(myRecord);
        return resolveOne(s, ctx.sessionId, boards, cur, targetUid, pick.row, pick.col, false);
      }

      // Human: resolve the attack they submitted to their inbox slot.
      const ev = s.inbox?.attacks?.[cur] as AttackEvent | undefined;
      if (!ev) return null;
      return resolveOne(
        s,
        ctx.sessionId,
        boards,
        cur,
        ev.targetUid ?? targetUid,
        ev.row,
        ev.col,
        true,
      );
    }

    return null;
  },
};

registerEngine(ENGINE_KEY, boatyReducer);
