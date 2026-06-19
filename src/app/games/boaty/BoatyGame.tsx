"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/lib/AuthProvider";
import {
  GameGamertagBadge,
  recordGameStats,
  isAiPlayer,
  useGameColors,
  generatePostGameCommentsForUid,
  getAIAuthHeaders,
} from "@/app/games/_gamecore";
import type { JMContent } from "@/lib/content-types";
import { fetchWithRetry } from "@/lib/fetch-retry";
import { PointsManager, Activity } from "@/lib/points";
import { useBoatySession } from "./useBoatySession";
import type { RaftDef, Position, AttackRecord } from "./boatyTypes";
import type { GameEndResult } from "@/app/games/_gamecore/registry/types";
import SetupScreen from "./screens/SetupScreen";
import PlayScreen from "./screens/PlayScreen";

const EMPTY_ATTACKS: AttackRecord = { hits: [], misses: [], gatorHits: [] };

function cellLabel(p: { row: number; col: number }): string {
  return `${String.fromCharCode(65 + p.col)}${p.row + 1}`;
}

/** Flatten the per-defender AttackRecord map into a plain-text recap for the AI
 *  Post-Game Comment prompt. */
function buildBoatyEventLog(
  btAttacks: Record<string, AttackRecord>,
  players: Array<{ uid: string; gamertag: string }>,
): string {
  const nameFor = (uid: string) =>
    players.find((p) => p.uid === uid)?.gamertag ?? "Unknown";
  const lines: string[] = [];
  for (const [defenderUid, rec] of Object.entries(btAttacks)) {
    const attackerUid = players.find((p) => p.uid !== defenderUid)?.uid;
    if (!attackerUid) continue;
    const attacker = nameFor(attackerUid);
    const defender = nameFor(defenderUid);
    for (const c of rec.hits) lines.push(`${attacker} threw at ${cellLabel(c)} — HIT ${defender}'s raft.`);
    for (const c of rec.misses) lines.push(`${attacker} threw at ${cellLabel(c)} — MISS.`);
    for (const c of rec.gatorHits) lines.push(`${attacker} threw at ${cellLabel(c)} — hit the GATOR (free turn).`);
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
  const { state } = useBoatySession(sessionId, userId);

  const {
    session,
    btPhase,
    myBoard,
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

  const readyCount = Object.keys(btReady).length;
  const hasSubmitted = btReady[userId] === true;

  const attacksOnMe: AttackRecord = btAttacks[userId] ?? EMPTY_ATTACKS;
  const attacksOnOpponent: AttackRecord = btAttacks[opponentUid] ?? EMPTY_ATTACKS;

  // ─── All game writes go through the authenticated Boaty route ──
  const postBoaty = useCallback(
    async (action: string, payload: Record<string, unknown>) => {
      const headers = await getAIAuthHeaders();
      // Retry transient failures (the dropped-command hole on flaky links);
      // idempotent actions + the server turn-check make retries safe.
      const res = await fetchWithRetry("/api/games/boaty", {
        method: "POST",
        headers,
        body: JSON.stringify({ action, sessionId, ...payload }),
      });
      if (!res.ok) throw new Error(`boaty ${action} failed: ${res.status}`);
    },
    [sessionId],
  );

  // Setup: submit the board (server writes the secret board + flips btReady).
  const handleSetupDone = useCallback(
    async (rafts: RaftDef[], gator: Position) => {
      await postBoaty("submit-board", { board: { rafts, gator } });
    },
    [postBoaty],
  );

  // Play: submit an attack (server resolves it authoritatively).
  const handleAttack = useCallback(
    async (row: number, col: number) => {
      await postBoaty("submit-attack", { targetUid: opponentUid, row, col });
    },
    [postBoaty, opponentUid],
  );

  // ─── Delegate to composeGame result screen on finish ──────────
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

      // Host generates the AI opponent's Post-Game Comment (one LLM call) and
      // persists it via the route (clients can't write game fields on an engine
      // session). Fire-and-forget; the GC4 screen renders it when present.
      if (isHost) {
        const sessionData = session as unknown as Record<string, unknown> | null;
        const existing =
          (sessionData?.["aiPostGameComments"] as Record<string, string> | undefined) ?? {};
        for (const p of players) {
          if (!isAiPlayer(p.uid) || existing[p.uid]) continue;
          const opponentOfAi = playerUids.find((uid) => uid !== p.uid) ?? "";
          const aiHits = (btAttacks[opponentOfAi] ?? EMPTY_ATTACKS).hits.length;
          const humanHits = (btAttacks[p.uid] ?? EMPTY_ATTACKS).hits.length;
          void generatePostGameCommentsForUid(p.uid, {
            outcome: btWinner === p.uid ? "won" : "lost",
            score: `${aiHits}–${humanHits}`,
            gameContext: buildBoatyEventLog(btAttacks, players),
            gameName: "Boaty McBoatface",
          }).then((comment) => {
            if (comment) void postBoaty("set-ai-comment", { aiUid: p.uid, comment }).catch(() => {});
          });
        }
      }
    }
    if (btPhase !== "finished") gameEndFiredRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once on transition to finished
  }, [btPhase, btWinner, btAttacks, onGameEnd, players, isHost, userId, playerUids, session?.ownerId]);

  // ─── Render ────────────────────────────────────────────────
  if (!session) return null;

  if (session.status === "lobby") {
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

      {/* Play phase but the secret board / turn is still loading (e.g. right
          after a refresh, the owner-readable board doc is in flight). Show a
          spinner instead of a blank dark screen. */}
      {btPhase === "play" && (!btCurrentTurn || !myBoard) && (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6">
          <div className="h-10 w-10 animate-spin rounded-full border-3" style={{ borderColor: primary, borderTopColor: "transparent" }} />
          <p className="text-center text-lg font-bold uppercase tracking-wider text-white/60">
            Loading game&hellip;
          </p>
        </div>
      )}

      {btPhase === "play" && btCurrentTurn && myBoard && (
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
            attacksOnMe={attacksOnMe}
            attacksOnOpponent={attacksOnOpponent}
            lastAttack={btLastAttack}
            onAttack={handleAttack}
          />
        </div>
      )}

      <GameGamertagBadge />
    </div>
  );
}
