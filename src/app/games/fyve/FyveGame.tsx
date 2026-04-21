"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/AuthProvider";
import { GameGamertagBadge, getAIAuthHeaders, bgMusic, SFX, recordGameStats } from "@/app/games/_gamecore";
import { PointsManager, Activity } from "@/lib/points";
import { JMTeamInterstitial, JMGameResultOverlay } from "@/JMKit";
import { useFyveSession } from "./useFyveSession";
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
  // Theme splash — shown once when the grid first appears
  const [themeShown, setThemeShown] = useState(false);
  const [themeFading, setThemeFading] = useState(false);
  const [themeDismissed, setThemeDismissed] = useState(false);
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
    t1Score,
    t2Score,
    t1Name,
    t2Name,
  } = svState;

  // Display names — fallback to generic if not yet assigned
  const t1Display = t1Name ?? "Team 1";
  const t2Display = t2Name ?? "Team 2";
  const activeTeamName = activeTeam ? teamDisplay(activeTeam, svState).name : "";

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
      if (!isHost || !svState.teams) return;
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
      if (!isBoss || !isMyTeamActive) return;
      await updateFields({
        currentClue: { word, number, givenBy: userId },
        guessesRemaining: number,
        guessesUsedThisTurn: 0,
        bonusGuessAvailable: false,
        svPhase: "operative-guess",
      });
    },
    [updateFields, userId, isBoss, isMyTeamActive],
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
        if (newCount >= ASSETS_PER_TEAM) {
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
        if (newCount >= ASSETS_PER_TEAM) {
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
        PointsManager.award(Activity.PLAY_GAME);
        if (isHost) PointsManager.award(Activity.HOST_GAME);
        const allUids = session?.playerUids ?? [];
        const winTeam = updates["winningTeam"] as FyveTeam;
        const winnerUids = svState.teams?.[winTeam]?.members ?? [];
        if (winnerUids.includes(userId)) PointsManager.award(Activity.WIN_GAME);
        recordGameStats(allUids, winnerUids, session?.ownerId ?? "");
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
    [isHost, userId, keyDocId, selectedHeistId, sessionId, board, activeTeam, svState, updateFields, session?.playerUids, session?.ownerId],
  );

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

  // ─── After Card Reveal Animation (non-bomb cards only) ─────
  const handleRevealDismissed = useCallback(async () => {
    const revealedIndex = animReveal?.cardIndex;
    prevBoardRef.current = board; // Sync ref to prevent re-trigger
    revealPendingRef.current = false;

    // 5th-card clean win: keep reveal visible under win overlay, then clean up
    if (svState.winningTeam) {
      setGameOverPhase("win");
      setTimeout(() => setAnimReveal(null), 1200);
      return;
    }

    setAnimReveal(null);

    if (!isHost || revealedIndex == null) return;

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
  // Suppress until theme splash has been shown and dismissed — will be triggered manually on dismiss
  useEffect(() => {
    if (!board || !activeTeam) {
      // Reset ref when game is torn down (Play Again) so the next
      // game's first team always triggers the interstitial.
      prevActiveTeamRef.current = null;
      return;
    }
    if (prevActiveTeamRef.current !== activeTeam) {
      if (themeDismissed) {
        setInterstitialTeam(activeTeam);
      }
    }
    prevActiveTeamRef.current = activeTeam;
  }, [activeTeam, board, themeDismissed]);

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

  // ─── Theme splash — show once when gameplay begins ──
  useEffect(() => {
    if (themeShown || themeDismissed) return;
    if (svPhase === "boss-clue" || svPhase === "operative-guess") {
      setThemeShown(true);
    }
  }, [svPhase, themeShown, themeDismissed]);

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
                      {currentClue.word} : {bonusGuessAvailable ? "BONUS" : guessesRemaining}
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
              pendingTap={svState.pendingTap}
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
              t1Score={t1Score}
              t2Score={t2Score}
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
              canTap={false}
              heist={heist}
              t1Score={t1Score}
              t2Score={t2Score}
            />
          )
        )}

        {/* game-over phase: grid is hidden, victory overlay renders separately */}
      </div>

      {/* Theme splash — shown once at game start */}
      {themeShown && !themeDismissed && (
        <div
          className="fixed inset-0 z-40 flex flex-col items-center justify-center"
          style={{
            opacity: themeFading ? 0 : 1,
            transition: "opacity 600ms ease",
          }}
          onClick={() => {
            if (themeFading) return;
            setThemeFading(true);
            // Launch interstitial on top of the fading theme
            if (activeTeam) setInterstitialTeam(activeTeam);
            // Remove theme from DOM after fade completes
            setTimeout(() => setThemeDismissed(true), 700);
          }}
          role="button"
        >
          <div
            className="absolute inset-0 bg-black/85"
            style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
          />
          <div className="relative z-10 flex flex-col items-center px-[50px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/games/fyve/Fyve-Things-2.jpg"
              alt="FYVE Things"
              className="w-full max-w-[300px] rounded-2xl border border-white/20"
              draggable={false}
            />
            <p className="mt-6 text-sm text-white/40 animate-pulse">
              — Tap to continue —
            </p>
          </div>
        </div>
      )}

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
