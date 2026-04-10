"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { JMAppHeader } from "@/JMKit";
import { JMInviteCodeView } from "@/JMKit/JMInviteCodeView";
import { useAuth } from "@/lib/AuthProvider";
import {
  getInviteCodeEntry,
  joinGameSession,
} from "@/lib/game-sessions";

export default function GamesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, gamertag, avatarName, isLoading: authLoading } = useAuth();

  const inviteCode = searchParams.get("inviteCode");

  const needsAuth = !authLoading && inviteCode && (!user || !gamertag);

  const [status, setStatus] = useState<
    "loading" | "joining" | "error" | "no-code"
  >(inviteCode ? "loading" : "no-code");
  const [error, setError] = useState<string | null>(null);
  const [gameName, setGameName] = useState<string | null>(null);

  useEffect(() => {
    if (!inviteCode || authLoading || !user || !gamertag) return;

    let cancelled = false;

    async function join() {
      if (!cancelled) setStatus("loading");
      try {
        const entry = await getInviteCodeEntry(inviteCode!);
        if (!entry) {
          if (!cancelled) {
            setStatus("error");
            setError("No game found with that invite code.");
          }
          return;
        }

        if (!cancelled) {
          setGameName(entry.gameName);
          setStatus("joining");
        }

        const result = await joinGameSession(
          inviteCode!,
          user!.uid,
          gamertag!,
          avatarName ?? undefined,
        );

        if (cancelled) return;

        if (result.ok) {
          router.replace(
            `/games/${entry.gameSlug}?sessionId=${result.session.id}`,
          );
        } else {
          const msgs: Record<string, string> = {
            not_found: "Game session no longer exists.",
            full: "That game is full.",
            already_joined: "You're already in this game.",
            error: "Something went wrong. Please try again.",
          };
          setStatus("error");
          setError(msgs[result.reason] ?? "Could not join.");
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
          setError("Something went wrong. Please try again.");
        }
      }
    }

    join();
    return () => {
      cancelled = true;
    };
  }, [inviteCode, user, gamertag, avatarName, authLoading, router]);

  if (!inviteCode) {
    router.replace("/");
    return null;
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      <div className="relative z-20">
        <JMAppHeader />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
        {needsAuth && (
          <>
            <p className="text-center text-lg font-bold text-red-400">
              You need to sign in with a gamertag to join a game.
            </p>
            <div className="rounded-xl bg-white/5 px-6 py-3">
              <JMInviteCodeView code={inviteCode} size="md" />
            </div>
          </>
        )}

        {!needsAuth && (status === "loading" || status === "joining") && (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-white/40" />
            <p className="text-sm font-medium text-white/50">
              {status === "joining" && gameName
                ? `Joining ${gameName}...`
                : "Looking up game..."}
            </p>
            <div className="rounded-xl bg-white/5 px-6 py-3">
              <JMInviteCodeView code={inviteCode} size="md" />
            </div>
          </>
        )}

        {!needsAuth && status === "error" && (
          <>
            <p className="text-center text-lg font-bold text-red-400">
              {error}
            </p>
            <div className="rounded-xl bg-white/5 px-6 py-3">
              <JMInviteCodeView code={inviteCode} size="md" />
            </div>
            <button
              onClick={() => router.replace("/")}
              className="rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-bold uppercase tracking-wider text-white transition-all hover:bg-white/10"
            >
              Go Home
            </button>
          </>
        )}
      </div>
    </div>
  );
}
