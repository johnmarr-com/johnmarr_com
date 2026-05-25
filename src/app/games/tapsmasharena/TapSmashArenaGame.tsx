"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useJMStyle } from "@/JMStyle";
import { JMBannerText, JMChampionPicker, JMCloseCircleButton, JMGameScoreboard, JMWaiting, type ChampionOption } from "@/JMKit";
import { simpleMove, postGameComment, useMultiplayerRound, useGameMusic, sliceHistoryByTier, aiHistoryTierForLevel, TIER_PROMPT_DIRECTIVE, type GameMode, type ResolverOutput, type AIPersona } from "../_gamecore";
import { useAuth } from "@/lib/AuthProvider";
import { startGame, type GameSession } from "@/lib/game-sessions";

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

interface TranscriptEntry {
  round: number;
  p1Attack: Attack;
  p2Attack: Attack;
  winner: "p1" | "p2" | null;
  aiAttack?: Attack;
  aiReason?: string;
}

const ATTACK_FULL: Record<Attack, string> = { R: "Rock", P: "Paper", S: "Scissors" };

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

const BEATS: Record<Attack, Attack> = { R: "S", S: "P", P: "R" };
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

function resolveWinner(
  ownerAtk: Attack,
  opponentAtk: Attack,
): "owner" | "opponent" | null {
  if (ownerAtk === opponentAtk) return null;
  return BEATS[ownerAtk] === opponentAtk ? "owner" : "opponent";
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
  splashBgURL,
  mode = "solo",
  gameSlug,
  backgroundMusicURL,
  backgroundMusicVolume,
  sessionId: sessionIdProp,
  aiPersona,
}: {
  splashBgURL?: string;
  mode?: GameMode;
  gameSlug?: string;
  backgroundMusicURL?: string;
  backgroundMusicVolume?: number;
  sessionId?: string;
  aiPersona?: AIPersona;
}) {
  const { theme } = useJMStyle();
  const { user, gamertag: myTag } = useAuth();

  const musicURL = backgroundMusicURL || (gameSlug ? `/music/${gameSlug}.mp3` : null);
  const { ensurePlaying, connectVideo } = useGameMusic({ url: musicURL, volume: backgroundMusicVolume ?? 0.3 });

  const isFriends = mode === "friends" && !!sessionIdProp;

  const [phase, setPhase] = useState<GamePhase>(isFriends ? "idle" : "ready");
  const [p1Score, setP1Score] = useState(0);
  const [p2Score, setP2Score] = useState(0);
  const [playerSide, setPlayerSide] = useState<PlayerSide>("p1");
  const [endMessage, setEndMessage] = useState("");
  const [waitingForBattle, setWaitingForBattle] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const [aiPostGame, setAiPostGame] = useState("");
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
  const historyRef = useRef<MoveRecord[]>([]);
  const prefetchRef = useRef<Promise<{ attack: Attack; reasoning: string }> | null>(null);
  const personaPrompt = aiPersona?.prompt || undefined;
  const personaVoice = aiPersona?.voice || undefined;
  const personaSkillLevel = aiPersona?.skillLevel;
  const aiName = aiPersona?.name || "AI";

  // ─── Multiplayer resolver ───
  const tsaResolver = useCallback(
    (moves: Record<string, string>, sess: GameSession): ResolverOutput => {
      const sides = sess.playerSides ?? {};
      let p1Uid = "";
      let p2Uid = "";
      for (const [uid, side] of Object.entries(sides)) {
        if (side === "p1") p1Uid = uid;
        else if (side === "p2") p2Uid = uid;
      }

      const p1Attack = (moves[p1Uid] ?? "R") as Attack;
      const p2Attack = (moves[p2Uid] ?? "R") as Attack;

      const winner = resolveWinner(p1Attack, p2Attack);
      const variant = p1Attack === p2Attack ? 0 : Math.floor(Math.random() * 3) + 1;

      const currentRound = sess.currentRound ?? 0;
      const prevRounds = sess.rounds ?? [];
      let s1 = 0;
      let s2 = 0;
      for (const r of prevRounds) {
        const res = r.result as { p1Delta?: number; p2Delta?: number };
        s1 += res.p1Delta ?? 0;
        s2 += res.p2Delta ?? 0;
      }

      let p1Delta = 0;
      let p2Delta = 0;
      if (winner === "owner") p1Delta = 1;
      else if (winner === "opponent") p2Delta = 1;

      s1 += p1Delta;
      s2 += p2Delta;
      const gameOver = s1 >= POINTS_TO_WIN || s2 >= POINTS_TO_WIN;
      const winnerUid = gameOver
        ? s1 >= POINTS_TO_WIN ? p1Uid : p2Uid
        : null;

      const p1Tag = sess.players.find((p) => p.uid === p1Uid)?.gamertag ?? "P1";
      const p2Tag = sess.players.find((p) => p.uid === p2Uid)?.gamertag ?? "P2";

      const lines: string[] = [
        `Round ${currentRound + 1} — ${p1Tag}: ${ATTACK_FULL[p1Attack]}, ${p2Tag}: ${ATTACK_FULL[p2Attack]}`,
      ];
      if (winner) {
        const tag = winner === "owner" ? p1Tag : p2Tag;
        lines.push(`${tag} wins — 1 point (${s1}-${s2})`);
      } else {
        lines.push(`Tie (${s1}-${s2})`);
      }
      if (gameOver) {
        lines.push(`Game over — ${s1 >= POINTS_TO_WIN ? p1Tag : p2Tag} wins!`);
      }

      return {
        roundEntry: {
          round: currentRound,
          moves: { [p1Uid]: p1Attack, [p2Uid]: p2Attack },
          result: {
            p1Attack,
            p2Attack,
            winner: winner === "owner" ? "p1" : winner === "opponent" ? "p2" : null,
            variant,
            p1Delta,
            p2Delta,
            p1Score: s1,
            p2Score: s2,
          },
        },
        transcriptLines: lines,
        gameOver,
        winner: winnerUid,
      };
    },
    [],
  );

  const {
    session: mpSession,
    phase: mpPhase,
    isHost: mpIsHost,
    submitMove: mpSubmitMove,
    markAnimationDone,
  } = useMultiplayerRound({
    sessionId: isFriends ? sessionIdProp! : null,
    userId: user?.uid ?? "",
    resolver: tsaResolver,
  });

  // Derive this player's side from Firestore playerSides
  const mpSide: PlayerSide | null = useMemo(() => {
    if (!isFriends || !mpSession?.playerSides || !user?.uid) return null;
    const s = mpSession.playerSides[user.uid];
    return s === "p1" || s === "p2" ? (s as PlayerSide) : null;
  }, [isFriends, mpSession?.playerSides, user?.uid]);

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
      historyRef.current = [];
      prefetchRef.current = null;
      setTranscript([]);
      setShowTranscript(false);
      setAiPostGame("");
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

  // ─── Auto-start: AI mode starts immediately, friends waits for session ───
  const mountedRef = useRef(false);
  useEffect(() => {
    if (isFriends) return;
    if (mountedRef.current) return;
    mountedRef.current = true;
    queueMicrotask(() => handleStart("p1"));
  }, [handleStart, isFriends]);

  // ─── Multiplayer auto-start and restart detection ───
  const mpStartedRef = useRef(false);
  const mpRoundsLenRef = useRef(0);
  const mpPrevStatusRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isFriends || !mpSession || !mpSide) return;

    const prevStatus = mpPrevStatusRef.current;
    mpPrevStatusRef.current = mpSession.status;

    if (mpSession.status !== "playing") return;

    const isRestart = prevStatus === "finished" && mpSession.currentRound === 0;
    if (isRestart) {
      mpStartedRef.current = false;
      mpRoundsLenRef.current = 0;
    }

    if (mpStartedRef.current) return;

    // Joiner must tap the "Join Match" button once to satisfy iOS autoplay
    // gesture requirements before the video starts. Host has a fresh gesture
    // from "Start Game", so they auto-enter.
    if (!mpIsHost && !joinerAccepted) return;

    mpStartedRef.current = true;
    requestAnimationFrame(() => handleStart(mpSide));
  }, [isFriends, mpSession, mpSide, mpIsHost, joinerAccepted, handleStart]);

  // ─── Multiplayer round results: play video chapter and update scores ───
  useEffect(() => {
    if (!isFriends || !mpSession?.rounds?.length || !user?.uid) return;
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
    const mySide = playerSidesMap[user.uid] as PlayerSide | undefined;
    const myAttack = mySide === "p1" ? res.p1Attack : res.p2Attack;
    const theirAttack = mySide === "p1" ? res.p2Attack : res.p1Attack;
    const chapter = buildChapterName(myAttack, theirAttack, res.variant);

    const gameOver = res.p1Score >= POINTS_TO_WIN || res.p2Score >= POINTS_TO_WIN;
    const winnerSide = res.p1Score >= POINTS_TO_WIN ? "p1" : res.p2Score >= POINTS_TO_WIN ? "p2" : null;
    const iWon = winnerSide === mySide;

    requestAnimationFrame(() => {
      setTranscript((prev) => [
        ...prev,
        {
          round: latest.round + 1,
          p1Attack: res.p1Attack,
          p2Attack: res.p2Attack,
          winner: res.winner,
        },
      ]);

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

          if (gameOver) {
            setEndMessage(iWon ? pickRandom(WIN_PHRASES) : "You Lose!");
            setP("finished");
            playChapter(iWon ? "WIN" : "LOSE", { freeze: true });
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
  }, [isFriends, mpSession?.rounds, mpSession?.playerSides, user?.uid, playChapter, setP, markAnimationDone]);

  const fetchAiMove = useCallback((): Promise<{ attack: Attack; reasoning: string }> => {
    const prompt = buildMovePrompt(historyRef.current, personaSkillLevel);
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
  }, [personaPrompt, personaVoice, personaSkillLevel]);

  const resolveRound = useCallback(
    (playerAttack: Attack, cpuAttack: Attack, aiReason?: string) => {
      const isP1 = sideRef.current === "p1";
      const p1Atk = isP1 ? playerAttack : cpuAttack;
      const p2Atk = isP1 ? cpuAttack : playerAttack;

      const rw = resolveWinner(playerAttack, cpuAttack);
      const variant = playerAttack === cpuAttack ? 0 : Math.floor(Math.random() * 3) + 1;
      const chapter = buildChapterName(playerAttack, cpuAttack, variant);

      const moveWinner: MoveRecord["winner"] =
        rw === null ? "tie" : rw === "owner" ? "player" : "opponent";
      historyRef.current.push({ player: playerAttack, opponent: cpuAttack, winner: moveWinner });

      let nextP1 = p1Ref.current;
      let nextP2 = p2Ref.current;
      if (rw === "owner") {
        if (isP1) nextP1 += 1; else nextP2 += 1;
      } else if (rw === "opponent") {
        if (isP1) nextP2 += 1; else nextP1 += 1;
      }
      const gameOver = nextP1 >= POINTS_TO_WIN || nextP2 >= POINTS_TO_WIN;

      if (mode === "ai") {
        const transcriptWinner = rw === null ? null : (rw === "owner" ? (isP1 ? "p1" : "p2") : (isP1 ? "p2" : "p1")) as "p1" | "p2";
        const entry: TranscriptEntry = {
          round: historyRef.current.length,
          p1Attack: p1Atk,
          p2Attack: p2Atk,
          winner: transcriptWinner,
          aiAttack: cpuAttack,
        };
        const reason = aiReason || (historyRef.current.length === 1 ? "First round — random." : "");
        if (reason) entry.aiReason = reason;
        setTranscript((prev) => [...prev, entry]);
      }

      if (mode === "ai" && !gameOver) {
        prefetchRef.current = fetchAiMove();
      }

      if (mode === "ai" && gameOver) {
        const playerWon = rw === "owner";
        const aiWon = !playerWon;
        const prompt = buildPostGamePrompt(historyRef.current, aiWon);
        postGameComment(prompt, personaPrompt, personaVoice)
          .then(({ comment }) => { if (comment) setAiPostGame(comment); })
          .catch(() => {});

        if (aiPersona) {
          const docId = aiPersona.id.replace(/^ai-/, "");
          import("@/lib/ai-personas").then(({ recordAIGameResult }) => {
            recordAIGameResult(docId, aiWon).catch(() => {});
          });
        }
      }

      // See multiplayer counterpart: hold 300ms so the waiting overlay
      // finishes its fade-out before the round chapter starts.
      setWaitingForBattle(false);
      setTimeout(() => playChapter(chapter, {
        onEnd: () => {
          p1Ref.current = nextP1;
          p2Ref.current = nextP2;
          setP1Score(nextP1);
          setP2Score(nextP2);

          if (gameOver) {
            const playerWon = (isP1 && nextP1 >= POINTS_TO_WIN) || (!isP1 && nextP2 >= POINTS_TO_WIN);
            setEndMessage(
              mode === "ai"
                ? pickRandom(playerWon ? AI_WIN_PHRASES : AI_LOSE_PHRASES)
                : playerWon ? pickRandom(WIN_PHRASES) : "You Lose!",
            );
            setP("finished");
            playChapter(playerWon ? "WIN" : "LOSE", { freeze: true });
          } else {
            setP("ready");
            const v = videoRef.current;
            if (v) {
              chapterRef.current = "Ready";
              v.currentTime = CHAPTERS.Ready.start;
              v.pause();
            }
          }
        },
      }), 300);
    },
    [playChapter, setP, mode, fetchAiMove, personaPrompt, personaVoice, aiPersona],
  );

  const handleAttack = useCallback(
    (attack: Attack) => {
      if (phaseRef.current !== "ready") return;
      ensurePlaying();

      if (isFriends) {
        setWaitingForBattle(true);
        setP("animating");
        mpSubmitMove(attack);
        return;
      }

      setWaitingForBattle(true);
      setP("animating");

      if (mode === "ai") {
        const pending = prefetchRef.current;
        prefetchRef.current = null;

        if (pending) {
          pending.then(({ attack: cpu, reasoning }) => resolveRound(attack, cpu, reasoning));
        } else {
          const cpu = ATTACKS[Math.floor(Math.random() * ATTACKS.length)]!;
          resolveRound(attack, cpu);
        }
      } else {
        const cpu = ATTACKS[Math.floor(Math.random() * ATTACKS.length)]!;
        resolveRound(attack, cpu);
      }
    },
    [mode, isFriends, setP, resolveRound, mpSubmitMove, ensurePlaying],
  );

  const youIsP1 = playerSide === "p1";
  const playerTag = myTag || "YOU";
  const leftLabel = youIsP1
    ? playerTag
    : isFriends && opponentGamertag
      ? opponentGamertag
      : mode === "ai" ? aiName : "P1";
  const rightLabel = !youIsP1
    ? playerTag
    : isFriends && opponentGamertag
      ? opponentGamertag
      : mode === "ai" ? aiName : "P2";
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

              {/* Idle overlay — friends mode waiting for session */}
              {phase === "idle" && isFriends && (
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
                aria-hidden={!(waitingForBattle || (isFriends && mpPhase === "submitted"))}
                className={`absolute inset-0 z-10 flex items-center justify-center bg-black/50 transition-opacity duration-300 ${
                  waitingForBattle || (isFriends && mpPhase === "submitted")
                    ? "opacity-100"
                    : "pointer-events-none opacity-0"
                }`}
              >
                <JMWaiting alt="Waiting for opponent…" />
              </div>

              {/* Finished overlay */}
              {phase === "finished" && !showTranscript && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-end gap-3 bg-linear-to-t from-black/80 via-transparent to-transparent pb-8">
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
                  {isFriends ? (
                    mpIsHost ? (
                      <button
                        onClick={async () => {
                          if (!mpSession?.playerSides) return;
                          ensurePlaying();
                          videoRef.current?.pause();
                          await startGame(mpSession.id, mpSession.playerSides);
                        }}
                        className="mt-1 rounded-full px-8 py-3 text-sm font-bold uppercase tracking-wider text-black transition-transform hover:scale-105 active:scale-95"
                        style={{ backgroundColor: theme.accents.goldenGlow }}
                      >
                        Play Again
                      </button>
                    ) : (
                      <p className="mt-1 text-sm font-bold uppercase tracking-widest text-white/40 animate-pulse">
                        Waiting for rematch…
                      </p>
                    )
                  ) : (
                    <button
                      onClick={() => handleStart("p1")}
                      className="mt-1 rounded-full px-8 py-3 text-sm font-bold uppercase tracking-wider text-black transition-transform hover:scale-105 active:scale-95"
                      style={{ backgroundColor: theme.accents.goldenGlow }}
                    >
                      Play Again
                    </button>
                  )}
                  {(mode === "ai" || isFriends) && transcript.length > 0 && (
                    <button
                      onClick={() => setShowTranscript(true)}
                      className="mt-2 rounded-full border border-white/30 bg-white/10 px-6 py-2 text-sm font-bold uppercase tracking-wider text-white/80 transition-all hover:scale-105 hover:bg-white/20 active:scale-95"
                    >
                      {isFriends ? "View Transcript" : "View AI Transcript"}
                    </button>
                  )}
                </div>
              )}

              {/* Transcript overlay */}
              {phase === "finished" && showTranscript && (
                <div className="absolute inset-0 z-30 flex flex-col bg-black/95">
                  <div className="flex items-center justify-between px-5 py-4">
                    <span className="text-sm font-bold uppercase tracking-widest text-white/70">
                      {isFriends ? "Match Transcript" : "AI Transcript"}
                    </span>
                    <JMCloseCircleButton onClick={() => setShowTranscript(false)} />
                  </div>
                  <div className="flex-1 overflow-y-auto px-5 pb-5">
                    {aiPostGame && (
                      <div className="mb-4 pb-4 border-b border-white/15">
                        <p className="text-xs font-bold uppercase tracking-widest text-white/40">
                          Post-Game Thoughts
                        </p>
                        <p className="mt-2 text-sm italic text-amber-300/80">
                          &ldquo;{aiPostGame}&rdquo;
                        </p>
                      </div>
                    )}
                    {transcript.map((entry) => (
                      <div key={entry.round} className="mb-4 border-t border-white/15 pt-4 first:border-0 first:pt-0">
                        <p className="text-xs font-bold uppercase tracking-widest text-white/40">
                          Round {entry.round}
                        </p>
                        <p className="mt-1.5 text-sm">
                          <span className="font-semibold text-blue-400">P1: {ATTACK_FULL[entry.p1Attack]}</span>
                          <span className="mx-2 text-white/30">|</span>
                          <span className="font-semibold text-orange-400">P2: {ATTACK_FULL[entry.p2Attack]}</span>
                        </p>
                        <p className="text-sm text-white/60">
                          {entry.winner
                            ? `${entry.winner === "p1" ? "P1" : "P2"} wins — 1 Point`
                            : "Tie — 0 Points"}
                        </p>
                        {entry.aiReason && (
                          <p className="mt-1.5 text-sm italic text-amber-300/80">
                            &ldquo;{entry.aiReason}&rdquo;
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
        </div>
      </main>
    </div>
  );
}
