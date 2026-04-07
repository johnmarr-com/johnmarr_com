"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, Users, Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/JMKit";
import { JMInviteCodeView } from "@/JMKit/JMInviteCodeView";
import { JMInviteCodeInput } from "@/JMKit/JMInviteCodeInput";
import { useAuth } from "@/lib/AuthProvider";
import {
  createGameSession,
  joinGameSession,
  subscribeToSession,
  startGame,
  type CreateSessionInput,
  type GameSession,
} from "@/lib/game-sessions";

type FlowStep = "choice" | "hosting" | "joining" | "joined";

interface GameMultiplayerFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gameInput: CreateSessionInput;
  onGameStart: (sessionId: string) => void;
}

export function GameMultiplayerFlow({
  open,
  onOpenChange,
  gameInput,
  onGameStart,
}: GameMultiplayerFlowProps) {
  const { user, gamertag } = useAuth();
  const [step, setStep] = useState<FlowStep>("choice");
  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

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
    }
  }, [open]);

  // Subscribe to session updates for lobby
  useEffect(() => {
    if (!session?.id) return;
    let cancelled = false;

    subscribeToSession(session.id, (updated) => {
      if (cancelled) return;
      if (updated) setSession(updated);
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
  }, [session?.id]);

  const handleHost = useCallback(async () => {
    if (!user || !gamertag) return;
    setLoading(true);
    setError(null);
    try {
      const sess = await createGameSession(gameInput, user.uid, gamertag);
      setSession(sess);
      setStep("hosting");
    } catch {
      setError("Failed to create game session. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [user, gamertag, gameInput]);

  const handleJoinComplete = useCallback(
    async (code: string) => {
      if (!user || !gamertag) return;
      setLoading(true);
      setError(null);
      try {
        const result = await joinGameSession(code, user.uid, gamertag);
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
    [user, gamertag],
  );

  const handleCopyLink = useCallback(() => {
    if (!session) return;
    const url = `https://johnmarr.com/games?inviteCode=${encodeURIComponent(session.inviteCode)}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [session]);

  const inviteURL = session
    ? `https://johnmarr.com/games?inviteCode=${encodeURIComponent(session.inviteCode)}`
    : "";

  const isHost = session?.ownerId === user?.uid;
  const canStart =
    isHost && session && session.players.length >= 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto bg-black/95 sm:max-w-md">
        {/* Game logo */}
        {gameInput.gameLogoURL && (
          <div className="flex justify-center mb-2">
            <Image
              src={gameInput.gameLogoURL}
              alt={gameInput.gameName}
              width={200}
              height={100}
              className="h-auto w-[200px] object-contain"
              draggable={false}
            />
          </div>
        )}

        {/* ─── Step: Choice ─── */}
        {step === "choice" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-center text-white">
                Play with Friends
              </DialogTitle>
              <DialogDescription className="text-center text-white/50">
                Host a new game or join an existing one.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3 pt-2">
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
                <p className="text-center text-xs text-red-400">
                  You need a gamertag to play multiplayer.
                </p>
              )}
            </div>
          </>
        )}

        {/* ─── Step: Hosting (lobby) ─── */}
        {step === "hosting" && session && (
          <>
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-center text-white">
                Your Game Lobby
              </DialogTitle>
              <DialogDescription className="text-center text-white/50">
                Share this code with friends to join.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center gap-2 pt-1">
              {/* Invite code display */}
              <div className="rounded-xl bg-white/5 px-6 py-2">
                <JMInviteCodeView code={session.inviteCode} size="lg" />
              </div>

              {/* QR code */}
              <div className="rounded-xl bg-white p-3">
                <QRCodeSVG value={inviteURL} size={160} />
              </div>

              {/* Copy link */}
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-2 text-sm font-medium text-white/50 transition-colors hover:text-white"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-green-400" />
                    <span className="text-green-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy invite link
                  </>
                )}
              </button>

              {/* Player list */}
              <div className="w-full rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                  Players ({session.players.length}/{session.maxPlayers})
                </p>
                <div className="flex flex-col gap-2">
                  {session.players.map((p, i) => (
                    <div
                      key={p.uid}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="font-bold text-white">
                        {p.gamertag}
                      </span>
                      {i === 0 && (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-white/40">
                          Host
                        </span>
                      )}
                    </div>
                  ))}
                  {session.players.length < session.maxPlayers && (
                    <div className="flex items-center gap-2 text-sm text-white/20">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Waiting for players...
                    </div>
                  )}
                </div>
              </div>

              {/* Side assignments preview */}
              {session.players.length >= 2 && (
                <div className="flex items-center justify-center gap-4 text-sm">
                  <span className="font-bold text-red-400">
                    Red: {session.players[0]?.gamertag}
                  </span>
                  <span className="text-white/20">vs</span>
                  <span className="font-bold text-white">
                    White: {session.players[1]?.gamertag}
                  </span>
                </div>
              )}

              {/* Start button */}
              <button
                onClick={async () => {
                  if (!session || session.players.length < 2) return;
                  const sides: Record<string, string> = {};
                  sides[session.players[0]!.uid] = "red";
                  sides[session.players[1]!.uid] = "white";
                  await startGame(session.id, sides);
                  onGameStart(session.id);
                }}
                disabled={!canStart}
                className={`
                  w-full rounded-xl py-4 text-lg font-bold uppercase tracking-wider
                  transition-all
                  ${canStart
                    ? "bg-white text-black shadow-lg shadow-white/20 hover:scale-[1.02] active:scale-95"
                    : "cursor-not-allowed bg-white/10 text-white/25"
                  }
                `}
              >
                Start Game
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
                  <p className="text-sm text-white/40">Looking up game...</p>
                </div>
              ) : (
                <JMInviteCodeInput onComplete={handleJoinComplete} />
              )}

              {error && (
                <p className="text-center text-sm font-medium text-red-400">
                  {error}
                </p>
              )}

              <button
                onClick={() => {
                  setStep("choice");
                  setError(null);
                }}
                className="text-xs font-medium uppercase tracking-widest text-white/40 hover:text-white/70"
              >
                Back
              </button>
            </div>
          </>
        )}

        {/* ─── Step: Joined (player lobby) ─── */}
        {step === "joined" && session && (
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
              {/* Game logo */}
              {session.gameLogoURL && (
                <Image
                  src={session.gameLogoURL}
                  alt={session.gameName}
                  width={200}
                  height={64}
                  className="h-16 w-auto object-contain"
                  draggable={false}
                />
              )}

              {/* Invite code */}
              <div className="rounded-xl bg-white/5 px-4 py-2">
                <JMInviteCodeView code={session.inviteCode} size="sm" />
              </div>

              {/* Player list */}
              <div className="w-full rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                  Players ({session.players.length}/{session.maxPlayers})
                </p>
                <div className="flex flex-col gap-2">
                  {session.players.map((p, i) => (
                    <div
                      key={p.uid}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="font-bold text-white">
                        {p.gamertag}
                      </span>
                      {i === 0 && (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-white/40">
                          Host
                        </span>
                      )}
                      {p.uid === user?.uid && (
                        <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-green-400">
                          You
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Waiting indicator */}
              {session.status === "lobby" && (
                <div className="flex items-center gap-2 text-sm text-white/40">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Waiting for host to start...
                </div>
              )}

              {session.status === "playing" && (
                <div className="flex w-full flex-col items-center gap-3">
                  {session.playerSides && (
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
          <p className="text-center text-sm font-medium text-red-400">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
