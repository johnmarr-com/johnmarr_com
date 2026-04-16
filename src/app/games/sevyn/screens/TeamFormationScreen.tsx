"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import type { GameSession } from "@/lib/game-sessions";
import type { SevynTeam } from "../sevynTypes";
import { GameSectionHeader, GamePrimaryButton } from "@/app/games/_gamecore";
import { SEVYN_COLORS } from "../SevynGame";

interface TeamFormationScreenProps {
  session: GameSession;
  isHost: boolean;
  onTeamsFormed: (teams: Record<SevynTeam, { members: string[] }>) => void;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export default function TeamFormationScreen({
  session,
  isHost,
  onTeamsFormed,
}: TeamFormationScreenProps) {
  const [mode, setMode] = useState<"random" | "pick">("random");
  const [team1, setTeam1] = useState<string[]>([]);
  const [team2, setTeam2] = useState<string[]>([]);
  const [randomized, setRandomized] = useState(false);

  // Drag state
  const [draggedUid, setDraggedUid] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<"s1" | "s2" | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const dragGhost = useRef<HTMLDivElement | null>(null);
  const zone1Ref = useRef<HTMLDivElement>(null);
  const zone2Ref = useRef<HTMLDivElement>(null);

  const players = session.players;
  const playerMap = useMemo(() => {
    const m = new Map<string, string>();
    players.forEach((p) => m.set(p.uid, p.gamertag));
    return m;
  }, [players]);

  // Randomize teams
  const handleRandomize = useCallback(() => {
    const uids = shuffle(players.map((p) => p.uid));
    const half = Math.ceil(uids.length / 2);
    setTeam1(uids.slice(0, half));
    setTeam2(uids.slice(half));
    setRandomized(true);
  }, [players]);

  // Add player to a team
  const addToTeam = useCallback((uid: string, team: "s1" | "s2") => {
    // Remove from both first
    setTeam1((prev) => prev.filter((u) => u !== uid));
    setTeam2((prev) => prev.filter((u) => u !== uid));
    if (team === "s1") setTeam1((prev) => [...prev, uid]);
    else setTeam2((prev) => [...prev, uid]);
  }, []);

  // Remove player from team (tap to drop back)
  const removeFromTeam = useCallback((uid: string) => {
    setTeam1((prev) => prev.filter((u) => u !== uid));
    setTeam2((prev) => prev.filter((u) => u !== uid));
  }, []);

  // ─── Drag helpers ──────────────────────────────────────────

  const getZoneFromPoint = useCallback((x: number, y: number): "s1" | "s2" | null => {
    const r1 = zone1Ref.current?.getBoundingClientRect();
    const r2 = zone2Ref.current?.getBoundingClientRect();
    if (r1 && x >= r1.left && x <= r1.right && y >= r1.top && y <= r1.bottom) return "s1";
    if (r2 && x >= r2.left && x <= r2.right && y >= r2.top && y <= r2.bottom) return "s2";
    return null;
  }, []);

  const cleanupGhost = useCallback(() => {
    if (dragGhost.current) {
      dragGhost.current.remove();
      dragGhost.current = null;
    }
    isDragging.current = false;
    setDraggedUid(null);
    setDragOverZone(null);
  }, []);

  // HTML5 drag (desktop)
  const handleDragStart = useCallback((uid: string) => {
    setDraggedUid(uid);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedUid(null);
    setDragOverZone(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, zone: "s1" | "s2") => {
    e.preventDefault();
    setDragOverZone(zone);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverZone(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, zone: "s1" | "s2") => {
    e.preventDefault();
    if (draggedUid) addToTeam(draggedUid, zone);
    setDraggedUid(null);
    setDragOverZone(null);
  }, [draggedUid, addToTeam]);

  // Touch drag (mobile)
  const handleTouchStart = useCallback((uid: string, e: React.TouchEvent) => {
    const touch = e.touches[0]!;
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    setDraggedUid(uid);

    // Create ghost element
    const ghost = document.createElement("div");
    ghost.textContent = playerMap.get(uid) ?? uid;
    ghost.style.cssText = `
      position: fixed; z-index: 9999; pointer-events: none;
      background: rgba(232,76,30,0.9); color: white; padding: 8px 16px;
      border-radius: 9999px; font-size: 14px; font-weight: 600;
      transform: translate(-50%, -50%);
      left: ${touch.clientX}px; top: ${touch.clientY}px;
    `;
    document.body.appendChild(ghost);
    dragGhost.current = ghost;
  }, [playerMap]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
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
    setDragOverZone(getZoneFromPoint(touch.clientX, touch.clientY));
  }, [getZoneFromPoint]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || !draggedUid) {
      cleanupGhost();
      return;
    }
    const touch = e.changedTouches[0]!;
    const zone = getZoneFromPoint(touch.clientX, touch.clientY);
    if (zone) addToTeam(draggedUid, zone);
    cleanupGhost();
  }, [draggedUid, getZoneFromPoint, addToTeam, cleanupGhost]);

  const canStart = team1.length >= 2 && team2.length >= 2;

  const handleConfirm = useCallback(() => {
    if (!canStart) return;
    onTeamsFormed({
      syndicate1: { members: team1 },
      syndicate2: { members: team2 },
    });
  }, [canStart, team1, team2, onTeamsFormed]);

  if (!isHost) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-4">
        <GameSectionHeader
          eyebrow="SEVYN"
          title="Forming Teams"
          titleColorClass="text-[#E84C1E]"
          eyebrowColorClass="text-[#E84C1E]/70"
        />
        <p className="mt-4 text-sm text-white/40 animate-pulse">
          Host is assigning teams...
        </p>
      </div>
    );
  }

  const unassigned = players.filter(
    (p) => !team1.includes(p.uid) && !team2.includes(p.uid),
  );

  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-16">
      <div className="w-full max-w-lg">
        <GameSectionHeader
          eyebrow="SEVYN"
          title="Form Teams"
          titleColorClass="text-[#E84C1E]"
          eyebrowColorClass="text-[#E84C1E]/70"
        />

        {/* Mode toggle — larger for mobile */}
        <div className="mt-4 flex justify-center gap-3">
          <button
            className={`rounded-full px-6 py-3 text-sm font-bold transition ${
              mode === "random"
                ? "bg-[#E84C1E] text-white"
                : "bg-white/10 text-white/60 hover:bg-white/20"
            }`}
            onClick={() => setMode("random")}
          >
            Random
          </button>
          <button
            className={`rounded-full px-6 py-3 text-sm font-bold transition ${
              mode === "pick"
                ? "bg-[#E84C1E] text-white"
                : "bg-white/10 text-white/60 hover:bg-white/20"
            }`}
            onClick={() => setMode("pick")}
          >
            Pick Teams
          </button>
        </div>

        {mode === "random" && (
          <div className="mt-6">
            <GamePrimaryButton onClick={handleRandomize}>
              {randomized ? "Reshuffle" : "Randomize Teams"}
            </GamePrimaryButton>
          </div>
        )}

        {/* Team drop zones */}
        {(randomized || mode === "pick") && (
          <div className="mt-6 grid grid-cols-2 gap-3">
            {/* Syndicate 1 */}
            <div
              ref={zone1Ref}
              className={`min-h-[200px] rounded-xl border-2 border-dashed p-3 transition-colors ${
                dragOverZone === "s1"
                  ? "border-[#E84C1E] bg-[#E84C1E]/20"
                  : "border-[#E84C1E]/30 bg-[#E84C1E]/10"
              }`}
              onDragOver={(e) => handleDragOver(e, "s1")}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, "s1")}
            >
              <h3
                className="mb-3 text-center text-xs font-bold uppercase tracking-wider"
                style={{ color: SEVYN_COLORS.t1 }}
              >
                Syndicate 1
              </h3>
              <div className="space-y-2">
                {team1.map((uid) => (
                  <div
                    key={uid}
                    className="cursor-pointer rounded-full bg-black/30 px-3 py-2.5 text-center text-sm font-semibold text-white active:bg-red-900/40 hover:bg-black/50"
                    onClick={() => mode === "pick" && removeFromTeam(uid)}
                  >
                    {playerMap.get(uid) ?? uid}
                  </div>
                ))}
                {team1.length === 0 && (
                  <p className="py-6 text-center text-xs text-white/30">
                    {mode === "pick" ? "Drag players here" : "No players"}
                  </p>
                )}
              </div>
            </div>

            {/* Syndicate 2 */}
            <div
              ref={zone2Ref}
              className={`min-h-[200px] rounded-xl border-2 border-dashed p-3 transition-colors ${
                dragOverZone === "s2"
                  ? "border-blue-400 bg-blue-400/20"
                  : "border-blue-400/30 bg-blue-400/10"
              }`}
              onDragOver={(e) => handleDragOver(e, "s2")}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, "s2")}
            >
              <h3
                className="mb-3 text-center text-xs font-bold uppercase tracking-wider"
                style={{ color: SEVYN_COLORS.t2 }}
              >
                Syndicate 2
              </h3>
              <div className="space-y-2">
                {team2.map((uid) => (
                  <div
                    key={uid}
                    className="cursor-pointer rounded-full bg-black/30 px-3 py-2.5 text-center text-sm font-semibold text-white active:bg-red-900/40 hover:bg-black/50"
                    onClick={() => mode === "pick" && removeFromTeam(uid)}
                  >
                    {playerMap.get(uid) ?? uid}
                  </div>
                ))}
                {team2.length === 0 && (
                  <p className="py-6 text-center text-xs text-white/30">
                    {mode === "pick" ? "Drag players here" : "No players"}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Unassigned players (pick mode) — draggable */}
        {mode === "pick" && (
          <div className="mt-5">
            {unassigned.length > 0 && (
              <p className="mb-2 text-center text-xs text-white/40">
                Drag into a syndicate — tap inside to remove
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
                  className={`cursor-grab select-none rounded-full bg-white/15 px-5 py-2.5 text-sm font-semibold text-white active:cursor-grabbing active:bg-[#E84C1E]/40 hover:bg-white/25 ${
                    draggedUid === p.uid ? "opacity-40" : ""
                  }`}
                >
                  {p.gamertag}
                </div>
              ))}
            </div>
            {unassigned.length === 0 && team1.length > 0 && (
              <p className="text-center text-xs text-white/30">
                All players assigned
              </p>
            )}
          </div>
        )}

        {/* Confirm */}
        {(randomized || mode === "pick") && (
          <div className="mt-6">
            <GamePrimaryButton onClick={handleConfirm} disabled={!canStart}>
              {canStart ? "Confirm Teams" : "Need 2+ per team"}
            </GamePrimaryButton>
          </div>
        )}
      </div>
    </div>
  );
}
