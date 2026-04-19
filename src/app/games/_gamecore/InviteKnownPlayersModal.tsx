"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Loader2, Send, Check } from "lucide-react";
import { JMAvatarView, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/JMKit";
import {
  getKnownPlayerUids,
  fetchKnownPlayers,
  sendGameInvite,
  type KnownPlayer,
} from "@/lib/game-invites";

interface InviteKnownPlayersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  gameSlug: string;
  gameName: string;
  gameLogoURL: string;
  hostUid: string;
  hostGamertag: string;
  /** UIDs already in the game (joined players) */
  excludeUids: string[];
  /** UIDs already invited (pending) — shown grayed out */
  invitedUids: string[];
}

export function InviteKnownPlayersModal({
  open,
  onOpenChange,
  sessionId,
  gameSlug,
  gameName,
  gameLogoURL,
  hostUid,
  hostGamertag,
  excludeUids,
  invitedUids,
}: InviteKnownPlayersModalProps) {
  const [players, setPlayers] = useState<KnownPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const prevOpenRef = useRef(false);

  // Detect open transition and trigger fetch via ref to avoid lint issue
  const loadPlayers = useCallback(async () => {
    setLoading(true);
    try {
      const uids = await getKnownPlayerUids(hostUid);
      const filtered = uids.filter((u) => !excludeUids.includes(u));
      if (filtered.length === 0) {
        setPlayers([]);
      } else {
        const details = await fetchKnownPlayers(filtered);
        setPlayers(details);
      }
    } finally {
      setLoading(false);
    }
  }, [hostUid, excludeUids]);

  // Trigger load when modal transitions from closed to open
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;
    if (open && !wasOpen) {
      loadPlayers();
    }
  }, [open, loadPlayers]);

  const handleOpenChange = useCallback((next: boolean) => {
    if (!next) {
      setSelected(new Set());
      setSent(false);
    }
    onOpenChange(next);
  }, [onOpenChange]);

  const togglePlayer = useCallback((uid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }, []);

  const handleSend = useCallback(async () => {
    if (selected.size === 0) return;
    setSending(true);

    const gameInfo = { gameSlug, gameName, gameLogoURL };
    const promises = Array.from(selected).map((uid) =>
      sendGameInvite(sessionId, gameInfo, hostUid, hostGamertag, uid),
    );
    await Promise.all(promises);

    setSending(false);
    setSent(true);
    setTimeout(() => handleOpenChange(false), 800);
  }, [selected, sessionId, gameSlug, gameName, gameLogoURL, hostUid, hostGamertag, handleOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[80dvh] overflow-y-auto bg-black/95 sm:max-w-sm" onInteractOutside={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-center text-white">
            Invite Players
          </DialogTitle>
          <DialogDescription className="sr-only">
            Invite known players to your game
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg bg-green-800 px-4 py-3 text-center text-sm font-medium text-white">
          Select players you&apos;ve played with before. They&apos;ll see a <b>green</b> invite banner on the home page.
        </div>

        <div className="flex flex-col gap-3 pt-2">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-white/40" />
              <p className="text-xs text-white/30">Loading players...</p>
            </div>
          ) : players.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/30">
              No known players yet. Play some games and your contacts will appear here.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                {players.map((p) => {
                  const isInvited = invitedUids.includes(p.uid);
                  const isSelected = selected.has(p.uid);
                  return (
                    <button
                      key={p.uid}
                      onClick={() => !isInvited && togglePlayer(p.uid)}
                      disabled={isInvited}
                      className={`flex items-center gap-3 rounded-xl px-3 py-3.5 transition-colors ${
                        isInvited
                          ? "cursor-default opacity-40"
                          : isSelected
                            ? "bg-green-500/15 ring-1 ring-green-500/30"
                            : "bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full">
                        {p.avatarName ? (
                          <JMAvatarView width={44} avatarName={p.avatarName} />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-purple-500/20">
                            <span className="text-sm font-bold text-purple-400">
                              {p.gamertag.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="flex-1 text-left text-base font-bold text-white">
                        {p.gamertag}
                      </span>
                      {isInvited && (
                        <span className="text-xs font-medium text-white/40">(invited)</span>
                      )}
                      {isSelected && !isInvited && (
                        <Check className="h-4 w-4 text-green-400" />
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleSend}
                disabled={selected.size === 0 || sending || sent}
                className={`flex items-center justify-center gap-2 rounded-xl py-4 text-sm font-bold uppercase tracking-wider transition-all ${
                  sent
                    ? "bg-green-500/20 text-green-400"
                    : selected.size > 0
                      ? "bg-white text-black hover:scale-[1.02] active:scale-95"
                      : "cursor-not-allowed bg-white/10 text-white/25"
                }`}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : sent ? (
                  <>
                    <Check className="h-4 w-4" />
                    Sent!
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send Invite{selected.size > 1 ? "s" : ""} ({selected.size})
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
