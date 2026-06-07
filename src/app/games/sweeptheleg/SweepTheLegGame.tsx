"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import Image from "next/image";
import { useJMStyle } from "@/JMStyle";
import { JMBannerText, JMGameScoreboard } from "@/JMKit";
import { simpleMove, postGameComment, useMultiplayerRound, useGameMusic, isAiPlayer, getPersona, updateSessionFields } from "../_gamecore";
import { useAuth } from "@/lib/AuthProvider";
import { submitMove } from "@/lib/game-sessions";
import type { JMContent } from "@/lib/content-types";
import type { GameEndResult } from "../_gamecore/registry/types";

type Attack = "H" | "M" | "L";

interface MoveRecord {
  player: Attack;
  opponent: Attack;
  winner: "player" | "opponent" | "tie";
}
type ChapterName =
  | "Ready"
  | "H-L" | "H-M" | "H-H"
  | "M-H" | "M-L" | "M-M"
  | "L-M" | "L-H" | "L-L"
  | "W-W" | "R-W";
type GamePhase = "idle" | "ready" | "animating" | "finished";

const CHAPTERS: Record<ChapterName, { start: number; end: number }> = {
  Ready: { start: 0.0,     end: 1.5  },
  "H-L": { start: 1.667,   end: 5.083  },
  "H-M": { start: 5.625,   end: 9.833  },
  "H-H": { start: 10.375,  end: 13.458 },
  "M-H": { start: 14.0,    end: 17.375 },
  "M-L": { start: 17.917,  end: 22.375 },
  "M-M": { start: 22.917,  end: 26.083 },
  "L-M": { start: 26.625,  end: 31.958 },
  "L-H": { start: 32.5,    end: 38.458 },
  "L-L": { start: 39.0,    end: 41.75  },
  "W-W": { start: 42.292,  end: 45.0   },
  "R-W": { start: 45.542,  end: 48.292 },
};

const FRAME = 1 / 24;
const POINTS_TO_WIN = 5;
// After a move, stay optimistic this long (chosen attack highlighted, staging
// video looping) before fading in "Waiting for opponent…". Long enough that a
// normal resolve never shows it; only a genuinely slow opponent / AI does.
const WAITING_LABEL_DELAY_MS = 1500;
const ATTACKS: Attack[] = ["L", "M", "H"];
const ATTACK_LABEL: Record<Attack, string> = { H: "HIGH", M: "MID", L: "LOW" };
const ATTACK_BEATS: Record<Attack, string> = { H: "beats Low", M: "beats High", L: "beats Mid" };
type PlayerSide = "red" | "white";

const ACTION_TO_ATTACK: Record<string, Attack> = {
  high: "H",
  mid: "M",
  low: "L",
};

function parseAttackFromAction(action: string): Attack | null {
  const key = action.toLowerCase().trim();
  for (const [word, atk] of Object.entries(ACTION_TO_ATTACK)) {
    if (key.startsWith(word)) return atk;
  }
  return null;
}

function buildMovePrompt(aiSide: "red" | "white", history: MoveRecord[]): string {
  const playerSide = aiSide === "red" ? "White" : "Red";
  const nameMap: Record<string, string> = { H: "High", M: "Mid", L: "Low" };

  const system = `You are the ${aiSide.toUpperCase()} fighter in a martial-arts game. The human player is ${playerSide}. Each round both fighters simultaneously choose High, Mid, or Low.

WHAT BEATS WHAT:
- High beats Low (if opponent plays Low, you win with High)
- Mid beats High (if opponent plays High, you win with Mid)
- Low beats Mid (if opponent plays Mid, you win with Low)
- Same attack = tie

BONUS POINTS:
- Red scores 2 points (instead of 1) when Red plays Low and White plays Mid.
- White scores 2 points (instead of 1) when White plays Low and Red plays High.

First to 5 points wins. Study the player's patterns and choose the move most likely to beat them. Look for tendencies, repeats, sequences, and post-win/post-loss habits.

CRITICAL: Your ACTION must match your reasoning. If you reason that you should counter their Low, your ACTION must be High. If you reason that you should counter their High, your ACTION must be Mid. If you reason you should counter their Mid, your ACTION must be Low.

Format your response EXACTLY as:
REASONING: <1 brief sentence for the player to read after the game>
ACTION: <High, Mid, or Low>`;

  if (history.length === 0) {
    return system + "\n\nThis is the first round — no history yet. Pick your opening move.";
  }

  const lines = history.map((m, i) => {
    const result = m.winner === "tie" ? "Tie" : m.winner === "player" ? "Player won" : "You won";
    return `Round ${i + 1}: Player=${nameMap[m.player]}, You=${nameMap[m.opponent]} → ${result}`;
  });
  return system + `\n\nMove history:\n${lines.join("\n")}\n\nRound ${history.length + 1} — what do you play?`;
}

function buildPostGamePrompt(aiSide: "red" | "white", history: MoveRecord[], aiWon: boolean): string {
  const playerSide = aiSide === "red" ? "White" : "Red";
  const nameMap: Record<string, string> = { H: "High", M: "Mid", L: "Low" };
  const lines = history.map((m, i) => {
    const result = m.winner === "tie" ? "Tie" : m.winner === "player" ? "Player won" : "You won";
    return `Round ${i + 1}: Player=${nameMap[m.player]}, You=${nameMap[m.opponent]} → ${result}`;
  });

  return `You are the ${aiSide.toUpperCase()} fighter in a martial-arts game. The human player is ${playerSide}.

Full match history:
${lines.join("\n")}

The game is over. ${aiWon ? "You won!" : "You lost."} Give a brief post-game comment (1-2 sentences) reflecting on the match — what patterns you noticed, what worked or didn't, and whether the player surprised you. Be conversational and a good sport. Reply with ONLY your comment, nothing else.`;
}

function AttackIndicator({
  side,
  attack,
}: {
  side: "red" | "white";
  attack: Attack;
}) {
  const isRed = side === "red";
  const size = 48;
  const color = isRed ? "#ef4444" : "#ffffff";

  const verticalStyle: React.CSSProperties =
    attack === "H"
      ? { top: 24 }
      : attack === "L"
        ? { bottom: 24 }
        : { top: "50%", marginTop: -(size / 2) };

  const horizontalStyle: React.CSSProperties = isRed
    ? { left: -(size / 2) }
    : { right: -(size / 2) };

  const rotation = isRed ? 90 : -90;

  return (
    <div
      className={`absolute z-10 ${isRed ? "animate-indicator-in-left" : "animate-indicator-in-right"}`}
      style={{
        ...verticalStyle,
        ...horizontalStyle,
        width: size,
        height: size,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{ transform: `rotate(${rotation}deg)`, filter: `drop-shadow(0 0 6px ${color}80)` }}
      >
        <polygon points="50,15 90,85 50,65 10,85" fill={color} />
      </svg>
    </div>
  );
}

const WIN_PHRASES = [
  "CONGRATS!",
  "WAY TO GO!",
  "YOU CRUSHED!",
  "YOU DID IT!",
  "YOU RULE!",
  "YOU DA BOSS!",
  "YOU'RE FANTASTIC!",
  "YOU'RE AMAZING!",
  "YOU DOMINATED!",
  "YOU'RE THE BEST!",
];

const AI_WIN_PHRASES = [
  "You beat AI",
  "You crushed AI!",
  "You defeated AI",
  "You destroyed Skynet",
  "You beat the machine",
  "You slayed the Bot",
  "You pwned AI",
  "You beat the bot",
  "You killed AI",
  "You ruled the machine",
];

const AI_LOSE_PHRASES = [
  "Skynet destroyed you",
  "The Bot Bites Back",
  "The Revenge of AI",
  "The Bot Beat You",
  "The Machine Ate Your Lunch",
  "Bullied by the Bot",
  "You Lost to AI",
  "Pwned by AI",
  "AI kicked yo butt",
  "AI Domination",
];

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export default function SweepTheLegGame({
  sessionId,
  gameData,
  onGameEnd,
}: {
  sessionId: string;
  gameData: JMContent;
  onGameEnd: (result: GameEndResult) => void;
}) {
  const { theme } = useJMStyle();
  const { user, gamertag: myTag } = useAuth();
  const userId = user?.uid ?? "";

  const splashLogoURL = gameData.splashLogoURL ?? gameData.coverURL;
  const splashBgURL = gameData.splashBgURL;
  const gameSlug = gameData.slug ?? "sweeptheleg";
  const backgroundMusicURL = gameData.backgroundMusicURL;
  const backgroundMusicVolume = gameData.backgroundMusicVolume;

  const musicURL = backgroundMusicURL || (gameSlug ? `/music/${gameSlug}.mp3` : null);
  const { ensurePlaying, connectVideo } = useGameMusic({ url: musicURL, volume: backgroundMusicVolume ?? 0.3 });

  const [phase, setPhase] = useState<GamePhase>("idle");
  const [redScore, setRedScore] = useState(0);
  const [whiteScore, setWhiteScore] = useState(0);
  const [playerSide, setPlayerSide] = useState<PlayerSide>("red");
  const [endMessage, setEndMessage] = useState("");
  const [roundAttacks, setRoundAttacks] = useState<{ red: Attack; white: Attack } | null>(null);
  const [selectedAttack, setSelectedAttack] = useState<Attack | null>(null);
  const [showWaiting, setShowWaiting] = useState(false);
  const [joinerAccepted, setJoinerAccepted] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const chapterRef = useRef<ChapterName>("Ready");
  const loopingRef = useRef(false);
  const freezeRef = useRef(false);
  const onEndRef = useRef<(() => void) | null>(null);
  const rafRef = useRef(0);
  const phaseRef = useRef<GamePhase>("idle");
  const redRef = useRef(0);
  const whiteRef = useRef(0);
  const sideRef = useRef<PlayerSide>("red");
  const goToResultsRef = useRef<() => void>(() => {});

  // Rounds are resolved server-side (resolverKey "hml"); this hook just
  // subscribes, submits moves, and surfaces the server-written rounds.
  const {
    session: mpSession,
    phase: mpPhase,
    isHost: mpIsHost,
    submitMove: mpSubmitMove,
    markAnimationDone,
  } = useMultiplayerRound({
    sessionId,
    userId,
  });

  // Derive the player's assigned side from the multiplayer session
  const mpSide: PlayerSide | null = useMemo(() => {
    if (!mpSession?.playerSides || !userId) return null;
    const s = mpSession.playerSides[userId];
    return s === "red" || s === "white" ? s : null;
  }, [mpSession?.playerSides, userId]);

  // ─── AI opponent (a session player; the host drives its moves) ───
  const aiUid = useMemo(
    () => mpSession?.players.find((p) => isAiPlayer(p.uid))?.uid ?? null,
    [mpSession?.players],
  );
  const aiSide = useMemo(
    () => (aiUid ? mpSession?.playerSides?.[aiUid] : undefined),
    [aiUid, mpSession?.playerSides],
  );
  const aiPersona = useMemo(() => (aiUid ? getPersona(aiUid) : undefined), [aiUid]);
  const personaPrompt = aiPersona?.prompt || undefined;
  const personaVoice = aiPersona?.voice || undefined;
  const aiName = aiPersona?.name || "AI";
  const vsAI = !!aiUid;

  // Reconstruct the AI's move history (from its perspective) for prompt context.
  const aiHistory = useMemo<MoveRecord[]>(() => {
    if (!aiUid || !aiSide || !mpSession?.rounds) return [];
    const humanUid = mpSession.players.find((p) => p.uid !== aiUid)?.uid ?? "";
    return mpSession.rounds.map((r) => {
      const res = r.result as { winner: "red" | "white" | null };
      const aiAttack = (r.moves[aiUid] ?? "H") as Attack;
      const humanAttack = (r.moves[humanUid] ?? "H") as Attack;
      const winner: MoveRecord["winner"] =
        res.winner === null ? "tie" : res.winner === aiSide ? "opponent" : "player";
      return { player: humanAttack, opponent: aiAttack, winner };
    });
  }, [aiUid, aiSide, mpSession?.rounds, mpSession?.players]);

  const opponentGamertag = useMemo(() => {
    if (!mpSession || !user?.uid) return null;
    const opp = mpSession.players.find((p) => p.uid !== user.uid);
    return opp?.gamertag ?? null;
  }, [mpSession, user]);

  const setP = useCallback((p: GamePhase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const videoMountRef = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
  }, []);

  const playChapter = useCallback(
    (
      name: ChapterName,
      opts: { loop?: boolean; freeze?: boolean; onEnd?: () => void } = {},
    ) => {
      const v = videoRef.current;
      if (!v) return;
      connectVideo(v);
      chapterRef.current = name;
      loopingRef.current = opts.loop ?? false;
      freezeRef.current = opts.freeze ?? false;
      onEndRef.current = opts.onEnd ?? null;
      v.currentTime = CHAPTERS[name].start;
      v.play().catch(() => {});
    },
    [connectVideo],
  );

  useEffect(() => {
    let active = true;
    const wasPlayingRef = { current: false };

    function tick() {
      if (!active) return;
      const v = videoRef.current;
      if (v && !v.paused && !v.ended && !v.seeking) {
        const ch = CHAPTERS[chapterRef.current];
        if (v.currentTime >= ch.end - FRAME) {
          if (loopingRef.current) {
            v.currentTime = ch.start;
          } else if (freezeRef.current) {
            v.pause();
          } else {
            const cb = onEndRef.current;
            onEndRef.current = null;
            cb?.();
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    function onVisibilityChange() {
      const v = videoRef.current;
      if (!v) return;
      if (document.hidden) {
        wasPlayingRef.current = !v.paused;
        if (!v.paused) v.pause();
      } else if (wasPlayingRef.current) {
        v.currentTime = CHAPTERS[chapterRef.current].start;
        v.play().catch(() => {});
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const handleStart = useCallback(
    (side: PlayerSide) => {
      ensurePlaying();
      sideRef.current = side;
      setPlayerSide(side);
      redRef.current = 0;
      whiteRef.current = 0;
      setSelectedAttack(null);
      setRedScore(0);
      setWhiteScore(0);
      setP("ready");
      playChapter("Ready", { loop: true });
    },
    [playChapter, setP, ensurePlaying],
  );

  const mpStartedRef = useRef(false);
  const mpRoundsLenRef = useRef(0);

  // Auto-start the match once the session is playing and our side is known.
  // (The factory re-mounts this component for a rematch, so no restart
  // detection is needed here.)
  useEffect(() => {
    if (mpStartedRef.current) return;
    if (!mpSession || mpSession.status !== "playing" || !mpSide) return;

    // Joiner must tap the "Join Match" button once to satisfy iOS autoplay
    // gesture requirements before the video starts. The host has a fresh
    // gesture from "Start Game", so they auto-enter.
    if (!mpIsHost && !joinerAccepted) return;

    mpStartedRef.current = true;
    requestAnimationFrame(() => handleStart(mpSide));
  }, [mpSession, mpSide, mpIsHost, joinerAccepted, handleStart]);

  // Round results: play the video chapter, update scores, log the transcript.
  useEffect(() => {
    if (!mpSession?.rounds?.length) return;
    const rounds = mpSession.rounds;
    if (rounds.length <= mpRoundsLenRef.current) return;
    mpRoundsLenRef.current = rounds.length;

    const latest = rounds[rounds.length - 1]!;
    const res = latest.result as {
      chapter: ChapterName;
      winner: "red" | "white" | null;
      redDelta: number;
      whiteDelta: number;
      redScore: number;
      whiteScore: number;
    };

    const playerSidesMap = mpSession.playerSides ?? {};
    const redAttack = (latest.moves[Object.entries(playerSidesMap).find(([, s]) => s === "red")?.[0] ?? ""] ?? "H") as Attack;
    const whiteAttack = (latest.moves[Object.entries(playerSidesMap).find(([, s]) => s === "white")?.[0] ?? ""] ?? "H") as Attack;

    // Defer state updates to next frame to avoid synchronous setState-in-effect
    requestAnimationFrame(() => {
      setRoundAttacks({ red: redAttack, white: whiteAttack });

      const finishMessage = (playerWon: boolean) =>
        vsAI
          ? pickRandom(playerWon ? AI_WIN_PHRASES : AI_LOSE_PHRASES)
          : playerWon
            ? pickRandom(WIN_PHRASES)
            : "You Lose!";

      playChapter(res.chapter, {
        onEnd: () => {
          setRoundAttacks(null);
          redRef.current = res.redScore;
          whiteRef.current = res.whiteScore;
          setRedScore(res.redScore);
          setWhiteScore(res.whiteScore);

          // Game over: play the winner animation, then auto-advance to the
          // result screen (GC4) when it finishes — no button.
          if (res.redScore >= POINTS_TO_WIN) {
            setEndMessage(finishMessage(sideRef.current === "red"));
            setP("finished");
            playChapter("R-W", { onEnd: () => goToResultsRef.current() });
          } else if (res.whiteScore >= POINTS_TO_WIN) {
            setEndMessage(finishMessage(sideRef.current === "white"));
            setP("finished");
            playChapter("W-W", { onEnd: () => goToResultsRef.current() });
          } else {
            setP("ready");
            playChapter("Ready", { loop: true });
            markAnimationDone();
          }
        },
      });
    });
  }, [mpSession, vsAI, playChapter, setP, markAnimationDone]);

  // Stay optimistic right after a move: keep the chosen attack highlighted and
  // only declare "waiting for opponent" if the resolve genuinely takes a beat
  // (slow opponent / AI still thinking). Avoids a flicker on normal fast
  // resolves now that resolution round-trips the server.
  useEffect(() => {
    if (mpPhase === "submitted") {
      const t = setTimeout(() => setShowWaiting(true), WAITING_LABEL_DELAY_MS);
      return () => clearTimeout(t);
    }
    const r = requestAnimationFrame(() => setShowWaiting(false));
    return () => cancelAnimationFrame(r);
  }, [mpPhase]);

  const fetchAiMove = useCallback((): Promise<{ attack: Attack; reasoning: string }> => {
    const side = aiSide === "red" || aiSide === "white" ? aiSide : "white";
    const prompt = buildMovePrompt(side, aiHistory);
    return simpleMove(prompt, personaPrompt, personaVoice)
      .then(({ action, reason }) => {
        const attack = parseAttackFromAction(action);
        if (attack) return { attack, reasoning: reason };
        return { attack: ATTACKS[Math.floor(Math.random() * ATTACKS.length)]!, reasoning: reason };
      })
      .catch(() => ({
        attack: ATTACKS[Math.floor(Math.random() * ATTACKS.length)]!,
        reasoning: "",
      }));
  }, [aiSide, aiHistory, personaPrompt, personaVoice]);

  // ─── Host drives the AI opponent's move when a round opens ───
  // The in-flight request is intentionally NOT cancelled on re-render: a
  // snapshot or phase change (e.g. the human submitting their move flips the
  // phase to "animating") must not abort the AI's pending request, or the AI
  // would never submit and the round stalls on "waiting for opponent" forever.
  // The round guard prevents duplicate requests; a failed submit resets it so a
  // later snapshot retries.
  const aiMoveRoundRef = useRef(-1);
  useEffect(() => {
    if (!mpIsHost || !aiUid || !mpSession || mpSession.status !== "playing") return;
    if (phase !== "ready") return;
    const round = mpSession.currentRound ?? 0;
    if (mpSession.pendingMoves?.[aiUid] != null) return; // AI already moved this round
    if (aiMoveRoundRef.current >= round) return; // already generating for this round
    aiMoveRoundRef.current = round;

    void fetchAiMove().then(({ attack }) => {
      void submitMove(sessionId, aiUid, attack).catch(() => {
        // Submit failed — allow a later snapshot to retry this round.
        if (aiMoveRoundRef.current === round) aiMoveRoundRef.current = round - 1;
      });
    });
  }, [mpIsHost, aiUid, mpSession, phase, sessionId, fetchAiMove]);

  // ─── On match end: host generates the AI post-game comment + records W/L ───
  const finishedFiredRef = useRef(false);
  useEffect(() => {
    if (phase !== "finished" || !mpSession || finishedFiredRef.current) return;
    finishedFiredRef.current = true;
    if (!mpIsHost || !aiUid || !aiSide) return;

    const sides = mpSession.playerSides ?? {};
    const redUid = Object.entries(sides).find(([, s]) => s === "red")?.[0] ?? "";
    const whiteUid = Object.entries(sides).find(([, s]) => s === "white")?.[0] ?? "";
    const winnerUid = redRef.current >= POINTS_TO_WIN ? redUid : whiteUid;
    const aiWon = winnerUid === aiUid;

    const prompt = buildPostGamePrompt(aiSide === "red" ? "red" : "white", aiHistory, aiWon);
    postGameComment(prompt, personaPrompt, personaVoice)
      .then(({ comment }) => {
        if (comment) {
          void updateSessionFields(sessionId, { [`aiPostGameComments.${aiUid}`]: comment });
        }
      })
      .catch(() => {});

    const docId = aiUid.replace(/^ai-/, "");
    import("@/lib/ai-personas").then(({ recordAIGameResult }) => {
      recordAIGameResult(docId, aiWon).catch(() => {});
    });
  }, [phase, mpSession, mpIsHost, aiUid, aiSide, aiHistory, personaPrompt, personaVoice, sessionId]);

  // ─── Hand the finished match off to the factory result screen (GC4) ───
  const goToResults = useCallback(() => {
    if (!mpSession) return;
    const players = mpSession.players;
    const sides = mpSession.playerSides ?? {};
    const redUid = Object.entries(sides).find(([, s]) => s === "red")?.[0] ?? "";
    const whiteUid = Object.entries(sides).find(([, s]) => s === "white")?.[0] ?? "";
    const finalRed = redRef.current;
    const finalWhite = whiteRef.current;
    const winnerUid = finalRed >= POINTS_TO_WIN ? redUid : whiteUid;
    const winner = players.find((p) => p.uid === winnerUid);

    const scores: Record<string, number> = {};
    if (redUid) scores[redUid] = finalRed;
    if (whiteUid) scores[whiteUid] = finalWhite;

    videoRef.current?.pause();
    onGameEnd({
      winners: winner ? [winner] : [],
      winnerPoints: Math.max(finalRed, finalWhite),
      allPlayers: players,
      scores,
    });
  }, [mpSession, onGameEnd]);

  // Keep the ref pointed at the latest goToResults so the winner-animation
  // onEnd callback (registered earlier) always calls the current closure.
  useEffect(() => {
    goToResultsRef.current = goToResults;
  }, [goToResults]);

  const handleAttack = useCallback(
    (attack: Attack) => {
      if (phaseRef.current !== "ready") return;
      ensurePlaying();
      setSelectedAttack(attack);
      setP("animating");
      mpSubmitMove(attack);
    },
    [setP, mpSubmitMove, ensurePlaying],
  );

  return (
    <div className="relative flex h-dvh flex-col bg-black">
      {splashBgURL && (
        <div
          className="absolute inset-0 z-0 bg-cover bg-center opacity-50"
          style={{ backgroundImage: `url(${splashBgURL})` }}
        />
      )}
      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden px-4">
        {/* Scoreboard */}
        {phase !== "idle" && (() => {
          const playerIsRed = playerSide === "red";
          const playerTag = myTag || "YOU";
          const oppLabel = opponentGamertag ?? (vsAI ? aiName : playerIsRed ? "White" : "Red");
          const leftLabel = playerIsRed ? playerTag : oppLabel;
          const rightLabel = !playerIsRed ? playerTag : oppLabel;
          return (
            <JMGameScoreboard
              leftLabel={leftLabel}
              rightLabel={rightLabel}
              leftScore={redScore}
              rightScore={whiteScore}
              pointsToWin={POINTS_TO_WIN}
              leftColorClass="text-red-500"
              rightColorClass="text-white"
            />
          );
        })()}

        {/* Video arena — grows to fill available space, stays square */}
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className="relative aspect-square max-h-full max-w-full">
            <div className="relative h-full w-full overflow-hidden rounded-xl">
              <video
                ref={videoMountRef}
                src="/video/Sweep-The-Leg-Chapters.mp4"
                playsInline
                preload="auto"
                className="block h-full w-full object-cover opacity-0 transition-opacity duration-500"
                onLoadedData={(e) => { (e.target as HTMLVideoElement).classList.remove("opacity-0"); }}
              />

              {phase === "idle" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/60 px-6">
                  {splashLogoURL ? (
                    <Image
                      src={splashLogoURL}
                      alt="Sweep the Leg"
                      width={280}
                      height={140}
                      className={`w-full max-w-[280px] object-contain${!mpSession || mpSession.status !== "playing" || !mpSide ? " animate-gentle-float" : ""}`}
                      draggable={false}
                      priority
                    />
                  ) : (
                    <h1 className="text-center text-4xl font-black uppercase leading-tight tracking-tight text-white sm:text-5xl">
                      Sweep
                      <br />
                      the Leg
                    </h1>
                  )}
                  {!mpSession || mpSession.status !== "playing" || !mpSide ? (
                    <p className="text-center text-sm font-medium uppercase tracking-widest text-white animate-pulse">
                      Waiting for host
                      <br />
                      to start match…
                    </p>
                  ) : !mpIsHost && !joinerAccepted ? (
                    <button
                      onClick={() => {
                        ensurePlaying();
                        setJoinerAccepted(true);
                      }}
                      className="rounded-full px-10 py-4 text-lg font-black uppercase tracking-wider text-black transition-transform hover:scale-105 active:scale-95"
                      style={{ backgroundColor: theme.accents.goldenGlow }}
                    >
                      Join Match
                    </button>
                  ) : (
                    <p className="text-sm font-medium uppercase tracking-widest text-white/50 animate-pulse">
                      Loading match…
                    </p>
                  )}
                </div>
              )}

              {phase === "finished" && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end gap-3 bg-linear-to-t from-black/80 via-transparent to-transparent pb-8">
                  <JMBannerText paddingX={32} paddingY={10}>
                    <h2
                      className="text-center text-3xl font-black uppercase tracking-tight sm:text-4xl"
                      style={{ color: playerSide === "red" ? "#ef4444" : "#ffffff" }}
                    >
                      {endMessage}
                    </h2>
                  </JMBannerText>
                  <p className="text-lg font-bold text-white/60">
                    {redScore} &ndash; {whiteScore}
                  </p>
                </div>
              )}
            </div>

            {roundAttacks && (
              <>
                <AttackIndicator side="red" attack={roundAttacks.red} />
                <AttackIndicator side="white" attack={roundAttacks.white} />
              </>
            )}
          </div>
        </div>

        {/* Player label + Attack buttons — always mounted to prevent layout jumps */}
        <div className="shrink-0 py-3">
          <p
            className={`mb-2 text-center text-sm font-bold uppercase tracking-widest text-white/40 transition-opacity ${
              phase === "ready" || phase === "animating" ? "opacity-100" : "opacity-0"
            }`}
          >
            Choose your attack
          </p>

          {(() => {
            const isActive = phase === "ready" || phase === "animating";
            const isWaiting = showWaiting;
            const buttonsVisible = isActive && !isWaiting;
            return (
              <div className="relative">
                <div className="flex gap-3">
                  {ATTACKS.map((a) => (
                    <button
                      key={a}
                      onClick={() => handleAttack(a)}
                      disabled={phase !== "ready"}
                      aria-hidden={!buttonsVisible}
                      tabIndex={buttonsVisible ? 0 : -1}
                      className={`
                        flex-1 rounded-xl border-2 py-3 text-base font-bold uppercase tracking-wider
                        transition-opacity
                        ${!buttonsVisible ? "pointer-events-none opacity-0" : ""}
                        ${
                          phase === "ready" && playerSide === "red"
                            ? "border-red-500/30 bg-red-500/6 text-red-400 hover:scale-105 hover:border-red-500/60 hover:bg-red-500/12 active:scale-95"
                            : phase === "ready"
                              ? "border-white/30 bg-white/6 text-white hover:scale-105 hover:border-white/60 hover:bg-white/12 active:scale-95"
                              : playerSide === "red"
                                ? "cursor-not-allowed border-red-500/10 bg-red-500/2 text-red-400/25"
                                : "cursor-not-allowed border-white/10 bg-white/2 text-white/25"
                        }
                      `}
                      style={
                        buttonsVisible && phase !== "ready" && selectedAttack
                          ? { opacity: a === selectedAttack ? 1 : 0.3 }
                          : undefined
                      }
                    >
                      <span className="block text-xl font-black sm:text-2xl">
                        {ATTACK_LABEL[a]}
                      </span>
                      <span className="mt-0.5 block text-[10px] font-medium normal-case tracking-wide text-white/40">
                        {ATTACK_BEATS[a]}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Waiting overlay — same footprint as the buttons, no layout shift */}
                <div
                  aria-hidden={!isWaiting}
                  className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity ${
                    isWaiting ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <p className="text-center text-sm font-bold uppercase tracking-widest text-white animate-pulse">
                    Waiting for opponent…
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      </main>
    </div>
  );
}
