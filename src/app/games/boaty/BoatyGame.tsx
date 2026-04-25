"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/lib/AuthProvider";
import {
  GameGamertagBadge,
  recordGameStats,
  isAiPlayer,
  useGameColors,
  getPersona,
  generatePostGameCommentsForUid,
} from "@/app/games/_gamecore";
import { pickTargetForPersona } from "./boatyAI";
import type { JMContent } from "@/lib/content-types";
import { PointsManager, Activity } from "@/lib/points";
import { useBoatySession } from "./useBoatySession";
import type { RaftDef, Position, AttackRecord, AttackResult, PlayerBoard } from "./boatyTypes";
import type { GameEndResult } from "@/app/games/_gamecore/registry/types";
import {
  randomPlacement,
  randomGatorPosition,
  resolveAttack,
  checkWin,
  moveGator,
  findRaftAt,
  isRaftDestroyed,
  BOATY_ATTACK_ANIM_MS,
  SQUARE_FIXED_ROTATION,
} from "./boatyLogic";

// Extra hold after a raft-sink so the AI waits through the taunt on the human's client.
// Mirrors TAUNT_EXTRA_HOLD_MS in PlayScreen.
const AI_RAFT_SINK_EXTRA_HOLD_MS = 2000;
// Short pause between AI gator free-turns so the human can see the grid settle.
const AI_BETWEEN_TURNS_MS = 800;
import SetupScreen from "./screens/SetupScreen";
import PlayScreen from "./screens/PlayScreen";

const EMPTY_ATTACKS: AttackRecord = { hits: [], misses: [], gatorHits: [] };

function cellLabel(p: { row: number; col: number }): string {
  // Column A-E (columns), rows 1-5 — same convention humans use.
  return `${String.fromCharCode(65 + p.col)}${p.row + 1}`;
}

/** Flatten the per-defender AttackRecord map into a plain-text game recap,
 *  one line per shot, ordered roughly by the order shots were taken.
 *  This is the context we hand an AI persona for their Post-Game Comments. */
function buildBoatyEventLog(
  btAttacks: Record<string, AttackRecord>,
  players: Array<{ uid: string; gamertag: string }>,
): string {
  const nameFor = (uid: string) =>
    players.find((p) => p.uid === uid)?.gamertag ?? "Unknown";

  const lines: string[] = [];
  for (const [defenderUid, rec] of Object.entries(btAttacks)) {
    // Figure out who the attacker was for this record — the OTHER player.
    const attackerUid = players.find((p) => p.uid !== defenderUid)?.uid;
    if (!attackerUid) continue;
    const attacker = nameFor(attackerUid);
    const defender = nameFor(defenderUid);

    for (const c of rec.hits) {
      lines.push(`${attacker} threw at ${cellLabel(c)} — HIT ${defender}'s raft.`);
    }
    for (const c of rec.misses) {
      lines.push(`${attacker} threw at ${cellLabel(c)} — MISS.`);
    }
    for (const c of rec.gatorHits) {
      lines.push(`${attacker} threw at ${cellLabel(c)} — hit the GATOR (free turn).`);
    }
  }
  return lines.join("\n");
}

interface BoatyGameProps {
  sessionId: string;
  gameData: JMContent;
  onGameEnd?: (result: GameEndResult) => void;
}

export default function BoatyGame({ sessionId, gameData, onGameEnd }: BoatyGameProps) {
  const { user } = useAuth();
  const { primary } = useGameColors();
  const userId = user?.uid ?? "";
  const { state, updateFields } = useBoatySession(sessionId, userId);

  const {
    session,
    btPhase,
    btBoards,
    btReady,
    btCurrentTurn,
    btAttacks,
    btLastAttack,
    btWinner,
    isHost,
  } = state;

  const players = useMemo(() => session?.players ?? [], [session?.players]);
  const playerUids = players.map((p) => p.uid);
  const opponentUid = playerUids.find((uid) => uid !== userId) ?? "";
  const aiUid = playerUids.find((uid) => isAiPlayer(uid));

  const readyCount = Object.keys(btReady).length;
  const allReady = readyCount >= 2 && players.length >= 2;
  const hasSubmitted = btReady[userId] === true;

  const myBoard = btBoards[userId];
  const opponentBoard = btBoards[opponentUid];
  const attacksOnMe: AttackRecord = btAttacks[userId] ?? EMPTY_ATTACKS;
  const attacksOnOpponent: AttackRecord = btAttacks[opponentUid] ?? EMPTY_ATTACKS;

  // ─── Host: AI auto-setup (place rafts + mark ready) ───────
  const aiSetupFiredRef = useRef(false);
  useEffect(() => {
    if (!isHost || btPhase !== "setup" || !aiUid || aiSetupFiredRef.current) return;
    if (btReady[aiUid]) return; // Already set up

    aiSetupFiredRef.current = true;
    const rafts = randomPlacement().map((r) =>
      r.type === "square" ? { ...r, rotation: SQUARE_FIXED_ROTATION } : r,
    );
    const gator = randomGatorPosition(rafts);
    void updateFields({
      [`btBoards.${aiUid}`]: { rafts, gator },
      [`btReady.${aiUid}`]: true,
    });
  }, [isHost, btPhase, aiUid, btReady, updateFields]);

  // Reset the ref when phase changes
  useEffect(() => {
    if (btPhase !== "setup") aiSetupFiredRef.current = false;
  }, [btPhase]);

  // ─── Host: Both ready → transition to play ─────────────────
  useEffect(() => {
    if (!isHost || btPhase !== "setup" || !allReady) return;
    const p1 = playerUids[0] ?? "";
    const p2 = playerUids[1] ?? "";
    const firstPlayer = Math.random() < 0.5 ? p1 : p2;
    void updateFields({
      btPhase: "play",
      btCurrentTurn: firstPlayer,
      btAttacks: {
        [p1]: { hits: [], misses: [], gatorHits: [] },
        [p2]: { hits: [], misses: [], gatorHits: [] },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, btPhase, allReady]);

  // ─── Host: AI auto-play turns ──────────────────────────────
  // Stable key instead of the btLastAttack object: Firestore snapshots can emit a new
  // object reference for unchanged data, which would re-fire the effect, cancel the
  // pending 800ms timer, and leave aiPlayingRef stuck at `true`. The key only changes
  // when a real attack lands, so the effect re-fires exactly when we want it to
  // (initial turn-to-AI, or gator free-turn after AI's previous attack).
  const aiLastAttackKey = useMemo(() => {
    if (!btLastAttack) return null;
    return `${btLastAttack.attackerUid}-${btLastAttack.row}-${btLastAttack.col}-${btLastAttack.result}`;
  }, [btLastAttack]);

  // Two refs cooperate here:
  //   aiTimerRef   — pending 800ms scheduling timer (can be cancelled & re-scheduled)
  //   aiPlayingRef — AI has committed to a turn (timer fired / executeAiTurn running /
  //                  animation-wait pending). Blocks spurious re-fires until a full
  //                  turn completes. Owned by executeAiTurn, NEVER touched by cleanup.
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiPlayingRef = useRef(false);
  useEffect(() => {
    if (!isHost || btPhase !== "play" || !btCurrentTurn || !aiUid) return;
    if (btCurrentTurn !== aiUid) {
      aiPlayingRef.current = false;
      return;
    }
    // Already scheduled OR a turn is mid-flight → don't stack another attack.
    if (aiTimerRef.current !== null || aiPlayingRef.current) return;

    const humanUid = playerUids.find((uid) => !isAiPlayer(uid)) ?? "";
    const humanBoard = btBoards[humanUid];
    if (!humanBoard) return;

    const currentAttacks: AttackRecord = btAttacks[humanUid] ?? EMPTY_ATTACKS;

    aiTimerRef.current = setTimeout(() => {
      aiTimerRef.current = null;
      aiPlayingRef.current = true;
      void executeAiTurn(aiUid, humanUid, humanBoard, currentAttacks);
    }, 800);
    // Cleanup cancels the PENDING timer only. aiPlayingRef is owned by executeAiTurn
    // so a resetting it here would cause spurious re-fires (from Firestore echoing
    // the AI's own write) to schedule back-to-back attacks.
    return () => {
      if (aiTimerRef.current !== null) {
        clearTimeout(aiTimerRef.current);
        aiTimerRef.current = null;
      }
    };
    // aiLastAttackKey (not btLastAttack) so AI re-fires after a gator hit without
    // spurious re-fires from Firestore snapshot churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, btPhase, btCurrentTurn, aiUid, aiLastAttackKey]);

  const executeAiTurn = useCallback(
    async (
      aiId: string,
      targetId: string,
      targetBoard: PlayerBoard,
      currentAttacks: AttackRecord,
    ) => {
      // Persona's user-level → algorithmic tier (basic / standard / sharp).
      // Persona's play style biases the pick from that tier's ranked list
      // (aggressive hunts, cautious picks top, creative widens, chaotic deviates).
      // Falls back to Champion (L7) + Balanced if the persona has no metadata.
      const persona = getPersona(aiId);
      const target = pickTargetForPersona(
        currentAttacks,
        persona?.skillLevel,
        persona?.playStyle ?? "balanced",
      );
      const result: AttackResult = resolveAttack(target.row, target.col, targetBoard);

      const updatedAttacks: AttackRecord = {
        hits: [...currentAttacks.hits],
        misses: [...currentAttacks.misses],
        gatorHits: [...currentAttacks.gatorHits],
      };

      if (result === "hit") {
        updatedAttacks.hits.push(target);
      } else if (result === "miss") {
        updatedAttacks.misses.push(target);
      } else {
        updatedAttacks.gatorHits.push(target);
      }

      const defenderGatorBefore = targetBoard.gator;
      const newGator = moveGator(targetBoard.gator, targetBoard.rafts);
      const won = result === "hit" && checkWin(updatedAttacks);

      // Match the human attack flow: write attack data immediately so both clients
      // animate, and DEFER the turn change until after the animation — otherwise the
      // grid would flip to the human's attack view mid-molotov.
      const hitRaft =
        result === "hit" ? findRaftAt(targetBoard.rafts, target.row, target.col) : undefined;
      const raftDestroyed = !!hitRaft && isRaftDestroyed(hitRaft, updatedAttacks.hits);
      const holdExtraMs = raftDestroyed && !won ? AI_RAFT_SINK_EXTRA_HOLD_MS : 0;

      await updateFields({
        btLastAttack: {
          attackerUid: aiId,
          targetUid: targetId,
          row: target.row,
          col: target.col,
          result,
          defenderGatorBefore,
        },
        [`btBoards.${targetId}.gator`]: newGator,
        [`btAttacks.${targetId}`]: updatedAttacks,
      });

      // After the animation completes: win, turn-handover, or schedule a free gator turn.
      setTimeout(() => {
        aiPlayingRef.current = false;
        if (won) {
          void updateFields({ btWinner: aiId, btPhase: "finished" });
        } else if (result === "gator") {
          // Free turn — queue another AI move using the updated board + attacks.
          // Small extra delay so the "they hit your gator" popup reads before the next throw.
          const nextBoard: PlayerBoard = { rafts: targetBoard.rafts, gator: newGator };
          aiPlayingRef.current = true;
          setTimeout(() => {
            void executeAiTurn(aiId, targetId, nextBoard, updatedAttacks);
          }, AI_BETWEEN_TURNS_MS);
        } else {
          void updateFields({ btCurrentTurn: targetId });
        }
      }, BOATY_ATTACK_ANIM_MS + holdExtraMs);
    },
    [updateFields],
  );

  // ─── Setup: commit board ───────────────────────────────────
  const handleSetupDone = useCallback(
    async (rafts: RaftDef[], gator: Position) => {
      await updateFields({
        [`btBoards.${userId}`]: { rafts, gator },
        [`btReady.${userId}`]: true,
      });
    },
    [userId, updateFields],
  );

  // ─── Play: handle attack (writes attack data, NOT turn change) ──
  const lastAttackResultRef = useRef<{ result: AttackResult; won: boolean } | null>(null);
  const handleAttack = useCallback(
    async (
      row: number,
      col: number,
      result: AttackResult,
      defenderGatorBefore: Position,
      newGator: Position,
      updatedAttacks: AttackRecord,
      won: boolean,
    ) => {
      // Stash the result so handleTurnEnd knows what to do
      lastAttackResultRef.current = { result, won };

      const fields: Record<string, unknown> = {
        btLastAttack: {
          attackerUid: userId,
          targetUid: opponentUid,
          row,
          col,
          result,
          defenderGatorBefore,
        },
        [`btBoards.${opponentUid}.gator`]: newGator,
        [`btAttacks.${opponentUid}`]: updatedAttacks,
      };

      await updateFields(fields);
    },
    [userId, opponentUid, updateFields],
  );

  // ─── Play: advance turn (called after animation finishes) ──
  const handleTurnEnd = useCallback(async () => {
    const ref = lastAttackResultRef.current;
    if (!ref) return;
    lastAttackResultRef.current = null;

    if (ref.won) {
      await updateFields({ btWinner: userId, btPhase: "finished" });
      return;
    }
    if (ref.result !== "gator") {
      await updateFields({ btCurrentTurn: opponentUid });
    }
  }, [userId, opponentUid, updateFields]);

  // ─── Delegate to composeGame result screen ─────────────────
  const gameEndFiredRef = useRef(false);
  useEffect(() => {
    if (btPhase === "finished" && btWinner && onGameEnd && !gameEndFiredRef.current) {
      gameEndFiredRef.current = true;
      const winner = players.find((p) => p.uid === btWinner);
      const loser = players.find((p) => p.uid !== btWinner);

      const winnerHits = (btAttacks[loser?.uid ?? ""] ?? EMPTY_ATTACKS).hits.length;
      const loserHits = (btAttacks[winner?.uid ?? ""] ?? EMPTY_ATTACKS).hits.length;
      const scores: Record<string, number> = {};
      if (winner) scores[winner.uid] = winnerHits;
      if (loser) scores[loser.uid] = loserHits;

      onGameEnd({
        winners: winner ? [winner] : [],
        winnerPoints: winnerHits,
        allPlayers: players,
        scores,
      });

      PointsManager.award(Activity.PLAY_GAME);
      if (isHost) PointsManager.award(Activity.HOST_GAME);
      if (btWinner === userId) PointsManager.award(Activity.WIN_GAME);
      recordGameStats(playerUids, btWinner ? [btWinner] : [], session?.ownerId ?? "");

      // Host generates Post-Game Comments for each AI player (one LLM call per AI).
      // Fire-and-forget; stored on the session so the GC4 screen can render them.
      if (isHost) {
        const sessionData = session as unknown as Record<string, unknown> | null;
        const existing =
          (sessionData?.["aiPostGameComments"] as Record<string, string> | undefined) ?? {};
        for (const p of players) {
          if (!isAiPlayer(p.uid)) continue;
          if (existing[p.uid]) continue; // already generated (reconnect/replay safety)
          const opponentOfAi = playerUids.find((uid) => uid !== p.uid) ?? "";
          const aiHits = (btAttacks[opponentOfAi] ?? EMPTY_ATTACKS).hits.length;
          const humanHits = (btAttacks[p.uid] ?? EMPTY_ATTACKS).hits.length;
          const outcome: "won" | "lost" | "draw" =
            btWinner === p.uid ? "won" : "lost";
          const gameContext = buildBoatyEventLog(btAttacks, players);
          void generatePostGameCommentsForUid(p.uid, {
            outcome,
            score: `${aiHits}–${humanHits}`,
            gameContext,
            gameName: "Boaty McBoatface",
          }).then((comment) => {
            if (!comment) return;
            void updateFields({
              [`aiPostGameComments.${p.uid}`]: comment,
            });
          });
        }
      }
    }
    if (btPhase !== "finished") {
      gameEndFiredRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once on transition to finished
  }, [btPhase, btWinner, btAttacks, onGameEnd, players, isHost, userId, playerUids, session?.ownerId]);

  // ─── Render ────────────────────────────────────────────────
  if (!session) return null;

  // EPIC screen — show while session is still in lobby (host hasn't started yet)
  const isLobby = session.status === "lobby";
  if (isLobby) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-6" style={{ backgroundColor: "#1a2e1a" }}>
        <div className="h-10 w-10 animate-spin rounded-full border-3" style={{ borderColor: primary, borderTopColor: "transparent" }} />
        <p className="text-center text-lg font-bold uppercase tracking-wider text-white/60">
          Waiting for host to start&hellip;
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: "#1a2e1a" }}>
      {btPhase === "setup" && (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <SetupScreen
            hasSubmitted={hasSubmitted}
            readyCount={readyCount}
            totalPlayers={players.length}
            splashBgURL={gameData.splashBgURL}
            splashBgDim={gameData.splashBgDim}
            onDone={handleSetupDone}
          />
        </div>
      )}

      {btPhase === "play" && btCurrentTurn && myBoard && opponentBoard && (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          {gameData.splashBgURL && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat brightness-[0.35]"
              style={{ backgroundImage: `url(${gameData.splashBgURL})` }}
            />
          )}
          <PlayScreen
            currentUserId={userId}
            opponentUid={opponentUid}
            ownerUid={session.ownerId}
            players={players}
            currentTurn={btCurrentTurn}
            myBoard={myBoard}
            opponentBoard={opponentBoard}
            attacksOnMe={attacksOnMe}
            attacksOnOpponent={attacksOnOpponent}
            lastAttack={btLastAttack}
            onAttack={handleAttack}
            onTurnEnd={handleTurnEnd}
          />
        </div>
      )}

      <GameGamertagBadge />
    </div>
  );
}
