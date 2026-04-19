"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { GameSession } from "@/lib/game-sessions";
import type { FyveTeam } from "../fyveTypes";
import { GameSectionHeader, GamePrimaryButton, pickRandomTeams, type TeamName, type TeamIdentity } from "@/app/games/_gamecore";
import { useAuth } from "@/lib/AuthProvider";
import { JMTeamLogoButton } from "@/JMKit/JMTeamLogoButton";
import { JMTeamLogoPicker } from "@/JMKit/JMTeamLogoPicker";
import { FYVE_COLORS } from "../FyveGame";

interface TeamFormationScreenProps {
  session: GameSession;
  isHost: boolean;
  onTeamsFormed: (teams: Record<FyveTeam, { members: string[] }>, t1Name: string, t2Name: string) => void;
  /** Live draft from Firestore — non-hosts read this */
  draftTeam1?: string[] | null;
  draftTeam2?: string[] | null;
  draftT1Logo?: string | null;
  draftT2Logo?: string | null;
  /** Host writes draft changes to Firestore */
  onDraftChanged?: (draft: { draftTeam1: string[]; draftTeam2: string[]; draftT1Logo: string; draftT2Logo: string }) => void;
}

// ─── Shared team zone UI ───────────────────────────────────

function VsBadge() {
  return (
    <div
      className="pointer-events-none absolute left-1/2 z-10 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border-2 border-white/20 bg-black text-xs font-black text-white"
      style={{ top: "calc((160px + 12px) / 2 - 20px + 12px)" }}
    >
      VS
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────

export default function TeamFormationScreen({
  session,
  isHost,
  onTeamsFormed,
  draftTeam1: externalTeam1,
  draftTeam2: externalTeam2,
  draftT1Logo,
  draftT2Logo,
  onDraftChanged,
}: TeamFormationScreenProps) {
  const { user } = useAuth();
  const myUid = user?.uid ?? "";

  const [team1, setTeam1] = useState<string[]>(externalTeam1 ?? []);
  const [team2, setTeam2] = useState<string[]>(externalTeam2 ?? []);

  // Restore identities from draft logos if returning from boss-select, otherwise pick random
  const [teamIdentities, setTeamIdentities] = useState<[TeamIdentity, TeamIdentity]>(() => {
    if (draftT1Logo && draftT2Logo) {
      const m1 = draftT1Logo.match(/Team-(\w+)\./);
      const m2 = draftT2Logo.match(/Team-(\w+)\./);
      if (m1 && m2) {
        return [
          { name: m1[1] as TeamName, logoUrl: draftT1Logo },
          { name: m2[1] as TeamName, logoUrl: draftT2Logo },
        ];
      }
    }
    const picked = pickRandomTeams(2);
    return [picked[0]!, picked[1]!];
  });
  const t1Identity = teamIdentities[0];
  const t2Identity = teamIdentities[1];

  // Logo picker modal state (host only)
  const [logoPickerTeam, setLogoPickerTeam] = useState<"t1" | "t2" | null>(null);

  // Sync draft to Firestore whenever team1/team2 change (host only)
  const initialSyncDone = useRef(false);
  useEffect(() => {
    if (!isHost || !onDraftChanged) return;
    // Write logo URLs on first render, then on every team change
    onDraftChanged({
      draftTeam1: team1,
      draftTeam2: team2,
      draftT1Logo: t1Identity.logoUrl,
      draftT2Logo: t2Identity.logoUrl,
    });
    initialSyncDone.current = true;
  }, [isHost, team1, team2, t1Identity.logoUrl, t2Identity.logoUrl, onDraftChanged]);

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

  // Add player to a team
  const addToTeam = useCallback((uid: string, team: "s1" | "s2") => {
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

  const handleDragStart = useCallback((uid: string) => { setDraggedUid(uid); }, []);
  const handleDragEnd = useCallback(() => { setDraggedUid(null); setDragOverZone(null); }, []);

  const handleDragOver = useCallback((e: React.DragEvent, zone: "s1" | "s2") => {
    e.preventDefault();
    setDragOverZone(zone);
  }, []);

  const handleDragLeave = useCallback(() => { setDragOverZone(null); }, []);

  const handleDrop = useCallback((e: React.DragEvent, zone: "s1" | "s2") => {
    e.preventDefault();
    if (draggedUid) addToTeam(draggedUid, zone);
    setDraggedUid(null);
    setDragOverZone(null);
  }, [draggedUid, addToTeam]);

  const handleTouchStart = useCallback((uid: string, e: React.TouchEvent) => {
    const touch = e.touches[0]!;
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    setDraggedUid(uid);

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
    onTeamsFormed(
      { syndicate1: { members: team1 }, syndicate2: { members: team2 } },
      t1Identity.name,
      t2Identity.name,
    );
  }, [canStart, team1, team2, t1Identity.name, t2Identity.name, onTeamsFormed]);

  // ─── Non-host: read-only spectator view ───────────────────

  if (!isHost) {
    const viewT1 = externalTeam1 ?? [];
    const viewT2 = externalTeam2 ?? [];
    const logo1 = draftT1Logo ?? t1Identity.logoUrl;
    const logo2 = draftT2Logo ?? t2Identity.logoUrl;

    return (
      <div className="relative flex min-h-dvh flex-col items-center px-4 py-16">
        <div className="pointer-events-none absolute inset-0 bg-black/50" />
        <div className="relative z-10 w-full max-w-lg">
          <GameSectionHeader
            eyebrow="FYVE"
            title="Forming Teams"
            titleColorClass="text-[#E84C1E]"
            eyebrowColorClass="text-[#E84C1E]/70"
          />

          {/* Team zones — read only */}
          <div className="relative mt-6 grid grid-cols-2 gap-3">
            <VsBadge />

            {/* Team 1 */}
            <div className="min-h-[200px] rounded-xl border-2 border-dashed border-[#E84C1E]/30 bg-[#E84C1E]/10 p-3">
              <JMTeamLogoButton logoUrl={logo1} color={FYVE_COLORS.t1} />
              <div className="space-y-3">
                {viewT1.map((uid) => (
                  <div
                    key={uid}
                    className="flex items-center justify-center gap-1.5 truncate rounded-full bg-black/30 px-3 py-3.5 text-base font-semibold text-white"
                  >
                    {uid === myUid && <span className="text-yellow-400">&#9733;</span>}
                    {playerMap.get(uid) ?? uid}
                  </div>
                ))}
              </div>
            </div>

            {/* Team 2 */}
            <div className="min-h-[200px] rounded-xl border-2 border-dashed border-blue-400/30 bg-blue-400/10 p-3">
              <JMTeamLogoButton logoUrl={logo2} color={FYVE_COLORS.t2} />
              <div className="space-y-3">
                {viewT2.map((uid) => (
                  <div
                    key={uid}
                    className="flex items-center justify-center gap-1.5 truncate rounded-full bg-black/30 px-3 py-3.5 text-base font-semibold text-white"
                  >
                    {uid === myUid && <span className="text-yellow-400">&#9733;</span>}
                    {playerMap.get(uid) ?? uid}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-white/40 animate-pulse">
            Host is assigning teams...
          </p>
        </div>
      </div>
    );
  }

  // ─── Host: interactive drag-and-drop view ─────────────────

  const unassigned = players.filter(
    (p) => !team1.includes(p.uid) && !team2.includes(p.uid),
  );

  return (
    <div className="relative flex min-h-dvh flex-col items-center px-4 py-16">
      <div className="pointer-events-none absolute inset-0 bg-black/50" />
      <div className="relative z-10 w-full max-w-lg">
        <GameSectionHeader
          eyebrow="FYVE"
          title="Forming Teams"
          titleColorClass="text-[#E84C1E]"
          eyebrowColorClass="text-[#E84C1E]/70"
        />

        {/* Team drop zones */}
        <div className="relative mt-6 grid grid-cols-2 gap-3">
          <VsBadge />

          {/* Team 1 */}
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
            <JMTeamLogoButton logoUrl={t1Identity.logoUrl} color={FYVE_COLORS.t1} onPress={() => setLogoPickerTeam("t1")} />
            <div className="space-y-3">
              {team1.map((uid) => (
                <div
                  key={uid}
                  className="cursor-pointer truncate rounded-full bg-black/30 px-3 py-3.5 text-center text-base font-semibold text-white active:bg-red-900/40 hover:bg-black/50"
                  onClick={() => removeFromTeam(uid)}
                >
                  {playerMap.get(uid) ?? uid}
                </div>
              ))}
              {team1.length === 0 && (
                <p className="py-6 text-center text-xs text-white/30">
                  Drag players here
                </p>
              )}
            </div>
          </div>

          {/* Team 2 */}
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
            <JMTeamLogoButton logoUrl={t2Identity.logoUrl} color={FYVE_COLORS.t2} onPress={() => setLogoPickerTeam("t2")} />
            <div className="space-y-3">
              {team2.map((uid) => (
                <div
                  key={uid}
                  className="cursor-pointer truncate rounded-full bg-black/30 px-3 py-3.5 text-center text-base font-semibold text-white active:bg-red-900/40 hover:bg-black/50"
                  onClick={() => removeFromTeam(uid)}
                >
                  {playerMap.get(uid) ?? uid}
                </div>
              ))}
              {team2.length === 0 && (
                <p className="py-6 text-center text-xs text-white/30">
                  Drag players here
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Unassigned players — draggable */}
        <div className="mt-5">
          {unassigned.length > 0 && (
            <p className="mb-2 text-center text-xs text-white/40">
              Drag into a team — tap inside to remove
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-3">
            {unassigned.map((p) => (
              <div
                key={p.uid}
                draggable
                onDragStart={() => handleDragStart(p.uid)}
                onDragEnd={handleDragEnd}
                onTouchStart={(e) => handleTouchStart(p.uid, e)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className={`cursor-grab select-none rounded-full bg-white/15 px-6 py-3.5 text-base font-semibold text-white active:cursor-grabbing active:bg-[#E84C1E]/40 hover:bg-white/25 ${
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

        {/* Confirm */}
        <div className="mt-6">
          <GamePrimaryButton onClick={handleConfirm} disabled={!canStart}>
            {canStart ? "Confirm Teams" : "Need 2+ per team"}
          </GamePrimaryButton>
        </div>
      </div>

      {/* Team logo picker modal */}
      {logoPickerTeam && (
        <JMTeamLogoPicker
          color={logoPickerTeam === "t1" ? FYVE_COLORS.t1 : FYVE_COLORS.t2}
          currentName={logoPickerTeam === "t1" ? t1Identity.name : t2Identity.name}
          onSelect={(team) => {
            setTeamIdentities((prev) =>
              logoPickerTeam === "t1" ? [team, prev[1]] : [prev[0], team],
            );
            setLogoPickerTeam(null);
          }}
          onClose={() => setLogoPickerTeam(null)}
        />
      )}
    </div>
  );
}
