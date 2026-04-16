"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { GameGamertagBadge } from "@/app/games/_gamecore";
import { getAIAuthHeaders } from "@/app/games/_gamecore";
import { useSevynSession } from "./useSevynSession";
import type {
  SevynHeist,
  SevynTeam,
  SevynRevealResult,
  SevynBoardCard,
  CardType,
} from "./sevynTypes";

// Screens
import BriefingScreen from "./screens/BriefingScreen";
import TeamFormationScreen from "./screens/TeamFormationScreen";
import ArchitectVoteScreen from "./screens/ArchitectVoteScreen";

import ArchitectScreen from "./screens/ArchitectScreen";
import OperativeScreen from "./screens/OperativeScreen";
import CardRevealOverlay from "./screens/CardRevealOverlay";
import WinScreen from "./screens/WinScreen";

// ─── Constants ──────────────────────────────────────────────

const SEVYN_COLORS = {
  navy: "#0D1B2E",
  orange: "#E84C1E",
  gray: "#8C9BAD",
  white: "#FFFFFF",
  t1: "#E84C1E",    // red team
  t2: "#3B82F6",    // blue team
  neutral: "#8C9BAD",
  bomb: "#000000",
} as const;

export { SEVYN_COLORS };

const TEAM_NAMES = [
  "Ghosts", "Angels", "Devils", "Wolves", "Vipers", "Hawks", "Owls", "Dragons",
  "Cobras", "Phantoms", "Jackals", "Falcons", "Reapers", "Scorpions", "Titans",
  "Ravens", "Shadows", "Serpents", "Foxes", "Lions", "Panthers", "Vultures",
  "Specters", "Crows", "Wasps", "Spiders", "Sharks", "Wraiths", "Condors",
  "Jaguars", "Mantis", "Hornets", "Pythons", "Lynx", "Raptors", "Stingrays",
  "Barracudas", "Piranhas", "Kraken", "Chimeras", "Hydras", "Basilisks",
  "Gargoyles", "Sentinels", "Nomads", "Ronin", "Saboteurs", "Marauders",
  "Corsairs", "Outlaws",
];

function pickTeamNames(): { t1Name: string; t2Name: string } {
  const shuffled = [...TEAM_NAMES].sort(() => Math.random() - 0.5);
  return { t1Name: `Red ${shuffled[0]}`, t2Name: `Blue ${shuffled[1]}` };
}

// ─── Score Circle ──────────────────────────────────────────

const CIRCLE_SIZE = 56;
const STROKE_WIDTH = 3;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ScoreCircle({ score, color }: { score: number; color: string }) {
  const progress = score / 7;
  const offset = CIRCUMFERENCE * (1 - progress);

  return (
    <div className="relative mt-0.5" style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}>
      <svg width={CIRCLE_SIZE} height={CIRCLE_SIZE} className="absolute inset-0 -rotate-90">
        {/* Team color progress arc */}
        <circle
          cx={CIRCLE_SIZE / 2}
          cy={CIRCLE_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {/* Inner black circle with score */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="flex items-center justify-center rounded-full bg-black"
          style={{ width: CIRCLE_SIZE - STROKE_WIDTH * 2 - 2, height: CIRCLE_SIZE - STROKE_WIDTH * 2 - 2 }}
        >
          <span className="text-base font-black" style={{ color }}>
            {score}/7
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Props ──────────────────────────────────────────────────

interface SevynGameProps {
  sessionId: string;
  splashBgURL?: string;
  gameLogoURL?: string;
}

export default function SevynGame({
  sessionId,
  splashBgURL: _splashBgURL,
  gameLogoURL: _gameLogoURL,
}: SevynGameProps) {
  const { user } = useAuth();
  const userId = user?.uid ?? "";
  void _splashBgURL; void _gameLogoURL; // reserved for future use
  const {
    session,
    svState,
    isHost,
    myTeam,
    isArchitect,
    isMyTeamActive,
    setPhase,
    updateFields,
  } = useSevynSession({ sessionId, userId });

  // Track loaded heist data for briefing + reveal metadata
  const [heist, setHeist] = useState<SevynHeist | null>(null);
  // Architect color map (fetched from server, only for architects)
  const [architectColorMap, setArchitectColorMap] = useState<CardType[] | null>(null);
  // Card reveal animation — driven by board-change detection (all clients)
  const [animReveal, setAnimReveal] = useState<{
    cardIndex: number;
    word: string;
    result: SevynRevealResult;
  } | null>(null);
  const prevBoardRef = useRef<SevynBoardCard[] | null>(null);
  const {
    svPhase,
    selectedHeistId,
    board,
    activeTeam,
    currentClue,
    guessesRemaining,
    keyDocId,
    winningTeam,
    loseByBomb,
    t1Score,
    t2Score,
    t1Name,
    t2Name,
  } = svState;

  // Display names — fallback to generic if not yet assigned
  const t1Display = t1Name ?? "Red Team";
  const t2Display = t2Name ?? "Blue Team";
  const activeTeamName = activeTeam ? (activeTeam === "syndicate1" ? t1Display : t2Display) : "";
  const myTeamName = myTeam ? (myTeam === "syndicate1" ? t1Display : t2Display) : "";

  // ─── Auto-advance from lobby heist selection ───────────────
  // If lobby selected a heist (sevynLobbyHeist* fields), apply it on first load
  useEffect(() => {
    if (!isHost || !session || svPhase !== "heist-select") return;
    const raw = session as unknown as Record<string, unknown>;
    const lobbyHeistId = raw["sevynLobbyHeistId"] as string | undefined;
    if (!lobbyHeistId) return;

    (async () => {
      const { getHeist } = await import("@/lib/sevyn-heists");
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
        heistClients: h.clients,
        svPhase: "briefing",
      });
    })();
  }, [isHost, session, svPhase, updateFields]);

  // ─── Load heist data when selected ─────────────────────────
  useEffect(() => {
    if (!selectedHeistId) return;
    (async () => {
      const { getHeist } = await import("@/lib/sevyn-heists");
      const h = await getHeist(selectedHeistId);
      if (h) setHeist(h);
    })();
  }, [selectedHeistId]);

  // ─── Preload all heist reveal images into browser cache ────
  useEffect(() => {
    if (!heist) return;
    const urls: string[] = [];
    for (const a of heist.assets) { if (a.imageUrl) urls.push(a.imageUrl); }
    for (const c of heist.civilians) { if (c.imageUrl) urls.push(c.imageUrl); }
    if (heist.bomb.imageUrl) urls.push(heist.bomb.imageUrl);
    for (const url of urls) {
      const img = new Image();
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

  // Preload bomb sound when it becomes available
  useEffect(() => {
    if (!svState.bombSoundUrl) return;
    const a = new Audio(svState.bombSoundUrl);
    a.preload = "auto";
    a.load();
  }, [svState.bombSoundUrl]);

  // ─── Fetch architect view when game starts and I'm an architect ──
  useEffect(() => {
    if (!isArchitect || !keyDocId || !sessionId) return;
    (async () => {
      const headers = await getAIAuthHeaders();
      const res = await fetch("/api/games/sevyn", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "get-architect-view",
          sessionId,
          keyDocId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setArchitectColorMap(data.colorMap);

        // ─── DEBUG: log architect view with board ─────────
        const colorMap = data.colorMap as string[];
        console.log("[SEVYN CLIENT] Architect color map received:");
        board?.forEach((card, i) => {
          const type = colorMap[i] ?? "?";
          const typeLabel = type === "T1" ? "Syndicate 1" : type === "T2" ? "Syndicate 2" : type === "N" ? "Civilian" : type === "BOMB" ? "BOMB" : type;
          console.log(`  Card ${i + 1}: "${card.word}" → ${typeLabel}`);
        });
      }
    })();
  }, [isArchitect, keyDocId, sessionId, board]);

  // ─── Team Formation Complete ──────────────────────────────
  const handleTeamsFormed = useCallback(
    async (teams: Record<SevynTeam, { members: string[] }>) => {
      const { t1Name, t2Name } = pickTeamNames();
      await updateFields({
        teams: {
          syndicate1: { members: teams.syndicate1.members, architectUid: null },
          syndicate2: { members: teams.syndicate2.members, architectUid: null },
        },
        t1Name,
        t2Name,
        svPhase: "architect-vote",
        architectVotes: {},
      });
    },
    [updateFields],
  );

  // ─── Game Start (generate key + board on server) ──────────
  const startGame = useCallback(
    async (firstTeam: SevynTeam) => {
      if (!isHost || !selectedHeistId) return;
      const headers = await getAIAuthHeaders();
      const res = await fetch("/api/games/sevyn", {
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
      console.log("[SEVYN CLIENT] Board received from generate-key:");
      (data.board as { index: number; word: string }[]).forEach((c, i) => {
        console.log(`  Card ${i + 1}: "${c.word}"`);
      });

      await updateFields({
        bombSoundUrl: data.bombSoundEffect ?? null,
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
        svPhase: "architect-clue",
      });
    },
    [isHost, selectedHeistId, sessionId, updateFields],
  );

  // ─── Architect Vote Complete → immediately start game ─────
  const handleArchitectsElected = useCallback(
    async (s1Architect: string, s2Architect: string) => {
      if (!svState.teams) return;
      await updateFields({
        teams: {
          syndicate1: { ...svState.teams.syndicate1, architectUid: s1Architect },
          syndicate2: { ...svState.teams.syndicate2, architectUid: s2Architect },
        },
      });
      // Host picks a random first team and starts the game immediately
      if (isHost) {
        const firstTeam: SevynTeam = Math.random() < 0.5 ? "syndicate1" : "syndicate2";
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
      const res = await fetch("/api/games/sevyn", {
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
      const result: SevynRevealResult = await res.json();

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
        };
      }

      // Calculate score changes + game outcome
      const updates: Record<string, unknown> = {
        board: updatedBoard,
        svPhase: "card-reveal" as const,
        pendingTap: null,
      };

      const currentActiveTeam = activeTeam!;
      const oppositeTeam: SevynTeam = currentActiveTeam === "syndicate1" ? "syndicate2" : "syndicate1";

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

          if (newRemaining <= 0) {
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

    // If game is over, phase is already set
    if (svState.winningTeam) return;

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
      const nextTeam: SevynTeam = currentActiveTeam === "syndicate1" ? "syndicate2" : "syndicate1";
      await updateFields({
        activeTeam: nextTeam,
        currentClue: null,
        guessesRemaining: 0,
        guessesUsedThisTurn: 0,
        bonusGuessAvailable: false,
        svPhase: "architect-clue",
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

  // ─── Pass Turn ────────────────────────────────────────────
  const handlePassTurn = useCallback(async () => {
    if (!isHost || !activeTeam) return;
    const nextTeam: SevynTeam = activeTeam === "syndicate1" ? "syndicate2" : "syndicate1";
    await updateFields({
      activeTeam: nextTeam,
      currentClue: null,
      guessesRemaining: 0,
      guessesUsedThisTurn: 0,
      bonusGuessAvailable: false,
      pendingTap: null,
      svPhase: "architect-clue",
    });
  }, [isHost, activeTeam, updateFields]);

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

      {/* Gamertag badge */}
      <GameGamertagBadge badgeClassName="bg-[#0D1B2E]/80" />

      {/* Score circles — top corners, scroll with page */}
      {board && svPhase !== "game-over" && (
        <>
          {/* Left: Team 1 */}
          <div className="absolute top-2 left-3 z-30 flex flex-col items-start">
            <span className="text-[10px] font-bold tracking-wide" style={{ color: SEVYN_COLORS.t1 }}>
              {t1Display.toUpperCase()}
            </span>
            <ScoreCircle score={t1Score} color={SEVYN_COLORS.t1} />
          </div>
          {/* Center: Now Playing + CODE / CREATE — bottom-aligned to grid top */}
          {activeTeam && (() => {
            const clueColor = activeTeam === "syndicate1" ? SEVYN_COLORS.t1 : SEVYN_COLORS.t2;
            const teamName = activeTeam === "syndicate1" ? t1Display : t2Display;
            const isActiveArchitect = isArchitect && isMyTeamActive && !currentClue;
            return (
              <div className="absolute left-16 right-16 z-40 flex flex-col items-center" style={{ top: "130px", transform: "translateY(calc(-100% - 10px))" }}>
                <span className="text-[10px] font-bold tracking-wide" style={{ color: clueColor }}>
                  Now Playing: {teamName}
                </span>
                {currentClue ? (
                  <span className="text-xl font-black">
                    <span style={{ color: clueColor }}>CODE [</span>
                    <span className="text-white"> {currentClue.word} : {currentClue.number} </span>
                    <span style={{ color: clueColor }}>]</span>
                  </span>
                ) : isActiveArchitect ? (
                  <span className="text-base font-black text-white">
                    Create Clue (Below Grid)
                  </span>
                ) : null}
              </div>
            );
          })()}
          {/* Right: Team 2 */}
          <div className="absolute top-2 right-3 z-30 flex flex-col items-end">
            <span className="text-[10px] font-bold tracking-wide" style={{ color: SEVYN_COLORS.t2 }}>
              {t2Display.toUpperCase()}
            </span>
            <ScoreCircle score={t2Score} color={SEVYN_COLORS.t2} />
          </div>
        </>
      )}

      {/* Phase router */}
      <div className="relative z-10">
        {svPhase === "heist-select" && (
          <div className="flex min-h-dvh flex-col items-center justify-center px-4">
            <p className="text-white/60 animate-pulse">Loading heist...</p>
          </div>
        )}

        {svPhase === "briefing" && heist && (
          <BriefingScreen
            heist={heist}
            myTeam={myTeam}
            isHost={isHost}
            onContinue={() => isHost && setPhase("team-formation")}
          />
        )}

        {svPhase === "team-formation" && session && (
          <TeamFormationScreen
            session={session}
            isHost={isHost}
            onTeamsFormed={handleTeamsFormed}
          />
        )}

        {svPhase === "architect-vote" && session && svState.teams && (
          <ArchitectVoteScreen
            session={session}
            teams={svState.teams}
            userId={userId}
            myTeam={myTeam}
            myTeamName={myTeamName}
            isHost={isHost}
            votes={svState.architectVotes ?? {}}
            onVote={async (candidateUid) => {
              await updateFields({
                [`architectVotes.${userId}`]: candidateUid,
              });
            }}
            onElected={handleArchitectsElected}
          />
        )}

        {svPhase === "architect-clue" && board && (
          isArchitect && isMyTeamActive ? (
            <ArchitectScreen
              board={board}
              colorMap={architectColorMap}
              activeTeam={activeTeam!}
              myTeam={myTeam!}
              activeTeamName={activeTeamName}
              currentClue={currentClue}
              isMyTurn={true}
              onSubmitClue={handleClueSubmitted}
              heist={heist}
            />
          ) : isArchitect ? (
            <ArchitectScreen
              board={board}
              colorMap={architectColorMap}
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
              waitingForClue
            />
          )
        )}

        {svPhase === "operative-guess" && board && (
          isArchitect ? (
            <ArchitectScreen
              board={board}
              colorMap={architectColorMap}
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
              canTap={isMyTeamActive && !isArchitect}
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
          isArchitect ? (
            <ArchitectScreen
              board={board}
              colorMap={architectColorMap}
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

        {svPhase === "game-over" && heist && (
          <WinScreen
            heist={heist}
            winningTeam={winningTeam}
            loseByBomb={loseByBomb}
            teams={svState.teams}
            session={session}
            t1Score={t1Score}
            t2Score={t2Score}
            t1Name={t1Display}
            t2Name={t2Display}
          />
        )}
      </div>

      {/* Card Reveal Overlay — flies from grid card on ALL clients */}
      {animReveal && (
        <CardRevealOverlay
          result={animReveal.result}
          activeTeam={activeTeam!}
          boardWord={animReveal.word}
          bombSoundUrl={animReveal.result.cardType === "BOMB" ? svState.bombSoundUrl : null}
          onDismiss={handleRevealDismissed}
        />
      )}
    </div>
  );
}
