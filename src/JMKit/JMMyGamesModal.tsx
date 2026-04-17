"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useJMStyle } from "@/JMStyle";
import { useAuth } from "@/lib/AuthProvider";
import { getActiveSessionsForUser } from "@/lib/game-sessions";
import type { GameSession } from "@/lib/game-sessions";

interface JMMyGamesModalProps {
  onClose: () => void;
}

export function JMMyGamesModal({ onClose }: JMMyGamesModalProps) {
  const { theme } = useJMStyle();
  const { user } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(!!user);

  useEffect(() => {
    if (!user) return;
    getActiveSessionsForUser(user.uid)
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [user]);

  const handleRejoin = (session: GameSession) => {
    onClose();
    router.push(`/games/${session.gameSlug}?sessionId=${session.id}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="max-w-sm w-full rounded-2xl border overflow-hidden"
        style={{
          backgroundColor: theme.surfaces.base,
          borderColor: theme.surfaces.elevated2,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2
            className="text-lg font-semibold"
            style={{ color: theme.text.primary }}
          >
            My Games
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 transition-colors hover:bg-white/10"
            style={{ color: theme.text.tertiary }}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-5 pb-5 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <div
                className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
                style={{ borderColor: theme.accents.neonPink, borderTopColor: "transparent" }}
              />
            </div>
          ) : sessions.length === 0 ? (
            <p
              className="py-8 text-center text-sm"
              style={{ color: theme.text.tertiary }}
            >
              No active games
            </p>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => handleRejoin(session)}
                  className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all hover:brightness-110"
                  style={{
                    backgroundColor: theme.surfaces.elevated1,
                    borderColor: theme.surfaces.elevated2,
                  }}
                >
                  {session.gameLogoURL ? (
                    <Image
                      src={session.gameLogoURL}
                      alt={session.gameName}
                      width={48}
                      height={24}
                      className="h-6 w-12 rounded object-contain"
                    />
                  ) : (
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg"
                      style={{ backgroundColor: theme.surfaces.elevated2 }}
                    >
                      🎮
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p
                        className="truncate text-sm font-medium"
                        style={{ color: theme.text.primary }}
                      >
                        {session.gameName}
                      </p>
                      {user && session.ownerId === user.uid && (
                        <span className="shrink-0 rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/60">
                          Host
                        </span>
                      )}
                    </div>
                    <p
                      className="text-xs"
                      style={{ color: theme.text.tertiary }}
                    >
                      {session.players.length} player{session.players.length !== 1 ? "s" : ""}
                      {" · "}
                      {session.status === "lobby" ? "In lobby" : "In progress"}
                      {" · "}
                      {session.updatedAt?.toDate
                        ? session.updatedAt.toDate().toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                        : ""}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold"
                    style={{
                      backgroundColor: session.status === "playing"
                        ? `${theme.semantic.success}20`
                        : `${theme.accents.neonPink}20`,
                      color: session.status === "playing"
                        ? theme.semantic.success
                        : theme.accents.neonPink,
                    }}
                  >
                    {session.status === "playing" ? "Rejoin" : "Open"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
