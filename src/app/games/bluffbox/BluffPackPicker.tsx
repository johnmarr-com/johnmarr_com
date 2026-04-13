"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/lib/AuthProvider";
import {
  getOfficialPacks,
  getMyPacks,
  getSharedPacks,
  type BluffBoxPack,
} from "@/lib/bluffbox-packs";
import {
  BluffPackCover,
  JMSelectAsset,
  JM_SELECT_ASSET_DETAIL_Z,
} from "@/JMKit";
import BluffPackDetailView from "./packs/BluffPackDetailView";

type SubTab = "official" | "my" | "shared";

interface BluffPackPickerProps {
  onSelect: (pack: BluffBoxPack) => void;
  onClose: () => void;
}

export default function BluffPackPicker({ onSelect, onClose }: BluffPackPickerProps) {
  const { user } = useAuth();

  const [subTab, setSubTab] = useState<SubTab>("official");
  const [officialList, setOfficialList] = useState<BluffBoxPack[]>([]);
  const [myList, setMyList] = useState<BluffBoxPack[]>([]);
  const [sharedList, setSharedList] = useState<BluffBoxPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailPack, setDetailPack] = useState<BluffBoxPack | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [off, shared] = await Promise.all([getOfficialPacks(), getSharedPacks()]);
        if (cancelled) return;
        setOfficialList(off);
        setSharedList(shared);
        if (user) {
          const my = await getMyPacks(user.uid);
          if (!cancelled) setMyList(my);
        }
      } catch (err) {
        console.error("Failed to load packs:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const currentList = useMemo(() => {
    const raw = subTab === "official" ? officialList : subTab === "my" ? myList : sharedList;
    return raw.filter((p) => p.cards.length > 0);
  }, [subTab, officialList, myList, sharedList]);

  const handleSelect = useCallback(
    (pack: BluffBoxPack) => {
      onSelect(pack);
    },
    [onSelect],
  );

  const SUB_TABS: {
    id: SubTab;
    label: string;
    visible: boolean;
  }[] = useMemo(
    () => [
      { id: "official", label: "Official", visible: true },
      { id: "my", label: "My packs", visible: true },
      { id: "shared", label: "Shared", visible: true },
    ],
    [],
  );

  return (
    <>
      <JMSelectAsset<BluffBoxPack>
        open
        suspendInteractions={detailPack != null}
        onClose={onClose}
        title="Choose a pack"
        subtitle="Pick the pack for this game"
        tabs={SUB_TABS}
        activeTabId={subTab}
        onTabChange={(id) => setSubTab(id as SubTab)}
        loading={loading}
        emptyMessage="No packs with cards available."
        items={currentList}
        itemKey={(p) => p.id}
        onItemPress={(p) => setDetailPack(p)}
        renderItem={(pack) => (
          <div className="flex items-center gap-4">
            <BluffPackCover coverImageURL={pack.coverImageURL} name={pack.name} size={72} />
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-white sm:text-xl">{pack.name}</p>
              <p className="mt-1 text-base text-white/50">
                {pack.cards.length} cards · {pack.creatorGamertag}
              </p>
            </div>
          </div>
        )}
      />

      {detailPack != null &&
        typeof document !== "undefined" &&
        createPortal(
          <BluffPackDetailView
            pack={detailPack}
            readOnlyCards
            overlayClassName={JM_SELECT_ASSET_DETAIL_Z}
            onClose={() => setDetailPack(null)}
            onSelect={handleSelect}
          />,
          document.body,
        )}
    </>
  );
}
