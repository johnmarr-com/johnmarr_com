"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, Users, User, Bot, Check, UserPlus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  JMAvatarView,
  JMAIAvatarView,
} from "@/JMKit";
import { JMInviteCodeView } from "@/JMKit/JMInviteCodeView";
import { JMInviteCodeInput } from "@/JMKit/JMInviteCodeInput";
import { InviteKnownPlayersModal } from "./InviteKnownPlayersModal";
import { InviteAIModal } from "./InviteAIModal";
import { isAiPlayer, getPersona } from "./aiPersonas";
import type { AIPersona } from "./aiPersonas";
import { useAuth } from "@/lib/AuthProvider";
import {
  createGameSession,
  joinGameSession,
  subscribeToSession,
  startGame,
  removePlayerFromSession,
  addAIPlayerToSession,
  removeAIPlayerFromSession,
  type CreateSessionInput,
  type GameSession,
  type GameSessionPlayer,
} from "@/lib/game-sessions";
import { removePendingInviteByUid, fetchKnownPlayers, type KnownPlayer } from "@/lib/game-invites";

type FlowStep = "choice" | "hosting" | "joining" | "joined";

function LobbyPlayerRow({
  player,
  isFirstHuman,
  isYou,
  onRemove,
}: {
  player: GameSessionPlayer;
  isFirstHuman: boolean;
  isYou: boolean;
  onRemove?: (() => void | Promise<void>) | undefined;
}) {
  const isAI = isAiPlayer(player.uid);
  return (
    <div className="flex items-center gap-3 rounded-lg py-1.5">
      {isAI ? (
        <JMAIAvatarView size={36} {...(player.avatarName ? { avatarName: player.avatarName } : {})} scaleOverride={getPersona(player.uid)?.avatarScale} />
      ) : player.avatarName ? (
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full">
          <JMAvatarView width={36} avatarName={player.avatarName} />
        </div>
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
          <span className="text-sm font-bold text-white/60">
            {player.gamertag.charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      <span className={`text-base font-bold ${isAI ? "text-red-400" : "text-white"}`}>
        {player.gamertag}
      </span>
      {isFirstHuman && !isAI && (
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold uppercase text-white/50">
          Host
        </span>
      )}
      {isAI && (
        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-bold uppercase text-red-400">
          AI
        </span>
      )}
      {isYou && (
        <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-bold uppercase text-green-400">
          You
        </span>
      )}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-auto rounded-full p-1.5 text-white/30 transition-colors hover:bg-red-500/10 hover:text-red-400"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

interface GameMultiplayerFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameInput: CreateSessionInput;
  onGameStart: (sessionId: string) => void;
  /** Side labels for player 0 and player 1. Defaults to ["red", "white"]. Only used in "versus" mode. */
  sideLabels?: [string, string];
  /** "versus" = 2-player with sides (default). "party" = N-player, no sides. */
  flowMode?: "versus" | "party";
  /** Minimum players to enable start. Defaults to 2 for versus, 3 for party. */
  minPlayers?: number;
  /** Extra content injected above the Start button in the host lobby. Pass a function to receive the live session. */
  lobbyExtra?: React.ReactNode | ((ctx: { session: GameSession }) => React.ReactNode);
  /** Show "Play Solo" option in the mode select. */
  showSolo?: boolean;
  /** Called when user taps "Play Solo". */
  onSoloPlay?: (() => void) | undefined;
  /** True = pure solo (no opponent). false/undefined = solo means vs AI. */
  trueSoloMode?: boolean;
  /** Show the "+ AI" column in the host lobby. */
  allowAI?: boolean;
}

export function GameMultiplayerFlow({
  open,
  onOpenChange,
  gameInput,
  onGameStart,
  sideLabels = ["red", "white"],
  flowMode = "versus",
  minPlayers,
  lobbyExtra,
  showSolo = false,
  onSoloPlay,
  trueSoloMode = false,
  allowAI = false,
}: GameMultiplayerFlowProps) {
  const { user, gamertag, avatarName } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<FlowStep>("choice");
  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [kicked, setKicked] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [pendingPlayerDetails, setPendingPlayerDetails] = useState<KnownPlayer[]>([]);
  const unsubRef = useRef<(() => void) | null>(null);
  const trackedPlayersRef = useRef<Set<string>>(new Set());

  const is1v1 = gameInput.maxPlayers === 2;

  // Clean up listener on close
  useEffect(() => {
    if (!open) {
      unsubRef.current?.();
      unsubRef.current = null;
      setStep("choice");
      setSession(null);
      setError(null);
      setLoading(false);
      setCopied(false);
      setKicked(false);
    }
  }, [open]);

  // Subscribe to session updates for lobby + track known players for host
  useEffect(() => {
    if (!session?.id) return;
    let cancelled = false;

    subscribeToSession(session.id, (updated) => {
      if (cancelled) return;
      if (updated) {
        setSession(updated);

        if (updated.kickedUids?.includes(user?.uid ?? "")) {
          setKicked(true);
        }

        // Host: add new human players to own knownPlayerUids
        if (updated.ownerId === user?.uid) {
          const newUids = updated.players
            .map((p) => p.uid)
            .filter((uid) => uid !== user.uid && !isAiPlayer(uid) && !trackedPlayersRef.current.has(uid));

          if (newUids.length > 0) {
            newUids.forEach((uid) => trackedPlayersRef.current.add(uid));
            import("firebase/firestore").then(async ({ doc, updateDoc, arrayUnion }) => {
              const { initializeFirebase } = await import("@/lib/firebase");
              const { getFirestore } = await import("firebase/firestore");
              const { app } = await initializeFirebase();
              const db = getFirestore(app);
              await updateDoc(doc(db, "users", user.uid), {
                knownPlayerUids: arrayUnion(...newUids),
              }).catch(() => {});
            });
          }
        }
      }
    }).then((unsub) => {
      if (cancelled) {
        unsub();
      } else {
        unsubRef.current = unsub;
      }
    });

    return () => {
      cancelled = true;
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [session?.id, user?.uid]);

  // Fetch gamertags for pending invite UIDs
  const pendingUids = useMemo(
    () => session?.pendingInviteUids ?? [],
    [session?.pendingInviteUids],
  );

  useEffect(() => {
    if (pendingUids.length === 0) {
      setPendingPlayerDetails([]);
      return;
    }
    let cancelled = false;
    fetchKnownPlayers(pendingUids).then((details) => {
      if (!cancelled) setPendingPlayerDetails(details);
    });
    return () => { cancelled = true; };
  }, [pendingUids]);

  const excludeUids = useMemo(() => {
    return session?.players.map((p) => p.uid) ?? [];
  }, [session?.players]);

  const handleRemovePending = useCallback(
    async (toUid: string) => {
      if (!session) return;
      await removePendingInviteByUid(session.id, toUid);
    },
    [session],
  );

  const handleBootPlayer = useCallback(
    async (uid: string) => {
      if (!session) return;
      if (isAiPlayer(uid)) {
        await removeAIPlayerFromSession(session.id, uid);
      } else {
        await removePlayerFromSession(session.id, uid);
      }
    },
    [session],
  );

  const handleHost = useCallback(async () => {
    if (!user || !gamertag) return;
    setLoading(true);
    setError(null);
    try {
      const sess = await createGameSession(gameInput, user.uid, gamertag, avatarName ?? undefined);
      setSession(sess);
      setStep("hosting");
    } catch {
      setError("Failed to create game session. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user, gamertag, avatarName, gameInput]);

  const handleJoinComplete = useCallback(
    async (code: string) => {
      if (!user || !gamertag) return;
      setLoading(true);
      setError(null);
      try {
        const result = await joinGameSession(code, user.uid, gamertag, avatarName ?? undefined);
        if (result.ok) {
          setSession(result.session);
          setStep("joined");
        } else {
          const msgs: Record<string, string> = {
            not_found: "No game found with that code.",
            full: "That game is full.",
            error: "Something went wrong. Please try again.",
          };
          setError(msgs[result.reason] ?? "Could not join.");
        }
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [user, gamertag, avatarName],
  );

  const handleCopyLink = useCallback(() => {
    if (!session) return;
    const url = `https://johnmarr.com/games?inviteCode=${encodeURIComponent(session.inviteCode)}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [session]);

  const handleAddAI = useCallback(
    async (persona: AIPersona) => {
      if (!session) return;
      await addAIPlayerToSession(session.id, persona.id, persona.name, persona.avatarName);
    },
    [session],
  );

  const handleRemoveAI = useCallback(
    async (personaId: string) => {
      if (!session) return;
      await removeAIPlayerFromSession(session.id, personaId);
    },
    [session],
  );

  const inviteURL = session
    ? `https://johnmarr.com/games?inviteCode=${encodeURIComponent(session.inviteCode)}`
    : "";

  const isHost = session?.ownerId === user?.uid;
  const effectiveMinPlayers = minPlayers ?? (flowMode === "party" ? 3 : 2);
  const canStart =
    isHost && session && session.players.length >= effectiveMinPlayers;

  const aiPlayerIds = useMemo(
    () => session?.players.filter((p) => isAiPlayer(p.uid)).map((p) => p.uid) ?? [],
    [session?.players],
  );

  const humanCount = session ? session.players.length - aiPlayerIds.length : 0;
  const aiCount = aiPlayerIds.length;
  const availableSlots = session ? session.maxPlayers - session.players.length : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto bg-black/95 sm:max-w-md">
        {/* Game logo — gentle float */}
        {gameInput.gameLogoURL && (
          <div className="-mt-2 flex justify-center animate-gentle-float">
            <Image
              src={gameInput.gameLogoURL}
              alt={gameInput.gameName}
              width={280}
              height={140}
              className="h-auto w-[280px] object-contain"
              draggable={false}
            />
          </div>
        )}

        {/* ─── Step: Choice (mode select) ─── */}
        {step === "choice" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-center text-white">
                {gameInput.gameName}
              </DialogTitle>
              <DialogDescription className="text-center text-white/50">
                Choose how you want to play.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3 pt-2">
              {showSolo && onSoloPlay && (
                <button
                  onClick={onSoloPlay}
                  className="flex items-center justify-center gap-2 rounded-xl bg-white py-4 text-lg font-bold uppercase tracking-wider text-black transition-all hover:scale-[1.02] active:scale-95"
                >
                  <User className="h-5 w-5" />
                  {trueSoloMode ? (
                    "Play Solo"
                  ) : (
                    <>Play Solo vs <span className="font-black text-red-500">AI</span></>
                  )}
                </button>
              )}
              <button
                onClick={handleHost}
                disabled={loading || !gamertag}
                className="flex items-center justify-center gap-2 rounded-xl bg-white py-4 text-lg font-bold uppercase tracking-wider text-black transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Users className="h-5 w-5" />
                    Host a Game
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setStep("joining");
                  setError(null);
                }}
                disabled={loading || !gamertag}
                className="flex items-center justify-center gap-2 rounded-xl border-2 border-white/30 bg-white/5 py-4 text-lg font-bold uppercase tracking-wider text-white transition-all hover:bg-white/10 active:scale-95 disabled:opacity-50"
              >
                Join a Game
              </button>
              {!gamertag && (
                <p className="text-center text-base text-red-400">
                  You need a gamertag to play multiplayer.
                </p>
              )}
            </div>
          </>
        )}

        {/* ─── Step: Hosting (lobby) ─── */}
        {step === "hosting" && session && (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>Invite Players / AI</DialogTitle>
              <DialogDescription>
                Share your invite code or QR with {is1v1 ? "a friend" : "friends"}
              </DialogDescription>
            </DialogHeader>

            <div className="-mt-2 flex flex-col items-center">
              {/* Invite section */}
              <div className="w-full rounded-xl border border-white/15 bg-white/8 p-4">
                <p className="mb-3 text-center text-lg font-semibold text-white">
                  Invite Players / <span className="text-red-400">AI</span>
                </p>
                <p className="text-center text-base text-white/50">
                  Share this code with {is1v1 ? "a friend" : "friends"} to join.
                </p>
                <div className="mt-2 flex justify-center rounded-xl bg-black/20 px-6 py-2">
                  <JMInviteCodeView code={session.inviteCode} size="md" />
                </div>

                {/* QR + Invite columns */}
                <div className="mt-4 flex w-full items-start gap-4">
                  {/* QR column — tap to copy link */}
                  <div className="flex flex-col items-center gap-1.5">
                    <p className="text-sm font-medium text-white/50">Or share:</p>
                    <button
                      onClick={handleCopyLink}
                      className="relative h-[114px] w-[114px] rounded-xl bg-white p-2 transition-all active:scale-95"
                    >
                      <QRCodeSVG value={inviteURL} className="h-full w-full" />
                      {copied && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/70">
                          <div className="flex items-center gap-1.5">
                            <Check className="h-5 w-5 text-green-400" />
                            <span className="text-sm font-bold uppercase tracking-wider text-green-400">Copied!</span>
                          </div>
                        </div>
                      )}
                    </button>
                  </div>

                  {/* Invite section (Players + AI) */}
                  <div className="flex flex-1 flex-col gap-2">
                    {/* Shared "Or invite:" label with lines */}
                    <div className="flex items-center gap-2">
                      <div className="h-px flex-1 bg-white/15" />
                      <p className="shrink-0 text-sm font-medium text-white/50">Or invite:</p>
                      <div className="h-px flex-1 bg-white/15" />
                    </div>

                    <div className="flex items-start justify-center gap-3">
                      {/* Invite Player/s */}
                      <button
                        onClick={() => setInviteModalOpen(true)}
                        className="flex h-[114px] flex-1 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/20 bg-black/20 transition-all hover:border-white/40 hover:bg-white/10 active:scale-95"
                      >
                        <UserPlus className="h-8 w-8 text-white/50" />
                        <span className="px-1 text-center text-sm font-bold uppercase leading-tight tracking-wider text-white/60">
                          {is1v1 ? "Player" : "Players"}
                        </span>
                      </button>

                      {/* Invite AI */}
                      {allowAI && (
                        <button
                          onClick={() => setAiModalOpen(true)}
                          className="flex h-[114px] flex-1 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-red-500/30 bg-red-500/5 transition-all hover:border-red-500/50 hover:bg-red-500/10 active:scale-95"
                        >
                          <Bot className="h-8 w-8 text-red-400" />
                          <span className="px-1 text-center text-sm font-bold uppercase leading-tight tracking-wider text-red-400/70">
                            + AI
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Player list */}
              <div className="mt-6 w-full rounded-xl border border-white/15 bg-white/8 p-4">
                <p className="mb-3 text-center text-lg font-semibold text-white">
                  Game Lobby
                </p>
                <p className="mb-2 text-sm font-bold uppercase tracking-widest text-white/50">
                  Players ({session.players.length}/{session.maxPlayers})
                </p>
                <div className="flex flex-col gap-2">
                  {session.players.map((p, i) => (
                    <LobbyPlayerRow
                      key={p.uid}
                      player={p}
                      isFirstHuman={i === 0}
                      isYou={p.uid === user?.uid}
                      onRemove={
                        isHost && (isAiPlayer(p.uid) || i !== 0)
                          ? () => handleBootPlayer(p.uid)
                          : undefined
                      }
                    />
                  ))}

                  {/* Pending invited players */}
                  {pendingPlayerDetails.map((p) => (
                    <div
                      key={p.uid}
                      className="flex items-center gap-3 rounded-lg py-1.5"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
                        <span className="text-sm font-bold text-white/30">
                          {p.gamertag.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="font-medium italic text-white/50">
                        {p.gamertag}
                      </span>
                      <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-bold uppercase text-yellow-400/70">
                        Pending
                      </span>
                      <button
                        onClick={() => handleRemovePending(p.uid)}
                        className="ml-auto rounded-full p-1 text-white/20 transition-colors hover:bg-white/10 hover:text-white/50"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  {session.players.length < effectiveMinPlayers && pendingPlayerDetails.length === 0 && (
                    <div className="flex items-center gap-2 text-base text-white/40">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {effectiveMinPlayers <= 2
                        ? "Waiting for player..."
                        : `Waiting for minimum ${effectiveMinPlayers} players...`}
                    </div>
                  )}
                  {session.players.length >= effectiveMinPlayers && pendingPlayerDetails.length > 0 && (
                    <div className="flex items-center gap-2 text-base text-white/40">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Waiting for invited players...
                    </div>
                  )}
                </div>
              </div>

              {/* Side assignments preview (versus mode only) */}
              {flowMode === "versus" && session.players.length >= 2 && (
                <div className="my-4 flex items-center justify-center gap-4 text-lg">
                  <span className="font-bold text-red-400">
                    {sideLabels[0].charAt(0).toUpperCase() + sideLabels[0].slice(1)}: {session.players[0]?.gamertag}
                  </span>
                  <span className="text-white/60">vs</span>
                  <span className="font-bold text-white">
                    {sideLabels[1].charAt(0).toUpperCase() + sideLabels[1].slice(1)}: {session.players[1]?.gamertag}
                  </span>
                </div>
              )}

              {/* Game-specific lobby extras */}
              {typeof lobbyExtra === "function" ? lobbyExtra({ session }) : lobbyExtra}

              {/* Error message (hosting step) */}
              {error && (
                <p className="text-center text-base font-medium text-red-400">
                  {error}
                </p>
              )}

              {/* Start button */}
              <button
                onClick={async () => {
                  if (!session || session.players.length < effectiveMinPlayers) return;
                  setError(null);
                  try {
                    const sides: Record<string, string> = {};
                    if (flowMode === "versus") {
                      sides[session.players[0]!.uid] = sideLabels[0];
                      sides[session.players[1]!.uid] = sideLabels[1];
                    } else {
                      session.players.forEach((p, i) => {
                        sides[p.uid] = `player-${i + 1}`;
                      });
                    }
                    await startGame(session.id, sides);
                    onGameStart(session.id);
                  } catch {
                    setError("Failed to start game. Please try again.");
                  }
                }}
                disabled={!canStart}
                className={`
                  mt-3 w-full rounded-xl py-4 text-lg font-bold uppercase tracking-wider
                  transition-all
                  ${canStart
                    ? "bg-white text-black shadow-lg shadow-white/20 hover:scale-[1.02] active:scale-95"
                    : "cursor-not-allowed bg-white/10 text-white/25"
                  }
                `}
              >
                {aiCount > 0 ? (
                  <>
                    Start Game: <span className="text-black/40">{humanCount} {humanCount === 1 ? "Person" : "People"} +</span> <span className="text-red-500">{aiCount} AI</span>
                  </>
                ) : (
                  "Start Game"
                )}
              </button>
            </div>
          </>
        )}

        {/* ─── Step: Joining (code input) ─── */}
        {step === "joining" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-center text-white">
                Join a Game
              </DialogTitle>
              <DialogDescription className="text-center text-white/50">
                Enter the 3-character colored invite code.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center gap-4 pt-2">
              {loading ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-white/50" />
                  <p className="text-base text-white/40">Looking up game...</p>
                </div>
              ) : (
                <JMInviteCodeInput onComplete={handleJoinComplete} />
              )}

              {error && (
                <p className="text-center text-base font-medium text-red-400">
                  {error}
                </p>
              )}
            </div>
          </>
        )}

        {/* ─── Kicked notification ─── */}
        {kicked && (
          <div className="flex flex-col items-center gap-6 py-8">
            <p className="text-center text-lg font-bold text-white">
              You have been uninvited to the game.
            </p>
            <button
              onClick={() => {
                onOpenChange(false);
                router.push("/");
              }}
              className="rounded-xl bg-white px-8 py-3 text-base font-bold uppercase tracking-wider text-black transition-all hover:scale-[1.02] active:scale-95"
            >
              Okay
            </button>
          </div>
        )}

        {/* ─── Step: Joined (player lobby) ─── */}
        {step === "joined" && session && !kicked && (
          <>
            <DialogHeader>
              <DialogTitle className="text-center text-white">
                {session.gameName}
              </DialogTitle>
              <DialogDescription className="text-center text-white/50">
                Hosted by {session.ownerGamertag}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center gap-4 pt-2">
              {/* Invite code */}
              <div className="rounded-xl bg-white/5 px-4 py-2">
                <JMInviteCodeView code={session.inviteCode} size="sm" />
              </div>

              {/* Player list */}
              <div className="w-full rounded-xl border border-white/15 bg-white/8 p-4">
                <p className="mb-2 text-sm font-bold uppercase tracking-widest text-white/50">
                  Players ({session.players.length}/{session.maxPlayers})
                </p>
                <div className="flex flex-col gap-2">
                  {session.players.map((p, i) => (
                    <LobbyPlayerRow
                      key={p.uid}
                      player={p}
                      isFirstHuman={i === 0}
                      isYou={p.uid === user?.uid}
                    />
                  ))}
                </div>
              </div>

              {session.gameSlug === "bluffbox" &&
                typeof (session as GameSession & Record<string, unknown>)["bluffLobbyPackName"] ===
                  "string" && (
                  <p className="mt-2 text-center text-sm text-white/50">
                    Pack:{" "}
                    <span className="font-semibold text-white/70">
                      {(session as GameSession & Record<string, unknown>)["bluffLobbyPackName"] as string}
                    </span>
                  </p>
                )}

              {/* Waiting indicator */}
              {session.status === "lobby" && (
                <div className="flex items-center gap-2 text-base text-white/40">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Waiting for host to start...
                </div>
              )}

              {session.status === "playing" && (
                <div className="flex w-full flex-col items-center gap-3">
                  {flowMode === "versus" && session.playerSides && (
                    <div className="flex items-center justify-center gap-4 text-sm">
                      {session.players.map((p) => {
                        const side = session.playerSides?.[p.uid];
                        return (
                          <span
                            key={p.uid}
                            className={`font-bold ${side === "red" ? "text-red-400" : "text-white"}`}
                          >
                            {side ? side.charAt(0).toUpperCase() + side.slice(1) : "?"}: {p.gamertag}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <button
                    onClick={() => onGameStart(session.id)}
                    className="w-full rounded-xl bg-white py-4 text-lg font-bold uppercase tracking-wider text-black shadow-lg shadow-white/20 transition-all hover:scale-[1.02] active:scale-95"
                  >
                    Game Started — Enter
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Global error for host flow */}
        {step === "choice" && error && (
          <p className="text-center text-base font-medium text-red-400">
            {error}
          </p>
        )}
      </DialogContent>

      {/* Invite Known Players Modal */}
      {session && user && gamertag && (
        <InviteKnownPlayersModal
          open={inviteModalOpen}
          onOpenChange={setInviteModalOpen}
          sessionId={session.id}
          gameSlug={session.gameSlug}
          gameName={session.gameName}
          gameLogoURL={session.gameLogoURL}
          hostUid={user.uid}
          hostGamertag={gamertag}
          excludeUids={excludeUids}
          invitedUids={pendingUids}
        />
      )}

      {/* AI Persona Roster Modal */}
      {session && allowAI && (
        <InviteAIModal
          open={aiModalOpen}
          onOpenChange={setAiModalOpen}
          availableSlots={availableSlots}
          currentAIIds={aiPlayerIds}
          onAddAI={handleAddAI}
          onRemoveAI={handleRemoveAI}
        />
      )}
    </Dialog>
  );
}
