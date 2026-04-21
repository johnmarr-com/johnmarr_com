"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, ChevronRight } from "lucide-react";
import { getOfficialPacks, type WordonkulousPack } from "@/lib/wordonkulous-packs";
import { GraduationCap, Zap, Clock, Footprints } from "lucide-react";
import type { GameLengthPreset } from "@/app/games/_gamecore/gameLengthPresets";
import { JMGameLengthPicker } from "@/JMKit";
import WordonkulousPackPicker from "./WordonkulousPackPicker";

const WK_LENGTH_PRESETS: GameLengthPreset[] = [
  { key: "learn", label: "Learn", rounds: 1, estimatedMinutes: 3, icon: GraduationCap, iconColor: "#ffffff" },
  { key: "quick", label: "Quick", rounds: 3, estimatedMinutes: 8, icon: Zap, iconColor: "#facc15" },
  { key: "standard", label: "Standard", rounds: 5, estimatedMinutes: 12, icon: Clock, iconColor: "#ff1493" },
  { key: "marathon", label: "Marathon", rounds: 7, estimatedMinutes: 17, icon: Footprints, iconColor: "#00fffc" },
];

const DEFAULT_PRESET_KEY = "standard";

function pickDefaultPack(packs: WordonkulousPack[]): WordonkulousPack | null {
  const withDefs = packs.filter((p) => p.definitions.length > 0);
  if (withDefs.length === 0) return null;
  const starter = withDefs.find((p) => /\bstarter\b|^basic$/i.test(p.name.trim()));
  return starter ?? withDefs[0] ?? null;
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

export default function WordonkulousPackLobbySelector({ sessionId }: Props) {
  const [selected, setSelected] = useState<WordonkulousPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lengthKey, setLengthKey] = useState(DEFAULT_PRESET_KEY);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const official = await getOfficialPacks();
        const def = pickDefaultPack(official);
        if (cancelled) return;
        const defaultPreset = WK_LENGTH_PRESETS.find((p) => p.key === DEFAULT_PRESET_KEY)!;
        if (def) {
          setSelected(def);
          await writeLobbyFields(sessionId, {
            wkLobbyPackId: def.id,
            wkLobbyPackName: def.name,
            wkLobbyPackCoverURL: def.coverImageURL,
            wkLobbyRounds: defaultPreset.rounds,
          });
        } else {
          await writeLobbyFields(sessionId, {
            wkLobbyRounds: defaultPreset.rounds,
          });
        }
      } catch (e) {
        console.error("[WordonkulousPackLobbySelector]", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  const onPickFromModal = useCallback(
    async (pack: WordonkulousPack) => {
      setSelected(pack);
      setPickerOpen(false);
      try {
        await writeLobbyFields(sessionId, {
          wkLobbyPackId: pack.id,
          wkLobbyPackName: pack.name,
          wkLobbyPackCoverURL: pack.coverImageURL,
        });
      } catch (e) {
        console.error("[WordonkulousPackLobbySelector] save pack", e);
      }
    },
    [sessionId],
  );

  const onLengthChange = useCallback(
    async (preset: GameLengthPreset) => {
      setLengthKey(preset.key);
      try {
        await writeLobbyFields(sessionId, { wkLobbyRounds: preset.rounds });
      } catch (e) {
        console.error("[WordonkulousPackLobbySelector] save rounds", e);
      }
    },
    [sessionId],
  );

  return (
    <>
      <div className="mt-4 w-full rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
        <p className="mb-2 text-center text-xs font-bold uppercase tracking-wider text-amber-400/90">
          Definition pack
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
              <p className="text-sm text-white/70">{selected.definitions.length} definitions</p>
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
          presets={WK_LENGTH_PRESETS}
          selectedKey={lengthKey}
          onChange={onLengthChange}
        />
      </div>

      {pickerOpen && (
        <WordonkulousPackPicker
          onSelect={onPickFromModal}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}
