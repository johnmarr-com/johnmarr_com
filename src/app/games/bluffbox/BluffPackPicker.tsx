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
}

export default function BluffPackPicker({ onSelect, onClose, defaultPackId }: BluffPackPickerProps) {
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
      colors={{
        background: "#1c1410",
        title: "#fbbf24",
        activeTab: "#b45309",
        accent: "#fbbf24",
        buttonText: "#000000",
        border: "#f59e0b",
      }}
    />
  );
}
