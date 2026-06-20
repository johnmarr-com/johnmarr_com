"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/AuthProvider";
import { GameGamertagBadge, bgMusic, SFX, recordGameStats } from "@/app/games/_gamecore";
import { PointsManager, Activity } from "@/lib/points";
import { JMTeamInterstitial, JMGameResultOverlay } from "@/JMKit";
import { useFyveSession } from "./useFyveSession";
import {
  confirmTeams,
  continueBriefing,
  backToTeams,
  selectBosses,
  selectHeist,
  submitClue,
  tapCard,
  passTurn,
  playAgain,
  getBossView,
  updateDraft,
} from "./fyveApi";
import {
  ASSETS_PER_TEAM,
  type FyveHeist,
  type FyveTeam,
  type FyveRevealResult,
  type FyveBoardCard,
  type CardType,
} from "./fyveTypes";

// Screens
import BriefingScreen from "./screens/BriefingScreen";
import TeamFormationScreen from "./screens/TeamFormationScreen";
import BossSelectScreen from "./screens/BossSelectScreen";
import HeistPickerModal from "./HeistPickerModal";

import BossScreen from "./screens/BossScreen";
import OperativeScreen from "./screens/OperativeScreen";
import CardRevealOverlay from "./screens/CardRevealOverlay";
import BombFailOverlay from "./screens/BombFailOverlay";

// ─── Constants ──────────────────────────────────────────────

const FYVE_COLORS = {
  navy: "#0D1B2E",
  orange: "#E84C1E",
  gray: "#8C9BAD",
  white: "#FFFFFF",
  t1: "#E84C1E",    // red team
  t2: "#3B82F6",    // blue team
  neutral: "#8C9BAD",
  bomb: "#000000",
} as const;

export { FYVE_COLORS };

/** Resolve display props for a team: name, color, logo, score */
function teamDisplay(
  team: FyveTeam,
  svState: { t1Name: string | null; t2Name: string | null; t1Score: number; t2Score: number; draftT1Logo: string | null; draftT2Logo: string | null },
) {
  const isT1 = team === "syndicate1";
  return {
    name: (isT1 ? svState.t1Name : svState.t2Name) ?? (isT1 ? "Team 1" : "Team 2"),
    color: isT1 ? FYVE_COLORS.t1 : FYVE_COLORS.t2,
    logo: (isT1 ? svState.draftT1Logo : svState.draftT2Logo) ?? "",
    score: isT1 ? svState.t1Score : svState.t2Score,
  };
}


// ─── Props ──────────────────────────────────────────────────

interface FyveGameProps {
  sessionId: string;
  splashBgURL?: string;
  gameLogoURL?: string;
  musicUrl?: string;
}

export default function FyveGame({
  sessionId,
  splashBgURL: _splashBgURL,
  gameLogoURL,
  musicUrl,
}: FyveGameProps) {
  const { user } = useAuth();
  const userId = user?.uid ?? "";
  void _splashBgURL; // reserved for future use
  const {
    session,
    svState,
    isHost,
    myTeam,
    isBoss,
    isMyTeamActive,
  } = useFyveSession({ sessionId, userId });

  // Track loaded heist data for briefing + reveal metadata
  const [heist, setHeist] = useState<FyveHeist | null>(null);
  // Boss color map (fetched from server, only for bosses)
  const [bossColorMap, setBossColorMap] = useState<CardType[] | null>(null);
  // Card reveal animation — driven by board-change detection (all clients)
  const [animReveal, setAnimReveal] = useState<{
    cardIndex: number;
    word: string;
    result: FyveRevealResult;
  } | null>(null);
  // Sync flag — set immediately when a reveal is detected so same-render
  // effects (game-over) know a reveal is pending before state updates.
  const revealPendingRef = useRef(false);
  const prevBoardRef = useRef<FyveBoardCard[] | null>(null);
  // Bomb fail — dedicated overlay that owns the entire bomb-loss sequence
  const [bombFail, setBombFail] = useState<{
    cardIndex: number;
    word: string;
    imageUrl: string;
    audioUrl: string | null;
    description: string;
  } | null>(null);
  // Team interstitial — shows when activeTeam changes during gameplay
  const [interstitialTeam, setInterstitialTeam] = useState<FyveTeam | null>(null);
  const prevActiveTeamRef = useRef<FyveTeam | null>(null);
  // When the engine switches teams atomically with a reveal, defer the
  // interstitial until the reveal overlay finishes so they don't stack.
  const pendingInterstitialRef = useRef<FyveTeam | null>(null);
  // Game-over overlay: "loss" shows bomb loss first, then transitions to "win"
  const [gameOverPhase, setGameOverPhase] = useState<"loss" | "win" | null>(null);
  const gameOverDismissedRef = useRef(false);
  // Heist picker (host, heist-select phase)
  const [heistPickerOpen, setHeistPickerOpen] = useState(false);
  const {
    svPhase,
    selectedHeistId,
    board,
    activeTeam,
    currentClue,
    guessesRemaining,
    keyDocId,
    winningTeam,
    t1Score,
    t2Score,
    t1Name,
    t2Name,
  } = svState;

  // Display names — fallback to generic if not yet assigned
  const t1Display = t1Name ?? "Team 1";
  const t2Display = t2Name ?? "Team 2";
  const activeTeamName = activeTeam ? teamDisplay(activeTeam, svState).name : "";

  // ─── Load heist data when selected ─────────────────────────
  useEffect(() => {
    if (!selectedHeistId) return;
    (async () => {
      const { getHeist } = await import("@/lib/fyve-heists");
      const h = await getHeist(selectedHeistId);
      if (h) setHeist(h);
    })();
  }, [selectedHeistId]);

  // ─── Preload all heist reveal images into browser cache ────
  useEffect(() => {
    if (!heist) return;
    const urls: string[] = [];
    for (const a of heist.assets) {
      if (a.imageUrl) urls.push(a.imageUrl);
      if (a.bombImageUrl) urls.push(a.bombImageUrl);
    }
    for (const c of heist.civilians) { if (c.imageUrl) urls.push(c.imageUrl); }
    for (const url of urls) {
      const img = new window.Image();
      img.src = url;
    }
  }, [heist]);

  // ─── Preload reveal sound effects ─────────────────────────
  useEffect(() => {
    for (const src of [SFX.SUCCESS, SFX.FAIL]) {
      const a = new Audio(src);
      a.preload = "auto";
      a.load();
    }
  }, []);

  // Preload per-element bomb sounds from heist data
  useEffect(() => {
    if (!heist) return;
    for (const asset of heist.assets) {
      if (asset.bombSoundEffect) {
        const a = new Audio(asset.bombSoundEffect);
        a.preload = "auto";
        a.load();
      }
    }
  }, [heist]);

  // ─── Fetch boss view when the board is dealt and I'm a boss ──
  useEffect(() => {
    if (!isBoss || !keyDocId || !sessionId) return;
    (async () => {
      const colorMap = await getBossView(sessionId);
      if (colorMap) setBossColorMap(colorMap);
    })();
  }, [isBoss, keyDocId, sessionId]);

  // ─── Heist chosen (host) → engine-free setup write ─────────
  const handleHeistSelected = useCallback(
    (h: FyveHeist) => {
      setHeist(h);
      void selectHeist(sessionId, h.id);
    },
    [sessionId],
  );

  // ─── Team Formation Complete ──────────────────────────────
  const handleTeamsFormed = useCallback(
    (teams: Record<FyveTeam, { members: string[] }>, t1Name: string, t2Name: string) => {
      void confirmTeams(sessionId, {
        team1: teams.syndicate1.members,
        team2: teams.syndicate2.members,
        t1Name,
        t2Name,
      });
    },
    [sessionId],
  );

  // ─── Draft team-formation live preview (throttled) ─────────
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleDraftChanged = useCallback(
    (draft: { draftTeam1?: string[]; draftTeam2?: string[]; draftT1Logo?: string | null; draftT2Logo?: string | null }) => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      draftTimerRef.current = setTimeout(() => {
        void updateDraft(sessionId, draft);
      }, 250);
    },
    [sessionId],
  );

  // ─── Boss Selection Complete → engine generates board + coin flip ──
  const handleBossesSelected = useCallback(
    (s1Boss: string, s2Boss: string) => {
      void selectBosses(sessionId, s1Boss, s2Boss);
    },
    [sessionId],
  );

  // ─── Clue Submitted (active boss) → engine sets clue + phase ──
  const handleClueSubmitted = useCallback(
    (word: string, number: number) => {
      void submitClue(sessionId, word, number);
    },
    [sessionId],
  );

  // ─── Game-over → award points + record stats (once, any client/host) ──
  const gameEndFiredRef = useRef(false);
  useEffect(() => {
    if (svPhase === "game-over" && winningTeam && !gameEndFiredRef.current) {
      gameEndFiredRef.current = true;
      PointsManager.award(Activity.PLAY_GAME);
      if (isHost) {
        PointsManager.award(Activity.HOST_GAME);
        const allUids = session?.playerUids ?? [];
        const winnerUids = svState.teams?.[winningTeam]?.members ?? [];
        recordGameStats(allUids, winnerUids, session?.ownerId ?? "");
      }
      const winnerUids = svState.teams?.[winningTeam]?.members ?? [];
      if (winnerUids.includes(userId)) PointsManager.award(Activity.WIN_GAME);
    }
    if (svPhase !== "game-over") gameEndFiredRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once at game-over
  }, [svPhase, winningTeam, isHost, userId]);

  // ─── Detect board changes → trigger reveal animation (all clients) ──
  useEffect(() => {
    if (animReveal || bombFail) return; // Don't check during active animation

    const prev = prevBoardRef.current;
    prevBoardRef.current = board;

    if (!board || !prev) return;

    for (let i = 0; i < board.length; i++) {
      const cur = board[i]!;
      const pre = prev[i];
      if (cur.revealed && !pre?.revealed && cur.revealedType) {
        revealPendingRef.current = true;
        if (cur.revealedType === "BOMB") {
          // Bombs → dedicated BombFailOverlay (no CardRevealOverlay)
          setBombFail({
            cardIndex: i,
            word: cur.word,
            imageUrl: cur.revealedImageUrl ?? "",
            audioUrl: cur.revealedSoundEffect ?? null,
            description: cur.revealedDescription ?? "",
          });
        } else {
          setAnimReveal({
            cardIndex: i,
            word: cur.word,
            result: {
              cardIndex: i,
              cardType: cur.revealedType,
              name: cur.revealedName ?? "",
              description: cur.revealedDescription ?? "",
              imageUrl: cur.revealedImageUrl ?? "",
              ...(cur.revealedAssetNumber != null ? { assetNumber: cur.revealedAssetNumber } : {}),
            },
          });
        }
        break;
      }
    }
  }, [board, animReveal, bombFail]);

  // ─── After Card Reveal Animation (presentation only; the engine already
  // applied score/turn/win atomically at reveal time) ──
  const handleRevealDismissed = useCallback(() => {
    prevBoardRef.current = board; // Sync ref to prevent re-trigger
    revealPendingRef.current = false;

    // Clean win on the revealed card: keep it visible under the win overlay.
    if (winningTeam) {
      setGameOverPhase("win");
      setTimeout(() => setAnimReveal(null), 1200);
      return;
    }

    setAnimReveal(null);

    // If the engine switched teams with this reveal, play the interstitial now.
    if (pendingInterstitialRef.current) {
      setInterstitialTeam(pendingInterstitialRef.current);
      pendingInterstitialRef.current = null;
    }
  }, [board, winningTeam]);

  // ─── Team interstitial — fires when activeTeam changes during gameplay,
  // deferred until any in-flight reveal overlay finishes (so they don't stack). ──
  useEffect(() => {
    if (!board || !activeTeam) {
      // Reset refs when the game is torn down (Play Again) so the next
      // game's first team always triggers the interstitial.
      prevActiveTeamRef.current = null;
      pendingInterstitialRef.current = null;
      return;
    }
    if (prevActiveTeamRef.current !== activeTeam) {
      prevActiveTeamRef.current = activeTeam;
      if (animReveal || bombFail || revealPendingRef.current) {
        pendingInterstitialRef.current = activeTeam; // fire on reveal dismiss
      } else {
        setInterstitialTeam(activeTeam);
      }
    }
  }, [activeTeam, board, animReveal, bombFail]);

  // ─── Pass Turn (any operative on the active team) → engine switches ──
  const handlePassTurn = useCallback(() => {
    if (svPhase !== "operative-guess" || !activeTeam || myTeam !== activeTeam || isBoss) return;
    void passTurn(sessionId);
  }, [svPhase, activeTeam, myTeam, isBoss, sessionId]);

  // ─── Play Again (host) → engine resets to boss-select ─────
  const handlePlayAgain = useCallback(() => {
    if (!isHost) return;
    bgMusic.stop();
    gameOverDismissedRef.current = true;
    setGameOverPhase(null);
    void playAgain(sessionId);
  }, [isHost, sessionId]);

  // ─── Reset gameOverPhase when game restarts (fixes stale state on non-host) ──
  useEffect(() => {
    if (svPhase !== "game-over" && gameOverPhase) {
      setGameOverPhase(null);
      gameOverDismissedRef.current = false;
    }
  }, [svPhase, gameOverPhase]);

  // ─── Show game-over overlay when entering via Firestore sync (late join / reconnect) ──
  // Checks revealPendingRef so we don't race ahead of a card reveal or bomb
  // that was detected in the same render cycle (state not yet updated).
  useEffect(() => {
    if (svPhase === "game-over" && !animReveal && !bombFail && !revealPendingRef.current && !gameOverPhase && !gameOverDismissedRef.current) {
      const hasBomb = board?.some((c) => c.revealed && c.revealedType === "BOMB");
      setGameOverPhase(hasBomb ? "loss" : "win");
    }
  }, [svPhase, animReveal, bombFail, gameOverPhase, board]);


  // ─── Bomb loss → win transition (show loss for 10s, then switch to win) ──
  useEffect(() => {
    if (gameOverPhase !== "loss") return;
    const timer = setTimeout(() => setGameOverPhase("win"), 10000);
    return () => clearTimeout(timer);
  }, [gameOverPhase]);

  // ─── Render ───────────────────────────────────────────────

  if (!session || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black">
        <p className="text-white/60 animate-pulse">Loading...</p>
      </div>
    );
  }

  // Background image from heist only (no splash fallback — clean black base)
  const bgUrl = svState.selectedHeistBgUrl;

  return (
    <div className="relative min-h-dvh bg-black text-white">
      {/* Full-bleed background image — visible beyond the 800px game column */}
      {bgUrl && (
        <div
          className="fixed inset-0 bg-cover bg-center opacity-25 pointer-events-none"
          style={{ backgroundImage: `url(${bgUrl})` }}
        />
      )}

    <div className="relative mx-auto min-h-dvh max-w-[800px] bg-black overflow-hidden">
      {/* Inner background image — same image layered inside the game column */}
      {bgUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25 pointer-events-none"
          style={{ backgroundImage: `url(${bgUrl})` }}
        />
      )}

      {/* Team color edge glow — above BG, below grid/UI */}
      <div
        className="pointer-events-none absolute inset-0 z-5 transition-shadow duration-700 ease-in-out"
        style={{
          boxShadow: board && activeTeam
            ? `inset 0 0 60px 10px ${activeTeam === "syndicate1" ? "rgba(232,76,30,0.35)" : "rgba(80,150,255,0.45)"}`
            : "none",
        }}
      />

      {/* Gamertag badge */}
      <GameGamertagBadge badgeClassName="bg-[#0D1B2E]/80" />

      {/* Score circles — top corners, scroll with page */}
      {board && svPhase !== "game-over" && (
        <>
          {/* Left: Team 1 logo + score badge (top-right of logo) */}
          <div className="absolute top-2 left-2 z-30 origin-top-left transition-all duration-500" style={{ opacity: activeTeam === "syndicate2" ? 0.15 : 1, transform: activeTeam === "syndicate2" ? "scale(0.7)" : "scale(1)" }}>
            <div
              className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full"
              style={{ backgroundColor: `${FYVE_COLORS.t1}20` }}
            >
              {svState.draftT1Logo && (
                <>
                  <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${svState.draftT1Logo})` }} />
                  <div className="absolute inset-0" style={{ backgroundColor: FYVE_COLORS.t1, mixBlendMode: "color" }} />
                </>
              )}
            </div>
            {/* Score badge hidden — progress bars show score below grid */}
            {/* <div
              className="absolute -top-1 z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-black bg-black"
              style={{ right: "-15px" }}
            >
              <span className="text-base font-black leading-none" style={{ color: FYVE_COLORS.t1 }}>{t1Score}/5</span>
            </div> */}
          </div>
          {/* Center: Clue display or Boss prompt — bottom-aligned to grid top */}
          {activeTeam && (() => {
            const clueColor = activeTeam === "syndicate1" ? FYVE_COLORS.t1 : FYVE_COLORS.t2;
            const teamName = activeTeam === "syndicate1" ? t1Display : t2Display;
            const isActiveBoss = isBoss && isMyTeamActive && !currentClue;
            return (
              <div className="absolute left-16 right-16 z-40 flex flex-col items-center" style={{ top: "130px", transform: "translateY(calc(-100% - 10px))" }}>
                {currentClue ? (
                  <>
                    <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: clueColor }}>
                      {teamName} Clue:
                    </span>
                    <span className="text-xl font-black text-white">
                      {currentClue.word} : {guessesRemaining}
                    </span>
                  </>
                ) : isActiveBoss ? (
                  <button
                    type="button"
                    className="rounded-lg bg-linear-to-br from-[#b8860b] via-[#daa520] to-[#8b6914] px-4 py-2.5 text-sm font-bold text-neutral-950 active:scale-95 transition-transform"
                    onClick={() => window.dispatchEvent(new CustomEvent("fyve-open-clue-modal"))}
                  >
                    Create Clue
                  </button>
                ) : null}
              </div>
            );
          })()}
          {/* Right: Team 2 logo + score badge (top-left of logo) */}
          <div className="absolute top-2 right-2 z-30 origin-top-right transition-all duration-500" style={{ opacity: activeTeam === "syndicate1" ? 0.15 : 1, transform: activeTeam === "syndicate1" ? "scale(0.7)" : "scale(1)" }}>
            <div
              className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full"
              style={{ backgroundColor: `${FYVE_COLORS.t2}20` }}
            >
              {svState.draftT2Logo && (
                <>
                  <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${svState.draftT2Logo})` }} />
                  <div className="absolute inset-0" style={{ backgroundColor: FYVE_COLORS.t2, mixBlendMode: "color" }} />
                </>
              )}
            </div>
            {/* Score badge hidden — progress bars show score below grid */}
            {/* <div
              className="absolute -top-1 z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-black bg-black"
              style={{ left: "-15px" }}
            >
              <span className="text-base font-black leading-none" style={{ color: FYVE_COLORS.t2 }}>{t2Score}/5</span>
            </div> */}
          </div>
        </>
      )}

      {/* Phase router */}
      <div className="relative z-10">
        {svPhase === "heist-select" && isHost && (
          <div className="flex min-h-dvh flex-col items-center justify-center gap-7 px-4">
            {gameLogoURL && (
              <div className="animate-gentle-float">
                <Image
                  src={gameLogoURL}
                  alt="FYVE"
                  width={260}
                  height={130}
                  className="h-auto w-[260px] object-contain"
                  draggable={false}
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => setHeistPickerOpen(true)}
              className="rounded-xl px-9 py-4 text-lg font-black uppercase tracking-wider text-black transition-transform active:scale-95"
              style={{ backgroundColor: FYVE_COLORS.orange }}
            >
              Choose Heist
            </button>
          </div>
        )}
        {svPhase === "heist-select" && isHost && heistPickerOpen && (
          <HeistPickerModal
            onSelect={(h) => {
              setHeistPickerOpen(false);
              handleHeistSelected(h);
            }}
            onClose={() => setHeistPickerOpen(false)}
            accentColor={FYVE_COLORS.orange}
          />
        )}
        {svPhase === "heist-select" && !isHost && (
          <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-6">
            <div className="absolute right-6 top-[29px] flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <p className="text-xs font-bold uppercase tracking-wider text-white/60">Prepping Game</p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/games/fyve/Fyve-Things-2.jpg"
              alt="FYVE Things"
              className="max-h-[85dvh] max-w-[90vw] object-contain"
            />
          </div>
        )}

        {svPhase === "briefing" && heist && (
          <BriefingScreen
            heist={heist}
            isHost={isHost}
            onContinue={() => { if (isHost) void continueBriefing(sessionId); }}
          />
        )}

        {svPhase === "team-formation" && session && (
          <TeamFormationScreen
            session={session}
            isHost={isHost}
            onTeamsFormed={handleTeamsFormed}
            draftTeam1={svState.draftTeam1}
            draftTeam2={svState.draftTeam2}
            draftT1Logo={svState.draftT1Logo}
            draftT2Logo={svState.draftT2Logo}
            onDraftChanged={handleDraftChanged}
          />
        )}

        {svPhase === "boss-select" && session && svState.teams && (
          <BossSelectScreen
            session={session}
            teams={svState.teams}
            isHost={isHost}
            draftT1Logo={svState.draftT1Logo}
            draftT2Logo={svState.draftT2Logo}
            onElected={handleBossesSelected}
            onBack={isHost ? () => void backToTeams(sessionId) : undefined}
          />
        )}

        {svPhase === "boss-clue" && board && (
          isBoss && isMyTeamActive ? (
            <BossScreen
              board={board}
              colorMap={bossColorMap}
              activeTeam={activeTeam!}
              myTeam={myTeam!}
              activeTeamName={activeTeamName}
              currentClue={currentClue}
              isMyTurn={true}
              onSubmitClue={handleClueSubmitted}
              heist={heist}
              t1Score={t1Score}
              t2Score={t2Score}
            />
          ) : isBoss ? (
            <BossScreen
              board={board}
              colorMap={bossColorMap}
              activeTeam={activeTeam!}
              myTeam={myTeam!}
              activeTeamName={activeTeamName}
              currentClue={currentClue}
              isMyTurn={false}
              heist={heist}
              t1Score={t1Score}
              t2Score={t2Score}
            />
          ) : (
            <OperativeScreen
              board={board}
              activeTeam={activeTeam!}
              myTeam={myTeam!}
              activeTeamName={activeTeamName}
              currentClue={currentClue}
              guessesRemaining={0}
              canTap={false}
              heist={heist}
              waitingForClue={isMyTeamActive}
              t1Score={t1Score}
              t2Score={t2Score}
            />
          )
        )}

        {svPhase === "operative-guess" && board && (
          isBoss ? (
            <BossScreen
              board={board}
              colorMap={bossColorMap}
              activeTeam={activeTeam!}
              myTeam={myTeam!}
              activeTeamName={activeTeamName}
              currentClue={currentClue}
              isMyTurn={false}
              heist={heist}
              t1Score={t1Score}
              t2Score={t2Score}
            />
          ) : (
            <OperativeScreen
              board={board}
              activeTeam={activeTeam!}
              myTeam={myTeam!}
              activeTeamName={activeTeamName}
              currentClue={currentClue}
              guessesRemaining={guessesRemaining}
              canTap={isMyTeamActive && !isBoss}
              guessesUsedThisTurn={svState.guessesUsedThisTurn}
              onTapCard={(cardIndex) => void tapCard(sessionId, cardIndex)}
              onPassTurn={handlePassTurn}
              heist={heist}
              t1Score={t1Score}
              t2Score={t2Score}
            />
          )
        )}

        {/* game-over phase: grid is hidden, victory overlay renders separately */}
      </div>


      {/* Bomb Fail Overlay — unified bomb card animation + loss screen */}
      {bombFail && activeTeam && winningTeam && (() => {
        const loser: FyveTeam = winningTeam === "syndicate1" ? "syndicate2" : "syndicate1";
        const ld = teamDisplay(loser, svState);
        return (
          <BombFailOverlay
            cardIndex={bombFail.cardIndex}
            boardWord={bombFail.word}
            bombImageUrl={bombFail.imageUrl}
            bombAudioUrl={bombFail.audioUrl}
            bombDescription={bombFail.description}
            losingTeam={loser}
            losingTeamName={ld.name}
            losingTeamLogoUrl={ld.logo}
            onDismiss={() => {
              prevBoardRef.current = board;
              revealPendingRef.current = false;
              setBombFail(null);
              setGameOverPhase("win");
            }}
          />
        );
      })()}

      {/* Game-Over: Loss fallback (late-join/reconnect into finished bomb game) */}
      {gameOverPhase === "loss" && !bombFail && heist && winningTeam && (() => {
        const loser: FyveTeam = winningTeam === "syndicate1" ? "syndicate2" : "syndicate1";
        const ld = teamDisplay(loser, svState);
        const elementBomb = heist.assets[ld.score];
        return (
          <JMGameResultOverlay
            variant="loss"
            teamName={ld.name}
            teamColor={ld.color}
            teamLogoUrl={ld.logo}
            cardImageUrl={elementBomb?.bombImageUrl ?? ""}
            message={elementBomb?.bombDescription ?? ""}
            audioUrl={elementBomb?.bombSoundEffect ?? null}
            onDismiss={() => setGameOverPhase("win")}
          />
        );
      })()}

      {/* Game-Over: Win Overlay — directly for clean wins, after bomb/loss for bombs */}
      {gameOverPhase === "win" && !bombFail && heist && winningTeam && (() => {
        const wd = teamDisplay(winningTeam, svState);
        return (
          <JMGameResultOverlay
            variant="win"
            teamName={wd.name}
            teamColor={wd.color}
            teamLogoUrl={wd.logo}
            cardImageUrl={heist.targetObjectImageUrl}
            heading={heist.title}
            message={heist.winMessage}
            audioUrl={musicUrl}
            isHost={isHost}
            onPlayAgain={handlePlayAgain}
          />
        );
      })()}

      {/* Card Reveal Overlay — non-bomb cards only */}
      {animReveal && (
        <CardRevealOverlay
          result={animReveal.result}
          activeTeam={activeTeam!}
          boardWord={animReveal.word}
          isGameEnding={!!svState.winningTeam}
          onDismiss={handleRevealDismissed}
        />
      )}

      {/* Team interstitial — "Now Playing" splash on turn change */}
      {interstitialTeam && (() => {
        const td = teamDisplay(interstitialTeam, svState);
        return (
          <JMTeamInterstitial
            teamName={td.name}
            teamColor={td.color}
            logoUrl={td.logo}
            score={td.score}
            maxScore={ASSETS_PER_TEAM}
            onDismiss={() => setInterstitialTeam(null)}
          />
        );
      })()}
    </div>
    </div>
  );
}
