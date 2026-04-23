"use client";

import { useState, useRef, useCallback, useEffect, useId, useLayoutEffect } from "react";
import Image from "next/image";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import type { Position, RaftDef, RaftType, Rotation } from "../boatyTypes";
import { GRID_SIZE, getOccupiedSquares, posKey } from "../boatyLogic";

/**
 * Ripple Lottie: first play jumps in halfway (frame 45) so the scale-up burst
 * lands on an already-visible wave; subsequent loops run the full animation.
 */
function RippleLottie({ animationData }: { animationData: object }) {
  const ref = useRef<LottieRefCurrentProps>(null);
  useEffect(() => {
    ref.current?.goToAndPlay(45, true);
  }, []);
  return (
    <Lottie
      lottieRef={ref}
      animationData={animationData}
      loop
      autoplay={false}
      className="h-full w-full brightness-150 saturate-150"
    />
  );
}

// ─── Lottie loader (loaded once per URL, shared across all cells) ──
const lottieCache = new Map<string, object>();
const lottiePromises = new Map<string, Promise<object | null>>();
function useLottie(url: string) {
  const [data, setData] = useState<object | null>(() => lottieCache.get(url) ?? null);
  useEffect(() => {
    if (data) return;
    let promise = lottiePromises.get(url);
    if (!promise) {
      promise = fetch(url)
        .then((r) => r.json() as Promise<object>)
        .then((d) => { lottieCache.set(url, d); return d; })
        .catch(() => null);
      lottiePromises.set(url, promise);
    }
    void promise.then((d) => { if (d) setData(d); });
  }, [data, url]);
  return data;
}

// ─── Swamp art ───────────────────────────────────────────────
const SWAMP_BG = "/images/games/boaty/Swamp.jpg";
const ENEMY_SWAMP_BG = "/images/games/boaty/enemy-swamp-bg.jpg";
/** Single overlay layer: darkens swamp in gaps/margins; cut out via SVG mask (not 25 cell backgrounds). */
const SWAMP_BG_DARKEN_ALPHA = 0.5;
const RAFT_SQUARE_BG = "/images/games/boaty/Raft-Square.png";
const RAFT_SMALL_BG = "/images/games/boaty/Raft-Small.png";
const RAFT_L_BG = "/images/games/boaty/Raft-L.png";
const ALLIGATOR_IMG = "/images/games/boaty/Alligator.png";
/** Matches `.bt-gator-sink` / `.bt-gator-rise` duration in `globals.css`. */
const GATOR_SINK_RISE_MS = 350;
/** Extra hold underwater after sink, before rise at the new cell. */
const GATOR_UNDERWATER_MS = 1000;

// ─── Placeholder Colors ──────────────────────────────────────
/** Wash under raft art when selected — second `background-image` layer (under URL). */
const SELECTED_RAFT_TINT = "rgba(250, 215, 60, 0.42)";
const SELECTED_RAFT_TINT_LAYER = `linear-gradient(${SELECTED_RAFT_TINT}, ${SELECTED_RAFT_TINT})`;
const COLOR_TAPPABLE = "rgba(255,255,255,0.06)";

// Grid layout constants (must match the JSX: p-2 = 8px, gap-1 = 4px)
const GRID_PADDING = 8;
const GRID_GAP = 4;

/** Measured grid geometry so SVG mask holes match real cell boxes (Safari subpixels + aspect-ratio rows). */
interface SwampMaskLayout {
  bw: number;
  bh: number;
  padLeft: number;
  padTop: number;
  cw: number;
  ch: number;
  gapX: number;
  gapY: number;
}
const RAFT_ART_OUTER_RADIUS = 8;

/**
 * L sprite is a square with the missing tromino quadrant in the bottom-left at rotation 0°.
 * `transform: rotate(raft.rotation)` aligns the hole with game logic; clip stays in sprite space.
 */
const L_RAFT_CLIP_BASE =
  "polygon(0% 0%, 100% 0%, 100% 100%, 50% 100%, 50% 50%, 0% 50%)";

function raftGridSpan(raft: RaftDef): { r0: number; c0: number; nr: number; nc: number } {
  const sqs = getOccupiedSquares(raft);
  const rs = sqs.map((s) => s.row);
  const cs = sqs.map((s) => s.col);
  const r0 = Math.min(...rs);
  const c0 = Math.min(...cs);
  return { r0, c0, nr: Math.max(...rs) - r0 + 1, nc: Math.max(...cs) - c0 + 1 };
}

/**
 * View box for shorty art: **2× along the short axis** of the domino bbox so `scale(½)` on the image
 * keeps the bitmap domino-sized without a cramped stage. Wide → extra height (`aspect-ratio 1/2`); tall → extra **width** + height (`200%` × `200%` so the stage matches the wide case in spirit).
 */
function shortySquareSizerStyle(wideDomino: boolean): React.CSSProperties {
  return wideDomino
    ? { width: "100%", height: "auto", aspectRatio: "1 / 2" }
    : { width: "200%", height: "200%" };
}

/** `dominoTightScale` = min/max span (always ½ for a 2×1 domino) so `cover` on the circumscribed square matches the pre-square bbox. */
function shortyArtStyle(
  rotation: Rotation,
  isSelected: boolean,
  dominoTightScale: number,
): React.CSSProperties {
  const tint = isSelected ? `, ${SELECTED_RAFT_TINT_LAYER}` : "";
  return {
    width: "100%",
    height: "100%",
    transform: `rotate(${rotation}deg) scale(${dominoTightScale})`,
    transformOrigin: "center center",
    backgroundImage: `url(${RAFT_SMALL_BG})${tint}`,
    backgroundSize: isSelected ? "cover, 100% 100%" : "cover",
    backgroundPosition: "center, center",
    backgroundRepeat: "no-repeat, no-repeat",
  };
}

interface SwampGridProps {
  /** Rafts to display (own board in setup/defense). */
  rafts?: RaftDef[];
  /** Index of the currently selected raft (setup mode). */
  selectedRaftIndex?: number | null;
  /** Gator position. */
  gator?: Position | null;
  /** Hit markers (flames on raft squares that were hit). */
  hits?: Position[];
  /** Miss markers (water ripples). */
  misses?: Position[];
  /** Cells the player can tap (attack mode). */
  tappable?: boolean;
  /** When true with tappable, keeps target styling but ignores taps (e.g. during attack animation). */
  tapLocked?: boolean;
  /** Called when a cell is tapped. Optional event for reading tap coordinates. */
  onCellTap?: (row: number, col: number, e?: React.MouseEvent) => void;
  /** If true, show raft tap targets for selection (setup mode). */
  onRaftTap?: (raftIndex: number) => void;
  /** Called on pointer down on a raft (before we know if it’s a tap or drag). Set drag refs only — do not force selection here if tap should toggle off. */
  onDragStart?: (raftIndex: number, companions: { dr: number; dc: number }[], touchToAnchor: { dr: number; dc: number }) => void;
  /** First real movement after pointer down — user is dragging; select this raft for the drag. */
  onDragRaftLift?: (raftIndex: number) => void;
  /** Called on finger release after a drag — the cell the finger was over. */
  onDragDrop?: (touchRow: number, touchCol: number) => void;
  /** Cell currently being attacked — suppress hit/miss rendering until animation completes. */
  pendingCell?: { row: number; col: number } | null;
  /** When true, use the darker enemy-swamp background to emphasise the flip between attack and defend views. */
  enemyView?: boolean;
}

export default function SwampGrid({
  rafts = [],
  selectedRaftIndex,
  gator,
  hits = [],
  misses = [],
  tappable = false,
  tapLocked = false,
  onCellTap,
  onRaftTap,
  onDragStart,
  onDragRaftLift,
  onDragDrop,
  pendingCell,
  enemyView = false,
}: SwampGridProps) {
  const bgUrl = enemyView ? ENEMY_SWAMP_BG : SWAMP_BG;
  const fireLottie = useLottie("/lottie/fire.json");
  const rippleLottie = useLottie("/lottie/green-ripple.json");
  const gridRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const maskLayoutRef = useRef<SwampMaskLayout | null>(null);
  const swampHoleMaskId = useId().replace(/:/g, "");
  const gatorWaterMaskId = useId().replace(/:/g, "");
  const gatorWaterBlurId = `${gatorWaterMaskId}-blur`;
  const [swampMaskLayout, setSwampMaskLayout] = useState<SwampMaskLayout | null>(null);

  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    const measure = () => {
      requestAnimationFrame(() => {
        const gridEl = gridRef.current;
        if (!gridEl) return;
        const c00 = gridEl.querySelector('[data-boaty-r="0"][data-boaty-c="0"]') as HTMLElement | null;
        const c01 = gridEl.querySelector('[data-boaty-r="0"][data-boaty-c="1"]') as HTMLElement | null;
        const c10 = gridEl.querySelector('[data-boaty-r="1"][data-boaty-c="0"]') as HTMLElement | null;

        if (c00 && c01 && c10) {
          const gridRect = gridEl.getBoundingClientRect();
          const bw = gridRect.width;
          const bh = gridRect.height;
          if (bw <= 0 || bh <= 0) return;
          const r00 = c00.getBoundingClientRect();
          const r01 = c01.getBoundingClientRect();
          const r10 = c10.getBoundingClientRect();
          const padLeft = r00.left - gridRect.left;
          const padTop = r00.top - gridRect.top;
          const cw = r00.width;
          const ch = r00.height;
          const gapX = Math.max(0, r01.left - r00.right);
          const gapY = Math.max(0, r10.top - r00.bottom);
          const layout: SwampMaskLayout = { bw, bh, padLeft, padTop, cw, ch, gapX, gapY };
          maskLayoutRef.current = layout;
          setSwampMaskLayout(layout);
          return;
        }

        const bw = gridEl.clientWidth;
        const bh = gridEl.clientHeight;
        const innerW = bw - 2 * GRID_PADDING;
        const innerH = bh - 2 * GRID_PADDING;
        const cw = (innerW - (GRID_SIZE - 1) * GRID_GAP) / GRID_SIZE;
        const ch = (innerH - (GRID_SIZE - 1) * GRID_GAP) / GRID_SIZE;
        if (cw > 0 && ch > 0) {
          const layout: SwampMaskLayout = {
            bw,
            bh,
            padLeft: GRID_PADDING,
            padTop: GRID_PADDING,
            cw,
            ch,
            gapX: GRID_GAP,
            gapY: GRID_GAP,
          };
          maskLayoutRef.current = layout;
          setSwampMaskLayout(layout);
        }
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // All drag data lives in a ref for performance (no re-render on every pointer move)
  const dragData = useRef<{
    raftIndex: number;
    moved: boolean;
    companions: { dr: number; dc: number }[];
    touchToAnchor: { dr: number; dc: number };
    raftType: RaftType;
    rotation: Rotation;
    raftLocalTouch: { dr: number; dc: number };
    cellSize: number;
    fingerX: number;
    fingerY: number;
  } | null>(null);

  // State only to trigger re-render: show/hide floating raft + hide grid cells
  const [draggingRaftIndex, setDraggingRaftIndex] = useState<number | null>(null);

  // ─── Gator sink / rise animation ─────────────────────────────
  const prevGatorKeyRef = useRef(gator ? posKey(gator) : null);
  const [displayedGator, setDisplayedGator] = useState(gator ?? null);
  const [gatorPhase, setGatorPhase] = useState<"idle" | "sinking" | "rising">("idle");
  /** Randomized while fully submerged (before rise) so left/right facing changes off-screen. */
  const [gatorMirrored, setGatorMirrored] = useState(false);

  useEffect(() => {
    const newKey = gator ? posKey(gator) : null;
    const oldKey = prevGatorKeyRef.current;
    prevGatorKeyRef.current = newKey;

    // No gator or first render — show immediately
    if (!gator || !oldKey || oldKey === newKey) {
      setDisplayedGator(gator ?? null);
      setGatorPhase("idle");
      return;
    }

    // Position changed — sink at old spot, hold, then rise at new spot
    setGatorPhase("sinking");
    const t1 = setTimeout(() => {
      setGatorMirrored(Math.random() < 0.5);
      setDisplayedGator(gator);
      setGatorPhase("rising");
    }, GATOR_SINK_RISE_MS + GATOR_UNDERWATER_MS);
    const t2 = setTimeout(() => {
      setGatorPhase("idle");
    }, GATOR_SINK_RISE_MS + GATOR_UNDERWATER_MS + GATOR_SINK_RISE_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by position, not object identity
  }, [gator ? posKey(gator) : null]);

  // Convert pointer coordinates to grid cell (row, col). Returns null if outside grid.
  const pointerToCell = useCallback((clientX: number, clientY: number): { row: number; col: number } | null => {
    const el = gridRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const L = maskLayoutRef.current;
    const padL = L?.padLeft ?? GRID_PADDING;
    const padT = L?.padTop ?? GRID_PADDING;
    const cw =
      L?.cw ??
      (rect.width - 2 * GRID_PADDING - (GRID_SIZE - 1) * GRID_GAP) / GRID_SIZE;
    const ch = L?.ch ?? cw;
    const gapX = L?.gapX ?? GRID_GAP;
    const gapY = L?.gapY ?? GRID_GAP;
    const x = clientX - rect.left - padL;
    const y = clientY - rect.top - padT;
    const stepX = cw + gapX;
    const stepY = ch + gapY;
    if (stepX <= 0 || stepY <= 0) return null;
    const col = Math.floor(x / stepX);
    const row = Math.floor(y / stepY);
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return null;
    const lx = x - col * stepX;
    const ly = y - row * stepY;
    if (lx < 0 || lx > cw || ly < 0 || ly > ch) return null;
    return { row, col };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!onDragStart) return;
    const cell = pointerToCell(e.clientX, e.clientY);
    if (!cell) return;

    // Find which raft owns this cell
    const key = posKey(cell);
    let foundRaft: { raftIndex: number; anchor: Position; squares: Position[] } | null = null;
    for (let i = 0; i < rafts.length; i++) {
      const raft = rafts[i]!;
      const squares = getOccupiedSquares(raft);
      for (const sq of squares) {
        if (posKey(sq) === key) {
          foundRaft = { raftIndex: i, anchor: raft.anchor, squares };
          break;
        }
      }
      if (foundRaft) break;
    }
    if (!foundRaft) return;

    e.preventDefault();
    gridRef.current!.setPointerCapture(e.pointerId);

    // Companion offsets: other cells' positions relative to the touched cell
    const companions = foundRaft.squares
      .filter((sq) => !(sq.row === cell.row && sq.col === cell.col))
      .map((sq) => ({ dr: sq.row - cell.row, dc: sq.col - cell.col }));

    // Offset from touched cell back to anchor (for reconstructing raft state on drop)
    const touchToAnchor = {
      dr: foundRaft.anchor.row - cell.row,
      dc: foundRaft.anchor.col - cell.col,
    };

    const rect = gridRef.current!.getBoundingClientRect();
    const L = maskLayoutRef.current;
    const cellSize =
      L?.cw ?? (rect.width - 2 * GRID_PADDING - (GRID_SIZE - 1) * GRID_GAP) / GRID_SIZE;

    const raftDef = rafts[foundRaft.raftIndex]!;

    dragData.current = {
      raftIndex: foundRaft.raftIndex,
      moved: false,
      companions,
      touchToAnchor,
      raftType: raftDef.type,
      rotation: raftDef.rotation,
      raftLocalTouch: {
        dr: cell.row - raftDef.anchor.row,
        dc: cell.col - raftDef.anchor.col,
      },
      cellSize,
      fingerX: e.clientX - rect.left,
      fingerY: e.clientY - rect.top,
    };

    onDragStart(foundRaft.raftIndex, companions, touchToAnchor);
  }, [rafts, onDragStart, pointerToCell]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const dd = dragData.current;
    if (!dd || !gridRef.current) return;

    const rect = gridRef.current.getBoundingClientRect();
    dd.fingerX = e.clientX - rect.left;
    dd.fingerY = e.clientY - rect.top;

    if (!dd.moved) {
      // First move — lift the raft off the grid
      dd.moved = true;
      setDraggingRaftIndex(dd.raftIndex);
      onDragRaftLift?.(dd.raftIndex);
      return; // floating element appears on next render at initial position
    }

    // Subsequent moves — update floating position directly (no re-render)
    if (floatingRef.current) {
      floatingRef.current.style.transform = `translate(${dd.fingerX}px, ${dd.fingerY}px)`;
    }
  }, [onDragRaftLift]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const dd = dragData.current;
    if (!dd) return;
    dragData.current = null;

    if (dd.moved) {
      // Drag completed — resolve the drop cell and notify parent
      const cell = pointerToCell(e.clientX, e.clientY);
      if (cell) onDragDrop?.(cell.row, cell.col);
      setDraggingRaftIndex(null);
    } else if (onRaftTap) {
      // Tap (no drag): pointer path — click is often lost after preventDefault + capture
      onRaftTap(dd.raftIndex);
    }
  }, [onDragDrop, onRaftTap, pointerToCell]);

  const handlePointerCancel = useCallback(() => {
    if (!dragData.current) return;
    dragData.current = null;
    setDraggingRaftIndex(null);
  }, []);

  // ─── Build cell lookup maps ──────────────────────────────
  const raftMap = new Map<string, { raftIndex: number }>();
  rafts.forEach((raft, raftIndex) => {
    if (raftIndex === draggingRaftIndex) return; // hide dragged raft from grid
    for (const sq of getOccupiedSquares(raft)) {
      raftMap.set(posKey(sq), { raftIndex });
    }
  });

  const hitSet = new Set(hits.map(posKey));
  const missSet = new Set(misses.map(posKey));
  const displayedGatorKey = displayedGator ? posKey(displayedGator) : null;
  const attackedSet = new Set([...hitSet, ...missSet]);

  const cells: React.ReactNode[] = [];

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const key = posKey({ row, col });
      const raftInfo = raftMap.get(key);
      const isHit = hitSet.has(key);
      const isMiss = missSet.has(key);
      const isGator = key === displayedGatorKey;
      const isAttacked = attackedSet.has(key);
      const isPending = pendingCell != null && row === pendingCell.row && col === pendingCell.col;

      // Determine cell appearance (empty cells stay transparent so SWAMP_BG shows through)
      let bg = "transparent";
      let border = "1px solid rgba(255,255,255,0.08)";
      let content: React.ReactNode = null;
      let cursor = "default";
      let raftSquareBg: React.CSSProperties = {};

      if (isPending) {
        // Attacked but result not yet revealed — neutral pulsing state
        bg = "rgba(255,255,255,0.15)";
      } else if (isHit) {
        content = fireLottie
          ? (
            <div className="h-full w-full origin-bottom animate-[bt-fire-explode_0.35s_ease-out_both]">
              <Lottie animationData={fireLottie} loop autoplay className="h-full w-full" />
            </div>
          )
          : <span className="text-lg">🔥</span>;
      } else if (isMiss) {
        content = rippleLottie
          ? (
            <div className="h-full w-full animate-[bt-ripple-explode_0.35s_ease-out_both]">
              <RippleLottie animationData={rippleLottie} />
            </div>
          )
          : <span className="text-lg">💧</span>;
      } else if (isGator && !tappable) {
        // Show gator only on own board (not attack view)
        bg = "transparent";
        const animClass =
          gatorPhase === "sinking" ? "bt-gator-sink" :
          gatorPhase === "rising" ? "bt-gator-rise" : "";
        content = (
          <div className="relative flex h-full w-full items-center justify-center">
            {/*
              Curved waterline (deeper in center) + feather via feGaussianBlur on mask geometry.
              Fragment url(#) from this inline SVG works in Safari; plain CSS gradient mask did not.
            */}
            <svg
              aria-hidden
              xmlns="http://www.w3.org/2000/svg"
              className="pointer-events-none absolute left-0 top-0 block"
              style={{ width: 0, height: 0, overflow: "visible" }}
            >
              <defs>
                <filter
                  id={gatorWaterBlurId}
                  x="-35%"
                  y="-35%"
                  width="170%"
                  height="170%"
                  filterUnits="objectBoundingBox"
                >
                  <feGaussianBlur in="SourceGraphic" stdDeviation="0.022" />
                </filter>
                <mask
                  id={gatorWaterMaskId}
                  maskUnits="objectBoundingBox"
                  maskContentUnits="objectBoundingBox"
                  x="0"
                  y="0"
                  width="1"
                  height="1"
                >
                  <path
                    d="M 0,0 L 1,0 L 1,0.62 Q 0.5,0.76 0,0.62 Z"
                    fill="white"
                    filter={`url(#${gatorWaterBlurId})`}
                  />
                </mask>
              </defs>
            </svg>
            <div
              className={`flex h-full w-full items-center justify-center${gatorMirrored ? " -scale-x-100" : ""}`}
              style={{
                WebkitMaskImage: `url(#${gatorWaterMaskId})`,
                maskImage: `url(#${gatorWaterMaskId})`,
                WebkitMaskSize: "100% 100%",
                maskSize: "100% 100%",
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
              }}
            >
              <Image
                src={ALLIGATOR_IMG}
                alt=""
                width={64}
                height={64}
                className={`h-[85%] w-[85%] max-h-full object-contain object-center select-none ${animClass}`}
                draggable={false}
              />
            </div>
          </div>
        );
      } else if (raftInfo != null && !tappable) {
        const raft = rafts[raftInfo.raftIndex];
        if (
          raft?.type === "square" ||
          raft?.type === "shorty" ||
          raft?.type === "lshape"
        ) {
          bg = "transparent";
          border = "none";
          raftSquareBg = {
            position: "relative",
            zIndex: 1,
          };
        }
      }

      if (tappable && !isAttacked && !isPending) {
        bg = COLOR_TAPPABLE;
        raftSquareBg = {};
        cursor = tapLocked ? "wait" : "pointer";
      }

      const raft = raftInfo != null ? rafts[raftInfo.raftIndex] : undefined;

      const isSeamlessRaftTile =
        raftInfo != null &&
        !tappable &&
        !isHit &&
        !isMiss &&
        !isPending &&
        (raft?.type === "square" ||
          raft?.type === "lshape" ||
          raft?.type === "shorty");

      const handleTap = (e: React.MouseEvent) => {
        if (tappable && !tapLocked && !isAttacked && onCellTap) {
          onCellTap(row, col, e);
        } else if (onRaftTap && raftInfo != null && !onDragStart) {
          onRaftTap(raftInfo.raftIndex);
        } else if (onCellTap && !tappable) {
          onCellTap(row, col);
        }
      };

      cells.push(
        <button
          key={key}
          type="button"
          data-boaty-r={row}
          data-boaty-c={col}
          onClick={handleTap}
          className="flex min-h-0 min-w-0 items-center justify-center transition-[background-color,background-image] duration-150"
          style={{
            // Explicit placement so L-raft span overlays don’t reshuffle auto-placed cells when rafts move.
            gridRow: row + 1,
            gridColumn: col + 1,
            zIndex: 2,
            backgroundColor: bg,
            ...raftSquareBg,
            ...(isSeamlessRaftTile ? {} : { border, borderRadius: 4 }),
            // Square cells come from equal 1fr rows/cols on aspect-square board — not per-item aspect-ratio
            // (Safari inflates the grid ~10–20px vs Chrome when each button has aspect-ratio:1 + implicit rows).
            cursor,
          }}
        >
          {content}
        </button>,
      );
    }
  }

  // Read drag data for floating element (ref snapshot at render time)
  const dd = dragData.current;

  const raftArtOverlays =
    !tappable &&
    rafts.map((raft, raftIndex) => {
      if (raftIndex === draggingRaftIndex) return null;
      if (raft.type !== "square" && raft.type !== "shorty" && raft.type !== "lshape") {
        return null;
      }

      const { r0, c0, nr, nc } = raftGridSpan(raft);
      const isRaftSelected = raftIndex === selectedRaftIndex;
      const tint = isRaftSelected ? `, ${SELECTED_RAFT_TINT_LAYER}` : "";
      const bgSizeFull = isRaftSelected ? "100% 100%, 100% 100%" : "100% 100%";

      const outerStyle: React.CSSProperties = {
        gridColumn: `${c0 + 1} / span ${nc}`,
        gridRow: `${r0 + 1} / span ${nr}`,
        zIndex: 1,
      };

      if (raft.type === "square") {
        return (
          <div
            key={`raft-art-${raftIndex}`}
            className="pointer-events-none min-h-0 min-w-0 overflow-hidden"
            style={{ ...outerStyle, borderRadius: RAFT_ART_OUTER_RADIUS }}
          >
            <div
              className="h-full w-full"
              style={{
                width: "100%",
                height: "100%",
                backgroundImage: `url(${RAFT_SQUARE_BG})${tint}`,
                backgroundSize: bgSizeFull,
                backgroundPosition: "center, center",
                backgroundRepeat: "no-repeat, no-repeat",
              }}
            />
          </div>
        );
      }

      if (raft.type === "shorty") {
        const wideDomino = nc > nr;
        const dominoTightScale = Math.min(nr, nc) / Math.max(nr, nc);
        return (
          <div
            key={`raft-art-${raftIndex}`}
            className="pointer-events-none relative min-h-0 min-w-0 overflow-visible"
            style={{ ...outerStyle, borderRadius: RAFT_ART_OUTER_RADIUS, position: "relative" }}
          >
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={shortySquareSizerStyle(wideDomino)}
            >
              <div
                className="h-full w-full"
                style={shortyArtStyle(raft.rotation, isRaftSelected, dominoTightScale)}
              />
            </div>
          </div>
        );
      }

      return (
        <div
          key={`raft-art-${raftIndex}`}
          className="pointer-events-none min-h-0 min-w-0 overflow-hidden"
          style={{ ...outerStyle, borderRadius: RAFT_ART_OUTER_RADIUS }}
        >
          <div
            className="h-full w-full"
            style={{
              width: "100%",
              height: "100%",
              transform: `rotate(${raft.rotation}deg)`,
              transformOrigin: "center center",
              clipPath: L_RAFT_CLIP_BASE,
              WebkitClipPath: L_RAFT_CLIP_BASE,
              backgroundImage: `url(${RAFT_L_BG})${tint}`,
              backgroundSize: bgSizeFull,
              backgroundPosition: "center, center",
              backgroundRepeat: "no-repeat, no-repeat",
            }}
          />
        </div>
      );
    });

  return (
    <div
      ref={gridRef}
      className="relative mx-auto grid aspect-square w-full min-w-0 max-w-[500px] gap-1 rounded-xl p-2 touch-none"
      style={{
        gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
        gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)`,
        backgroundImage: `url(${bgUrl})`,
        backgroundSize: "contain",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {/*
        Darken gutters/margins only: Safari does not apply `mask-image: url(#id)` reliably on HTML,
        but masking an SVG <rect> inside the same <svg> as <defs><mask> works consistently.
      */}
      {swampMaskLayout != null && (
        <svg
          aria-hidden
          xmlns="http://www.w3.org/2000/svg"
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]"
          width="100%"
          height="100%"
          viewBox={`0 0 ${swampMaskLayout.bw} ${swampMaskLayout.bh}`}
          preserveAspectRatio="none"
        >
          <defs>
            <mask
              id={swampHoleMaskId}
              maskUnits="userSpaceOnUse"
              maskContentUnits="userSpaceOnUse"
              x={0}
              y={0}
              width={swampMaskLayout.bw}
              height={swampMaskLayout.bh}
            >
              <rect width={swampMaskLayout.bw} height={swampMaskLayout.bh} fill="white" />
              {Array.from({ length: GRID_SIZE }, (_, row) =>
                Array.from({ length: GRID_SIZE }, (_, col) => {
                  const x =
                    swampMaskLayout.padLeft + col * (swampMaskLayout.cw + swampMaskLayout.gapX);
                  const y =
                    swampMaskLayout.padTop + row * (swampMaskLayout.ch + swampMaskLayout.gapY);
                  return (
                    <rect
                      key={`mask-${row}-${col}`}
                      x={x}
                      y={y}
                      width={swampMaskLayout.cw}
                      height={swampMaskLayout.ch}
                      fill="black"
                    />
                  );
                }),
              ).flat()}
            </mask>
          </defs>
          <rect
            x={0}
            y={0}
            width={swampMaskLayout.bw}
            height={swampMaskLayout.bh}
            fill={`rgba(0,0,0,${SWAMP_BG_DARKEN_ALPHA})`}
            mask={`url(#${swampHoleMaskId})`}
          />
        </svg>
      )}
      {raftArtOverlays}
      {cells}

      {/* Floating raft — follows finger freely, snaps into grid on release */}
      {draggingRaftIndex != null && dd && (() => {
        const touch = dd.raftLocalTouch;
        const cs = dd.cellSize;
        const r = dd.rotation;
        const floatSel = selectedRaftIndex === dd.raftIndex;
        const tint = floatSel ? `, ${SELECTED_RAFT_TINT_LAYER}` : "";
        const bgFull = floatSel ? "100% 100%, 100% 100%" : "100% 100%";

        const shell = (child: React.ReactNode) => (
          <div
            ref={floatingRef}
            className="pointer-events-none absolute left-0 top-0 z-50"
            style={{
              transform: `translate(${dd.fingerX}px, ${dd.fingerY}px)`,
              willChange: "transform",
              filter: "drop-shadow(0 6px 16px rgba(0,0,0,0.7))",
            }}
          >
            {child}
          </div>
        );

        if (dd.raftType === "lshape" || dd.raftType === "square") {
          const anchorLeft = -cs / 2 - touch.dc * cs;
          const anchorTop = -cs / 2 - touch.dr * cs;
          const squareOrL: React.CSSProperties = {
            width: "100%",
            height: "100%",
            ...(dd.raftType === "lshape"
              ? { transform: `rotate(${r}deg)`, transformOrigin: "center center" }
              : {}),
            backgroundPosition: "center, center",
            backgroundRepeat: "no-repeat, no-repeat",
            opacity: 0.98,
            backgroundSize: bgFull,
            backgroundImage:
              dd.raftType === "square" ? `url(${RAFT_SQUARE_BG})${tint}` : `url(${RAFT_L_BG})${tint}`,
            ...(dd.raftType === "lshape"
              ? { clipPath: L_RAFT_CLIP_BASE, WebkitClipPath: L_RAFT_CLIP_BASE }
              : {}),
          };
          return shell(
            <div
              className="absolute overflow-hidden"
              style={{
                left: anchorLeft,
                top: anchorTop,
                width: cs * 2,
                height: cs * 2,
                borderRadius: RAFT_ART_OUTER_RADIUS,
              }}
            >
              <div className="h-full w-full" style={squareOrL} />
            </div>,
          );
        }

        const locals = [
          touch,
          ...dd.companions.map((c) => ({ dr: touch.dr + c.dr, dc: touch.dc + c.dc })),
        ];
        const minLdr = Math.min(...locals.map((p) => p.dr));
        const maxLdr = Math.max(...locals.map((p) => p.dr));
        const minLdc = Math.min(...locals.map((p) => p.dc));
        const maxLdc = Math.max(...locals.map((p) => p.dc));
        const fw = (maxLdc - minLdc + 1) * cs;
        const fh = (maxLdr - minLdr + 1) * cs;
        const left = -cs / 2 + (minLdc - touch.dc) * cs;
        const top = -cs / 2 + (minLdr - touch.dr) * cs;

        const wideDomino = fw > fh;
        const dominoTightScale = Math.min(fw, fh) / Math.max(fw, fh);
        return shell(
          <div
            className="absolute overflow-visible"
            style={{
              left,
              top,
              width: fw,
              height: fh,
              borderRadius: RAFT_ART_OUTER_RADIUS,
            }}
          >
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={shortySquareSizerStyle(wideDomino)}
            >
              <div
                className="h-full w-full"
                style={{ ...shortyArtStyle(r, floatSel, dominoTightScale), opacity: 0.98 }}
              />
            </div>
          </div>,
        );
      })()}
    </div>
  );
}
