"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/AuthProvider";
import {
  getOfficialPacks,
  getMyPacks,
  getSharedPacks,
  type BluffBoxPack,
} from "@/lib/bluffbox-packs";
import { JMAssetPicker, type JMAssetPickerItem } from "@/JMKit";
import { useGameColors, toPickerColors } from "@/app/games/_gamecore";
import type { GameLengthPreset } from "@/app/games/_gamecore/gameLengthPresets";

type PackItem = BluffBoxPack & JMAssetPickerItem;

function toPickerItem(pack: BluffBoxPack): PackItem {
  return {
    ...pack,
    subtitle: `${pack.cards.length} cards · ${pack.creatorGamertag}`,
    ...(pack.coverImageURL ? { coverImageURL: pack.coverImageURL } : {}),
  };
}

interface BluffPackPickerProps {
  /** Fired with the chosen pack when the host taps Play. */
  onSelect: (pack: BluffBoxPack) => void;
  /** Omit to hide the close button (host must pick to proceed). */
  onClose?: (() => void) | undefined;
  defaultPackId?: string | null | undefined;
  /** Round-count presets (omit to hide the length picker). */
  lengthPresets?: GameLengthPreset[] | undefined;
  selectedLengthKey?: string | undefined;
  onLengthChange?: ((preset: GameLengthPreset) => void) | undefined;
}

export default function BluffPackPicker({
  onSelect,
  onClose,
  defaultPackId,
  lengthPresets,
  selectedLengthKey,
  onLengthChange,
}: BluffPackPickerProps) {
  const { user } = useAuth();
  const gc = useGameColors();
  // BluffBox modal follows its brand blues (secondary/tertiary) unless the CMS
  // overrides any role explicitly.
  const modalColors = toPickerColors({
    background: gc.modalBg || gc.tertiary,
    accent: gc.modalAccent || gc.secondary,
    tab: gc.modalTab || gc.tertiary,
    border: gc.modalBorder || gc.secondary,
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
          setOfficialPacks(official.filter((p) => p.cards.length > 0).map(toPickerItem));
          setSharedPacks(shared.filter((p) => p.cards.length > 0).map(toPickerItem));
          setMyPacks(mine.filter((p) => p.cards.length > 0).map(toPickerItem));
        }
      } catch (e) {
        console.error("[BluffPackPicker]", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const tabs = useMemo(
    () => [
      { key: "official", label: "Official", items: officialPacks },
      { key: "mine", label: "My Packs", items: myPacks, emptyMessage: "You haven’t created any packs yet." },
      { key: "shared", label: "Shared", items: sharedPacks },
    ],
    [officialPacks, myPacks, sharedPacks],
  );

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
