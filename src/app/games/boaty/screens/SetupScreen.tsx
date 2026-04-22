"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useGameColors } from "@/app/games/_gamecore";
import type { RaftDef, Position } from "../boatyTypes";
import {
  randomPlacement,
  randomGatorPosition,
  moveGator,
  buildOccupiedSet,
  isInBounds,
  isValidPlacement,
  tryRotate,
  posKey,
  SQUARE_FIXED_ROTATION,
} from "../boatyLogic";
import SwampGrid from "../components/SwampGrid";
import SwampSignFrame from "../components/SwampSignFrame";
import { RotateCw } from "lucide-react";

interface SetupScreenProps {
  hasSubmitted: boolean;
  readyCount: number;
  totalPlayers: number;
  onDone: (rafts: RaftDef[], gator: Position) => void;
}

export default function SetupScreen({
  hasSubmitted,
  readyCount,
  totalPlayers,
  onDone,
}: SetupScreenProps) {
  const [rafts, setRafts] = useState<RaftDef[]>(() =>
    randomPlacement().map((r) =>
      r.type === "square" ? { ...r, rotation: SQUARE_FIXED_ROTATION } : r,
    ),
  );
  const [gator, setGator] = useState<Position>(() => randomGatorPosition(rafts));
  const [selectedRaft, setSelectedRaft] = useState<number | null>(null);
  const { primary } = useGameColors();
  const gatorRef = useRef(gator);
  const raftsRef = useRef(rafts);

  // Keep refs in sync for gator timer
  useEffect(() => { gatorRef.current = gator; }, [gator]);
  useEffect(() => { raftsRef.current = rafts; }, [rafts]);

  // Gator autonomous movement during setup (~1.5s interval)
  // If a drag-drop trapped the gator on a raft, it escapes to any free cell first.
  useEffect(() => {
    if (hasSubmitted) return;
    const id = setInterval(() => {
      setGator((prev) => {
        const currentRafts = raftsRef.current;
        const occupied = buildOccupiedSet(currentRafts);
        // Trapped on a raft? Jump to any free cell
        if (occupied.has(posKey(prev))) {
          const free = randomGatorPosition(currentRafts);
          gatorRef.current = free;
          return free;
        }
        const next = moveGator(prev, currentRafts);
        gatorRef.current = next;
        return next;
      });
    }, 1500);
    return () => clearInterval(id);
  }, [hasSubmitted]);

  // ─── Drag state ──────────────────────────────────────────────
  // Companions: relative offsets from the touched cell to each other cell in the raft.
  // TouchToAnchor: offset from touched cell back to the raft anchor for state updates.
  const dragCompanionsRef = useRef<{ dr: number; dc: number }[]>([]);
  const dragTouchToAnchorRef = useRef<{ dr: number; dc: number }>({ dr: 0, dc: 0 });

  // Handle cell tap: move selected raft to tapped position
  const handleCellTap = useCallback(
    (row: number, col: number) => {
      if (hasSubmitted || selectedRaft == null) return;

      const raft = rafts[selectedRaft];
      if (!raft) return;
      const candidate: RaftDef = { ...raft, anchor: { row, col } };
      const otherOccupied = buildOccupiedSet(rafts, selectedRaft);

      if (isValidPlacement(candidate, otherOccupied)) {
        const next = [...rafts];
        next[selectedRaft] =
          candidate.type === "square"
            ? { ...candidate, rotation: SQUARE_FIXED_ROTATION }
            : candidate;
        setRafts(next);

        // If gator is now under the raft, teleport to any free cell
        const newOccupied = buildOccupiedSet(next);
        if (newOccupied.has(posKey(gator))) {
          setGator(randomGatorPosition(next));
        }
      }
    },
    [rafts, selectedRaft, hasSubmitted, gator],
  );

  // Handle raft tap: select it
  const handleRaftTap = useCallback(
    (raftIndex: number) => {
      if (hasSubmitted) return;
      setSelectedRaft((prev) => (prev === raftIndex ? null : raftIndex));
    },
    [hasSubmitted],
  );

  // ─── Drag handlers ──────────────────────────────────────────
  const handleDragStart = useCallback(
    (_raftIndex: number, companions: { dr: number; dc: number }[], touchToAnchor: { dr: number; dc: number }) => {
      if (hasSubmitted) return;
      dragCompanionsRef.current = companions;
      dragTouchToAnchorRef.current = touchToAnchor;
    },
    [hasSubmitted],
  );

  /** Select raft only once the finger actually moves (drag); taps use `onRaftTap` on pointer up so same-raft tap can deselect. */
  const handleDragRaftLift = useCallback(
    (raftIndex: number) => {
      if (hasSubmitted) return;
      setSelectedRaft(raftIndex);
    },
    [hasSubmitted],
  );

  // Called on finger release — validate the drop cell + companion directions, snap if clear
  const handleDragDrop = useCallback(
    (touchRow: number, touchCol: number) => {
      if (selectedRaft == null) return;
      const raft = rafts[selectedRaft];
      if (!raft) return;

      // Build all cells: the finger cell + each companion direction
      const companions = dragCompanionsRef.current;
      const allCells = [
        { row: touchRow, col: touchCol },
        ...companions.map((c) => ({ row: touchRow + c.dr, col: touchCol + c.dc })),
      ];

      // Every cell must be in bounds
      if (!allCells.every(isInBounds)) return;

      // Every cell must be clear of other rafts (ignore the dragged raft entirely)
      const otherOccupied = buildOccupiedSet(rafts, selectedRaft);
      if (allCells.some((c) => otherOccupied.has(posKey(c)))) return;

      // Valid — reconstruct anchor from the touch offset and snap into place
      const ta = dragTouchToAnchorRef.current;
      const newAnchor = { row: touchRow + ta.dr, col: touchCol + ta.dc };
      const next = [...rafts];
      next[selectedRaft] = {
        ...raft,
        anchor: newAnchor,
        rotation: raft.type === "square" ? SQUARE_FIXED_ROTATION : raft.rotation,
      };
      setRafts(next);

      // If gator is now under a raft, teleport to any free cell
      const newOccupied = buildOccupiedSet(next);
      if (newOccupied.has(posKey(gator))) {
        setGator(randomGatorPosition(next));
      }
    },
    [rafts, selectedRaft, gator],
  );

  // Rotate selected raft
  const handleRotate = useCallback(() => {
    if (selectedRaft == null || hasSubmitted) return;
    const raft = rafts[selectedRaft];
    if (!raft || raft.type === "square") return; // No rotation needed

    const otherOccupied = buildOccupiedSet(rafts, selectedRaft);
    const rotated = tryRotate(raft, otherOccupied);
    if (rotated) {
      const next = [...rafts];
      next[selectedRaft] = rotated;
      setRafts(next);

      // If gator is now under the raft, teleport to any free cell
      const newOccupied = buildOccupiedSet(next);
      if (newOccupied.has(posKey(gator))) {
        setGator(randomGatorPosition(next));
      }
    }
  }, [rafts, selectedRaft, hasSubmitted, gator]);

  const handleDone = () => {
    if (hasSubmitted) return;
    setSelectedRaft(null);
    onDone(rafts, gator);
  };

  const hasSelection = selectedRaft != null;
  const rotateDisabled = !hasSelection
    || rafts[selectedRaft]?.type === "square"
    || !tryRotate(rafts[selectedRaft]!, buildOccupiedSet(rafts, selectedRaft));

  if (hasSubmitted) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center gap-4 px-4 py-6">
        <div className="flex min-h-0 w-full flex-1 flex-col items-center overflow-visible">
          <div aria-hidden className="min-h-0 w-full flex-[1.7] basis-0 shrink-0" />
          <div className="w-full max-w-[500px] shrink-0">
            <SwampSignFrame variant="my">
              <SwampGrid rafts={rafts} gator={gator} />
            </SwampSignFrame>
          </div>
          <div aria-hidden className="min-h-0 w-full flex-[0.3] basis-0 shrink-0" />
        </div>
        <div className="flex shrink-0 flex-col items-center gap-3 py-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          <p className="text-center text-sm font-bold uppercase tracking-wider text-white">
            Waiting for opponent&hellip; ({readyCount}/{totalPlayers})
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-4 px-4 py-6">
      <div className="flex min-h-0 w-full flex-1 flex-col items-center overflow-visible">
        <div aria-hidden className="min-h-0 w-full flex-[1.7] basis-0 shrink-0" />
        <div className="relative z-10 flex w-full max-w-[500px] shrink-0 flex-col items-center">
          <SwampSignFrame variant="my">
            <SwampGrid
              rafts={rafts}
              selectedRaftIndex={selectedRaft}
              gator={gator}
              onCellTap={handleCellTap}
              onRaftTap={handleRaftTap}
              onDragStart={handleDragStart}
              onDragRaftLift={handleDragRaftLift}
              onDragDrop={handleDragDrop}
            />
          </SwampSignFrame>
        </div>
        <div aria-hidden className="min-h-0 w-full flex-[0.3] basis-0 shrink-0" />
      </div>

      <div className="relative z-20 flex w-full max-w-[500px] shrink-0 flex-col items-center gap-3">
        <p className="max-w-[500px] -translate-y-[15px] animate-[wk-fade-up_0.4s_ease-out_both] px-2 text-center text-sm font-bold uppercase tracking-wider text-white/70">
          Drag and rotate your rafts to prep for battle
        </p>

        <div className="grid w-full grid-cols-4 gap-3">
          <div className="col-span-1 flex min-h-13 items-stretch">
            {hasSelection && (
              <button
                type="button"
                onClick={handleRotate}
                disabled={rotateDisabled}
                className={`flex w-full items-center justify-center gap-1 rounded-xl px-2 py-3 text-xs font-bold uppercase tracking-wider transition-all sm:gap-2 sm:px-3 sm:text-sm ${
                  rotateDisabled
                    ? "bg-white/5 text-white/25"
                    : "bg-white/15 text-white hover:bg-white/25 active:scale-95"
                }`}
              >
                <RotateCw className="size-4 shrink-0 sm:size-[18px]" />
                <span className="truncate">Rotate</span>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleDone}
            className="col-span-3 rounded-xl py-4 text-lg font-black uppercase tracking-wider text-black transition-all hover:scale-[1.02] active:scale-95"
            style={{ backgroundColor: primary, boxShadow: `0 10px 15px -3px ${primary}40` }}
          >
            Ready
          </button>
        </div>
      </div>
    </div>
  );
}
