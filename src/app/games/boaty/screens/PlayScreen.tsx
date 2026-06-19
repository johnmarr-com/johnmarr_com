"use client";

import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import { useGameColors, bgMusic } from "@/app/games/_gamecore";

const SFX_WHOOSH = "/images/games/boaty/whoosh.mp3";
const SFX_SPLASH = "/images/games/boaty/splash.mp3";
const SFX_EXPLOSION = "/images/games/boaty/explosion.mp3";
const MOLOTOV_LOTTIE_URL = "/images/games/boaty/molotov.json";
// Container sized at MOLOTOV_BASE_SIZE; the Lottie inside gets the registered scale override
// so the bottle artwork renders at its intended size. will-change hints keep Safari crisp.
const MOLOTOV_BASE_SIZE = 1200;
const MOLOTOV_OVERRIDE_SCALE = 1.5; //getAvatarScale("YI9IA7"); // 3
import { JMAvatarView } from "@/JMKit";
import type { GameSessionPlayer } from "@/lib/game-sessions";
import type { PlayerBoard, AttackRecord, LastAttack, AttackResult } from "../boatyTypes";
import {
  resolveAttack,
  checkWin,
  moveGator,
  posKey,
  findRaftAt,
  isRaftDestroyed,
  BOATY_ATTACK_ANIM_MS,
  BOATY_THROW_MS,
} from "../boatyLogic";
import type { RaftType } from "../boatyTypes";

const RAFT_TAUNT_CODE: Record<RaftType, "S" | "L" | "B"> = {
  square: "S",
  lshape: "L",
  shorty: "B",
};
const RAFT_SINK_NAME: Record<RaftType, string> = {
  square: "Big Raft!",
  lshape: "Crooked Raft!",
  shorty: "Paddle Boat!",
};
const TAUNT_VARIANTS = 5;
const TAUNT_EXTRA_HOLD_MS = 2000; // 5s total instead of the normal 3s post-reveal
const tauntSfxUrl = (player: "p1" | "p2", code: "S" | "L" | "B" | "G", n: number) =>
  `/images/games/boaty/${player}/${code}-${n}.mp3`;
import Image from "next/image";
import SwampGrid from "../components/SwampGrid";
import SwampSignFrame from "../components/SwampSignFrame";

interface PlayScreenProps {
  currentUserId: string;
  opponentUid: string;
  ownerUid: string;
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
  ownerUid,
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
  const [attacking, setAttacking] = useState(false);
  const [molotovLottieData, setMolotovLottieData] = useState<object | null>(null);
  const molotovLottieRef = useRef<LottieRefCurrentProps | null>(null);
  useEffect(() => {
    fetch(MOLOTOV_LOTTIE_URL)
      .then((r) => r.json() as Promise<object>)
      .then(setMolotovLottieData)
      .catch(() => {});
  }, []);
  // Fully-qualified same-document URL works around WebKit bug #189499 where Safari
  // mis-resolves bare `url(#id)` filter fragments on composited subtrees.
  const molotovFilterUrl = useMemo(() => {
    if (typeof window === "undefined") return "url(#bt-molotov-fx)";
    const base = window.location.href.split("#")[0];
    return `url('${base}#bt-molotov-fx')`;
  }, []);
  const [gatorHitPopup, setGatorHitPopup] = useState<null | "attacker" | "defender">(null);
  const [gatorHitFading, setGatorHitFading] = useState(false);
  const [raftSinkPopup, setRaftSinkPopup] = useState<RaftType | null>(null);
  const [raftSinkFading, setRaftSinkFading] = useState(false);
  const [myGator, setMyGator] = useState(myBoard.gator);
  const [pendingCell, setPendingCell] = useState<{ row: number; col: number } | null>(null);

  // Gator taunts: shuffle-bag per player so we cycle all 5 before repeating any.
  const gatorBagRef = useRef<{ p1: number[]; p2: number[] }>({ p1: [], p2: [] });
  const pickGatorIndex = useCallback((player: "p1" | "p2"): number => {
    const bag = gatorBagRef.current[player];
    if (bag.length === 0) {
      const fresh = Array.from({ length: TAUNT_VARIANTS }, (_, i) => i + 1);
      for (let i = fresh.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [fresh[i], fresh[j]] = [fresh[j]!, fresh[i]!];
      }
      gatorBagRef.current[player] = fresh;
    }
    return gatorBagRef.current[player].pop()!;
  }, []);

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

    // Determine whether this attack destroyed a raft, and whether it was a win —
    // use the defender's board + post-attack hits list (Firestore sends these atomically with btLastAttack).
    const defenderIsMe = lastAttack.targetUid === currentUserId;
    const targetRafts = defenderIsMe ? myBoard.rafts : opponentBoard.rafts;
    const targetHits = defenderIsMe ? attacksOnMe.hits : attacksOnOpponent.hits;
    const hitRaft = result === "hit" ? findRaftAt(targetRafts, row, col) : undefined;
    const raftDestroyed = !!hitRaft && isRaftDestroyed(hitRaft, targetHits);
    const attackerWon = result === "hit" && targetHits.length >= 9; // TOTAL_RAFT_SQUARES

    // Pick the taunt to play (if any). Raft-sink sounds play even on the winning kill shot
    // (scores the win screen); gator sounds only when the game continues.
    let tauntUrl: string | null = null;
    const playerDir: "p1" | "p2" = lastAttack.attackerUid === ownerUid ? "p1" : "p2";
    let code: "S" | "L" | "B" | "G" | null = null;
    if (result === "gator" && !attackerWon) {
      code = "G";
    } else if (raftDestroyed && hitRaft) {
      code = RAFT_TAUNT_CODE[hitRaft.type];
    }
    if (code) {
      // Gator fires often, so cycle through all 5 before any repeat; raft-sink taunts stay purely random.
      const n = code === "G"
        ? pickGatorIndex(playerDir)
        : 1 + Math.floor(Math.random() * TAUNT_VARIANTS);
      tauntUrl = tauntSfxUrl(playerDir, code, n);
    }

    // Phase 1: throw
    setMolotov({ phase: "throw", landX: center.x, landY: center.y, fromLeft });
    bgMusic.playSfx(SFX_WHOOSH);

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
      bgMusic.playSfx(result === "miss" ? SFX_SPLASH : SFX_EXPLOSION);
      if (tauntUrl) bgMusic.playSfx(tauntUrl);
      if (result === "gator") setGatorHitPopup(iAmAttacker ? "attacker" : "defender");
      // Attacker-only sunk-raft popup — skipped on the winning kill shot (the win screen takes over).
      if (iAmAttacker && raftDestroyed && hitRaft && !attackerWon) {
        setRaftSinkPopup(hitRaft.type);
      }
      // Defender gator position: single source of truth is Firestore (already moved in attack write).
    }, BOATY_THROW_MS);

    // Phase 3: hold result, then clean up and advance turn / end game.
    // Extra 2s when a raft was destroyed so the taunt can play out before the flip.
    const holdExtraMs = raftDestroyed && !attackerWon ? TAUNT_EXTRA_HOLD_MS : 0;
    const t2 = setTimeout(() => {
      setMolotov(null);
      if (iAmAttacker) {
        void onTurnEnd().finally(() => setAttacking(false));
      }
    }, BOATY_ATTACK_ANIM_MS + holdExtraMs);

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

  // Gator popup: hold ~4s, then fade out over 500ms, then unmount
  useEffect(() => {
    if (!gatorHitPopup) return;
    setGatorHitFading(false);
    const tFade = setTimeout(() => setGatorHitFading(true), 4000);
    const tHide = setTimeout(() => setGatorHitPopup(null), 4500);
    return () => { clearTimeout(tFade); clearTimeout(tHide); };
  }, [gatorHitPopup]);

  // Raft-sink popup: same hold + fade cycle as the gator popup
  useEffect(() => {
    if (!raftSinkPopup) return;
    setRaftSinkFading(false);
    const tFade = setTimeout(() => setRaftSinkFading(true), 4000);
    const tHide = setTimeout(() => setRaftSinkPopup(null), 4500);
    return () => { clearTimeout(tFade); clearTimeout(tHide); };
  }, [raftSinkPopup]);

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
    <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto px-4 py-4">
      {/* SVG inner-glow filter — uses SourceAlpha on the first feComposite (not SourceGraphic).
       * SourceAlpha is the cross-browser-reliable input per the canonical inner-glow recipe;
       * SourceGraphic silently fails to composite on Safari when the filtered subtree is
       * a CSS-transformed / composited Lottie.
       * References:
       *   https://riptutorial.com/svg/example/12623/shadow-filters--inner-glow
       *   https://bugs.webkit.org/show_bug.cgi?id=189499 (fragment url resolution) */}
      <svg aria-hidden className="pointer-events-none absolute h-0 w-0 overflow-hidden">
        <defs>
          <filter
            id="bt-molotov-fx"
            filterUnits="userSpaceOnUse"
            x="-200"
            y="-200"
            width="1600"
            height="1600"
            colorInterpolationFilters="sRGB"
          >
            <feFlood floodColor="#ffaa1a" floodOpacity="1" />
            <feComposite in2="SourceAlpha" operator="out" />
            <feGaussianBlur stdDeviation="20" />
            <feComposite in2="SourceGraphic" operator="atop" />
          </filter>
        </defs>
      </svg>
      {/* Extra dim over the game bg on the enemy swamp view — more menacing, fades back on home swamp */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 -z-10 bg-black transition-opacity duration-500 ${displayView === "attack" ? "opacity-50" : "opacity-0"}`}
      />
      {/* Player avatars — absolutely positioned so they don't push grid layout */}
      <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex items-start justify-between px-4">
        <PlayerBadge player={me} isActive={isMyTurn} side="left" />
        <PlayerBadge player={opponent} isActive={!isMyTurn} side="right" />
      </div>

      {/* Board: flex spacers push map into the middle of the band so it sits further from the bottom */}
      <div className="flex min-h-0 w-full flex-1 flex-col items-center overflow-visible">
        <div aria-hidden className="min-h-0 w-full flex-[1.1] basis-0 shrink-0" />
        <div className="relative w-full max-w-[500px] shrink-0">
          <div
            ref={gridRef}
            className="w-full"
            style={{
              animation: flipAnim ? `${flipAnim} 0.25s ease-in-out both` : undefined,
              transformStyle: "preserve-3d",
            }}
          >
            {displayView === "attack" ? (
              <SwampSignFrame variant="their">
                <SwampGrid
                  hits={attacksOnOpponent.hits}
                  misses={attacksOnOpponent.misses}
                  tappable={isMyTurn}
                  tapLocked={attacking}
                  onCellTap={handleAttackCell}
                  pendingCell={displayView === "attack" ? pendingCell : null}
                  enemyView
                />
              </SwampSignFrame>
            ) : (
              <SwampSignFrame variant="my">
                <SwampGrid
                  rafts={myBoard.rafts}
                  gator={swampGator}
                  hits={attacksOnMe.hits}
                  misses={attacksOnMe.misses}
                  pendingCell={displayView === "defend" ? pendingCell : null}
                />
              </SwampSignFrame>
            )}
          </div>
          {/* "{GAMERTAG}'s turn" overlay — shows at the start of their turn, fades out once their attack animation begins */}
          <div
            className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${!isMyTurn && !molotov ? "opacity-100" : "opacity-0"}`}
          >
            <div className="rounded-2xl border border-[#daa520] bg-black/85 px-7 py-4 backdrop-blur-sm">
              <p className="animate-pulse text-lg font-black uppercase tracking-wider text-white/80">
                {opponent?.gamertag ?? "Opponent"}&apos;s turn!
              </p>
            </div>
          </div>
          {/* Sunk-raft popup — attacker only, skipped on the winning kill shot */}
          {raftSinkPopup && (
            <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
              <div
                className="mx-4 flex flex-col items-center rounded-2xl bg-black/85 px-8 py-5 text-center shadow-2xl backdrop-blur-sm"
                style={{
                  animation: raftSinkFading
                    ? "bt-gator-popup-out 0.5s ease-in both"
                    : "bt-gator-popup-in 0.35s ease-out both",
                }}
              >
                <p className="text-base font-black uppercase tracking-wider text-white/80">
                  You sunk their
                </p>
                <p className="mt-1 text-3xl font-black uppercase tracking-wider text-white">
                  {RAFT_SINK_NAME[raftSinkPopup]}
                </p>
              </div>
            </div>
          )}
          {/* Gator hit popup — centered over the grid, gator head on top */}
          {gatorHitPopup && (
            <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
              <div
                className="mx-4 flex flex-col items-center rounded-2xl bg-black/85 px-8 py-5 text-center shadow-2xl backdrop-blur-sm"
                style={{
                  animation: gatorHitFading
                    ? "bt-gator-popup-out 0.5s ease-in both"
                    : "bt-gator-popup-in 0.35s ease-out both",
                }}
              >
                <Image
                  src="/images/games/boaty/Alligator.png"
                  alt=""
                  width={150}
                  height={150}
                  className="mb-2 h-36 w-36 shrink-0 object-contain"
                  draggable={false}
                />
                <p className="text-base font-black uppercase tracking-wider text-white/80">
                  {gatorHitPopup === "attacker" ? "You hit their gator!" : "They hit your gator!"}
                </p>
                <p className="mt-1 text-3xl font-black uppercase tracking-wider text-white">
                  {gatorHitPopup === "attacker" ? "Go again!" : "They go again!"}
                </p>
              </div>
            </div>
          )}
        </div>
        <div aria-hidden className="min-h-0 w-full flex-[0.9] basis-0 shrink-0" />
      </div>

      {/* Molotov throw animation */}
      {molotov && molotov.phase === "throw" && (() => {
        const sw = window.innerWidth;
        // Element center anchors at (startX, startY). Position the center AT the viewport top so the
        // bottom half of the scaled Lottie is already peeking into view at frame 0 — no waiting.
        const startX = sw * 0.5;
        const startY = -1000;
        const endX = molotov.landX;
        const endY = molotov.landY;
        // Flip gif when impact is on the right half of the screen
        const targetIsRight = endX > sw / 2;
        // Minimal bezier — slight upward arc via a nudged midpoint
        const cpX = (startX + endX) / 3;
        const cpY = (startY + endY) / 3 - 40;
        return (
          <div className="pointer-events-none fixed inset-0 z-50">
            <div
              className="absolute"
              style={{
                width: 0,
                height: 0,
                offsetPath: `path("M ${startX} ${startY} Q ${cpX} ${cpY}, ${endX} ${endY}")`,
                offsetRotate: "0deg",
                animation: `bt-molotov-throw ${BOATY_THROW_MS / 1000}s linear forwards`,
                willChange: "transform, offset-distance",
              }}
            >
              <div
                className={`relative -translate-x-1/2 -translate-y-1/2 ${targetIsRight ? "-scale-x-100" : ""}`}
                style={{
                  width: MOLOTOV_BASE_SIZE,
                  height: MOLOTOV_BASE_SIZE,
                  isolation: "isolate",
                  filter: molotovFilterUrl,
                  WebkitFilter: molotovFilterUrl,
                }}
              >
                {molotovLottieData && (
                  <Lottie
                    lottieRef={molotovLottieRef}
                    animationData={molotovLottieData}
                    loop
                    autoplay
                    className="h-full w-full"
                    style={{
                      transform: `scale(${MOLOTOV_OVERRIDE_SCALE})`,
                    }}
                    onDOMLoaded={() => molotovLottieRef.current?.setSpeed(7)}
                  />
                )}
              </div>
            </div>
          </div>
        );
      })()}

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
  const avatarSize = isActive ? 72 : 48;
  return (
    <div
      className={`flex flex-col gap-1 transition-opacity duration-300 ${side === "right" ? "items-end" : "items-start"} ${isActive ? "opacity-100" : "opacity-50"}`}
    >
      <div
        className={`overflow-hidden rounded-full ring-2 transition-all duration-300 ${isActive ? "h-[72px] w-[72px]" : "h-12 w-12 ring-white/20"}`}
        style={isActive ? { ["--tw-ring-color" as string]: primary } : undefined}
      >
        <JMAvatarView width={avatarSize} avatarName={player?.avatarName ?? "default"} />
      </div>
      <span className={`text-sm font-bold ${isActive ? "text-white" : "text-white/40"}`}>
        {player?.gamertag ?? "???"}
      </span>
    </div>
  );
}
