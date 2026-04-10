"use client";

import { useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { useGameMusic, GameGamertagBadge, GameSectionHeader, GamePrimaryButton, GameStatusMessage } from "../_gamecore";
import { useSketchinessSession, updateSessionFields } from "./useSketchinessSession";
import { buildInitialChains, type ChainEntry } from "./chainEngine";

import { getMission, missionToSecretMessage } from "@/lib/sketchiness-missions";
import type { SketchinessMission } from "@/lib/sketchiness-missions";
import { processAiQueue } from "./aiPlayer";
import SketchinessBriefing from "./SketchinessBriefing";
import SketchinessPlayScreen from "./SketchinessPlayScreen";
import SketchinessMadLibs from "./SketchinessMadLibs";
import SketchinessReveal from "./SketchinessReveal";
import SketchinessScoring from "./SketchinessScoring";
import SketchinessVoting from "./SketchinessVoting";
import SketchinessShare from "./SketchinessShare";

const AI_PLAYER_ID = "ai-silicon";

interface SketchinessGameProps {
  sessionId: string;
  gameSlug: string;
  splashBgURL?: string;
  splashLogoURL?: string;
  backgroundMusicURL?: string;
  backgroundMusicVolume?: number;
  bgMusicLandingOnly?: boolean;
}

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export default function SketchinessGame({
  sessionId,
  gameSlug,
  splashBgURL,
  splashLogoURL,
  backgroundMusicURL,
  backgroundMusicVolume = 0.3,
  bgMusicLandingOnly = false,
}: SketchinessGameProps) {
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
    chainsComplete,
    transmit,
    setPhase,
  } = useSketchinessSession({ sessionId, userId });

  const kicked = session?.kickedUids?.includes(userId) ?? false;

  const setupRef = useRef(false);

  // Host: when lobby phase, determine play order and advance to briefing
  useEffect(() => {
    if (!isHost || !session || session.status !== "playing") return;
    if (skState.skPhase !== "lobby" || setupRef.current) return;
    setupRef.current = true;

    const players = session.players;
    const order = shuffleArray(players.map((p) => p.uid));
    let aiPlayerId: string | null = null;

    if (order.length % 2 !== 0) {
      aiPlayerId = AI_PLAYER_ID;
      order.push(AI_PLAYER_ID); // default to last; host can reorder in briefing
    }

    updateSessionFields(sessionId, {
      skPhase: "briefing",
      playOrder: order,
      aiPlayerId,
      message: null,
      chains: {},
      gameMode: "basic",
      moleId: null,
      eliminatedPlayers: [],
      missionNumber: 0,
      votes: {},
      elementMatches: null,
      scoringResult: null,
    });
  }, [isHost, session, skState.skPhase, sessionId]);

  // Host: auto-transition to madlibs when all chains complete
  useEffect(() => {
    if (!isHost || skState.skPhase !== "active" || !chainsComplete) return;
    setPhase("madlibs");
  }, [isHost, skState.skPhase, chainsComplete, setPhase]);

  // Host: process AI player queue
  const aiProcessingRef = useRef(false);
  useEffect(() => {
    if (!isHost || skState.skPhase !== "active" || !skState.aiPlayerId) return;
    if (aiProcessingRef.current) return;

    aiProcessingRef.current = true;
    processAiQueue(
      skState.aiPlayerId,
      sessionId,
      skState.chains,
      skState.playOrder,
      skState.missionNumber ?? 0,
    ).finally(() => {
      aiProcessingRef.current = false;
    });
  }, [isHost, skState.skPhase, skState.aiPlayerId, skState.chains, skState.playOrder, skState.missionNumber, sessionId]);

  // Host-only: reorder players from briefing drag-and-drop
  const handleReorder = useCallback(
    async (newOrder: string[]) => {
      if (!isHost) return;
      await updateSessionFields(sessionId, { playOrder: newOrder });
    },
    [isHost, sessionId],
  );

  // Host-only: "Begin Mission" from briefing — fetch mission, build chains, go active
  const handleBriefingReady = useCallback(
    async (selectedMission: SketchinessMission | null) => {
      if (!isHost || !selectedMission) return;

      const playerCount = skState.playOrder.length;
      const mission = await getMission(selectedMission.id);
      if (!mission) return;

      const msg = missionToSecretMessage(mission, playerCount);
      const chains = buildInitialChains(msg.elements);

      await updateSessionFields(sessionId, {
        skPhase: "active",
        message: { id: msg.sourceId, template: msg.template, elements: msg.elements },
        chains,
      });
    },
    [isHost, skState.playOrder.length, sessionId],
  );

  // Host-only: advance from madlibs to scoring
  const handleMadLibsProceed = useCallback(() => {
    if (!isHost) return;
    setPhase("scoring");
  }, [isHost, setPhase]);

  // Host-only: advance from reveal to scoring
  const handleRevealProceed = useCallback(() => {
    if (!isHost) return;
    setPhase("scoring");
  }, [isHost, setPhase]);

  // Host-only: advance from scoring to voting or done
  const handleScoringComplete = useCallback(
    async () => {
      if (!isHost) return;
      if (skState.gameMode === "advanced" || skState.gameMode === "expert") {
        await updateSessionFields(sessionId, { skPhase: "voting" });
      } else {
        await updateSessionFields(sessionId, { skPhase: "done" });
      }
    },
    [isHost, skState.gameMode, sessionId],
  );

  // Player action: cast a vote
  const handleVote = useCallback(
    async (targetUid: string) => {
      await updateSessionFields(sessionId, {
        [`votes.${userId}`]: targetUid,
      });
    },
    [sessionId, userId],
  );

  // Host-only: finalize voting phase
  const handleVotingProceed = useCallback(async () => {
    if (!isHost) return;
    await updateSessionFields(sessionId, { skPhase: "done" });
  }, [isHost, sessionId]);

  // Host-only: reset game for another round
  const handlePlayAgain = useCallback(async () => {
    if (!isHost) return;
    setupRef.current = false;
    await updateSessionFields(sessionId, {
      skPhase: "lobby",
      playOrder: [],
      aiPlayerId: null,
      message: null,
      chains: {},
      gameMode: "basic",
      moleId: null,
      eliminatedPlayers: [],
      missionNumber: (skState.missionNumber ?? 0) + 1,
      votes: {},
      elementMatches: null,
      scoringResult: null,
    });
  }, [isHost, sessionId, skState.missionNumber]);

  const handleTransmit = useCallback(
    async (entry: ChainEntry) => {
      await transmit(entry);
    },
    [transmit],
  );

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
        <SketchinessBriefing
          players={session.players}
          playOrder={skState.playOrder}
          aiPlayerId={skState.aiPlayerId}
          onReady={handleBriefingReady}
          onReorder={handleReorder}
          isHost={isHost}
        />
      );
      break;

    case "active":
      phaseContent = (
        <SketchinessPlayScreen
          key={currentTask ? `${currentTask.elementIndex}-${currentTask.stepIndex}` : "waiting"}
          sessionId={sessionId}
          task={currentTask}
          queueLength={queueLength}
          playerDone={playerDone}
          onTransmit={handleTransmit}
          userId={userId}
          round={skState.missionNumber ?? 0}
        />
      );
      break;

    case "madlibs":
      if (!skState.message) break;
      phaseContent = (
        <SketchinessMadLibs
          sessionId={sessionId}
          chains={skState.chains}
          message={skState.message}
          sessionElementMatches={skState.elementMatches}
          onProceed={handleMadLibsProceed}
          isHost={isHost}
        />
      );
      break;

    case "reveal":
      if (!skState.message) break;
      phaseContent = (
        <SketchinessReveal
          players={session.players}
          playOrder={skState.playOrder}
          aiPlayerId={skState.aiPlayerId}
          chains={skState.chains}
          message={skState.message}
          onProceed={handleRevealProceed}
          isHost={isHost}
        />
      );
      break;

    case "scoring":
      if (!skState.message) break;
      phaseContent = (
        <SketchinessScoring
          sessionId={sessionId}
          chains={skState.chains}
          message={skState.message}
          elementMatches={skState.elementMatches}
          sessionScoringResult={skState.scoringResult}
          onComplete={handleScoringComplete}
          isHost={isHost}
        />
      );
      break;

    case "voting":
      phaseContent = (
        <SketchinessVoting
          players={session.players}
          playOrder={skState.playOrder}
          aiPlayerId={skState.aiPlayerId}
          userId={userId}
          moleId={skState.moleId}
          votes={skState.votes}
          onVote={handleVote}
          onProceed={handleVotingProceed}
          isHost={isHost}
        />
      );
      break;

    case "done":
      phaseContent = (
        <div className="fixed inset-0 z-10 flex flex-col items-center justify-center px-6">
          <div className="flex w-full max-w-lg flex-col items-center gap-5">
            <GameSectionHeader
              eyebrow="Mission Complete"
              title="Debrief Over"
              titleColorClass="text-white"
            />
            <p className="text-center text-base text-white/60">
              Thanks for playing, agents. The syndicate lives to spy another day.
            </p>
            <div className="w-full pt-2">
              {isHost ? (
                <GamePrimaryButton onClick={() => setPhase("share")}>
                  View Transmissions
                </GamePrimaryButton>
              ) : (
                <GameStatusMessage message="Waiting for host..." />
              )}
            </div>
          </div>
        </div>
      );
      break;

    case "share":
      phaseContent = (
        <SketchinessShare
          players={session.players}
          playOrder={skState.playOrder}
          aiPlayerId={skState.aiPlayerId}
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
