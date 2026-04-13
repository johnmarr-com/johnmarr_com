"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, ChevronRight } from "lucide-react";
import { getOfficialPacks, type BluffBoxPack } from "@/lib/bluffbox-packs";
import { BluffPackCover } from "@/JMKit";
import BluffPackPicker from "./BluffPackPicker";

function pickDefaultPack(packs: BluffBoxPack[]): BluffBoxPack | null {
  const withCards = packs.filter((p) => p.cards.length > 0);
  if (withCards.length === 0) return null;
  const basic = withCards.find((p) => /\bbluff\s*box\s*basic\b|^basic$/i.test(p.name.trim()));
  return basic ?? withCards[0] ?? null;
}

async function writeLobbyPackToSession(
  sessionId: string,
  pack: BluffBoxPack,
): Promise<void> {
  const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  const { initializeFirebase } = await import("@/lib/firebase");
  const { getFirestore } = await import("firebase/firestore");
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  await updateDoc(doc(db, "gameSessions", sessionId), {
    bluffLobbyPackId: pack.id,
    bluffLobbyPackName: pack.name,
    bluffLobbyPackCoverURL: pack.coverImageURL,
    updatedAt: serverTimestamp(),
  });
}

interface BluffPackLobbySelectorProps {
  sessionId: string;
}

/**
 * Host multiplayer lobby: default official pack (prefers “Bluff Box Basic”), owner can change before Start.
 * Writes `bluffLobbyPack*` on the session so {@link BluffBoxGame} can skip the in-game pack-select step.
 */
export default function BluffPackLobbySelector({ sessionId }: BluffPackLobbySelectorProps) {
  const [selected, setSelected] = useState<BluffBoxPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const official = await getOfficialPacks();
        const def = pickDefaultPack(official);
        if (cancelled) return;
        if (def) {
          setSelected(def);
          await writeLobbyPackToSession(sessionId, def);
        }
      } catch (e) {
        console.error("[BluffPackLobbySelector]", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const onPickFromModal = useCallback(
    async (pack: BluffBoxPack) => {
      setSelected(pack);
      setPickerOpen(false);
      try {
        await writeLobbyPackToSession(sessionId, pack);
      } catch (e) {
        console.error("[BluffPackLobbySelector] save pack", e);
      }
    },
    [sessionId],
  );

  return (
    <>
      <div className="mt-4 w-full rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
        <p className="mb-2 text-center text-xs font-bold uppercase tracking-wider text-amber-400/90">
          Bluff pack
        </p>
        {loading || !selected ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-white/30" />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-left transition-colors hover:bg-white/10"
          >
            <BluffPackCover coverImageURL={selected.coverImageURL} name={selected.name} size={48} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{selected.name}</p>
              <p className="text-xs text-white/45">{selected.cards.length} cards · tap to change</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-white/40" />
          </button>
        )}
      </div>

      {pickerOpen && (
        <BluffPackPicker onSelect={onPickFromModal} onClose={() => setPickerOpen(false)} />
      )}
    </>
  );
}
