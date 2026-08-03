"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { subscribeToSession, type GameSession } from "@/lib/game-sessions";
import { updateSessionFields } from "@/app/games/_gamecore/sessionHelpers";
import { useGameColors, GamePrimaryButton, GameStatusMessage } from "@/app/games/_gamecore";
import { useAuth } from "@/lib/AuthProvider";
import { JMTextCard } from "@/JMKit";
import {
  listItemsForPack,
  type BullshiitakeItem,
  type BSType,
} from "@/lib/bullshiitake-packs";
import BullshiitakePackPicker from "./BullshiitakePackPicker";
import type { GC3Props } from "../_gamecore/registry/types";

/** The story fields copied into the session doc — viewers render purely from
 * the snapshot (no per-client Firestore reads; see docs/DATA-ACCESS.md). */
interface PresentedStory {
  itemId: string;
  bsType: BSType;
  storyText: string;
  correction?: string;
  imageURL?: string;
  searchID?: number;
}

const REVEAL_LABEL: Record<BSType, string> = {
  true: "TRUE",
  partlytrue: "PARTLY TRUE",
  bullshiitake: "BULL SHIITAKE",
};

/**
 * Bull Shiitake GC3 — a host-presented story game. The HOST controls
 * everything (pick pack → reveal → next); everyone else just watches the
 * shared screen. Endless: no scoring, no game end, `onGameEnd` never fires.
 *
 * Host-driven by design (no engineKey): the host IS the presenter, the only
 * state is what they present, and it's written to the session via
 * `updateSessionFields` (the legacy owner-writes regime). Viewers render
 * from `subscribeToSession` snapshots alone.
 */
export default function BullshiitakeGame({ sessionId }: GC3Props) {
  const router = useRouter();
  const gc = useGameColors();
  const { user } = useAuth();
  const [session, setSession] = useState<GameSession | null>(null);
  const [busy, setBusy] = useState(false);

  // The host's local copy of the pack's stories (viewers never load these).
  const itemsRef = useRef<{ packId: string; items: BullshiitakeItem[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;
    void subscribeToSession(sessionId, (s) => {
      if (!cancelled) setSession(s);
    }).then((u) => {
      if (cancelled) u();
      else unsub = u;
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [sessionId]);

  const s = (session ?? {}) as unknown as Record<string, unknown>;
  const bsPhase = (s["bsPhase"] as string) ?? "setup";
  const bsItem = (s["bsItem"] as PresentedStory | null) ?? null;
  const bsRevealed = s["bsRevealed"] === true;
  const bsPackId = (s["bsPackId"] as string) ?? "";
  const rawSeenIds = s["bsSeenIds"];
  const bsSeenIds = useMemo(
    () => (Array.isArray(rawSeenIds) ? (rawSeenIds as string[]) : []),
    [rawSeenIds],
  );
  const isHost = !!session && !!user && session.ownerId === user.uid;

  const ensureItems = useCallback(async (packId: string): Promise<BullshiitakeItem[]> => {
    if (itemsRef.current?.packId === packId) return itemsRef.current.items;
    const items = (await listItemsForPack(packId)).filter((i) => i.storyText.trim());
    itemsRef.current = { packId, items };
    return items;
  }, []);

  /** Host: pick a random unseen story and present it (reshuffle on exhaustion). */
  const presentRandom = useCallback(
    async (packId: string, seenIds: string[]) => {
      setBusy(true);
      try {
        const items = await ensureItems(packId);
        if (items.length === 0) return;
        let pool = items.filter((i) => !seenIds.includes(i.id));
        let seen = seenIds;
        if (pool.length === 0) {
          // Deck exhausted — start a fresh cycle.
          pool = items;
          seen = [];
        }
        const pick = pool[Math.floor(Math.random() * pool.length)]!;
        const story: PresentedStory = {
          itemId: pick.id,
          bsType: pick.bsType,
          storyText: pick.storyText,
          ...(pick.correction ? { correction: pick.correction } : {}),
          ...(pick.imageURL ? { imageURL: pick.imageURL } : {}),
          ...(pick.searchID != null ? { searchID: pick.searchID } : {}),
        };
        await updateSessionFields(sessionId, {
          bsPhase: "story",
          bsPackId: packId,
          bsItem: story,
          bsRevealed: false,
          bsSeenIds: [...seen, pick.id],
        });
      } catch (e) {
        console.error("[bullshiitake] present failed:", e);
      } finally {
        setBusy(false);
      }
    },
    [ensureItems, sessionId],
  );

  const handleReveal = useCallback(() => {
    void updateSessionFields(sessionId, { bsRevealed: true });
  }, [sessionId]);

  const handleNext = useCallback(() => {
    if (!bsPackId) return;
    void presentRandom(bsPackId, bsSeenIds);
  }, [presentRandom, bsPackId, bsSeenIds]);

  const revealColor =
    bsItem?.bsType === "bullshiitake" ? gc.primary || "#F97316" : "#FFFFFF";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#140d06" }}>
      {/* Exit — back to the Games page */}
      <button
        type="button"
        onClick={() => router.push("/games")}
        className="fixed top-4 left-4 z-20 flex items-center gap-1.5 rounded-full bg-black/50 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Exit
      </button>

      {!session ? (
        <div className="flex min-h-screen items-center justify-center">
          <GameStatusMessage message="Loading…" type="loading" />
        </div>
      ) : bsPhase === "setup" || !bsItem ? (
        isHost ? (
          <BullshiitakePackPicker
            onSelect={(pack) => void presentRandom(pack.id, [])}
            defaultPackId={bsPackId || null}
          />
        ) : (
          <div className="flex min-h-screen items-center justify-center px-6">
            <GameStatusMessage message="Waiting for the host to choose a pack…" type="waiting" />
          </div>
        )
      ) : (
        /* Story presentation — central 800px column, page scrolls naturally. */
        <main className="mx-auto w-full max-w-200 px-4 pt-16 pb-24 sm:pt-20">
          {/* 2:1 banner */}
          {bsItem.imageURL && (
            <div className="relative mb-6 aspect-2/1 w-full overflow-hidden rounded-2xl shadow-2xl">
              <Image
                src={bsItem.imageURL}
                alt=""
                fill
                sizes="(max-width: 800px) 100vw, 800px"
                priority
                className="object-cover"
              />
            </div>
          )}

          {/* The story */}
          <JMTextCard
            text={bsItem.storyText}
            align="left"
            preserveWhitespace
            darkShadow
            className="mb-8"
          />

          {!bsRevealed ? (
            /* Reveal — host only; everyone else watches */
            isHost && (
              <GamePrimaryButton onClick={handleReveal} variant="white" loading={busy}>
                Reveal
              </GamePrimaryButton>
            )
          ) : (
            <div>
              {/* BS-Type verdict */}
              <h2
                className="text-center text-5xl font-black uppercase tracking-wide sm:text-6xl"
                style={{ color: revealColor, textShadow: "0 4px 24px rgba(0,0,0,0.6)" }}
              >
                {REVEAL_LABEL[bsItem.bsType]}
              </h2>

              {/* Partly True correction */}
              {bsItem.bsType === "partlytrue" && bsItem.correction && (
                <p className="mx-auto mt-5 max-w-160 whitespace-pre-wrap text-center text-lg leading-relaxed text-white/85">
                  {bsItem.correction}
                </p>
              )}

              {/* Next — host only, smaller, right-aligned */}
              {isHost && (
                <div className="mt-8 flex justify-end">
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={busy}
                    className="rounded-full px-8 py-3 text-sm font-bold uppercase tracking-wider text-black transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                    style={{ backgroundColor: gc.primary || "#F97316" }}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      )}
    </div>
  );
}
