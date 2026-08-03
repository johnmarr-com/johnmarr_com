"use client";

import { useState, useEffect, useMemo } from "react";
import {
  listBullshiitakePacks,
  countItemsForPack,
  type BullshiitakePack,
} from "@/lib/bullshiitake-packs";
import { JMAssetPicker, type JMAssetPickerItem } from "@/JMKit";
import { useGameColors, toPickerColors } from "@/app/games/_gamecore";

type PackItem = BullshiitakePack & JMAssetPickerItem & { itemCount: number };

interface BullshiitakePackPickerProps {
  onSelect: (pack: PackItem) => void;
  defaultPackId?: string | null;
}

/**
 * In-game story-pack picker (host, setup phase). Mirrors BlarfPackPicker:
 * JMAssetPicker shell, CMS-driven modal colors. No visibility tiers yet —
 * one tab with every pack that has at least one story.
 */
export default function BullshiitakePackPicker({
  onSelect,
  defaultPackId,
}: BullshiitakePackPickerProps) {
  const gc = useGameColors();
  // Warm dark + the game's orange; every role is CMS-overridable.
  const modalColors = toPickerColors({
    background: gc.modalBg || "#241408",
    accent: gc.modalAccent || gc.primary || "#F97316",
    tab: gc.modalTab || "#C2410C",
    border: gc.modalBorder || undefined,
  });

  const [packs, setPacks] = useState<PackItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const all = await listBullshiitakePacks();
        const withCounts = await Promise.all(
          all.map(async (pack) => {
            const itemCount = await countItemsForPack(pack.id);
            const item: PackItem = {
              ...pack,
              itemCount,
              subtitle: `${itemCount} stor${itemCount === 1 ? "y" : "ies"}`,
              ...(pack.iconURL ? { coverImageURL: pack.iconURL } : {}),
            };
            return item;
          }),
        );
        if (!cancelled) setPacks(withCounts.filter((p) => p.itemCount > 0));
      } catch (e) {
        console.error("[BullshiitakePackPicker]", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tabs = useMemo(
    () => [
      {
        key: "packs",
        label: "Packs",
        items: packs,
        emptyMessage: "No story packs yet.",
      },
    ],
    [packs],
  );

  return (
    <JMAssetPicker<PackItem>
      title="Choose a Pack"
      tabs={tabs}
      defaultSelectedId={defaultPackId}
      onSelect={onSelect}
      loading={loading}
      actionLabel="Play"
      colors={modalColors}
    />
  );
}
