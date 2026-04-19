"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/AuthProvider";
import { GameGamertagBadge, getAIAuthHeaders, bgMusic } from "@/app/games/_gamecore";
import { JMTeamInterstitial, JMGameResultOverlay } from "@/JMKit";
import { useFyveSession } from "./useFyveSession";
import type {
  FyveHeist,
  FyveTeam,
  FyveRevealResult,
  FyveBoardCard,
  CardType,
} from "./fyveTypes";

// Screens
import BriefingScreen from "./screens/BriefingScreen";
import TeamFormationScreen from "./screens/TeamFormationScreen";
import BossSelectScreen from "./screens/BossSelectScreen";

import BossScreen from "./screens/BossScreen";
import OperativeScreen from "./screens/OperativeScreen";
import CardRevealOverlay from "./screens/CardRevealOverlay";

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
    setPhase,
    updateFields,
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
  const prevBoardRef = useRef<FyveBoardCard[] | null>(null);
  // Team interstitial — shows when activeTeam changes during gameplay
  const [interstitialTeam, setInterstitialTeam] = useState<FyveTeam | null>(null);
  const prevActiveTeamRef = useRef<FyveTeam | null>(null);
  // Game-over overlay: "loss" shows bomb loss first, then transitions to "win"
  const [gameOverPhase, setGameOverPhase] = useState<"loss" | "win" | null>(null);
  const gameOverDismissedRef = useRef(false);
  const {
    svPhase,
    selectedHeistId,
    board,
    activeTeam,
    currentClue,
    guessesRemaining,
    bonusGuessAvailable,
    keyDocId,
    winningTeam,
    loseByBomb,
    t1Score,
    t2Score,
    t1Name,
    t2Name,
  } = svState;

  // Display names — fallback to generic if not yet assigned
  const t1Display = t1Name ?? "Team 1";
  const t2Display = t2Name ?? "Team 2";
  const activeTeamName = activeTeam ? (activeTeam === "syndicate1" ? t1Display : t2Display) : "";

  // ─── Auto-advance from lobby heist selection ───────────────
  // If lobby selected a heist (fyveLobbyHeist* fields), apply it on first load
  useEffect(() => {
    if (!isHost || !session || svPhase !== "heist-select") return;
    const raw = session as unknown as Record<string, unknown>;
    const lobbyHeistId = raw["fyveLobbyHeistId"] as string | undefined;
    if (!lobbyHeistId) return;

    (async () => {
      const { getHeist } = await import("@/lib/fyve-heists");
      const h = await getHeist(lobbyHeistId);
      if (!h) return;
      setHeist(h);
      await updateFields({
        selectedHeistId: h.id,
        selectedHeistTitle: h.title,
        selectedHeistBgUrl: h.backgroundImageUrl,
        selectedHeistTargetUrl: h.targetObjectImageUrl,
        heistBriefing: h.briefing,
        heistSetting: h.setting,
        svPhase: "briefing",
      });
    })();
  }, [isHost, session, svPhase, updateFields]);

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
    for (const src of ["/music/Sound-Success.mp3", "/music/Sound-Fail.mp3"]) {
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

  // ─── Fetch boss view when game starts and I'm a boss ─────────
  useEffect(() => {
    if (!isBoss || !keyDocId || !sessionId) return;
    (async () => {
      const headers = await getAIAuthHeaders();
      const res = await fetch("/api/games/fyve", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "get-boss-view",
          sessionId,
          keyDocId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setBossColorMap(data.colorMap);

        // ─── DEBUG: log boss view with board ──────────────
        const colorMap = data.colorMap as string[];
        console.log("[FYVE CLIENT] Boss color map received:");
        board?.forEach((card, i) => {
          const type = colorMap[i] ?? "?";
          const typeLabel = type === "T1" ? "Syndicate 1" : type === "T2" ? "Syndicate 2" : type === "N" ? "Civilian" : type === "BOMB" ? "BOMB" : type;
          console.log(`  Card ${i + 1}: "${card.word}" → ${typeLabel}`);
        });
      }
    })();
  }, [isBoss, keyDocId, sessionId, board]);

  // ─── Team Formation Complete ──────────────────────────────
  const handleTeamsFormed = useCallback(
    async (teams: Record<FyveTeam, { members: string[] }>, t1Name: string, t2Name: string) => {
      await updateFields({
        teams: {
          syndicate1: { members: teams.syndicate1.members, bossUid: null },
          syndicate2: { members: teams.syndicate2.members, bossUid: null },
        },
        t1Name,
        t2Name,
        svPhase: "boss-select",
      });
    },
    [updateFields],
  );

  // ─── Game Start (generate key + board on server) ──────────
  const startGame = useCallback(
    async (firstTeam: FyveTeam) => {
      if (!isHost || !selectedHeistId) return;
      const headers = await getAIAuthHeaders();
      const res = await fetch("/api/games/fyve", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "generate-key",
          sessionId,
          heistId: selectedHeistId,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();

      // ─── DEBUG: log board from server ─────────────────────
      console.log("[FYVE CLIENT] Board received from generate-key:");
      (data.board as { index: number; word: string }[]).forEach((c, i) => {
        console.log(`  Card ${i + 1}: "${c.word}"`);
      });

      await updateFields({
        board: data.board,
        keyDocId: data.keyDocId,
        activeTeam: firstTeam,
        t1Score: 0,
        t2Score: 0,
        t1RevealCount: 0,
        t2RevealCount: 0,
        t1RevealedAssets: [],
        t2RevealedAssets: [],
        guessesRemaining: 0,
        guessesUsedThisTurn: 0,
        bonusGuessAvailable: false,
        currentClue: null,
        pendingTap: null,
        winningTeam: null,
        loseByBomb: false,
        bombRevealedBy: null,
        svPhase: "boss-clue",
      });
    },
    [isHost, selectedHeistId, sessionId, updateFields],
  );

  // ─── Boss Selection Complete → immediately start game ──────
  const handleBossesSelected = useCallback(
    async (s1Boss: string, s2Boss: string) => {
      if (!svState.teams) return;
      await updateFields({
        teams: {
          syndicate1: { ...svState.teams.syndicate1, bossUid: s1Boss },
          syndicate2: { ...svState.teams.syndicate2, bossUid: s2Boss },
        },
      });
      // Host picks a random first team and starts the game immediately
      if (isHost) {
        const firstTeam: FyveTeam = Math.random() < 0.5 ? "syndicate1" : "syndicate2";
        await startGame(firstTeam);
      }
    },
    [updateFields, svState.teams, isHost, startGame],
  );

  // ─── Clue Submitted ──────────────────────────────────────
  const handleClueSubmitted = useCallback(
    async (word: string, number: number) => {
      await updateFields({
        currentClue: { word, number, givenBy: userId },
        guessesRemaining: number,
        guessesUsedThisTurn: 0,
        bonusGuessAvailable: false,
        svPhase: "operative-guess",
      });
    },
    [updateFields, userId],
  );

  // ─── Card Reveal (host calls server) ─────────────────────
  const handleRevealCard = useCallback(
    async (cardIndex: number) => {
      if (!isHost || !keyDocId || !selectedHeistId) return;
      const headers = await getAIAuthHeaders();
      const res = await fetch("/api/games/fyve", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "reveal-card",
          sessionId,
          keyDocId,
          cardIndex,
          heistId: selectedHeistId,
        }),
      });
      if (!res.ok) return;
      const result: FyveRevealResult = await res.json();

      // Update the board card as revealed
      const updatedBoard = board ? [...board] : [];
      if (updatedBoard[cardIndex]) {
        updatedBoard[cardIndex] = {
          ...updatedBoard[cardIndex],
          revealed: true,
          revealedType: result.cardType,
          revealedName: result.name,
          revealedDescription: result.description,
          revealedImageUrl: result.imageUrl,
          ...(result.bombSoundEffect ? { revealedSoundEffect: result.bombSoundEffect } : {}),
        };
      }

      // Calculate score changes + game outcome
      const updates: Record<string, unknown> = {
        board: updatedBoard,
        svPhase: "card-reveal" as const,
        pendingTap: null,
      };

      const currentActiveTeam = activeTeam!;
      const oppositeTeam: FyveTeam = currentActiveTeam === "syndicate1" ? "syndicate2" : "syndicate1";

      if (result.cardType === "T1") {
        const newCount = svState.t1RevealCount + 1;
        updates["t1RevealCount"] = newCount;
        updates["t1Score"] = newCount;
        // Assign asset number
        if (updatedBoard[cardIndex]) {
          updatedBoard[cardIndex] = {
            ...updatedBoard[cardIndex]!,
            revealedAssetNumber: newCount,
          };
          updates["board"] = updatedBoard;
        }
        if (newCount >= 7) {
          updates["winningTeam"] = "syndicate1";
          updates["svPhase"] = "game-over";
        }
      } else if (result.cardType === "T2") {
        const newCount = svState.t2RevealCount + 1;
        updates["t2RevealCount"] = newCount;
        updates["t2Score"] = newCount;
        if (updatedBoard[cardIndex]) {
          updatedBoard[cardIndex] = {
            ...updatedBoard[cardIndex]!,
            revealedAssetNumber: newCount,
          };
          updates["board"] = updatedBoard;
        }
        if (newCount >= 7) {
          updates["winningTeam"] = "syndicate2";
          updates["svPhase"] = "game-over";
        }
      } else if (result.cardType === "BOMB") {
        // Bomb: the guessing team loses, opponent wins
        updates["winningTeam"] = oppositeTeam;
        updates["loseByBomb"] = true;
        updates["bombRevealedBy"] = svState.pendingTap?.tappedBy ?? null;
        updates["svPhase"] = "game-over";
      }

      // Mark session finished so it leaves "active games" lists
      if (updates["winningTeam"]) {
        updates["status"] = "finished";
      }

      // If not game-over, handle turn continuation / switching
      if (!updates["winningTeam"]) {
        const isOwnAsset =
          (currentActiveTeam === "syndicate1" && result.cardType === "T1") ||
          (currentActiveTeam === "syndicate2" && result.cardType === "T2");

        if (isOwnAsset) {
          // Correct guess — decrement guesses remaining
          const newRemaining = svState.guessesRemaining - 1;
          const newUsed = svState.guessesUsedThisTurn + 1;
          updates["guessesRemaining"] = newRemaining;
          updates["guessesUsedThisTurn"] = newUsed;

          if (newRemaining <= 0 && !svState.bonusGuessAvailable) {
            // All clue-number guesses used correctly — grant bonus guess
            updates["bonusGuessAvailable"] = true;
            updates["guessesRemaining"] = 1;
          }
          // Stay in operative-guess phase (after reveal animation)
        } else {
          // Wrong: opponent asset or neutral → switch teams
          updates["guessesRemaining"] = 0;
          updates["guessesUsedThisTurn"] = 0;
          updates["bonusGuessAvailable"] = false;
        }
      }

      await updateFields(updates);
      // Overlay is triggered by board-change detection (useEffect below)
    },
    [isHost, keyDocId, selectedHeistId, sessionId, board, activeTeam, svState, updateFields],
  );

  // ─── Detect board changes → trigger reveal animation (all clients) ──
  useEffect(() => {
    if (animReveal) return; // Don't check during active animation

    const prev = prevBoardRef.current;
    prevBoardRef.current = board;

    if (!board || !prev) return;

    for (let i = 0; i < board.length; i++) {
      const cur = board[i]!;
      const pre = prev[i];
      if (cur.revealed && !pre?.revealed && cur.revealedType) {
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
            ...(cur.revealedSoundEffect ? { bombSoundEffect: cur.revealedSoundEffect } : {}),
          },
        });
        break;
      }
    }
  }, [board, animReveal]);

  // ─── After Reveal Animation ───────────────────────────────
  const handleRevealDismissed = useCallback(async () => {
    const revealedIndex = animReveal?.cardIndex;
    prevBoardRef.current = board; // Sync ref to prevent re-trigger
    setAnimReveal(null);

    if (!isHost || revealedIndex == null) return;

    // If game is over, show the appropriate overlay
    if (svState.winningTeam) {
      setGameOverPhase(svState.loseByBomb ? "loss" : "win");
      return;
    }

    const lastRevealed = board?.find(
      (c) => c.revealed && c.index === revealedIndex,
    );
    if (!lastRevealed) return;

    const currentActiveTeam = activeTeam!;
    const isOwnAsset =
      (currentActiveTeam === "syndicate1" && lastRevealed.revealedType === "T1") ||
      (currentActiveTeam === "syndicate2" && lastRevealed.revealedType === "T2");

    if (isOwnAsset && svState.guessesRemaining > 0) {
      // Continue guessing
      await updateFields({ svPhase: "operative-guess" });
    } else {
      // Switch teams
      const nextTeam: FyveTeam = currentActiveTeam === "syndicate1" ? "syndicate2" : "syndicate1";
      await updateFields({
        activeTeam: nextTeam,
        currentClue: null,
        guessesRemaining: 0,
        guessesUsedThisTurn: 0,
        bonusGuessAvailable: false,
        svPhase: "boss-clue",
      });
    }
  }, [animReveal, board, isHost, svState, activeTeam, updateFields]);

  // ─── Auto-reveal when pendingTap is confirmed (host only) ──
  const revealFiredRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isHost || !svState.pendingTap) {
      revealFiredRef.current = null;
      return;
    }
    // Don't re-fire for the same tap
    if (revealFiredRef.current === svState.pendingTap.cardIndex) return;
    revealFiredRef.current = svState.pendingTap.cardIndex;
    handleRevealCard(svState.pendingTap.cardIndex);
  }, [isHost, svState.pendingTap, handleRevealCard]);

  // ─── Team interstitial — fires when activeTeam changes during gameplay ──
  useEffect(() => {
    if (!board || !activeTeam) return;
    if (prevActiveTeamRef.current !== activeTeam) {
      setInterstitialTeam(activeTeam);
    }
    prevActiveTeamRef.current = activeTeam;
  }, [activeTeam, board]);

  // ─── Pass Turn (any operative on the active team — same Firestore rules as pendingTap) ──
  const handlePassTurn = useCallback(async () => {
    if (svPhase !== "operative-guess" || !activeTeam || myTeam !== activeTeam || isBoss) return;
    const nextTeam: FyveTeam = activeTeam === "syndicate1" ? "syndicate2" : "syndicate1";
    await updateFields({
      activeTeam: nextTeam,
      currentClue: null,
      guessesRemaining: 0,
      guessesUsedThisTurn: 0,
      bonusGuessAvailable: false,
      pendingTap: null,
      svPhase: "boss-clue",
    });
  }, [svPhase, activeTeam, myTeam, isBoss, updateFields]);

  // ─── Play Again (host resets to boss-select) ─────────────
  const handlePlayAgain = useCallback(async () => {
    if (!isHost) return;
    bgMusic.stop();
    gameOverDismissedRef.current = true;
    setGameOverPhase(null);
    await updateFields({
      board: null,
      keyDocId: null,
      activeTeam: null,
      currentClue: null,
      guessesRemaining: 0,
      guessesUsedThisTurn: 0,
      bonusGuessAvailable: false,
      pendingTap: null,
      winningTeam: null,
      loseByBomb: false,
      bombRevealedBy: null,
      t1Score: 0,
      t2Score: 0,
      t1RevealCount: 0,
      t2RevealCount: 0,
      t1RevealedAssets: [],
      t2RevealedAssets: [],
      status: "playing",
      svPhase: "boss-select",
    });
  }, [isHost, updateFields]);

  // ─── Show game-over overlay when entering via Firestore sync (non-host clients) ──
  useEffect(() => {
    if (svPhase === "game-over" && !animReveal && !gameOverPhase && !gameOverDismissedRef.current) {
      setGameOverPhase(loseByBomb ? "loss" : "win");
    }
    // Reset the guard once Firestore has moved past game-over
    if (svPhase !== "game-over") {
      gameOverDismissedRef.current = false;
    }
  }, [svPhase, animReveal, gameOverPhase, loseByBomb]);

  // ─── Bomb loss → win transition (show loss for 15s, then switch to win) ──
  useEffect(() => {
    if (gameOverPhase !== "loss") return;
    const timer = setTimeout(() => setGameOverPhase("win"), 15000);
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
    <div className="relative min-h-dvh bg-black text-white overflow-hidden">
      {/* Background image */}
      {bgUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 pointer-events-none"
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
          <div className="absolute top-2 left-2 z-30 transition-opacity duration-500" style={{ opacity: activeTeam === "syndicate2" ? 0.15 : 1 }}>
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
            <div
              className="absolute -top-1 z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-black bg-black"
              style={{ right: "-15px" }}
            >
              <span className="text-base font-black leading-none" style={{ color: FYVE_COLORS.t1 }}>{t1Score}/7</span>
            </div>
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
                      {currentClue.word} : {bonusGuessAvailable ? "BONUS" : guessesRemaining}
                    </span>
                  </>
                ) : isActiveBoss ? (
                  <button
                    type="button"
                    className="rounded-lg bg-[#E84C1E] px-4 py-1.5 text-xs font-bold text-white active:scale-95 transition-transform"
                    onClick={() => window.dispatchEvent(new CustomEvent("fyve-open-clue-modal"))}
                  >
                    Create Clue
                  </button>
                ) : null}
              </div>
            );
          })()}
          {/* Right: Team 2 logo + score badge (top-left of logo) */}
          <div className="absolute top-2 right-2 z-30 transition-opacity duration-500" style={{ opacity: activeTeam === "syndicate1" ? 0.15 : 1 }}>
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
            <div
              className="absolute -top-1 z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-black bg-black"
              style={{ left: "-15px" }}
            >
              <span className="text-base font-black leading-none" style={{ color: FYVE_COLORS.t2 }}>{t2Score}/7</span>
            </div>
          </div>
        </>
      )}

      {/* Phase router */}
      <div className="relative z-10">
        {svPhase === "heist-select" && (
          <div className="flex min-h-dvh flex-col items-center justify-center px-4">
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
            <p className="mt-6 text-white/40 text-sm animate-pulse">Loading heist...</p>
          </div>
        )}

        {svPhase === "briefing" && heist && (
          <BriefingScreen
            heist={heist}
            isHost={isHost}
            onContinue={() => isHost && setPhase("team-formation")}
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
            onDraftChanged={(draft) => updateFields(draft)}
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
            onBack={isHost ? () => setPhase("team-formation") : undefined}
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
              pendingTap={svState.pendingTap}
              heist={heist}
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
              pendingTap={svState.pendingTap}
              guessesUsedThisTurn={svState.guessesUsedThisTurn}
              onTapCard={(cardIndex, tappedByGamertag) => {
                updateFields({
                  pendingTap: {
                    cardIndex,
                    tappedBy: userId,
                    tappedByGamertag,
                    confirmedAt: Date.now(),
                  },
                });
              }}
              onPassTurn={handlePassTurn}
              heist={heist}
            />
          )
        )}

        {svPhase === "card-reveal" && board && (
          isBoss ? (
            <BossScreen
              board={board}
              colorMap={bossColorMap}
              activeTeam={activeTeam!}
              myTeam={myTeam!}
              activeTeamName={activeTeamName}
              currentClue={currentClue}
              isMyTurn={false}
              pendingTap={svState.pendingTap}
              heist={heist}
            />
          ) : (
            <OperativeScreen
              board={board}
              activeTeam={activeTeam!}
              myTeam={myTeam!}
              activeTeamName={activeTeamName}
              currentClue={currentClue}
              guessesRemaining={guessesRemaining}
              canTap={false}
              heist={heist}
            />
          )
        )}

        {/* game-over phase: grid is hidden, victory overlay renders separately */}
      </div>

      {/* Game-Over: Bomb Loss Overlay — fades in on top of everything, tap to skip */}
      {gameOverPhase === "loss" && heist && winningTeam && (() => {
        const losingTeam: FyveTeam = winningTeam === "syndicate1" ? "syndicate2" : "syndicate1";
        const losingScore = losingTeam === "syndicate1" ? t1Score : t2Score;
        const elementBomb = heist.assets[losingScore];
        return (
          <JMGameResultOverlay
            variant="loss"
            teamName={losingTeam === "syndicate1" ? t1Display : t2Display}
            teamColor={losingTeam === "syndicate1" ? FYVE_COLORS.t1 : FYVE_COLORS.t2}
            teamLogoUrl={(losingTeam === "syndicate1" ? svState.draftT1Logo : svState.draftT2Logo) ?? ""}
            cardImageUrl={elementBomb?.bombImageUrl ?? ""}
            message={elementBomb?.bombDescription ?? ""}
            audioUrl={elementBomb?.bombSoundEffect ?? null}
            onDismiss={() => setGameOverPhase("win")}
          />
        );
      })()}

      {/* Game-Over: Win Overlay — fades in on top (directly for clean wins, after loss for bombs) */}
      {gameOverPhase === "win" && heist && winningTeam && (
        <JMGameResultOverlay
          variant="win"
          teamName={winningTeam === "syndicate1" ? t1Display : t2Display}
          teamColor={winningTeam === "syndicate1" ? FYVE_COLORS.t1 : FYVE_COLORS.t2}
          teamLogoUrl={(winningTeam === "syndicate1" ? svState.draftT1Logo : svState.draftT2Logo) ?? ""}
          cardImageUrl={heist.targetObjectImageUrl}
          heading={heist.title}
          message={heist.winMessage}
          audioUrl={musicUrl}
          isHost={isHost}
          onPlayAgain={handlePlayAgain}
        />
      )}

      {/* Card Reveal Overlay — flies from grid card on ALL clients */}
      {animReveal && (
        <CardRevealOverlay
          result={animReveal.result}
          activeTeam={activeTeam!}
          boardWord={animReveal.word}
          bombSoundUrl={animReveal.result.bombSoundEffect ?? null}
          onDismiss={handleRevealDismissed}
        />
      )}

      {/* Team interstitial — "Now Playing" splash on turn change */}
      {interstitialTeam && (
        <JMTeamInterstitial
          teamName={interstitialTeam === "syndicate1" ? t1Display : t2Display}
          teamColor={interstitialTeam === "syndicate1" ? FYVE_COLORS.t1 : FYVE_COLORS.t2}
          logoUrl={(interstitialTeam === "syndicate1" ? svState.draftT1Logo : svState.draftT2Logo) ?? ""}
          score={interstitialTeam === "syndicate1" ? t1Score : t2Score}
          onDismiss={() => setInterstitialTeam(null)}
        />
      )}
    </div>
  );
}
