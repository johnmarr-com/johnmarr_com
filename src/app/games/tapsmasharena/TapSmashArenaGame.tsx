"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useJMStyle } from "@/JMStyle";
import { JMBannerText, JMChampionPicker, JMGameScoreboard, JMWaiting, type ChampionOption } from "@/JMKit";
import { simpleMove, postGameComment, useMultiplayerRound, useGameMusic, sliceHistoryByTier, aiHistoryTierForLevel, TIER_PROMPT_DIRECTIVE, isAiPlayer, getPersona, updateSessionFields } from "../_gamecore";
import { useAuth } from "@/lib/AuthProvider";
import { submitMove } from "@/lib/game-sessions";
import type { JMContent } from "@/lib/content-types";
import type { GameEndResult } from "../_gamecore/registry/types";

type Attack = "R" | "P" | "S";

interface MoveRecord {
  player: Attack;
  opponent: Attack;
  winner: "player" | "opponent" | "tie";
}

type BattleChapter =
  | "S-R-1" | "S-R-2" | "S-R-3"
  | "R-S-1" | "R-S-2" | "R-S-3"
  | "S-P-1" | "S-P-2" | "S-P-3"
  | "P-S-1" | "P-S-2" | "P-S-3"
  | "R-P-1" | "R-P-2" | "R-P-3"
  | "P-R-1" | "P-R-2" | "P-R-3"
  | "RR" | "PP" | "SS";

type ChapterName = "Ready" | BattleChapter | "WIN" | "LOSE";
type GamePhase = "idle" | "ready" | "animating" | "finished";

const CHAPTERS: Record<ChapterName, { start: number; end: number }> = {
  Ready:   { start: 0.000,   end: 1.833   },
  "S-R-1": { start: 1.833,   end: 9.542   },
  "S-R-2": { start: 10.167,  end: 17.708  },
  "S-R-3": { start: 18.500,  end: 27.750  },
  "R-S-1": { start: 28.708,  end: 36.167  },
  "R-S-2": { start: 36.875,  end: 45.000  },
  "R-S-3": { start: 45.792,  end: 53.500  },
  "S-P-1": { start: 54.292,  end: 60.208  },
  "S-P-2": { start: 61.000,  end: 68.542  },
  "S-P-3": { start: 69.333,  end: 75.458  },
  "P-S-1": { start: 76.250,  end: 83.125  },
  "P-S-2": { start: 83.917,  end: 90.500  },
  "P-S-3": { start: 91.292,  end: 99.125  },
  "R-P-1": { start: 99.917,  end: 110.708 },
  "R-P-2": { start: 111.500, end: 121.083 },
  "R-P-3": { start: 121.875, end: 128.708 },
  "P-R-1": { start: 129.500, end: 138.792 },
  "P-R-2": { start: 139.500, end: 147.208 },
  "P-R-3": { start: 148.000, end: 158.875 },
  PP:      { start: 159.667, end: 165.083 },
  RR:      { start: 165.875, end: 171.667 },
  SS:      { start: 172.458, end: 177.458 },
  WIN:     { start: 178.250, end: 185.833 },
  LOSE:    { start: 186.625, end: 193.875 },
};

const FRAME = 1 / 24;
const POINTS_TO_WIN = 3;
const ATTACKS: Attack[] = ["R", "P", "S"];
const CHAMPION_BG = "/images/games/tapsmasharena/Champion-Choose-BG.png";
const CHAMPION_OPTIONS: ChampionOption<Attack>[] = [
  { value: "R", imageURL: "/images/games/tapsmasharena/Champion-Rock.png", label: "Rock" },
  { value: "P", imageURL: "/images/games/tapsmasharena/Champion-Paper.png", label: "Paper" },
  { value: "S", imageURL: "/images/games/tapsmasharena/Champion-Scissors.png", label: "Scissors" },
];

type PlayerSide = "p1" | "p2";

const TIE_CHAPTERS: Record<Attack, BattleChapter> = { R: "RR", P: "PP", S: "SS" };

const ACTION_TO_ATTACK: Record<string, Attack> = {
  rock: "R",
  paper: "P",
  scissors: "S",
};

function parseAttackFromAction(action: string): Attack | null {
  const key = action.toLowerCase().trim();
  for (const [word, atk] of Object.entries(ACTION_TO_ATTACK)) {
    if (key.startsWith(word)) return atk;
  }
  return null;
}

/**
 * Build owner-perspective chapter name.
 * For non-ties, both the variant (1-3) and the chapter follow the pattern
 * {ownerPick}-{opponentPick}-{variant}.
 */
function buildChapterName(
  ownerAtk: Attack,
  opponentAtk: Attack,
  variant: number,
): BattleChapter {
  if (ownerAtk === opponentAtk) return TIE_CHAPTERS[ownerAtk];
  return `${ownerAtk}-${opponentAtk}-${variant}` as BattleChapter;
}

function buildMovePrompt(
  history: MoveRecord[],
  skillLevel: number | undefined,
): string {
  const tier = aiHistoryTierForLevel(skillLevel);
  const sliced = sliceHistoryByTier(history, tier);

  const system = `You are playing Rock Paper Scissors against a human.

RULES:
- Rock beats Scissors
- Scissors beats Paper
- Paper beats Rock
- Same = tie

First to 3 points wins. Study the player's patterns and choose the move most likely to beat them. Look for tendencies, repeats, sequences, and post-win/post-loss habits.

CRITICAL: Your ACTION must match your reasoning. If you want to counter their Rock, play Paper. If you want to counter their Paper, play Scissors. If you want to counter their Scissors, play Rock.

${TIER_PROMPT_DIRECTIVE[tier]}

Format your response EXACTLY as:
REASONING: <1 brief sentence for the player to read after the game>
ACTION: <Rock, Paper, or Scissors>`;

  const nameMap: Record<string, string> = { R: "Rock", P: "Paper", S: "Scissors" };

  if (sliced.length === 0) {
    const reason = tier === "none" && history.length > 0
      ? "You don't recall earlier rounds — pick your move on instinct."
      : "This is the first round — no history yet. Pick your opening move.";
    return system + `\n\n${reason}`;
  }

  const lines = sliced.map((m, i) => {
    const result = m.winner === "tie" ? "Tie" : m.winner === "player" ? "Player won" : "You won";
    const roundNum = history.length - sliced.length + i + 1;
    return `Round ${roundNum}: Player=${nameMap[m.player]}, You=${nameMap[m.opponent]} → ${result}`;
  });
  return system + `\n\nMove history:\n${lines.join("\n")}\n\nRound ${history.length + 1} — what do you play?`;
}

function buildPostGamePrompt(history: MoveRecord[], aiWon: boolean): string {
  const nameMap: Record<string, string> = { R: "Rock", P: "Paper", S: "Scissors" };
  const lines = history.map((m, i) => {
    const result = m.winner === "tie" ? "Tie" : m.winner === "player" ? "Player won" : "You won";
    return `Round ${i + 1}: Player=${nameMap[m.player]}, You=${nameMap[m.opponent]} → ${result}`;
  });

  return `You just played Rock Paper Scissors against a human.

Full match history:
${lines.join("\n")}

The game is over. ${aiWon ? "You won!" : "You lost."} Give a brief post-game comment (1-2 sentences) reflecting on the match — what patterns you noticed, what worked or didn't, and whether the player surprised you. Be conversational and a good sport. Reply with ONLY your comment, nothing else.`;
}

const WIN_PHRASES = [
  "CONGRATS!", "WAY TO GO!", "YOU CRUSHED!", "YOU DID IT!", "YOU RULE!",
  "YOU DA BOSS!", "YOU'RE FANTASTIC!", "YOU'RE AMAZING!", "YOU DOMINATED!", "YOU'RE THE BEST!",
];
const AI_WIN_PHRASES = [
  "You beat AI", "You crushed AI!", "You defeated AI", "You destroyed Skynet",
  "You beat the machine", "You slayed the Bot", "You pwned AI", "You beat the bot",
];
const AI_LOSE_PHRASES = [
  "Skynet destroyed you", "The Bot Bites Back", "The Revenge of AI", "The Bot Beat You",
  "The Machine Ate Your Lunch", "Bullied by the Bot", "You Lost to AI", "Pwned by AI",
];

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export default function TapSmashArenaGame({
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

  const splashBgURL = gameData.splashBgURL;
  const gameSlug = gameData.slug ?? "tapsmasharena";
  const backgroundMusicURL = gameData.backgroundMusicURL;
  const backgroundMusicVolume = gameData.backgroundMusicVolume;

  const musicURL = backgroundMusicURL || (gameSlug ? `/music/${gameSlug}.mp3` : null);
  const { ensurePlaying, connectVideo } = useGameMusic({ url: musicURL, volume: backgroundMusicVolume ?? 0.3 });

  const [phase, setPhase] = useState<GamePhase>("idle");
  const [p1Score, setP1Score] = useState(0);
  const [p2Score, setP2Score] = useState(0);
  const [playerSide, setPlayerSide] = useState<PlayerSide>("p1");
  const [endMessage, setEndMessage] = useState("");
  const [waitingForBattle, setWaitingForBattle] = useState(false);
  const [joinerAccepted, setJoinerAccepted] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const chapterRef = useRef<ChapterName>("Ready");
  const freezeRef = useRef(false);
  const onEndRef = useRef<(() => void) | null>(null);
  const rafRef = useRef(0);
  const phaseRef = useRef<GamePhase>("idle");
  const p1Ref = useRef(0);
  const p2Ref = useRef(0);
  const sideRef = useRef<PlayerSide>("p1");
  const goToResultsRef = useRef<() => void>(() => {});

  // Rounds are resolved server-side (resolverKey "rps"); this hook just
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

  // Derive this player's side from Firestore playerSides
  const mpSide: PlayerSide | null = useMemo(() => {
    if (!mpSession?.playerSides || !userId) return null;
    const s = mpSession.playerSides[userId];
    return s === "p1" || s === "p2" ? (s as PlayerSide) : null;
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
  const personaSkillLevel = aiPersona?.skillLevel;
  const aiName = aiPersona?.name || "AI";
  const vsAI = !!aiUid;

  // Reconstruct the AI's move history (from its perspective) for prompt context.
  const aiHistory = useMemo<MoveRecord[]>(() => {
    if (!aiUid || !aiSide || !mpSession?.rounds) return [];
    const humanUid = mpSession.players.find((p) => p.uid !== aiUid)?.uid ?? "";
    return mpSession.rounds.map((r) => {
      const res = r.result as { winner: "p1" | "p2" | null };
      const aiAttack = (r.moves[aiUid] ?? "R") as Attack;
      const humanAttack = (r.moves[humanUid] ?? "R") as Attack;
      const winner: MoveRecord["winner"] =
        res.winner === null ? "tie" : res.winner === aiSide ? "opponent" : "player";
      return { player: humanAttack, opponent: aiAttack, winner };
    });
  }, [aiUid, aiSide, mpSession?.rounds, mpSession?.players]);

  const opponentGamertag = useMemo(() => {
    if (!mpSession || !userId) return null;
    const opp = mpSession.players.find((p) => p.uid !== userId);
    return opp?.gamertag ?? null;
  }, [mpSession, userId]);

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
      opts: { freeze?: boolean; onEnd?: () => void } = {},
    ) => {
      const v = videoRef.current;
      if (!v) return;
      connectVideo(v);
      chapterRef.current = name;
      freezeRef.current = opts.freeze ?? false;
      onEndRef.current = opts.onEnd ?? null;
      v.currentTime = CHAPTERS[name].start;
      v.play().catch(() => {});
    },
    [connectVideo],
  );

  // RAF loop: watches for chapter end
  useEffect(() => {
    let active = true;
    const wasPlayingRef = { current: false };

    function tick() {
      if (!active) return;
      const v = videoRef.current;
      if (v && !v.paused && !v.ended && !v.seeking) {
        const ch = CHAPTERS[chapterRef.current];
        if (v.currentTime >= ch.end - FRAME) {
          if (freezeRef.current) {
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
      p1Ref.current = 0;
      p2Ref.current = 0;
      setP1Score(0);
      setP2Score(0);
      setWaitingForBattle(false);
      setP("ready");

      const v = videoRef.current;
      if (v) {
        connectVideo(v);
        chapterRef.current = "Ready";
        v.currentTime = CHAPTERS.Ready.start;
        v.pause();
      }
    },
    [setP, ensurePlaying, connectVideo],
  );

  // ─── Auto-start the match once the session is playing and our side is known.
  // (The factory re-mounts this component for a rematch, so no restart
  // detection is needed.) ───
  const mpStartedRef = useRef(false);
  const mpRoundsLenRef = useRef(0);

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

  // ─── Round results: play the video chapter and update scores ───
  useEffect(() => {
    if (!mpSession?.rounds?.length || !userId) return;
    const rounds = mpSession.rounds;
    if (rounds.length <= mpRoundsLenRef.current) return;
    mpRoundsLenRef.current = rounds.length;

    const latest = rounds[rounds.length - 1]!;
    const res = latest.result as {
      p1Attack: Attack;
      p2Attack: Attack;
      winner: "p1" | "p2" | null;
      variant: number;
      p1Score: number;
      p2Score: number;
    };

    const playerSidesMap = mpSession.playerSides ?? {};
    const mySide = playerSidesMap[userId] as PlayerSide | undefined;
    const myAttack = mySide === "p1" ? res.p1Attack : res.p2Attack;
    const theirAttack = mySide === "p1" ? res.p2Attack : res.p1Attack;
    const chapter = buildChapterName(myAttack, theirAttack, res.variant);

    const gameOver = res.p1Score >= POINTS_TO_WIN || res.p2Score >= POINTS_TO_WIN;
    const winnerSide = res.p1Score >= POINTS_TO_WIN ? "p1" : res.p2Score >= POINTS_TO_WIN ? "p2" : null;
    const iWon = winnerSide === mySide;

    requestAnimationFrame(() => {
      // Fade the waiting overlay out *before* the round chapter starts so
      // the transition reads as: graphic fades → animation begins. Matches
      // the 300ms transition-opacity duration on the overlay.
      setWaitingForBattle(false);
      setTimeout(() => playChapter(chapter, {
        onEnd: () => {
          p1Ref.current = res.p1Score;
          p2Ref.current = res.p2Score;
          setP1Score(res.p1Score);
          setP2Score(res.p2Score);

          // Game over: play the winner animation, then auto-advance to the
          // result screen (GC4) when it finishes — no button.
          if (gameOver) {
            setEndMessage(
              vsAI
                ? pickRandom(iWon ? AI_WIN_PHRASES : AI_LOSE_PHRASES)
                : iWon ? pickRandom(WIN_PHRASES) : "You Lose!",
            );
            setP("finished");
            playChapter(iWon ? "WIN" : "LOSE", { onEnd: () => goToResultsRef.current() });
          } else {
            setP("ready");
            const v = videoRef.current;
            if (v) {
              chapterRef.current = "Ready";
              v.currentTime = CHAPTERS.Ready.start;
              v.pause();
            }
            markAnimationDone();
          }
        },
      }), 300);
    });
  }, [mpSession, vsAI, userId, playChapter, setP, markAnimationDone]);

  const fetchAiMove = useCallback((): Promise<{ attack: Attack; reasoning: string }> => {
    const prompt = buildMovePrompt(aiHistory, personaSkillLevel);
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
  }, [aiHistory, personaPrompt, personaVoice, personaSkillLevel]);

  // ─── Host drives the AI opponent's move when a round opens ───
  // The in-flight request is intentionally NOT cancelled on re-render; the round
  // guard prevents duplicates and a failed submit resets it so a later snapshot
  // retries. (A cancelled request would strand the AI and stall the round.)
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

    const winnerSide = p1Ref.current >= POINTS_TO_WIN ? "p1" : "p2";
    const aiWon = winnerSide === aiSide;

    const prompt = buildPostGamePrompt(aiHistory, aiWon);
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
    const p1Uid = Object.entries(sides).find(([, s]) => s === "p1")?.[0] ?? "";
    const p2Uid = Object.entries(sides).find(([, s]) => s === "p2")?.[0] ?? "";
    const finalP1 = p1Ref.current;
    const finalP2 = p2Ref.current;
    const winnerUid = finalP1 >= POINTS_TO_WIN ? p1Uid : p2Uid;
    const winner = players.find((p) => p.uid === winnerUid);

    const scores: Record<string, number> = {};
    if (p1Uid) scores[p1Uid] = finalP1;
    if (p2Uid) scores[p2Uid] = finalP2;

    videoRef.current?.pause();
    onGameEnd({
      winners: winner ? [winner] : [],
      winnerPoints: Math.max(finalP1, finalP2),
      allPlayers: players,
      scores,
    });
  }, [mpSession, onGameEnd]);

  useEffect(() => {
    goToResultsRef.current = goToResults;
  }, [goToResults]);

  const handleAttack = useCallback(
    (attack: Attack) => {
      if (phaseRef.current !== "ready") return;
      ensurePlaying();
      setWaitingForBattle(true);
      setP("animating");
      mpSubmitMove(attack);
    },
    [setP, mpSubmitMove, ensurePlaying],
  );

  const youIsP1 = playerSide === "p1";
  const playerTag = myTag || "YOU";
  const oppTag = opponentGamertag ?? (vsAI ? aiName : youIsP1 ? "P2" : "P1");
  const leftLabel = youIsP1 ? playerTag : oppTag;
  const rightLabel = !youIsP1 ? playerTag : oppTag;
  const sideColor = youIsP1 ? "#3b82f6" : "#f97316";

  return (
    <div className="relative flex h-dvh flex-col bg-black">
      {splashBgURL && (
        <div
          className="absolute inset-0 z-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${splashBgURL})` }}
        />
      )}
      <main className="relative z-10 flex flex-1 items-center justify-center overflow-hidden">
        <div
          className="relative h-full max-w-full overflow-hidden rounded-xl"
          style={{ aspectRatio: "9 / 16" }}
        >
              <video
                ref={videoMountRef}
                src="/video/Tap-Smash-Arena.mp4"
                playsInline
                preload="auto"
                className="block h-full w-full object-cover opacity-0 transition-opacity duration-500"
                onLoadedData={(e) => { (e.target as HTMLVideoElement).classList.remove("opacity-0"); }}
              />

              {/* Idle overlay — waiting for the host to start the match */}
              {phase === "idle" && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
                  {!mpSession || mpSession.status !== "playing" || !mpSide ? (
                    <p className="text-sm font-medium uppercase tracking-widest text-white/50 animate-pulse">
                      Waiting for host to start match…
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

              {/* Scoreboard overlay */}
              {phase !== "idle" && (
                <JMGameScoreboard
                  overlay
                  leftLabel={leftLabel}
                  rightLabel={rightLabel}
                  leftScore={p1Score}
                  rightScore={p2Score}
                  pointsToWin={POINTS_TO_WIN}
                />
              )}

              {/* Champion selection overlay */}
              <JMChampionPicker<Attack>
                options={CHAMPION_OPTIONS}
                backgroundImageURL={CHAMPION_BG}
                open={phase === "ready"}
                onSelect={handleAttack}
              />

              {/* Waiting for opponent after selection — always mounted, fades
                  in after the picker dismisses and out before the round chapter
                  plays so neither side pops. */}
              <div
                aria-hidden={!(waitingForBattle || mpPhase === "submitted")}
                className={`absolute inset-0 z-10 flex items-center justify-center bg-black/50 transition-opacity duration-300 ${
                  waitingForBattle || mpPhase === "submitted"
                    ? "opacity-100"
                    : "pointer-events-none opacity-0"
                }`}
              >
                <JMWaiting alt="Waiting for opponent…" />
              </div>

              {/* Finished overlay — the WIN/LOSE chapter auto-advances to GC4 */}
              {phase === "finished" && (
                <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-end gap-3 bg-linear-to-t from-black/80 via-transparent to-transparent pb-8">
                  <JMBannerText paddingX={32} paddingY={10}>
                    <h2
                      className="text-center text-3xl font-black uppercase tracking-tight sm:text-4xl"
                      style={{ color: sideColor }}
                    >
                      {endMessage}
                    </h2>
                  </JMBannerText>
                  <p className="text-lg font-bold text-white/60">
                    {p1Score} &ndash; {p2Score}
                  </p>
                </div>
              )}
        </div>
      </main>
    </div>
  );
}
