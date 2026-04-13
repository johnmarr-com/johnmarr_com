"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { X, Loader2, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import {
  getOfficialPacks,
  getMyPacks,
  getSharedPacks,
  type BluffBoxPack,
} from "@/lib/bluffbox-packs";
import { BluffPackCover } from "@/JMKit";
import BluffPackDetailView from "./packs/BluffPackDetailView";

type SubTab = "official" | "my" | "shared";

interface BluffPackPickerProps {
  onSelect: (pack: BluffBoxPack) => void;
  onClose: () => void;
}

export default function BluffPackPicker({ onSelect, onClose }: BluffPackPickerProps) {
  const { user, userTier, isAdmin } = useAuth();
  const canCreate = isAdmin || userTier === "pro";

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
    return () => { cancelled = true; };
  }, [user]);

  const currentList = useMemo(() => {
    const raw = subTab === "official" ? officialList : subTab === "my" ? myList : sharedList;
    return raw.filter((p) => p.cards.length > 0);
  }, [subTab, officialList, myList, sharedList]);

  const handleSelect = useCallback((pack: BluffBoxPack) => {
    onSelect(pack);
  }, [onSelect]);

  const SUB_TABS: { key: SubTab; label: string; visible: boolean }[] = [
    { key: "official", label: "Official", visible: true },
    { key: "my", label: "My Packs", visible: canCreate },
    { key: "shared", label: "Shared", visible: true },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-white/20 bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-white">Select a Bluff Pack</h3>
            <p className="text-sm text-white/50">Choose the card pack for this game</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex shrink-0 gap-1 border-b border-white/10 px-4 py-2">
          {SUB_TABS.filter((t) => t.visible).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSubTab(tab.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-bold transition-colors ${
                subTab === tab.key ? "bg-white/10 text-white" : "text-white/50 hover:text-white/70"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: "none" }}>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-white/30" />
            </div>
          ) : currentList.length === 0 ? (
            <p className="py-12 text-center text-sm text-white/50">
              No packs with cards available.
            </p>
          ) : (
            <div className="space-y-2">
              {currentList.map((pack) => (
                <button
                  key={pack.id}
                  onClick={() => setDetailPack(pack)}
                  className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-left transition-colors hover:bg-white/10"
                >
                  <BluffPackCover coverImageURL={pack.coverImageURL} name={pack.name} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">{pack.name}</p>
                    <p className="text-xs text-white/50">
                      {pack.cards.length} cards &middot; {pack.creatorGamertag}
                    </p>
                  </div>
                  <ChevronRight className="ml-2 h-4 w-4 shrink-0 text-white/40" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {detailPack && (
        <BluffPackDetailView
          pack={detailPack}
          onClose={() => setDetailPack(null)}
          onSelect={handleSelect}
        />
      )}
    </div>
  );
}
