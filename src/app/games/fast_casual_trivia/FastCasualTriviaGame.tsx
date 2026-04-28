"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import type { GC3Props } from "../_gamecore/registry/types";
import { useFastCasualTriviaSession } from "./useFastCasualTriviaSession";
import type { FctMode, FctTeam } from "./fastCasualTriviaTypes";
import { GameModeScreen } from "./screens/GameModeScreen";
import { TeamSelectorScreen } from "./screens/TeamSelectorScreen";
import { TeamLeadsAssignmentScreen } from "./screens/TeamLeadsAssignmentScreen";
import { GameBoardScreen } from "./screens/GameBoardScreen";

/**
 * GC3 component for the Fast Casual Trivia engine. Drives the in-game
 * sub-state machine: mode_select → team_selector | team_leads_assign → board.
 *
 * Phase 1 wires the state transitions and placeholder sub-screens.
 * Subsequent steps replace each sub-screen with its real implementation.
 */
export function FastCasualTriviaGame({ sessionId, gameData }: GC3Props) {
  const { user } = useAuth();
  const userId = user?.uid ?? "";
  const initialSkinId = gameData.slug ?? gameData.id;

  const {
    state,
    setPhase,
    setMode,
    setTeamCount,
    setTeams,
  } = useFastCasualTriviaSession(sessionId, userId, initialSkinId);

  const { session, phase, mode, teamCount, isHost } = state;

  // Initial host-side bootstrap: when the game starts and no FCT phase has
  // been written yet, plant the default mode_select phase + skin so all
  // clients see a consistent starting state.
  useEffect(() => {
    if (!isHost || !session) return;
    const data = session as unknown as Record<string, unknown>;
    if (data["fctPhase"] === undefined) {
      void setPhase("mode_select");
    }
    if (data["fctSkinId"] === undefined) {
      void setSkinIdIfMissing();
    }
    async function setSkinIdIfMissing() {
      // Setter lives on closure; only triggers once per session bootstrap.
      const { updateSessionFields } = await import("@/app/games/_gamecore");
      await updateSessionFields(sessionId, { fctSkinId: initialSkinId });
    }
  }, [isHost, session, setPhase, sessionId, initialSkinId]);

  // While Firestore subscription is loading.
  if (!session) {
    return (
      <div className="fixed inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black text-white/60">
        <Loader2 size={20} className="animate-spin" />
        <p className="text-sm">Loading session…</p>
      </div>
    );
  }

  const handleSelectMode = async (newMode: FctMode, newTeamCount: number) => {
    await setMode(newMode);
    await setTeamCount(newTeamCount);
    if (newMode === "single") {
      await setPhase("board");
      return;
    }
    if (newMode === "full_team") {
      await setPhase("team_selector");
      return;
    }
    if (newMode === "team_leads") {
      await setPhase("team_leads_assign");
      return;
    }
  };

  const handleTeamSetupComplete = async (teams: FctTeam[]) => {
    await setTeams(teams);
    await setPhase("board");
  };

  const handleBackToMode = async () => {
    await setPhase("mode_select");
  };

  // Render by sub-phase.
  switch (phase) {
    case "mode_select":
      return (
        <GameModeScreen
          isHost={isHost}
          gameData={gameData}
          playerCount={session.players.length}
          onSelect={handleSelectMode}
        />
      );
    case "team_selector":
      return (
        <TeamSelectorScreen
          isHost={isHost}
          session={session}
          gameData={gameData}
          teamCount={teamCount}
          onComplete={handleTeamSetupComplete}
          onBack={handleBackToMode}
        />
      );
    case "team_leads_assign":
      return (
        <TeamLeadsAssignmentScreen
          isHost={isHost}
          session={session}
          gameData={gameData}
          onComplete={handleTeamSetupComplete}
          onBack={handleBackToMode}
        />
      );
    case "board":
      return (
        <GameBoardScreen
          session={session}
          gameData={gameData}
          isHost={isHost}
          mode={mode ?? "single"}
          teams={state.teams}
          scores={state.scores}
          onMenuTap={() => {
            // Step 7 wires the GameControlPopup here.
          }}
        />
      );
    default:
      return null;
  }
}
