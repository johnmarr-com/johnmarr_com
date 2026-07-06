"use client";

import { useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { useGameMusic, GameGamertagBadge, GamePrimaryButton, GameStatusMessage, recordGameStats, useEngineDeadline } from "../_gamecore";
import { PointsManager, Activity } from "@/lib/points";
import { useMegaSketchySession } from "./useMegaSketchySession";
import * as msApi from "./megaSketchyApi";
import { type ChainEntry } from "./chainEngine";

import type { MegaSketchyMission } from "@/lib/megasketchy-missions";
import MegaSketchyBriefing from "./MegaSketchyBriefing";
import MegaSketchyPlayScreen from "./MegaSketchyPlayScreen";
import MegaSketchyMadLibs from "./MegaSketchyMadLibs";
import MegaSketchyReveal from "./MegaSketchyReveal";
import MegaSketchyScoring from "./MegaSketchyScoring";
import MegaSketchyVoting from "./MegaSketchyVoting";
import MegaSketchyShare from "./MegaSketchyShare";

interface MegaSketchyGameProps {
  sessionId: string;
  gameSlug: string;
  splashBgURL?: string;
  splashLogoURL?: string;
  backgroundMusicURL?: string;
  backgroundMusicVolume?: number;
  bgMusicLandingOnly?: boolean;
}

export default function MegaSketchyGame({
  sessionId,
  gameSlug,
  splashBgURL,
  splashLogoURL,
  backgroundMusicURL,
  backgroundMusicVolume = 0.3,
  bgMusicLandingOnly = false,
}: MegaSketchyGameProps) {
  const { user } = useAuth();
  const router = useRouter();
  const userId = user?.uid ?? "";

  const musicURL = bgMusicLandingOnly ? null : (backgroundMusicURL || `/music/${gameSlug}.mp3`);
  useGameMusic({ url: musicURL, volume: backgroundMusicVolume });

  const {
    session,
    skState,
    isHost,
    currentTask,
    queueLength,
    playerDone,
  } = useMegaSketchySession({ sessionId, userId });

  const kicked = session?.kickedUids?.includes(userId) ?? false;

  // Nudge the engine the instant a chain's 60s hourglass expires, so it
  // auto-skips an AFK player without waiting for the scheduled sweep. The
  // engine owns lobby→briefing (shuffle), active→madlibs (auto), and every
  // transition; the LLM judge/scoring run as server effects. No AI players.
  const phaseDeadlineAt =
    ((session as unknown as Record<string, unknown>)?.["phaseDeadlineAt"] as number | undefined) ?? 0;
  useEngineDeadline(sessionId, phaseDeadlineAt);

  // Host: reorder players from briefing drag-and-drop
  const handleReorder = useCallback(
    (newOrder: string[]) => {
      if (!isHost) return;
      void msApi.reorder(sessionId, newOrder);
    },
    [isHost, sessionId],
  );

  // Host: "Begin Mission" — the engine loads the mission + seeds the chains
  const handleBriefingReady = useCallback(
    (selectedMission: MegaSketchyMission | null) => {
      if (!isHost || !selectedMission) return;
      void msApi.beginMission(sessionId, selectedMission.id);
    },
    [isHost, sessionId],
  );

  // Advance the result/display phases (engine decides what's next). Allowed for
  // any player — the scoring screen exposes this to everyone (no host-gate), so
  // the group never waits on the host to reach the transmissions viewer.
  const handleAdvance = useCallback(() => {
    void msApi.advance(sessionId);
  }, [sessionId]);

  // Player: cast a vote (advanced/expert modes).
  const handleVote = useCallback(
    async (targetUid: string): Promise<void> => {
      await msApi.vote(sessionId, targetUid);
    },
    [sessionId],
  );

  // Host: reset for another round (engine re-shuffles → briefing).
  const handlePlayAgain = useCallback(() => {
    if (!isHost) return;
    void msApi.playAgain(sessionId);
  }, [isHost, sessionId]);

  // Player: submit the current task's sketch URL / text guess.
  const handleTransmit = useCallback(
    async (entry: ChainEntry) => {
      if (!currentTask) return;
      await msApi.transmit(sessionId, currentTask.elementIndex, entry.value);
    },
    [sessionId, currentTask],
  );

  // Game-over → award points + record stats (once, when the viewer opens).
  const gameEndFiredRef = useRef(false);
  useEffect(() => {
    if (skState.skPhase === "share" && !gameEndFiredRef.current) {
      gameEndFiredRef.current = true;
      const passed = skState.scoringResult?.passed ?? false;
      PointsManager.award(Activity.PLAY_GAME, { sessionId });
      if (passed) PointsManager.award(Activity.WIN_GAME, { sessionId });
      if (isHost) {
        PointsManager.award(Activity.HOST_GAME, { sessionId });
        const allUids = session?.playerUids ?? [];
        recordGameStats(allUids, passed ? allUids : [], session?.ownerId ?? "");
      }
    }
    if (skState.skPhase !== "share") gameEndFiredRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once at share
  }, [skState.skPhase, skState.scoringResult, isHost]);

  // Loading state
  if (!session || !userId) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white/30" />
      </div>
    );
  }

  // Phase content
  let phaseContent: React.ReactNode = null;

  switch (skState.skPhase) {
    case "lobby":
      phaseContent = (
        <div className="fixed inset-0 flex items-center justify-center bg-black">
          <div className="flex flex-col items-center gap-6">
            {splashLogoURL && (
              <div className="w-[240px] animate-gentle-float">
                <Image
                  src={splashLogoURL}
                  alt=""
                  width={480}
                  height={240}
                  className="h-auto w-full object-contain"
                  priority
                />
              </div>
            )}
            <GameStatusMessage message="Assembling the spy network..." type="loading" />
          </div>
        </div>
      );
      break;

    case "briefing":
      phaseContent = (
        <MegaSketchyBriefing
          players={session.players}
          playOrder={skState.playOrder}
          onReady={handleBriefingReady}
          onReorder={handleReorder}
          isHost={isHost}
        />
      );
      break;

    case "active":
      phaseContent = (
        <MegaSketchyPlayScreen
          key={currentTask ? `${currentTask.elementIndex}-${currentTask.stepIndex}` : "waiting"}
          sessionId={sessionId}
          task={currentTask}
          queueLength={queueLength}
          playerDone={playerDone}
          onTransmit={handleTransmit}
          userId={userId}
          round={skState.missionNumber ?? 0}
          deadlineAt={currentTask ? (skState.chainDeadlines[String(currentTask.elementIndex)] ?? 0) : 0}
        />
      );
      break;

    case "madlibs":
      if (!skState.message) break;
      phaseContent = (
        <MegaSketchyMadLibs
          chains={skState.chains}
          message={skState.message}
          sessionElementMatches={skState.elementMatches}
          onProceed={handleAdvance}
          isHost={isHost}
        />
      );
      break;

    case "reveal":
      if (!skState.message) break;
      phaseContent = (
        <MegaSketchyReveal
          players={session.players}
          playOrder={skState.playOrder}
          chains={skState.chains}
          message={skState.message}
          onProceed={handleAdvance}
          isHost={isHost}
        />
      );
      break;

    case "scoring":
      if (!skState.message) break;
      phaseContent = (
        <MegaSketchyScoring
          elementMatches={skState.elementMatches}
          sessionScoringResult={skState.scoringResult}
          onComplete={handleAdvance}
        />
      );
      break;

    case "voting":
      phaseContent = (
        <MegaSketchyVoting
          players={session.players}
          playOrder={skState.playOrder}
          userId={userId}
          moleId={skState.moleId}
          votes={skState.votes}
          onVote={handleVote}
          onProceed={handleAdvance}
          isHost={isHost}
        />
      );
      break;

    case "share":
      phaseContent = (
        <MegaSketchyShare
          players={session.players}
          playOrder={skState.playOrder}
          chains={skState.chains}
          userId={userId}
          isHost={isHost}
          onPlayAgain={handlePlayAgain}
        />
      );
      break;
  }

  const showGameBg =
    skState.skPhase === "active" ||
    skState.skPhase === "madlibs" ||
    skState.skPhase === "reveal" ||
    skState.skPhase === "scoring" ||
    skState.skPhase === "voting" ||
    skState.skPhase === "done" ||
    skState.skPhase === "share";

  return (
    <>
      {showGameBg && splashBgURL && (
        <div className="fixed inset-0 z-0">
          <Image
            src={splashBgURL}
            alt=""
            fill
            sizes="100vw"
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/80" />
        </div>
      )}
      <GameGamertagBadge />
      {phaseContent}
      {kicked && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
          <div className="flex w-full max-w-sm flex-col items-center gap-6 px-6">
            <p className="text-center text-xl font-bold text-white">
              You have been uninvited to the game.
            </p>
            <GamePrimaryButton onClick={() => router.push("/")} variant="white">
              Okay
            </GamePrimaryButton>
          </div>
        </div>
      )}
    </>
  );
}
