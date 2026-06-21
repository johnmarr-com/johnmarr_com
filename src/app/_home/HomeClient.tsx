"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { getAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { Play, ChevronRight, Trash2, Mail } from "lucide-react";
import { JMAppHeader, JMWelcomeAvatarModal, JMLevelUpPopup, Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogDescription, JMCloseCircleButton } from "@/JMKit";
import { useJMStyle } from "@/JMStyle";
import { subscribeToPublishedAlert } from "@/lib/content";
import type { JMAlert } from "@/lib/content-types";
import { subscribeToMyInvites, removeInvite, type GameInvite } from "@/lib/game-invites";
import { bgMusic } from "@/lib/BackgroundMusicPlayer";
import { getGamePlayHrefWithSession } from "@/lib/composite-game-slug";
import type { ResolvedSegment } from "@/lib/content-server";
import { PageSegments, segmentsHaveContent } from "./PageSegments";

interface HomeClientProps {
  /** The home page's resolved segment stack, fetched on the SERVER (Admin SDK)
   *  — never a client read, so the home is iOS-reliable. */
  segments: ResolvedSegment[];
}

/**
 * Interactive home shell. Content (featured + rows) arrives as props from the
 * server component; this component owns auth/personalization (alert + invites
 * subscriptions, welcome/level-up modals) and all click handlers.
 */
export default function HomeClient({ segments }: HomeClientProps) {
  const { user, isLoading, gamertag } = useAuth();
  const { theme } = useJMStyle();
  const router = useRouter();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [hasCheckedAvatar, setHasCheckedAvatar] = useState(false);
  const [activeAlert, setActiveAlert] = useState<JMAlert | null>(null);
  const [gameInvites, setGameInvites] = useState<GameInvite[]>([]);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [deletingInviteId, setDeletingInviteId] = useState<string | null>(null);
  const alertUnsubRef = useRef<(() => void) | null>(null);
  const inviteUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => { bgMusic.stop(); }, []);

  // Real-time admin alert subscription
  useEffect(() => {
    let cancelled = false;
    subscribeToPublishedAlert((alert) => {
      if (!cancelled) setActiveAlert(alert);
    }).then((unsub) => {
      if (cancelled) unsub();
      else alertUnsubRef.current = unsub;
    }).catch(() => {});

    return () => {
      cancelled = true;
      alertUnsubRef.current?.();
      alertUnsubRef.current = null;
    };
  }, []);

  // Real-time game invite subscription
  useEffect(() => {
    if (!user?.uid) {
      setGameInvites([]);
      return;
    }

    let cancelled = false;
    subscribeToMyInvites(user.uid, (invites) => {
      if (!cancelled) setGameInvites(invites);
    }).then((unsub) => {
      if (cancelled) unsub();
      else inviteUnsubRef.current = unsub;
    }).catch(() => {});

    return () => {
      cancelled = true;
      inviteUnsubRef.current?.();
      inviteUnsubRef.current = null;
    };
  }, [user?.uid]);

  // Check if this is a first-time user (no avatar)
  useEffect(() => {
    const checkFirstLogin = async () => {
      if (!user || hasCheckedAvatar) return;

      try {
        const auth = await getAuth();
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        const idToken = await currentUser.getIdToken();
        const response = await fetch("/api/user/avatar", {
          headers: { "Authorization": `Bearer ${idToken}` },
        });

        if (response.ok) {
          const data = await response.json();
          if (!data.avatarName) {
            setShowWelcomeModal(true);
          }
        }
      } catch (error) {
        console.error("Failed to check avatar:", error);
      } finally {
        setHasCheckedAvatar(true);
      }
    };

    // Only first-time users (no gamertag yet) need the onboarding check. A
    // returning player already has a gamertag — skip it entirely so the
    // onboarding modal can't flash on navigation back to home.
    if (user && !isLoading && !gamertag) {
      checkFirstLogin();
    }
  }, [user, isLoading, hasCheckedAvatar, gamertag]);

  const handleDeleteInvite = useCallback(async (invite: GameInvite) => {
    if (!user) return;
    setDeletingInviteId(invite.id);
    try {
      await removeInvite(invite.id, invite.sessionId, user.uid);
    } catch {
      // Invite may already be deleted — ignore
    } finally {
      setDeletingInviteId(null);
    }
  }, [user]);

  const handlePlayInvite = useCallback((invite: GameInvite) => {
    setInviteModalOpen(false);
    router.push(
      getGamePlayHrefWithSession(invite.gameSlug, invite.sessionId, invite.engineSlug),
    );
  }, [router]);

  const hasAnyContent = segmentsHaveContent(segments);

  return (
    <div
      className="relative min-h-screen"
      style={{ backgroundColor: theme.surfaces.base }}
    >
      <JMAppHeader />

      {/* Main Content Area */}
      <main className="pb-12">
        {/* Active Alert Banner */}
        {activeAlert && (
          <div
            className="w-full px-4 py-3 sm:px-6 sm:py-4"
            style={{ backgroundColor: theme.accents.goldenGlow }}
          >
            <p
              className="text-center font-bold whitespace-pre-wrap text-sm sm:text-base"
              style={{ color: "#000" }}
            >
              {activeAlert.text}
            </p>
          </div>
        )}

        {/* Game Invitations Banner */}
        {gameInvites.length > 0 && (
          <button
            onClick={() => setInviteModalOpen(true)}
            className="flex w-full items-center justify-between gap-3 bg-green-600 px-4 py-3 transition-colors active:bg-green-700 sm:px-6"
          >
            <div className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 text-white/80" />
              <p className="text-sm font-black uppercase tracking-wider text-white sm:text-base">
                Game Invitations
              </p>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold text-white">
                {gameInvites.length}
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-white/60" />
          </button>
        )}

        {/* The home's segment stack (carousels, rows, scrollyfoxes, …) */}
        {hasAnyContent ? (
          <PageSegments segments={segments} />
        ) : (
          <section className="relative mt-4">
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <h1
                className="mb-4 text-4xl font-bold sm:text-5xl"
                style={{ color: theme.text.primary }}
              >
                Welcome to John Marr
              </h1>
              <p
                className="max-w-md text-lg"
                style={{ color: theme.text.secondary }}
              >
                Content coming soon. Check back for shows, stories, games, and more.
              </p>
            </div>
          </section>
        )}
      </main>

      {/* Welcome modal for first-time users. Belt-and-suspenders: never render
          for a player who already has a gamertag, so it can't flash on return. */}
      <JMWelcomeAvatarModal
        isOpen={showWelcomeModal && !gamertag}
        onClose={() => setShowWelcomeModal(false)}
      />

      {/* Level-up celebration popup */}
      <JMLevelUpPopup />

      {/* Game Invitations Modal */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent
          hideCloseButton
          className="max-h-[90dvh] w-full max-w-md gap-0 overflow-hidden rounded-[28px] border border-white/15 bg-linear-to-b from-neutral-950 via-neutral-900 to-neutral-950 p-0 shadow-2xl shadow-black/50"
        >
          <DialogClose asChild>
            <JMCloseCircleButton className="absolute right-4 top-4 z-20" />
          </DialogClose>

          <div className="px-6 pb-6 pt-5">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-center text-base font-black uppercase tracking-widest text-white">
                Game Invitations
              </DialogTitle>
              <DialogDescription className="sr-only">
                Game invitations from other players
              </DialogDescription>
            </DialogHeader>

            {gameInvites.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/40">
                No invitations right now.
              </p>
            ) : (
              <div className="flex max-h-[60dvh] flex-col gap-2 overflow-y-auto">
                {gameInvites.map((invite) => {
                  const ts = invite.createdAt?.toDate?.();
                  const dateStr = ts
                    ? ts.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
                      " at " +
                      ts.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
                    : "";
                  return (
                    <div
                      key={invite.id}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-white">
                          {invite.gameName}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-white/50">
                          from {invite.fromGamertag}
                        </p>
                        {dateStr && (
                          <p className="mt-0.5 truncate text-xs text-white/30">
                            {dateStr}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handlePlayInvite(invite)}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-green-600 px-5 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-lg transition-all active:scale-95"
                      >
                        <Play className="h-3 w-3" fill="currentColor" />
                        Play
                      </button>
                      <button
                        onClick={() => handleDeleteInvite(invite)}
                        disabled={deletingInviteId === invite.id}
                        className="shrink-0 rounded-lg bg-white/5 p-3 text-white/30 transition-colors active:bg-red-500/20 active:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
