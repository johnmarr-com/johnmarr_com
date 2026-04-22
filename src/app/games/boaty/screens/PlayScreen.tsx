"use client";

import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from "react";
import { useGameColors } from "@/app/games/_gamecore";
import { JMAvatarView } from "@/JMKit";
import type { GameSessionPlayer } from "@/lib/game-sessions";
import type { PlayerBoard, AttackRecord, LastAttack, AttackResult } from "../boatyTypes";
import {
  resolveAttack,
  checkWin,
  moveGator,
  posKey,
  BOATY_ATTACK_ANIM_MS,
  BOATY_THROW_MS,
  BOATY_IMPACT_ANIM_MS,
} from "../boatyLogic";
import SwampGrid from "../components/SwampGrid";
import Banner from "../components/Banner";

interface PlayScreenProps {
  currentUserId: string;
  opponentUid: string;
  players: GameSessionPlayer[];
  currentTurn: string;
  myBoard: PlayerBoard;
  opponentBoard: PlayerBoard;
  attacksOnMe: AttackRecord;
  attacksOnOpponent: AttackRecord;
  lastAttack: LastAttack | null;
  onAttack: (
    row: number,
    col: number,
    result: AttackResult,
    defenderGatorBefore: { row: number; col: number },
    newGator: { row: number; col: number },
    updatedAttacks: AttackRecord,
    won: boolean,
  ) => Promise<void>;
  /** Called after the animation finishes to advance the turn. */
  onTurnEnd: () => Promise<void>;
}

export default function PlayScreen({
  currentUserId,
  opponentUid,
  players,
  currentTurn,
  myBoard,
  opponentBoard,
  attacksOnMe,
  attacksOnOpponent,
  lastAttack,
  onAttack,
  onTurnEnd,
}: PlayScreenProps) {
  const { primary, danger, tertiary } = useGameColors();
  const [attacking, setAttacking] = useState(false);
  const [gatorHitPopup, setGatorHitPopup] = useState(false);
  const [myGator, setMyGator] = useState(myBoard.gator);
  const [pendingCell, setPendingCell] = useState<{ row: number; col: number } | null>(null);

  // ── Grid flip state ──────────────────────────────────────
  const isMyTurn = currentTurn === currentUserId;
  const [displayView, setDisplayView] = useState<"attack" | "defend">(isMyTurn ? "attack" : "defend");
  const [flipAnim, setFlipAnim] = useState<"" | "bt-flip-out" | "bt-flip-in">("");
  const prevTurnRef = useRef(currentTurn);

  // ── Molotov animation state ──────────────────────────────
  const [molotov, setMolotov] = useState<{
    phase: "throw" | "impact";
    landX: number;  // window-level px
    landY: number;
    fromLeft: boolean;
    result?: AttackResult;
  } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const incomingHandledRef = useRef<string | null>(null);

  const lastAttackKey = useMemo(() => {
    if (!lastAttack) return null;
    return `${lastAttack.attackerUid}-${lastAttack.row}-${lastAttack.col}-${lastAttack.result}`;
  }, [lastAttack]);

  // Cell center in viewport px — measured from the real grid button (matches layout, aspect-ratio, etc.)
  const getCellCenter = useCallback((row: number, col: number): { x: number; y: number } => {
    const wrap = gridRef.current;
    const fallback = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    if (!wrap) return fallback;
    const cell = wrap.querySelector(
      `button[data-boaty-r="${row}"][data-boaty-c="${col}"]`,
    ) as HTMLElement | null;
    if (!cell) return fallback;
    const r = cell.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, []);

  const me = players.find((p) => p.uid === currentUserId);
  const opponent = players.find((p) => p.uid === opponentUid);

  /** During incoming molotov throw, show gator before the attack's slither; then sync from Firestore. */
  const swampGator = useMemo(() => {
    if (
      molotov?.phase === "throw" &&
      lastAttack?.targetUid === currentUserId &&
      lastAttack.defenderGatorBefore
    ) {
      return lastAttack.defenderGatorBefore;
    }
    return myGator;
  }, [molotov?.phase, lastAttack, currentUserId, myGator]);

  // Sync local gator from Firestore
  useEffect(() => {
    setMyGator(myBoard.gator);
  }, [myBoard.gator]);

  // ── Shared attack animation — fires for BOTH players on lastAttack ──
  // useLayoutEffect: set pendingCell before paint so the grid never flashes hit/miss early.
  // Stable lastAttackKey: Firestore churn on unrelated fields must not clear timeouts mid-animation.
  useLayoutEffect(() => {
    if (!lastAttackKey || !lastAttack) return;
    if (incomingHandledRef.current === lastAttackKey) return;
    incomingHandledRef.current = lastAttackKey;

    const { row, col, result } = lastAttack;
    const iAmAttacker = lastAttack.attackerUid === currentUserId;
    const fromLeft = !iAmAttacker; // attacker sees from right, defender from left
    const center = getCellCenter(row, col);

    // Suppress the hit/miss emoji on the grid until the animation reveals it
    setPendingCell({ row, col });

    // Phase 1: throw
    setMolotov({ phase: "throw", landX: center.x, landY: center.y, fromLeft });

    const t1 = setTimeout(() => {
      // Re-measure so impact lines up after any layout change during the throw
      const impactCenter = getCellCenter(row, col);
      // Phase 2: impact + result — NOW reveal the cell
      setPendingCell(null);
      setMolotov({
        phase: "impact",
        landX: impactCenter.x,
        landY: impactCenter.y,
        fromLeft,
        result,
      });
      if (result === "gator") setGatorHitPopup(true);
      // Defender gator position: single source of truth is Firestore (already moved in attack write).
    }, BOATY_THROW_MS);

    // Phase 3: after impact animation, hold result 3s, then clean up and advance turn / end game
    const t2 = setTimeout(() => {
      setMolotov(null);
      if (iAmAttacker) {
        void onTurnEnd().finally(() => setAttacking(false));
      }
    }, BOATY_ATTACK_ANIM_MS);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // lastAttack omitted: same attack is keyed by lastAttackKey; including lastAttack's object
    // identity would re-run cleanup mid-animation when Firestore sends a new snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lastAttackKey + render closure
  }, [lastAttackKey, currentUserId, getCellCenter, onTurnEnd]);

  // ── 3D grid flip on turn change ──────────────────────────
  useEffect(() => {
    if (currentTurn === prevTurnRef.current) return;
    prevTurnRef.current = currentTurn;

    // Phase 1: flip out old view
    setFlipAnim("bt-flip-out");
    const t = setTimeout(() => {
      // Phase 2: swap content + flip in new view
      setDisplayView(currentTurn === currentUserId ? "attack" : "defend");
      setFlipAnim("bt-flip-in");
      // Phase 3: clear anim class after flip-in completes
      setTimeout(() => setFlipAnim(""), 250);
    }, 250);
    return () => clearTimeout(t);
  }, [currentTurn, currentUserId]);

  // Dismiss gator popup after 2s
  useEffect(() => {
    if (!gatorHitPopup) return;
    const t = setTimeout(() => setGatorHitPopup(false), 2000);
    return () => clearTimeout(t);
  }, [gatorHitPopup]);

  const handleAttackCell = useCallback(
    async (row: number, col: number) => {
      if (!isMyTurn || attacking) return;

      const key = posKey({ row, col });
      const alreadyAttacked = new Set([
        ...attacksOnOpponent.hits.map(posKey),
        ...attacksOnOpponent.misses.map(posKey),
      ]);
      if (alreadyAttacked.has(key)) return;

      setAttacking(true);
      // Hide result on grid until shared lastAttack animation reveals it (before Firestore round-trip).
      setPendingCell({ row, col });

      // Resolve the attack locally — we know the result immediately
      const result = resolveAttack(row, col, opponentBoard);
      const updatedAttacks: AttackRecord = {
        hits: [...attacksOnOpponent.hits],
        misses: [...attacksOnOpponent.misses],
        gatorHits: [...attacksOnOpponent.gatorHits],
      };
      if (result === "hit") {
        updatedAttacks.hits.push({ row, col });
      } else if (result === "miss") {
        updatedAttacks.misses.push({ row, col });
      } else {
        updatedAttacks.gatorHits.push({ row, col });
      }
      const defenderGatorBefore = opponentBoard.gator;
      const newGator = moveGator(opponentBoard.gator, opponentBoard.rafts);
      const won = result === "hit" && checkWin(updatedAttacks);

      // Write to Firestore FIRST — both players see lastAttack at the same time
      // and both play the animation from the shared listener.
      // Turn change is NOT included here — it happens after the animation.
      await onAttack(row, col, result, defenderGatorBefore, newGator, updatedAttacks, won);

      // Animation is handled by the lastAttack listener (shared by both players).
      // We just wait for it to finish, then we're done.
    },
    [isMyTurn, attacking, attacksOnOpponent, opponentBoard, onAttack],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto px-4 py-4">
      {/* Player avatars */}
      <div className="flex w-full max-w-[600px] items-center justify-between px-2">
        <PlayerBadge player={me} isActive={isMyTurn} side="left" />
        <p className="text-xs font-black uppercase tracking-widest text-white/40">VS</p>
        <PlayerBadge player={opponent} isActive={!isMyTurn} side="right" />
      </div>

      {/* Turn indicator */}
      <p
        className="text-center text-sm font-black uppercase tracking-wider"
        style={{ color: isMyTurn ? primary : danger }}
      >
        {isMyTurn ? "Your turn — pick a target!" : "Opponent's turn..."}
      </p>

      {/* Grid with 3D flip */}
      <div
        ref={gridRef}
        className="w-full max-w-[600px] shrink-0"
        style={{
          animation: flipAnim ? `${flipAnim} 0.25s ease-in-out both` : undefined,
          transformStyle: "preserve-3d",
        }}
      >
        {displayView === "attack" ? (
          <>
            <Banner label="THEIR SWAMP" />
            <SwampGrid
              hits={attacksOnOpponent.hits}
              misses={attacksOnOpponent.misses}
              tappable={isMyTurn}
              tapLocked={attacking}
              onCellTap={handleAttackCell}
              pendingCell={displayView === "attack" ? pendingCell : null}
            />
          </>
        ) : (
          <>
            <Banner label="MY SWAMP" />
            <SwampGrid
              rafts={myBoard.rafts}
              gator={swampGator}
              hits={attacksOnMe.hits}
              misses={attacksOnMe.misses}
              pendingCell={displayView === "defend" ? pendingCell : null}
            />
          </>
        )}
      </div>

      {/* Molotov throw + impact animation */}
      {molotov && (
        <div className="pointer-events-none fixed inset-0 z-50">
          {molotov.phase === "throw" ? (() => {
            const sw = window.innerWidth;
            const sh = window.innerHeight;
            const startX = molotov.fromLeft ? -200 : sw + 200;
            const startY = Math.round(sh / 2 + 200);
            const endX = molotov.landX;
            const endY = molotov.landY;
            // Single control point: midpoint X, pulled upward for a gentle arch
            const cpX = Math.round((startX + endX) / 2);
            const cpY = Math.round(Math.min(startY, endY) - 150);
            return (
            <div
              className="absolute"
              style={{
                offsetPath: `path("M ${startX} ${startY} Q ${cpX} ${cpY}, ${endX} ${endY}")`,
                offsetRotate: "0deg",
                animation: `bt-molotov-throw ${BOATY_THROW_MS / 1000}s ease-in forwards`,
              }}
            >
              <div className="flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-orange-500 shadow-lg shadow-orange-500/50">
                <span className="text-2xl">🔥</span>
              </div>
            </div>
            );
          })() : (
            <div
              className="pointer-events-none fixed z-50"
              style={{
                left: molotov.landX,
                top: molotov.landY,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div
                className="h-16 w-16 rounded-full bg-orange-400/80"
                style={{
                  animation: `bt-molotov-impact ${BOATY_IMPACT_ANIM_MS / 1000}s ease-out forwards`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Gator hit popup */}
      {gatorHitPopup && (
        <div className="fixed inset-x-0 top-1/3 z-50 flex justify-center">
          <div
            className="mx-4 rounded-2xl px-8 py-5 text-center shadow-2xl"
            style={{
              backgroundColor: tertiary,
              animation: "wk-fade-up 0.3s ease-out both",
            }}
          >
            <p className="text-2xl font-black text-white">
              🐊 YOU HIT THEIR GATOR!
            </p>
            <p className="mt-1 text-base font-bold text-white/80">
              Go again!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Player Badge ────────────────────────────────────────────

function PlayerBadge({
  player,
  isActive,
  side,
}: {
  player: GameSessionPlayer | undefined;
  isActive: boolean;
  side: "left" | "right";
}) {
  const { primary } = useGameColors();
  return (
    <div className={`flex items-center gap-2 ${side === "right" ? "flex-row-reverse" : ""}`}>
      <div
        className={`h-12 w-12 overflow-hidden rounded-full ring-2 transition-all ${
          isActive ? "" : "ring-white/20 opacity-50"
        }`}
        style={isActive ? { ["--tw-ring-color" as string]: primary } : undefined}
      >
        <JMAvatarView width={48} avatarName={player?.avatarName ?? "default"} />
      </div>
      <span className={`text-sm font-bold ${isActive ? "text-white" : "text-white/40"}`}>
        {player?.gamertag ?? "???"}
      </span>
    </div>
  );
}
