"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { getOfficialBlarfPacks, getMyBlarfPacks, getSharedBlarfPacks, type BlarfPack } from "@/lib/blarf-packs";
import { JMAssetPicker, type JMAssetPickerItem } from "@/JMKit";
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
      colors={{
        background: "#1c588c",
        title: "#F7D047",
        activeTab: "#C93C3C",
        accent: "#F7D047",
        buttonText: "#000000",
      }}
      lengthPresets={lengthPresets}
      selectedLengthKey={selectedLengthKey}
      onLengthChange={onLengthChange}
    />
  );
}
