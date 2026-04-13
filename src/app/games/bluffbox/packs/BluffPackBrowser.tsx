"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2, ArrowUpDown, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import {
  getOfficialPacks,
  getMyPacks,
  getSharedPacks,
  deletePack,
  type BluffBoxPack,
} from "@/lib/bluffbox-packs";
import { BluffPackCover } from "@/JMKit";
import BluffPackDetailView from "./BluffPackDetailView";

type SubTab = "official" | "my" | "shared";
type SortKey = "date" | "name" | "cards";

interface BluffPackBrowserProps {
  onEdit?: ((pack: BluffBoxPack) => void) | undefined;
}

export default function BluffPackBrowser({ onEdit }: BluffPackBrowserProps) {
  const { user, userTier, isAdmin } = useAuth();
  const canCreate = isAdmin || userTier === "pro";

  const [subTab, setSubTab] = useState<SubTab>("official");
  const [sortKey, setSortKey] = useState<SortKey>("date");

  const [officialList, setOfficialList] = useState<BluffBoxPack[]>([]);
  const [myList, setMyList] = useState<BluffBoxPack[]>([]);
  const [sharedList, setSharedList] = useState<BluffBoxPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BluffBoxPack | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [off, shared] = await Promise.all([
        getOfficialPacks(),
        getSharedPacks(),
      ]);
      setOfficialList(off);
      setSharedList(shared);

      if (user) {
        const my = await getMyPacks(user.uid);
        setMyList(my);
      }
    } catch (err) {
      console.error("Failed to load packs:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const currentList = subTab === "official" ? officialList : subTab === "my" ? myList : sharedList;

  const sortedList = useMemo(() => {
    const list = [...currentList];
    switch (sortKey) {
      case "name":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "cards":
        list.sort((a, b) => b.cards.length - a.cards.length);
        break;
      case "date":
      default:
        break;
    }
    return list;
  }, [currentList, sortKey]);

  const handleDelete = useCallback(
    async (packId: string) => {
      if (!confirm("Delete this pack and all its cards?")) return;
      await deletePack(packId);
      loadAll();
    },
    [loadAll],
  );

  const SUB_TABS: { key: SubTab; label: string; count?: number; visible: boolean }[] = [
    { key: "official", label: "Official Packs", visible: true },
    { key: "my", label: "My Packs", count: myList.length, visible: canCreate },
    { key: "shared", label: "Shared Packs", count: sharedList.length, visible: true },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-white/5 p-1">
        {SUB_TABS.filter((t) => t.visible).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              subTab === tab.key ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
            }`}
          >
            {tab.label}
            {tab.count != null && (
              <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <ArrowUpDown className="h-3 w-3 text-white/30" />
        {(["date", "name", "cards"] as SortKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setSortKey(key)}
            className={`rounded-md px-2 py-1 text-xs transition-colors ${
              sortKey === key ? "bg-white/10 text-white" : "text-white/30 hover:text-white/50"
            }`}
          >
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-white/30" />
        </div>
      ) : sortedList.length === 0 ? (
        <p className="py-12 text-center text-sm text-white/30">
          {subTab === "my" ? "You haven't created any packs yet." : "No packs found."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {sortedList.map((pack) => (
            <div key={pack.id} className="group relative max-w-[400px]">
              <button
                onClick={() => setSelected(pack)}
                className="w-full transition-transform hover:scale-[1.02] active:scale-95"
              >
                <BluffPackCover coverImageURL={pack.coverImageURL} name={pack.name} />
                <p className="mt-1 text-center text-[10px] text-white/30">
                  {pack.cards.length} card{pack.cards.length !== 1 ? "s" : ""}
                </p>
              </button>
              {subTab === "my" && (
                <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  {onEdit && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onEdit(pack); }}
                      className="rounded-md bg-black/60 p-1.5 text-white/60 backdrop-blur transition-colors hover:text-white"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(pack.id); }}
                    className="rounded-md bg-black/60 p-1.5 text-red-400/60 backdrop-blur transition-colors hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selected && (
        <BluffPackDetailView
          pack={selected}
          onClose={() => setSelected(null)}
          onEdit={subTab === "my" && onEdit ? () => { setSelected(null); onEdit(selected); } : undefined}
          onCardRemoved={(imageURL) => {
            loadAll();
            setSelected((prev) =>
              prev ? { ...prev, cards: prev.cards.filter((c) => c !== imageURL) } : null,
            );
          }}
        />
      )}
    </div>
  );
}
