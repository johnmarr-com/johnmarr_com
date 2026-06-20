"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { getOfficialPacks, getMyPacks, getSharedPacks, type WordonkulousPack } from "@/lib/wordonkulous-packs";
import { JMAssetPicker, type JMAssetPickerItem } from "@/JMKit";
import { useGameColors, toPickerColors } from "@/app/games/_gamecore";
import type { GameLengthPreset } from "@/app/games/_gamecore/gameLengthPresets";

type PackItem = WordonkulousPack & JMAssetPickerItem;

function toPickerItem(pack: WordonkulousPack): PackItem {
  return { ...pack, subtitle: `${pack.definitions.length} definitions` };
}

interface WordonkulousPackPickerProps {
  onSelect: (pack: WordonkulousPack) => void;
  onClose?: () => void;
  lengthPresets?: GameLengthPreset[];
  selectedLengthKey?: string;
  onLengthChange?: (preset: GameLengthPreset) => void;
  defaultPackId?: string | null;
}

export default function WordonkulousPackPicker({
  onSelect,
  onClose,
  lengthPresets,
  selectedLengthKey,
  onLengthChange,
  defaultPackId,
}: WordonkulousPackPickerProps) {
  const { user } = useAuth();
  const gc = useGameColors();
  // Hot-pink background is pulled from the splash; CMS can override any role.
  const modalColors = toPickerColors({
    background: gc.modalBg || "#ff1493",
    accent: gc.modalAccent || "#8eff0e",
    tab: gc.modalTab || "#0272de",
    border: gc.modalBorder || "#2563eb",
  });
  const [officialPacks, setOfficialPacks] = useState<PackItem[]>([]);
  const [sharedPacks, setSharedPacks] = useState<PackItem[]>([]);
  const [myPacks, setMyPacks] = useState<PackItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [official, shared, mine] = await Promise.all([
          getOfficialPacks(),
          getSharedPacks(),
          user ? getMyPacks(user.uid) : Promise.resolve([]),
        ]);
        if (!cancelled) {
          setOfficialPacks(official.filter((p) => p.definitions.length > 0).map(toPickerItem));
          setSharedPacks(shared.filter((p) => p.definitions.length > 0).map(toPickerItem));
          setMyPacks(mine.filter((p) => p.definitions.length > 0).map(toPickerItem));
        }
      } catch (e) {
        console.error("[WordonkulousPackPicker]", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const tabs = useMemo(() => [
    { key: "official", label: "Official", items: officialPacks },
    { key: "mine", label: "My Packs", items: myPacks, emptyMessage: "You haven\u2019t created any packs yet." },
    { key: "shared", label: "Shared", items: sharedPacks },
  ], [officialPacks, sharedPacks, myPacks]);

  return (
    <JMAssetPicker<PackItem>
      title="Choose a Pack"
      tabs={tabs}
      defaultSelectedId={defaultPackId}
      onSelect={onSelect}
      onClose={onClose}
      loading={loading}
      actionLabel="Play"
      colors={modalColors}
      lengthPresets={lengthPresets}
      selectedLengthKey={selectedLengthKey}
      onLengthChange={onLengthChange}
    />
  );
}
