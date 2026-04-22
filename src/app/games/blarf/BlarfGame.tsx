"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { useBlarfSession } from "./useBlarfSession";
import {
  initScores,
  selectRounds,
  getCurrentRound,
  assignRoles,
  shuffleArray,
  scoreBlarfRound,
  applyScoreDeltas,
  determineWinners,
} from "./blarfTypes";
import type { BlarfRoundScoreResult } from "./blarfTypes";
import { GameGamertagBadge, recordGameStats } from "@/app/games/_gamecore";
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

const VOTE_TIMER_MS = 0; // timers disabled for dev

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
  /** When provided (via composeGame), the game calls this instead of rendering its own WinnerScreen. */
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
  const userId = user?.uid ?? "";
  const { state, updateFields } = useBlarfSession(sessionId, userId);
  const [showRoundIntro, setShowRoundIntro] = useState(false);
  const [lastRoundResult, setLastRoundResult] = useState<BlarfRoundScoreResult | null>(null);
  const [pickerLengthKey, setPickerLengthKey] = useState("standard");

  const {
    session,
    bfPhase,
    bfRounds,
    bfCurrentRound,
    bfTotalRounds,
    bfBlarfers,
    bfAssignments,
    bfBlarferLetter,
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
    bfLobbyPackId,
    bfLobbyRounds,
    bfRevealed,
    isHost,
  } = state;

  const players = session?.players ?? [];
  const playerUids = players.map((p) => p.uid);
  const kicked = session?.kickedUids?.includes(userId) ?? false;
  const roundData = getCurrentRound(bfRounds, bfCurrentRound);

  // ─── Derived values ────────────────────────────────────────

  const confirmCount = Object.keys(bfRoleConfirmed).length;
  const allConfirmed = confirmCount >= players.length && players.length > 0;

  const voteCount = Object.keys(bfVotes).length;
  const expectedVotes = players.length;
  const allVotesIn = voteCount >= expectedVotes && expectedVotes > 0;
  const hasVoted = bfVotes[userId] != null;

  const myWord = bfAssignments[userId] ?? "";
  const isBlarfer = bfBlarfers.includes(userId);
  const hasConfirmed = bfRoleConfirmed[userId] === true;

  const isLastSpeaker = bfCurrentSpeaker >= bfSpeakingOrder.length - 1;

  // Sync pickerLengthKey from lobby rounds
  useEffect(() => {
    if (bfLobbyRounds != null) {
      const match = BF_LENGTH_PRESETS.find((p) => p.rounds === bfLobbyRounds);
      if (match) setPickerLengthKey(match.key);
    }
  }, [bfLobbyRounds]);

  // ─── Host: Auto-apply lobby pack ──────────────────────────

  const [lobbyAutoApplyFailed, setLobbyAutoApplyFailed] = useState(false);

  useEffect(() => {
    if (bfPhase !== "pack-select") {
      setLobbyAutoApplyFailed(false);
      return;
    }
    if (!bfLobbyPackId || !isHost || lobbyAutoApplyFailed) return;

    let cancelled = false;
    (async () => {
      const { getBlarfPack } = await import("@/lib/blarf-packs");
      const pack = await getBlarfPack(bfLobbyPackId);
      if (cancelled) return;
      if (!pack?.rounds.length) {
        setLobbyAutoApplyFailed(true);
        return;
      }
      await handlePackSelected(pack);
    })().catch(() => {
      if (!cancelled) setLobbyAutoApplyFailed(true);
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, bfPhase, bfLobbyPackId, lobbyAutoApplyFailed]);

  // ─── Host: Pack selected ──────────────────────────────────

  const handlePackSelected = useCallback(
    async (pack: BlarfPack) => {
      const preset = BF_LENGTH_PRESETS.find((p) => p.key === pickerLengthKey);
      const lobbyOrPresetRounds = bfLobbyRounds ?? preset?.rounds ?? 4;
      const count = Math.min(lobbyOrPresetRounds, pack.rounds.length);
      const rounds = selectRounds(pack.rounds, count);
      const scores = initScores(playerUids);
      const { deleteField } = await import("firebase/firestore");
      await updateFields({
        bfPackId: pack.id,
        bfPackName: pack.name,
        bfPackCoverURL: pack.coverImageURL || null,
        bfRounds: rounds,
        bfCurrentRound: 1,
        bfTotalRounds: count,
        bfBlarfers: [],
        bfAssignments: {},
        bfBlarferLetter: "",
        bfVoiceStyle: null,
        bfRoleConfirmed: {},
        bfSpeakingOrder: [],
        bfCurrentSpeaker: 0,
        bfVotes: {},
        bfVoteDeadline: 0,
        bfScores: scores,
        bfRoundDeltas: {},
        bfVoteCounts: {},
        bfWinners: [],
        bfWinnerPoints: 0,
        bfPhase: "round-intro",
        bfLobbyPackId: deleteField(),
        bfLobbyPackName: deleteField(),
        bfLobbyPackCoverURL: deleteField(),
        bfLobbyRounds: deleteField(),
      });
    },
    [playerUids, bfLobbyRounds, pickerLengthKey, updateFields],
  );

  // ─── Round intro lifecycle ────────────────────────────────

  const roundIntroFiredRef = useRef(false);

  useEffect(() => {
    if (bfPhase === "round-intro") {
      setShowRoundIntro(true);
      roundIntroFiredRef.current = false;
    }
  }, [bfPhase]);

  const handleRoundIntroComplete = useCallback(async () => {
    if (!isHost || !roundData || roundIntroFiredRef.current) return;
    roundIntroFiredRef.current = true;
    const { blarfers, assignments, blarferLetter } = assignRoles(playerUids, roundData);
    await updateFields({
      bfBlarfers: blarfers,
      bfAssignments: assignments,
      bfBlarferLetter: blarferLetter,
      bfVoiceStyle: roundData.voiceStyle ?? null,
      bfRoleConfirmed: {},
      bfPhase: "role-reveal",
    });
  }, [isHost, roundData, playerUids, updateFields]);

  // ─── Host: All roles confirmed → speaking ─────────────────

  useEffect(() => {
    if (!isHost || bfPhase !== "role-reveal") return;
    if (!allConfirmed) return;
    void advanceToSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, bfPhase, allConfirmed]);

  const advanceToSpeaking = useCallback(async () => {
    if (!isHost) return;
    const order = shuffleArray(playerUids);
    await updateFields({
      bfSpeakingOrder: order,
      bfCurrentSpeaker: 0,
      bfPhase: "speaking",
    });
  }, [isHost, playerUids, updateFields]);

  // ─── Host: Advance speaker ────────────────────────────────

  const advanceSpeaker = useCallback(async () => {
    if (!isHost) return;
    if (isLastSpeaker) {
      await updateFields({
        bfVotes: {},
        bfVoteDeadline: VOTE_TIMER_MS > 0 ? Date.now() + VOTE_TIMER_MS : 0,
        bfPhase: "voting",
      });
    } else {
      await updateFields({
        bfCurrentSpeaker: bfCurrentSpeaker + 1,
      });
    }
  }, [isHost, isLastSpeaker, bfCurrentSpeaker, updateFields]);

  // ─── Host: All votes in or timer → score round ────────────

  useEffect(() => {
    if (!isHost || bfPhase !== "voting") return;
    if (allVotesIn) {
      void advanceToResults();
      return;
    }
    if (bfVoteDeadline <= 0) return;
    const ms = Math.max(0, bfVoteDeadline - Date.now());
    const timer = setTimeout(() => { void advanceToResults(); }, ms);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, bfPhase, allVotesIn, bfVoteDeadline]);

  const advanceToResults = useCallback(async () => {
    if (!isHost) return;
    const result = scoreBlarfRound(bfVotes, bfBlarfers, playerUids);
    const newScores = applyScoreDeltas(bfScores, result.deltas);
    setLastRoundResult(result);
    await updateFields({
      bfScores: newScores,
      bfRoundDeltas: result.deltas,
      bfVoteCounts: result.voteCounts,
      bfRevealed: false,
      bfPhase: "results",
    });
  }, [isHost, bfVotes, bfBlarfers, playerUids, bfScores, updateFields]);

  // ─── Host: Continue from results ──────────────────────────

  const advanceFromResults = useCallback(async () => {
    if (!isHost) return;
    if (bfCurrentRound < bfTotalRounds) {
      await updateFields({
        bfCurrentRound: bfCurrentRound + 1,
        bfBlarfers: [],
        bfAssignments: {},
        bfBlarferLetter: "",
        bfVoiceStyle: null,
        bfRoleConfirmed: {},
        bfSpeakingOrder: [],
        bfCurrentSpeaker: 0,
        bfVotes: {},
        bfVoteDeadline: 0,
        bfRoundDeltas: {},
        bfVoteCounts: {},
        bfPhase: "round-intro",
      });
      setLastRoundResult(null);
      return;
    }

    const { winners, points } = determineWinners(bfScores);
    await updateFields({
      bfWinners: winners,
      bfWinnerPoints: points,
      bfPhase: "final",
    });
    PointsManager.award(Activity.PLAY_GAME);
    if (isHost) PointsManager.award(Activity.HOST_GAME);
    if (winners.includes(userId)) PointsManager.award(Activity.WIN_GAME);
    recordGameStats(playerUids, winners, session?.ownerId ?? "");
  }, [
    isHost,
    userId,
    bfCurrentRound,
    bfTotalRounds,
    bfScores,
    playerUids,
    session?.ownerId,
    updateFields,
  ]);

  // ─── Play Again ───────────────────────────────────────────

  const handlePlayAgain = useCallback(async () => {
    await updateFields({
      bfPhase: "pack-select",
      bfPackId: null,
      bfPackName: null,
      bfPackCoverURL: null,
      bfRounds: [],
      bfCurrentRound: 1,
      bfTotalRounds: 1,
      bfBlarfers: [],
      bfAssignments: {},
      bfBlarferLetter: "",
      bfVoiceStyle: null,
      bfRoleConfirmed: {},
      bfSpeakingOrder: [],
      bfCurrentSpeaker: 0,
      bfVotes: {},
      bfVoteDeadline: 0,
      bfScores: {},
      bfRoundDeltas: {},
      bfVoteCounts: {},
      bfWinners: [],
      bfWinnerPoints: 0,
      bfRevealed: false,
      bfLobbyRounds: null,
    });
  }, [updateFields]);

  // ─── Delegate to composeGame result screen when available ──
  const gameEndFiredRef = useRef(false);
  useEffect(() => {
    if (bfPhase === "final" && bfWinners.length > 0 && onGameEnd && !gameEndFiredRef.current) {
      gameEndFiredRef.current = true;
      const players = session?.players ?? [];
      onGameEnd({
        winners: players.filter((p) => bfWinners.includes(p.uid)),
        winnerPoints: bfWinnerPoints,
        allPlayers: players,
        scores: bfScores,
      });
    }
    if (bfPhase !== "final") {
      gameEndFiredRef.current = false;
    }
  }, [bfPhase, bfWinners, bfWinnerPoints, bfScores, onGameEnd, session?.players]);

  // ─── Non-host: compute round result locally ───────────────

  useEffect(() => {
    if (bfPhase === "results" && !lastRoundResult) {
      const result = scoreBlarfRound(bfVotes, bfBlarfers, playerUids);
      setLastRoundResult(result);
    }
    if (bfPhase !== "results") {
      setLastRoundResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bfPhase]);

  // ─── Render ───────────────────────────────────────────────

  if (!session) return null;

  return (
    <div className="fixed inset-0 flex flex-col bg-[#2B4B6F]">
      {splashBgURL && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat brightness-[0.25]"
          style={{ backgroundImage: `url(${splashBgURL})` }}
        />
      )}

      {/* Pack select (host picks, others wait) */}
      {bfPhase === "pack-select" && isHost && (lobbyAutoApplyFailed || !bfLobbyPackId) && (
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
          <img
            src="/images/games/blarf/Blarf-Epic.png"
            alt="BLARF!"
            className="max-h-[85dvh] max-w-[90vw] object-contain"
          />
        </div>
      )}
      {bfPhase === "pack-select" && isHost && !lobbyAutoApplyFailed && bfLobbyPackId && (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-6">
          {gameLogoURL && (
            <div className="motion-reduce:animate-none animate-[float_3s_ease-in-out_infinite]">
              <Image
                src={gameLogoURL}
                alt=""
                width={400}
                height={200}
                className="h-36 w-auto max-w-[min(400px,85vw)] object-contain drop-shadow-lg select-none sm:h-48"
              />
            </div>
          )}
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent drop-shadow-lg" />
          <p className="text-sm font-bold uppercase tracking-wider text-white drop-shadow-lg">
            Loading pack&hellip;
          </p>
        </div>
      )}

      {/* Round intro overlay */}
      {showRoundIntro && (
        <RoundIntroScreen
          roundNumber={bfCurrentRound}
          onComplete={handleRoundIntroComplete}
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
            letter={bfBlarferLetter}
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
            assignments={bfAssignments}
            blarfers={bfBlarfers}
            voiceStyle={bfVoiceStyle}
            letter={bfBlarferLetter}
            isHost={isHost}
            isLastSpeaker={isLastSpeaker}
            onNextSpeaker={advanceSpeaker}
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
            deadline={bfVoteDeadline}
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
            assignments={bfAssignments}
            votes={bfVotes}
            roundDeltas={lastRoundResult.deltas}
            voteCounts={lastRoundResult.voteCounts}
            detectedBlarfers={lastRoundResult.detectedBlarfers}
            undetectedBlarfers={lastRoundResult.undetectedBlarfers}
            scores={bfScores}
            roundNumber={bfCurrentRound}
            totalRounds={bfTotalRounds}
            isHost={isHost}
            revealed={bfRevealed}
            onReveal={() => updateFields({ bfRevealed: true })}
            onContinue={advanceFromResults}
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
            onPlayAgain={handlePlayAgain}
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
