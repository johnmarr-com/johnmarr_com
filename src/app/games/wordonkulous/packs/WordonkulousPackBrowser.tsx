"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import {
  getOfficialPacks,
  getMyPacks,
  getSharedPacks,
  deletePack,
  type WordonkulousPack,
} from "@/lib/wordonkulous-packs";

type SubTab = "official" | "my" | "shared";
type SortKey = "date" | "name" | "defs";

interface WordonkulousPackBrowserProps {
  onEdit?: ((pack: WordonkulousPack) => void) | undefined;
}

export default function WordonkulousPackBrowser({ onEdit }: WordonkulousPackBrowserProps) {
  const { user, userTier, isAdmin } = useAuth();
  const canCreate = isAdmin || userTier === "pro";

  const [subTab, setSubTab] = useState<SubTab>("official");
  const [sortKey, setSortKey] = useState<SortKey>("date");

  const [officialList, setOfficialList] = useState<WordonkulousPack[]>([]);
  const [myList, setMyList] = useState<WordonkulousPack[]>([]);
  const [sharedList, setSharedList] = useState<WordonkulousPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPack, setSelectedPack] = useState<WordonkulousPack | null>(null);

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
      case "defs":
        list.sort((a, b) => b.definitions.length - a.definitions.length);
        break;
      case "date":
      default:
        break;
    }
    return list;
  }, [currentList, sortKey]);

  const handleDelete = useCallback(
    async (packId: string) => {
      if (!confirm("Delete this pack and all its definitions?")) return;
      await deletePack(packId);
      loadAll();
    },
    [loadAll],
  );

  const SUB_TABS: { key: SubTab; label: string; count?: number; visible: boolean }[] = [
    { key: "official", label: "Official", visible: true },
    { key: "my", label: "My Packs", count: myList.length, visible: canCreate },
    { key: "shared", label: "Shared", count: sharedList.length, visible: true },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
        {SUB_TABS.filter((t) => t.visible).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-bold tracking-wide transition ${
              subTab === tab.key
                ? "bg-white/20 text-white"
                : "text-white/40 active:bg-white/10"
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

      {/* Sort controls */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">Sort</span>
        {(["date", "name", "defs"] as SortKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setSortKey(key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              sortKey === key
                ? "bg-white/10 text-white"
                : "text-white/30 active:bg-white/10 active:text-white/50"
            }`}
          >
            {key === "defs" ? "Definitions" : key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-white/30" />
        </div>
      ) : sortedList.length === 0 ? (
        <p className="py-16 text-center text-sm text-white/30">
          {subTab === "my" ? "You haven't created any packs yet." : "No packs found."}
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {sortedList.map((pack) => (
            <div key={pack.id} className="group relative">
              <button
                onClick={() => setSelectedPack(selectedPack?.id === pack.id ? null : pack)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition active:scale-[0.99] ${
                  selectedPack?.id === pack.id
                    ? "border-amber-400/40 bg-amber-400/10"
                    : "border-white/10 bg-black/30 active:bg-white/5"
                }`}
              >
                {pack.coverImageURL && (
                  <div
                    className="h-14 w-14 shrink-0 rounded-xl border border-white/10 bg-cover bg-center"
                    style={{ backgroundImage: `url(${pack.coverImageURL})` }}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold text-white">{pack.name}</p>
                  <p className="mt-0.5 text-sm text-white/50">
                    {pack.definitions.length} definition{pack.definitions.length !== 1 ? "s" : ""}
                    {pack.creatorGamertag && ` · ${pack.creatorGamertag}`}
                  </p>
                </div>
              </button>

              {/* Edit / Delete actions — positioned outside the button */}
              {subTab === "my" && (
                <div className="absolute right-2 top-2 flex gap-1">
                  {onEdit && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onEdit(pack); }}
                      className="rounded-lg bg-amber-500/15 p-2 text-amber-400 transition active:bg-amber-500/25"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(pack.id); }}
                    className="rounded-lg bg-red-500/10 p-2 text-red-400/60 transition active:bg-red-500/20 active:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Expanded definitions preview */}
              {selectedPack?.id === pack.id && pack.definitions.length > 0 && (
                <div className="mt-1.5 rounded-xl border border-white/5 bg-black/20 px-4 py-3">
                  <p className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-white/30">
                    Definitions preview
                  </p>
                  <ul className="flex max-h-56 flex-col gap-3 overflow-y-auto overscroll-contain">
                    {pack.definitions.slice(0, 20).map((def, i) => (
                      <li key={i} className="flex gap-2 text-sm leading-relaxed text-white/50">
                        <span className="shrink-0 text-white/25">&bull;</span>
                        <span>{def}</span>
                      </li>
                    ))}
                    {pack.definitions.length > 20 && (
                      <li className="text-sm italic text-white/30">
                        ...and {pack.definitions.length - 20} more
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
