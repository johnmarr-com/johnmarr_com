"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { useBlarfSession } from "./useBlarfSession";
import { scoreBlarfRound } from "./blarfTypes";
import type { BlarfRoundScoreResult } from "./blarfTypes";
import { GameGamertagBadge, recordGameStats, useGameColors, useEngineDeadline } from "@/app/games/_gamecore";
import { selectPack, speakerDone } from "./blarfApi";
import { PointsManager, Activity } from "@/lib/points";
import { JMConfettiOverlay, JMSimpleButton } from "@/JMKit";
import { GamePrimaryButton } from "@/app/games/_gamecore";
import type { GameLengthPreset } from "@/app/games/_gamecore/gameLengthPresets";
import { GraduationCap, Zap, Clock, Footprints } from "lucide-react";
import type { BlarfPack } from "@/lib/blarf-packs";
import type { JMContent } from "@/lib/content-types";
import type { GameEndResult } from "@/app/games/_gamecore/registry/types";

import BlarfPackPicker from "./BlarfPackPicker";
import RoundIntroScreen from "./screens/RoundIntroScreen";
import RoleRevealScreen from "./screens/RoleRevealScreen";
import SpeakingPhaseScreen from "./screens/SpeakingPhaseScreen";
import MultiVoteScreen from "./screens/MultiVoteScreen";
import BlarferRevealScreen from "./screens/BlarferRevealScreen";
import WinnerScreen from "./screens/WinnerScreen";

// Timer durations for the progress bars — keep in sync with the blarf reducer.
const BF_SPEAK_MS = 15_000;
const BF_VOTE_MS = 60_000;

const BF_LENGTH_PRESETS: GameLengthPreset[] = [
  { key: "learn", label: "Learn", rounds: 1, estimatedMinutes: 2, icon: GraduationCap, iconColor: "#ffffff" },
  { key: "quick", label: "Quick", rounds: 2, estimatedMinutes: 4, icon: Zap, iconColor: "#F7D047" },
  { key: "standard", label: "Standard", rounds: 4, estimatedMinutes: 8, icon: Clock, iconColor: "#C93C3C" },
  { key: "long", label: "Long", rounds: 6, estimatedMinutes: 12, icon: Footprints, iconColor: "#4BA3C7" },
];

interface BlarfGameProps {
  sessionId: string;
  splashBgURL?: string;
  gameLogoURL?: string;
  splashIconURL?: string;
  gameData?: JMContent;
  onGameEnd?: (result: GameEndResult) => void;
}

export default function BlarfGame({
  sessionId,
  splashBgURL,
  gameLogoURL,
  onGameEnd,
}: BlarfGameProps) {
  const { user } = useAuth();
  const router = useRouter();
  const { tertiary } = useGameColors();
  const userId = user?.uid ?? "";
  const { state } = useBlarfSession(sessionId, userId);
  const [showRoundIntro, setShowRoundIntro] = useState(false);
  const [lastRoundResult, setLastRoundResult] = useState<BlarfRoundScoreResult | null>(null);
  const [pickerLengthKey, setPickerLengthKey] = useState("standard");

  const {
    session,
    bfPhase,
    bfCurrentRound,
    bfTotalRounds,
    bfBlarfers,
    bfVoiceStyle,
    bfRoleConfirmed,
    bfSpeakingOrder,
    bfCurrentSpeaker,
    bfVotes,
    bfVoteDeadline,
    bfScores,
    bfPackCoverURL,
    bfWinners,
    bfWinnerPoints,
    bfReveal,
    myRole,
    isHost,
  } = state;

  const players = useMemo(() => session?.players ?? [], [session?.players]);
  const playerUids = players.map((p) => p.uid);
  const kicked = session?.kickedUids?.includes(userId) ?? false;

  // Server-stamped deadline for the current phase; nudge the engine when it passes.
  const phaseDeadlineAt =
    ((session as unknown as Record<string, unknown>)?.["phaseDeadlineAt"] as number | undefined) ?? 0;
  useEngineDeadline(sessionId, phaseDeadlineAt);

  // ─── Derived ───────────────────────────────────────────────
  const confirmCount = Object.keys(bfRoleConfirmed).length;
  const voteCount = Object.keys(bfVotes).length;
  const expectedVotes = players.length;
  const hasVoted = bfVotes[userId] != null;

  const myWord = myRole?.word ?? "";
  const isBlarfer = myRole?.isBlarfer ?? false;
  const myLetter = myRole?.letter ?? "";
  const hasConfirmed = bfRoleConfirmed[userId] === true;

  // Word map for the results reveal (from the engine-published bfReveal).
  const revealAssignments = useMemo(() => {
    const m: Record<string, string> = {};
    for (const [uid, r] of Object.entries(bfReveal)) m[uid] = r.word;
    return m;
  }, [bfReveal]);

  // ─── Host: pick pack + length AFTER Start (server stores round data secretly) ──
  const handlePackSelected = useCallback(
    async (pack: BlarfPack) => {
      const preset = BF_LENGTH_PRESETS.find((p) => p.key === pickerLengthKey);
      const rounds = preset?.rounds ?? 4;
      const result = await selectPack(
        sessionId,
        { id: pack.id, name: pack.name, coverURL: pack.coverImageURL || null, rounds: pack.rounds },
        rounds,
      );
      if (!result.ok) throw new Error(result.error);
    },
    [sessionId, pickerLengthKey],
  );

  // ─── Player: signal done speaking (engine advances; timer is the backstop) ──
  const handleSpeakerDone = useCallback(async () => {
    const result = await speakerDone(sessionId);
    if (!result.ok) throw new Error(result.error);
  }, [sessionId]);

  // ─── Round intro overlay ───────────────────────────────────
  useEffect(() => {
    if (bfPhase === "round-intro") setShowRoundIntro(true);
  }, [bfPhase]);

  // ─── Results: recompute the round breakdown for display (deterministic from
  //     the now-public bfVotes + bfBlarfers). ──
  useEffect(() => {
    if (bfPhase === "results" && !lastRoundResult) {
      setLastRoundResult(scoreBlarfRound(bfVotes, bfBlarfers, playerUids));
    }
    if (bfPhase !== "results") setLastRoundResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bfPhase]);

  // ─── Delegate to composeGame result screen on finish + gamification ──
  const gameEndFiredRef = useRef(false);
  useEffect(() => {
    if (bfPhase === "final" && bfWinners.length > 0 && onGameEnd && !gameEndFiredRef.current) {
      gameEndFiredRef.current = true;
      const ps = session?.players ?? [];
      onGameEnd({
        winners: ps.filter((p) => bfWinners.includes(p.uid)),
        winnerPoints: bfWinnerPoints,
        allPlayers: ps,
        scores: bfScores,
      });
      PointsManager.award(Activity.PLAY_GAME);
      if (isHost) PointsManager.award(Activity.HOST_GAME);
      if (bfWinners.includes(userId)) PointsManager.award(Activity.WIN_GAME);
      if (isHost) recordGameStats(playerUids, bfWinners, session?.ownerId ?? "");
    }
    if (bfPhase !== "final") gameEndFiredRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once on transition to final
  }, [bfPhase, bfWinners, bfWinnerPoints, bfScores, onGameEnd, session?.players, isHost, userId]);

  // ─── Render ───────────────────────────────────────────────
  if (!session) return null;

  return (
    <div className="fixed inset-0 flex flex-col" style={{ backgroundColor: tertiary }}>
      {splashBgURL && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat brightness-[0.25]"
          style={{ backgroundImage: `url(${splashBgURL})` }}
        />
      )}

      {/* Pack + length: host configures here (after Start); others wait. */}
      {bfPhase === "pack-select" && isHost && (
        <BlarfPackPicker
          onSelect={handlePackSelected}
          lengthPresets={BF_LENGTH_PRESETS}
          selectedLengthKey={pickerLengthKey}
          onLengthChange={(preset) => setPickerLengthKey(preset.key)}
        />
      )}
      {bfPhase === "pack-select" && !isHost && (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">
          <div className="absolute right-6 top-[29px] flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            <p className="text-xs font-bold uppercase tracking-wider text-white/60">Prepping Game</p>
          </div>
          <Image
            src="/images/games/blarf/Blarf-Epic.png"
            alt="BLARF!"
            width={800}
            height={800}
            className="max-h-[85dvh] max-w-[90vw] object-contain"
          />
        </div>
      )}

      {/* Round intro overlay */}
      {showRoundIntro && (
        <RoundIntroScreen
          roundNumber={bfCurrentRound}
          onComplete={() => {}}
          onAnimationDone={() => setShowRoundIntro(false)}
        />
      )}

      {/* Role reveal */}
      {bfPhase === "role-reveal" && (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <RoleRevealScreen
            sessionId={sessionId}
            isBlarfer={isBlarfer}
            word={myWord}
            letter={myLetter}
            voiceStyle={bfVoiceStyle}
            hasConfirmed={hasConfirmed}
            confirmCount={confirmCount}
            totalPlayers={players.length}
          />
        </div>
      )}

      {/* Speaking phase */}
      {bfPhase === "speaking" && (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <SpeakingPhaseScreen
            speakingOrder={bfSpeakingOrder}
            currentSpeakerIndex={bfCurrentSpeaker}
            currentUserId={userId}
            players={players}
            myWord={myWord}
            amIBlarfer={isBlarfer}
            letter={myLetter}
            voiceStyle={bfVoiceStyle}
            deadline={phaseDeadlineAt}
            durationMs={BF_SPEAK_MS}
            onDone={handleSpeakerDone}
          />
        </div>
      )}

      {/* Voting */}
      {bfPhase === "voting" && (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <MultiVoteScreen
            sessionId={sessionId}
            players={players}
            currentUserId={userId}
            playerCount={players.length}
            amIBlarfer={isBlarfer}
            deadline={bfVoteDeadline}
            durationMs={BF_VOTE_MS}
            hasVoted={hasVoted}
            voteCount={voteCount}
            totalVoters={expectedVotes}
            roundNumber={bfCurrentRound}
            totalRounds={bfTotalRounds}
          />
        </div>
      )}

      {/* Results */}
      {bfPhase === "results" && lastRoundResult && (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <BlarferRevealScreen
            players={players}
            blarfers={bfBlarfers}
            assignments={revealAssignments}
            votes={bfVotes}
            roundDeltas={lastRoundResult.deltas}
            voteCounts={lastRoundResult.voteCounts}
            detectedBlarfers={lastRoundResult.detectedBlarfers}
            undetectedBlarfers={lastRoundResult.undetectedBlarfers}
            scores={bfScores}
            roundNumber={bfCurrentRound}
            totalRounds={bfTotalRounds}
          />
        </div>
      )}

      {/* Final winner screen — skipped when composeGame handles result via onGameEnd */}
      {bfPhase === "final" && bfWinners.length > 0 && !onGameEnd && (
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <JMConfettiOverlay loop />
          <WinnerScreen
            winners={players.filter((p) => bfWinners.includes(p.uid))}
            winnerPoints={bfWinnerPoints}
            allPlayers={players}
            scores={bfScores}
            isHost={isHost}
            onPlayAgain={() => {}}
          />
        </div>
      )}

      {/* HUD */}
      <GameGamertagBadge />
      {(bfPhase === "pack-select" || bfPhase === "final") && (
        <Link href="/" className="absolute left-3 top-3 z-60">
          <JMSimpleButton
            title="EXIT"
            size="sm"
            variant="ghost"
            titleColor="#ffffff"
            className="gap-1.5 rounded-lg bg-black/50 backdrop-blur-sm"
          >
            <span className="text-sm leading-none">&#9664;</span> EXIT
          </JMSimpleButton>
        </Link>
      )}
      {bfPackCoverURL && bfPhase !== "pack-select" && bfPhase !== "final" && bfPhase !== "round-intro" && (
        <div className="pointer-events-none absolute left-3 top-2 z-20 animate-[wk-slide-in-tl_0.6s_ease-out_both]">
          <div
            className="h-25 w-25 rounded-xl bg-cover bg-center shadow-lg sm:h-30 sm:w-30"
            style={{ backgroundImage: `url(${bfPackCoverURL})` }}
          />
        </div>
      )}
      {gameLogoURL && bfPhase !== "pack-select" && bfPhase !== "round-intro" && (
        <div className="pointer-events-none absolute right-[12px] top-4.5 z-20 animate-[wk-slide-in-tr_0.6s_ease-out_both]">
          <Image
            src={gameLogoURL}
            alt=""
            width={300}
            height={120}
            className="h-16 w-auto object-contain drop-shadow-lg select-none sm:h-20 animate-[rock_3s_ease-in-out_0.6s_infinite]"
          />
        </div>
      )}

      {/* Kicked overlay */}
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
    </div>
  );
}
