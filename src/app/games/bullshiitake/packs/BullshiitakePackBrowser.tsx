"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2, ArrowUpDown, Pencil, Trash2, Package } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import {
  listBullshiitakePacks,
  countItemsForPack,
  deleteBullshiitakePack,
  type BullshiitakePack,
} from "@/lib/bullshiitake-packs";
import { JMCard } from "@/JMKit";
import BullshiitakePackDetailView from "./BullshiitakePackDetailView";

type SortKey = "date" | "name" | "items";

interface BullshiitakePackBrowserProps {
  onEdit?: ((pack: BullshiitakePack) => void) | undefined;
}

/**
 * All packs in one list (no visibility tiers — any signed-in user can read
 * every pack). Item counts come from a server-side aggregate since items live
 * in the top-level `bullshiitake` collection, not on the pack doc.
 */
export default function BullshiitakePackBrowser({ onEdit }: BullshiitakePackBrowserProps) {
  const { user, isAdmin } = useAuth();

  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [packs, setPacks] = useState<BullshiitakePack[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BullshiitakePack | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listBullshiitakePacks();
      setPacks(list);
      const entries = await Promise.all(
        list.map(async (p) => [p.id, await countItemsForPack(p.id)] as const),
      );
      setCounts(Object.fromEntries(entries));
    } catch (err) {
      console.error("Failed to load packs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const sortedList = useMemo(() => {
    const list = [...packs];
    switch (sortKey) {
      case "name":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "items":
        list.sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0));
        break;
      case "date":
      default:
        break;
    }
    return list;
  }, [packs, counts, sortKey]);

  const handleDelete = useCallback(
    async (packId: string) => {
      if (!confirm("Delete this pack and all its stories?")) return;
      await deleteBullshiitakePack(packId);
      loadAll();
    },
    [loadAll],
  );

  const canManage = useCallback(
    (pack: BullshiitakePack) => isAdmin || pack.creatorId === user?.uid,
    [isAdmin, user?.uid],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <ArrowUpDown className="h-3 w-3 text-white/30" />
        {(["date", "name", "items"] as SortKey[]).map((key) => (
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
        <p className="py-12 text-center text-sm text-white/30">No packs found.</p>
      ) : (
        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
        >
          {sortedList.map((pack) => {
            const count = counts[pack.id] ?? 0;
            return (
              <div key={pack.id} className="group relative max-w-60">
                <button
                  onClick={() => setSelected(pack)}
                  className="w-full transition-transform hover:scale-[1.02] active:scale-95"
                >
                  <JMCard className="aspect-square bg-neutral-800">
                    {pack.iconURL ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- Storage URL */
                      <img src={pack.iconURL} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="h-10 w-10 text-white/15" />
                      </div>
                    )}
                  </JMCard>
                  <p className="mt-1.5 truncate text-center text-sm font-bold text-white">
                    {pack.name}
                  </p>
                  <p className="text-center text-[10px] text-white/30">
                    {count} stor{count !== 1 ? "ies" : "y"}
                  </p>
                </button>
                {canManage(pack) && (
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
            );
          })}
        </div>
      )}

      {selected && (
        <BullshiitakePackDetailView
          pack={selected}
          onClose={() => {
            setSelected(null);
            loadAll(); // items may have been added/removed inside the detail view
          }}
          onEdit={canManage(selected) && onEdit ? () => { setSelected(null); onEdit(selected); } : undefined}
        />
      )}
    </div>
  );
}
