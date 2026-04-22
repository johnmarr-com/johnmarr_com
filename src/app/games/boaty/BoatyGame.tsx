"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { GameGamertagBadge, recordGameStats, isAiPlayer, useGameColors } from "@/app/games/_gamecore";
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
  aiPickTarget,
  BOATY_ATTACK_ANIM_MS,
  SQUARE_FIXED_ROTATION,
} from "./boatyLogic";
import SetupScreen from "./screens/SetupScreen";
import PlayScreen from "./screens/PlayScreen";

const EMPTY_ATTACKS: AttackRecord = { hits: [], misses: [], gatorHits: [] };

interface BoatyGameProps {
  sessionId: string;
  gameData: JMContent;
  onGameEnd?: (result: GameEndResult) => void;
}

export default function BoatyGame({ sessionId, onGameEnd }: BoatyGameProps) {
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
  const aiPlayingRef = useRef(false);
  useEffect(() => {
    if (!isHost || btPhase !== "play" || !btCurrentTurn || !aiUid) return;
    if (btCurrentTurn !== aiUid) {
      aiPlayingRef.current = false;
      return;
    }
    if (aiPlayingRef.current) return;

    const humanUid = playerUids.find((uid) => !isAiPlayer(uid)) ?? "";
    const humanBoard = btBoards[humanUid];
    if (!humanBoard) return;

    const currentAttacks: AttackRecord = btAttacks[humanUid] ?? EMPTY_ATTACKS;

    aiPlayingRef.current = true;
    const timer = setTimeout(() => {
      void executeAiTurn(aiUid, humanUid, humanBoard, currentAttacks);
    }, 800);
    return () => clearTimeout(timer);
    // btLastAttack in deps so AI re-fires after a gator hit (free turn)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, btPhase, btCurrentTurn, aiUid, btLastAttack]);

  const executeAiTurn = useCallback(
    async (
      aiId: string,
      targetId: string,
      targetBoard: PlayerBoard,
      currentAttacks: AttackRecord,
    ) => {
      const target = aiPickTarget(currentAttacks);
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

      const fields: Record<string, unknown> = {
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
      };

      if (!won && result !== "gator") {
        fields["btCurrentTurn"] = targetId;
      }
      // Gator hit: btCurrentTurn stays as AI (free turn)
      // Win: defer btWinner / finished until after attack animation (same as human attacker).

      aiPlayingRef.current = false;
      await updateFields(fields);

      if (won) {
        setTimeout(() => {
          void updateFields({ btWinner: aiId, btPhase: "finished" });
        }, BOATY_ATTACK_ANIM_MS);
      }
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
    }
    if (btPhase !== "finished") {
      gameEndFiredRef.current = false;
    }
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
            onDone={handleSetupDone}
          />
        </div>
      )}

      {btPhase === "play" && btCurrentTurn && myBoard && opponentBoard && (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <PlayScreen
            currentUserId={userId}
            opponentUid={opponentUid}
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
