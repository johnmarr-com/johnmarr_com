"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, ChevronRight, GraduationCap, Zap, Clock, Footprints } from "lucide-react";
import { getOfficialBlarfPacks, type BlarfPack } from "@/lib/blarf-packs";
import type { GameLengthPreset } from "@/app/games/_gamecore/gameLengthPresets";
import { JMGameLengthPicker } from "@/JMKit";
import BlarfPackPicker from "./BlarfPackPicker";

const BF_LENGTH_PRESETS: GameLengthPreset[] = [
  { key: "learn", label: "Learn", rounds: 1, estimatedMinutes: 2, icon: GraduationCap, iconColor: "#ffffff" },
  { key: "quick", label: "Quick", rounds: 2, estimatedMinutes: 4, icon: Zap, iconColor: "#F7D047" },
  { key: "standard", label: "Standard", rounds: 4, estimatedMinutes: 8, icon: Clock, iconColor: "#C93C3C" },
  { key: "long", label: "Long", rounds: 6, estimatedMinutes: 12, icon: Footprints, iconColor: "#4BA3C7" },
];

const DEFAULT_PRESET_KEY = "standard";

function pickDefaultPack(packs: BlarfPack[]): BlarfPack | null {
  const withRounds = packs.filter((p) => p.rounds.length > 0);
  if (withRounds.length === 0) return null;
  const starter = withRounds.find((p) => /\bstarter\b|^basic$/i.test(p.name.trim()));
  return starter ?? withRounds[0] ?? null;
}

async function writeLobbyFields(
  sessionId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  const { initializeFirebase } = await import("@/lib/firebase");
  const { getFirestore } = await import("firebase/firestore");
  const { app } = await initializeFirebase();
  const db = getFirestore(app);
  await updateDoc(doc(db, "gameSessions", sessionId), {
    ...fields,
    updatedAt: serverTimestamp(),
  });
}

interface Props {
  sessionId: string;
}

export default function BlarfPackLobbySelector({ sessionId }: Props) {
  const [selected, setSelected] = useState<BlarfPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lengthKey, setLengthKey] = useState(DEFAULT_PRESET_KEY);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const official = await getOfficialBlarfPacks();
        const def = pickDefaultPack(official);
        if (cancelled) return;
        const defaultPreset = BF_LENGTH_PRESETS.find((p) => p.key === DEFAULT_PRESET_KEY)!;
        if (def) {
          setSelected(def);
          await writeLobbyFields(sessionId, {
            bfLobbyPackId: def.id,
            bfLobbyPackName: def.name,
            bfLobbyPackCoverURL: def.coverImageURL,
            bfLobbyRounds: defaultPreset.rounds,
          });
        } else {
          await writeLobbyFields(sessionId, {
            bfLobbyRounds: defaultPreset.rounds,
          });
        }
      } catch (e) {
        console.error("[BlarfPackLobbySelector]", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  const onPickFromModal = useCallback(
    async (pack: BlarfPack) => {
      setSelected(pack);
      setPickerOpen(false);
      try {
        await writeLobbyFields(sessionId, {
          bfLobbyPackId: pack.id,
          bfLobbyPackName: pack.name,
          bfLobbyPackCoverURL: pack.coverImageURL,
        });
      } catch (e) {
        console.error("[BlarfPackLobbySelector] save pack", e);
      }
    },
    [sessionId],
  );

  const onLengthChange = useCallback(
    async (preset: GameLengthPreset) => {
      setLengthKey(preset.key);
      try {
        await writeLobbyFields(sessionId, { bfLobbyRounds: preset.rounds });
      } catch (e) {
        console.error("[BlarfPackLobbySelector] save rounds", e);
      }
    },
    [sessionId],
  );

  return (
    <>
      <div className="mt-4 w-full rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
        <p className="mb-2 text-center text-xs font-bold uppercase tracking-wider text-amber-400/90">
          Word Pack
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
            {selected.coverImageURL && (
              <div
                className="h-12 w-12 shrink-0 rounded-lg bg-cover bg-center"
                style={{ backgroundImage: `url(${selected.coverImageURL})` }}
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-black text-white">{selected.name}</p>
              <p className="text-sm text-white/70">{selected.rounds.length} rounds</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-white/40" />
          </button>
        )}
      </div>

      {/* Game length selector */}
      <div className="mt-3 w-full rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
        <p className="mb-2 text-center text-xs font-bold uppercase tracking-wider text-amber-400/90">
          Game Length
        </p>
        <JMGameLengthPicker
          presets={BF_LENGTH_PRESETS}
          selectedKey={lengthKey}
          onChange={onLengthChange}
        />
      </div>

      {pickerOpen && (
        <BlarfPackPicker
          onSelect={onPickFromModal}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}
