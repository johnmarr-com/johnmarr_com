"use client";

import { useState, useRef, useCallback } from "react";
import type { Position, RaftDef, RaftType, Rotation } from "../boatyTypes";
import { GRID_SIZE, getOccupiedSquares, posKey } from "../boatyLogic";

// ─── Swamp art ───────────────────────────────────────────────
const SWAMP_BG = "/images/games/boaty/Swamp.jpg";
const RAFT_SQUARE_BG = "/images/games/boaty/Raft-Square.png";
const RAFT_SMALL_BG = "/images/games/boaty/Raft-Small.png";
const RAFT_L_BG = "/images/games/boaty/Raft-L.png";

// ─── Placeholder Colors ──────────────────────────────────────
/** Wash under raft art when selected — second `background-image` layer (under URL). */
const SELECTED_RAFT_TINT = "rgba(250, 215, 60, 0.42)";
const SELECTED_RAFT_TINT_LAYER = `linear-gradient(${SELECTED_RAFT_TINT}, ${SELECTED_RAFT_TINT})`;
const COLOR_GATOR = "#228B22";     // forest green
const COLOR_HIT = "#DC143C";       // crimson red (flames)
const COLOR_MISS = "#4169E1";      // royal blue (ripple)
const COLOR_TAPPABLE = "rgba(255,255,255,0.06)";

// Grid layout constants (must match the JSX: p-2 = 8px, gap-1 = 4px)
const GRID_PADDING = 8;
const GRID_GAP = 4;
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

/** Small raft PNG authored for vertical (rotation 0°); always rotate with game `rotation`. */
function shortyArtStyle(rotation: Rotation, isSelected: boolean): React.CSSProperties {
  const tint = isSelected ? `, ${SELECTED_RAFT_TINT_LAYER}` : "";
  return {
    width: "100%",
    height: "100%",
    transform: `rotate(${rotation}deg)`,
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
  /** Called when a drag starts. companions = relative offsets from touched cell to other raft cells. */
  onDragStart?: (raftIndex: number, companions: { dr: number; dc: number }[], touchToAnchor: { dr: number; dc: number }) => void;
  /** Called on finger release after a drag — the cell the finger was over. */
  onDragDrop?: (touchRow: number, touchCol: number) => void;
  /** Cell currently being attacked — suppress hit/miss rendering until animation completes. */
  pendingCell?: { row: number; col: number } | null;
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
  onDragDrop,
  pendingCell,
}: SwampGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);

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

  // Convert pointer coordinates to grid cell (row, col). Returns null if outside grid.
  const pointerToCell = useCallback((clientX: number, clientY: number): { row: number; col: number } | null => {
    const el = gridRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left - GRID_PADDING;
    const y = clientY - rect.top - GRID_PADDING;
    const cellSize = (rect.width - 2 * GRID_PADDING - (GRID_SIZE - 1) * GRID_GAP) / GRID_SIZE;
    const step = cellSize + GRID_GAP;
    const col = Math.floor(x / step);
    const row = Math.floor(y / step);
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return null;
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
    const cellSize = (rect.width - 2 * GRID_PADDING - (GRID_SIZE - 1) * GRID_GAP) / GRID_SIZE;

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
      return; // floating element appears on next render at initial position
    }

    // Subsequent moves — update floating position directly (no re-render)
    if (floatingRef.current) {
      floatingRef.current.style.transform = `translate(${dd.fingerX}px, ${dd.fingerY}px)`;
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const dd = dragData.current;
    if (!dd) return;
    dragData.current = null;

    if (dd.moved) {
      // Drag completed — resolve the drop cell and notify parent
      const cell = pointerToCell(e.clientX, e.clientY);
      if (cell) onDragDrop?.(cell.row, cell.col);
      setDraggingRaftIndex(null);
    }
    // If !moved it was a tap — the cell button onClick handles it
  }, [onDragDrop, pointerToCell]);

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
  const gatorKey = gator ? posKey(gator) : null;
  const attackedSet = new Set([...hitSet, ...missSet]);

  const cells: React.ReactNode[] = [];

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const key = posKey({ row, col });
      const raftInfo = raftMap.get(key);
      const isHit = hitSet.has(key);
      const isMiss = missSet.has(key);
      const isGator = key === gatorKey;
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
        bg = COLOR_HIT;
        content = <span className="text-lg">🔥</span>;
      } else if (isMiss) {
        bg = COLOR_MISS;
        content = <span className="text-lg">💧</span>;
      } else if (isGator && !tappable) {
        // Show gator only on own board (not attack view)
        bg = COLOR_GATOR;
        content = <span className="text-lg">🐊</span>;
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
        } else if (onRaftTap && raftInfo != null) {
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
          className="flex items-center justify-center transition-[background-color,background-image] duration-150"
          style={{
            // Explicit placement so L-raft span overlays don’t reshuffle auto-placed cells when rafts move.
            gridRow: row + 1,
            gridColumn: col + 1,
            zIndex: 1,
            backgroundColor: bg,
            ...raftSquareBg,
            ...(isSeamlessRaftTile ? {} : { border, borderRadius: 4 }),
            aspectRatio: "1",
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
        zIndex: 0,
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
        return (
          <div
            key={`raft-art-${raftIndex}`}
            className="pointer-events-none min-h-0 min-w-0 overflow-hidden"
            style={{ ...outerStyle, borderRadius: RAFT_ART_OUTER_RADIUS }}
          >
            <div className="h-full w-full" style={shortyArtStyle(raft.rotation, isRaftSelected)} />
          </div>
        );
      }

      return (
        <div
          key={`raft-art-${raftIndex}`}
          className="pointer-events-none min-h-0 min-w-0 overflow-hidden"
          style={outerStyle}
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
      className="relative mx-auto grid w-full max-w-[600px] gap-1 rounded-xl p-2 touch-none"
      style={{
        gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
        backgroundImage: `url(${SWAMP_BG})`,
        backgroundSize: "contain",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
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
                borderRadius: dd.raftType === "square" ? RAFT_ART_OUTER_RADIUS : 0,
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

        return shell(
          <div
            className="absolute overflow-hidden"
            style={{
              left,
              top,
              width: fw,
              height: fh,
              borderRadius: RAFT_ART_OUTER_RADIUS,
            }}
          >
            <div
              className="h-full w-full"
              style={{ ...shortyArtStyle(r, floatSel), opacity: 0.98 }}
            />
          </div>,
        );
      })()}
    </div>
  );
}
