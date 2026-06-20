"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { getOfficialBlarfPacks, getMyBlarfPacks, getSharedBlarfPacks, type BlarfPack } from "@/lib/blarf-packs";
import { JMAssetPicker, type JMAssetPickerItem } from "@/JMKit";
import { useGameColors, toPickerColors } from "@/app/games/_gamecore";
import type { GameLengthPreset } from "@/app/games/_gamecore/gameLengthPresets";

type PackItem = BlarfPack & JMAssetPickerItem;

function toPickerItem(pack: BlarfPack): PackItem {
  return { ...pack, subtitle: `${pack.rounds.length} rounds` };
}

interface BlarfPackPickerProps {
  onSelect: (pack: BlarfPack) => void;
  onClose?: () => void;
  lengthPresets?: GameLengthPreset[];
  selectedLengthKey?: string;
  onLengthChange?: (preset: GameLengthPreset) => void;
  defaultPackId?: string | null;
}

export default function BlarfPackPicker({
  onSelect,
  onClose,
  lengthPresets,
  selectedLengthKey,
  onLengthChange,
  defaultPackId,
}: BlarfPackPickerProps) {
  const { user } = useAuth();
  const gc = useGameColors();
  // Reproduces Blarf's existing look (blue / gold / red, no thick border);
  // any role is CMS-overridable.
  const modalColors = toPickerColors({
    background: gc.modalBg || "#1c588c",
    accent: gc.modalAccent || "#F7D047",
    tab: gc.modalTab || "#C93C3C",
    border: gc.modalBorder || undefined,
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
          getOfficialBlarfPacks(),
          getSharedBlarfPacks(),
          user ? getMyBlarfPacks(user.uid) : Promise.resolve([]),
        ]);
        if (!cancelled) {
          setOfficialPacks(official.filter((p) => p.rounds.length > 0).map(toPickerItem));
          setSharedPacks(shared.filter((p) => p.rounds.length > 0).map(toPickerItem));
          setMyPacks(mine.filter((p) => p.rounds.length > 0).map(toPickerItem));
        }
      } catch (e) {
        console.error("[BlarfPackPicker]", e);
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
