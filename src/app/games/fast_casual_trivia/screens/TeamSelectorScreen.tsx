"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import type { GameSession } from "@/lib/game-sessions";
import type { JMContent } from "@/lib/content-types";
import {
  GameBgUnderlay,
  GamePrimaryButton,
  pickRandomTeams,
  type TeamIdentity,
  useGameColors,
} from "@/app/games/_gamecore";
import { JMTeamLogoButton } from "@/JMKit/JMTeamLogoButton";
import { JMTeamLogoPicker } from "@/JMKit/JMTeamLogoPicker";
import { FCT_TEAM_COLORS, type FctTeam } from "../fastCasualTriviaTypes";

interface TeamSelectorScreenProps {
  isHost: boolean;
  session: GameSession;
  gameData: JMContent;
  teamCount: number; // 2 | 3 | 4
  onComplete: (teams: FctTeam[]) => Promise<void>;
  onBack: () => Promise<void>;
}

const MIN_PER_TEAM = 1;

export function TeamSelectorScreen({
  isHost,
  session,
  gameData,
  teamCount,
  onComplete,
  onBack,
}: TeamSelectorScreenProps) {
  const colors = useGameColors();
  const bgURL = gameData.splashBgURL;
  const bgDim = gameData.splashBgDim ?? 50;

  // Team color = FCT_TEAM_COLORS by index. Logo = random from team-logo pool.
  const teamColors = useMemo(
    () => FCT_TEAM_COLORS.slice(0, teamCount),
    [teamCount],
  );
  const [identities, setIdentities] = useState<TeamIdentity[]>(() =>
    pickRandomTeams(teamCount),
  );
  const [memberLists, setMemberLists] = useState<string[][]>(() =>
    Array.from({ length: teamCount }, () => []),
  );
  const [submitting, setSubmitting] = useState(false);
  const [logoPickerIdx, setLogoPickerIdx] = useState<number | null>(null);

  const players = session.players;
  const playerMap = useMemo(() => {
    const m = new Map<string, string>();
    players.forEach((p) => m.set(p.uid, p.gamertag));
    return m;
  }, [players]);

  const unassigned = players.filter(
    (p) => !memberLists.some((list) => list.includes(p.uid)),
  );

  // ─── Mutators ─────────────────────────────────────────────

  const assignToTeam = useCallback((uid: string, teamIdx: number) => {
    setMemberLists((prev) =>
      prev.map((list, i) => {
        const without = list.filter((u) => u !== uid);
        return i === teamIdx ? [...without, uid] : without;
      }),
    );
  }, []);

  const removeFromTeams = useCallback((uid: string) => {
    setMemberLists((prev) => prev.map((list) => list.filter((u) => u !== uid)));
  }, []);

  // ─── Drag state (keyboard / mouse / touch) ────────────────

  const [draggedUid, setDraggedUid] = useState<string | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const zoneRefs = useRef<(HTMLDivElement | null)[]>([]);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const dragGhost = useRef<HTMLDivElement | null>(null);

  const getZoneAtPoint = useCallback(
    (x: number, y: number): number | null => {
      for (let i = 0; i < zoneRefs.current.length; i++) {
        const r = zoneRefs.current[i]?.getBoundingClientRect();
        if (r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          return i;
        }
      }
      return null;
    },
    [],
  );

  const cleanupGhost = useCallback(() => {
    if (dragGhost.current) {
      dragGhost.current.remove();
      dragGhost.current = null;
    }
    isDragging.current = false;
    setDraggedUid(null);
    setDragOverIdx(null);
  }, []);

  const handleDragStart = useCallback((uid: string) => setDraggedUid(uid), []);
  const handleDragEnd = useCallback(() => {
    setDraggedUid(null);
    setDragOverIdx(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  }, []);

  const handleDragLeave = useCallback(() => setDragOverIdx(null), []);

  const handleDrop = useCallback(
    (e: React.DragEvent, idx: number) => {
      e.preventDefault();
      if (draggedUid) assignToTeam(draggedUid, idx);
      setDraggedUid(null);
      setDragOverIdx(null);
    },
    [draggedUid, assignToTeam],
  );

  const handleTouchStart = useCallback(
    (uid: string, e: React.TouchEvent) => {
      const touch = e.touches[0]!;
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
      setDraggedUid(uid);

      const ghost = document.createElement("div");
      ghost.textContent = playerMap.get(uid) ?? uid;
      ghost.style.cssText = `
        position: fixed; z-index: 9999; pointer-events: none;
        background: rgba(0,0,0,0.85); color: white; padding: 8px 16px;
        border-radius: 9999px; font-size: 14px; font-weight: 600;
        transform: translate(-50%, -50%);
        left: ${touch.clientX}px; top: ${touch.clientY}px;
        border: 2px solid ${colors.primary};
      `;
      document.body.appendChild(ghost);
      dragGhost.current = ghost;
    },
    [playerMap, colors.primary],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0]!;
      if (!isDragging.current && touchStartPos.current) {
        const dx = touch.clientX - touchStartPos.current.x;
        const dy = touch.clientY - touchStartPos.current.y;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) isDragging.current = true;
      }
      if (dragGhost.current) {
        dragGhost.current.style.left = `${touch.clientX}px`;
        dragGhost.current.style.top = `${touch.clientY}px`;
      }
      setDragOverIdx(getZoneAtPoint(touch.clientX, touch.clientY));
    },
    [getZoneAtPoint],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging.current || !draggedUid) {
        cleanupGhost();
        return;
      }
      const touch = e.changedTouches[0]!;
      const idx = getZoneAtPoint(touch.clientX, touch.clientY);
      if (idx != null) assignToTeam(draggedUid, idx);
      cleanupGhost();
    },
    [draggedUid, getZoneAtPoint, assignToTeam, cleanupGhost],
  );

  // ─── Confirm ──────────────────────────────────────────────

  const canConfirm = memberLists.every((list) => list.length >= MIN_PER_TEAM);

  const handleConfirm = async () => {
    if (!canConfirm || submitting) return;
    setSubmitting(true);
    try {
      const teams: FctTeam[] = memberLists.map((memberPlayerIds, i) => {
        const color = teamColors[i]!;
        const ident = identities[i]!;
        return {
          id: `team-${i}`,
          name: ident.name,
          colorName: color.name,
          colorHex: color.hex,
          logoId: ident.name,
          memberPlayerIds,
        };
      });
      await onComplete(teams);
    } catch {
      setSubmitting(false);
    }
  };

  // ─── Non-host spectator view ──────────────────────────────

  if (!isHost) {
    return (
      <div className="fixed inset-0 z-10 flex items-center justify-center overflow-hidden bg-black">
        <GameBgUnderlay url={bgURL} />
        <div
          className="absolute inset-0"
          style={{ backgroundColor: `rgba(0,0,0,${bgDim / 100})` }}
        />
        <div className="relative z-10 flex flex-col items-center gap-3 text-center text-white">
          <Loader2 size={28} className="animate-spin opacity-60" />
          <p className="text-base font-semibold">Host is forming teams…</p>
        </div>
      </div>
    );
  }

  // ─── Host interactive view ────────────────────────────────

  const gridColsClass =
    teamCount === 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <div className="fixed inset-0 z-10 bg-black">
      <GameBgUnderlay url={bgURL} />
      <div
        className="absolute inset-0"
        style={{ backgroundColor: `rgba(0,0,0,${bgDim / 100})` }}
      />

      <button
        type="button"
        onClick={() => void onBack()}
        aria-label="Back to mode select"
        className="absolute left-3 top-3 z-20 flex h-10 items-center gap-1 rounded-full pl-3 pr-5 text-sm font-semibold transition-colors active:scale-95"
        style={{
          backgroundColor: "rgba(0,0,0,0.5)",
          border: "1px solid rgba(255,255,255,0.20)",
          color: "#fff",
        }}
      >
        <ChevronLeft size={18} strokeWidth={2.5} />
        Back
      </button>

      <div className="absolute inset-0 z-10 overflow-y-auto">
      <div className="relative mx-auto flex min-h-full w-full max-w-lg flex-col px-4 py-8 text-white">
        <header className="text-center">
          <h1 className="text-2xl font-extrabold">Form Teams</h1>
          <p className="mt-1 text-sm text-white/70">
            Drag players into a team. Tap a player inside a team to remove.
          </p>
        </header>

        {/* Team drop zones */}
        <div className={`mt-5 grid gap-3 ${gridColsClass}`}>
          {teamColors.map((color, i) => {
            const ident = identities[i]!;
            const list = memberLists[i]!;
            const active = dragOverIdx === i;
            return (
              <div
                key={`team-${i}`}
                ref={(el) => {
                  zoneRefs.current[i] = el;
                }}
                className="rounded-xl border-2 border-dashed p-3 transition-colors"
                style={{
                  minHeight: "200px",
                  backgroundColor: active
                    ? `${color.hex}33`
                    : `${color.hex}1a`,
                  borderColor: active ? color.hex : `${color.hex}66`,
                }}
                onDragOver={(e) => handleDragOver(e, i)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, i)}
              >
                <JMTeamLogoButton
                  logoUrl={ident.logoUrl}
                  color={color.hex}
                  onPress={() => setLogoPickerIdx(i)}
                />
                <p
                  className="mt-1 text-center text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: color.hex }}
                >
                  {ident.name}
                </p>
                <div className="mt-2 space-y-2">
                  {list.map((uid) => (
                    <button
                      key={uid}
                      onClick={() => removeFromTeams(uid)}
                      className="w-full truncate rounded-full bg-black/40 px-3 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-black/60 active:bg-red-900/50"
                    >
                      {playerMap.get(uid) ?? uid}
                    </button>
                  ))}
                  {list.length === 0 && (
                    <p className="py-4 text-center text-[11px] text-white/40">
                      Drag players here
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Unassigned pool */}
        <div className="mt-5">
          {unassigned.length > 0 && (
            <p className="mb-2 text-center text-xs text-white/50">
              {unassigned.length} unassigned · drag to a team
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            {unassigned.map((p) => (
              <div
                key={p.uid}
                draggable
                onDragStart={() => handleDragStart(p.uid)}
                onDragEnd={handleDragEnd}
                onTouchStart={(e) => handleTouchStart(p.uid, e)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className={`cursor-grab select-none rounded-full bg-white/15 px-5 py-2.5 text-sm font-semibold text-white active:cursor-grabbing hover:bg-white/25 ${
                  draggedUid === p.uid ? "opacity-40" : ""
                }`}
              >
                {p.gamertag}
              </div>
            ))}
          </div>
          {unassigned.length === 0 && (
            <p className="text-center text-xs text-white/30">
              All players assigned
            </p>
          )}
        </div>

        {/* Confirm */}
        <div className="mt-6">
          <GamePrimaryButton onClick={handleConfirm} disabled={!canConfirm || submitting}>
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Saving…
              </span>
            ) : canConfirm ? (
              "Confirm Teams"
            ) : (
              `Need at least ${MIN_PER_TEAM} per team`
            )}
          </GamePrimaryButton>
        </div>
      </div>
      </div>

      {/* Team logo picker modal */}
      {logoPickerIdx != null && (
        <JMTeamLogoPicker
          color={teamColors[logoPickerIdx]!.hex}
          currentName={identities[logoPickerIdx]!.name}
          onSelect={(team) => {
            setIdentities((prev) =>
              prev.map((ident, i) => (i === logoPickerIdx ? team : ident)),
            );
            setLogoPickerIdx(null);
          }}
          onClose={() => setLogoPickerIdx(null)}
        />
      )}
    </div>
  );
}
