"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, ChevronRight } from "lucide-react";
import { getOfficialHeists } from "@/lib/fyve-heists";
import type { FyveHeist } from "./fyveTypes";
import HeistPickerModal from "./HeistPickerModal";

/** Pick a sensible default from official heists. */
function pickDefaultHeist(heists: FyveHeist[]): FyveHeist | null {
  if (heists.length === 0) return null;
  return heists[0] ?? null;
}

async function writeLobbyHeistToSession(
  sessionId: string,
  heist: FyveHeist,
): Promise<void> {
  const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  const { initializeFirebase } = await import("@/lib/firebase");
  const { getFirestore } = await import("firebase/firestore");
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  await updateDoc(doc(db, "gameSessions", sessionId), {
    fyveLobbyHeistId: heist.id,
    fyveLobbyHeistTitle: heist.title,
    fyveLobbyHeistBgUrl: heist.backgroundImageUrl,
    updatedAt: serverTimestamp(),
  });
}

interface HeistLobbySelectorProps {
  sessionId: string;
  /** Primary accent color from game CMS */
  accentColor?: string;
}

/**
 * Host lobby: auto-selects default heist, host can change before Start.
 * Writes `fyveLobbyHeist*` fields to the session so FyveGame can read them.
 */
export default function HeistLobbySelector({
  sessionId,
  accentColor = "#E84C1E",
}: HeistLobbySelectorProps) {
  const [selected, setSelected] = useState<FyveHeist | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const official = await getOfficialHeists();
        const def = pickDefaultHeist(official);
        if (cancelled) return;
        if (def) {
          setSelected(def);
          await writeLobbyHeistToSession(sessionId, def);
        }
      } catch (e) {
        console.error("[HeistLobbySelector]", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  const onPickFromModal = useCallback(
    async (heist: FyveHeist) => {
      setSelected(heist);
      setPickerOpen(false);
      try {
        await writeLobbyHeistToSession(sessionId, heist);
      } catch (e) {
        console.error("[HeistLobbySelector] save heist", e);
      }
    },
    [sessionId],
  );

  return (
    <>
      <div
        className="mt-4 w-full rounded-xl border p-4"
        style={{
          borderColor: `${accentColor}33`,
          backgroundColor: `${accentColor}0D`,
        }}
      >
        <p
          className="mb-2 text-center text-xs font-bold uppercase tracking-wider"
          style={{ color: `${accentColor}E6` }}
        >
          Heist
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
            {selected.backgroundImageUrl ? (
              <div
                className="h-12 w-12 shrink-0 rounded-lg bg-cover bg-center"
                style={{ backgroundImage: `url(${selected.backgroundImageUrl})` }}
              />
            ) : (
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-sm font-black"
                style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
              >
                S7
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{selected.title}</p>
              <p className="text-xs text-white/45">
                {selected.setting.location} &bull; tap to change
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-white/40" />
          </button>
        )}
      </div>

      {pickerOpen && (
        <HeistPickerModal
          onSelect={onPickFromModal}
          onClose={() => setPickerOpen(false)}
          accentColor={accentColor}
        />
      )}
    </>
  );
}
