"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2, ArrowUpDown, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import {
  getOfficialMissions,
  getMyMissions,
  getSharedMissions,
  deleteMission,
  type SketchinessMission,
} from "@/lib/sketchiness-missions";
import MissionDetailView from "./MissionDetailView";

type SubTab = "official" | "my" | "shared";
type SortKey = "date" | "name" | "maxPlayers";

interface MissionBrowserProps {
  /** Called when user wants to edit a mission from My Missions */
  onEdit?: ((mission: SketchinessMission) => void) | undefined;
  /** Called when a copy is created (to refresh lists) */
  onCopied?: (() => void) | undefined;
}

export default function MissionBrowser({ onEdit, onCopied }: MissionBrowserProps) {
  const { user, userTier, isAdmin } = useAuth();
  const canCreate = isAdmin || userTier === "pro";

  const [subTab, setSubTab] = useState<SubTab>("official");
  const [sortKey, setSortKey] = useState<SortKey>("date");

  const [officialList, setOfficialList] = useState<SketchinessMission[]>([]);
  const [myList, setMyList] = useState<SketchinessMission[]>([]);
  const [sharedList, setSharedList] = useState<SketchinessMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SketchinessMission | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [off, shared] = await Promise.all([
        getOfficialMissions(),
        getSharedMissions(),
      ]);
      setOfficialList(off);
      setSharedList(shared);

      if (user) {
        const my = await getMyMissions(user.uid);
        setMyList(my);
      }
    } catch (err) {
      console.error("Failed to load missions:", err);
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
        list.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "maxPlayers":
        list.sort((a, b) => b.maxPlayers - a.maxPlayers);
        break;
      case "date":
      default:
        break;
    }
    return list;
  }, [currentList, sortKey]);

  const handleDelete = useCallback(
    async (missionId: string) => {
      if (!confirm("Delete this mission?")) return;
      await deleteMission(missionId);
      loadAll();
    },
    [loadAll],
  );

  const handleCopied = useCallback(
    () => {
      setSelected(null);
      loadAll();
      onCopied?.();
    },
    [loadAll, onCopied],
  );

  const SUB_TABS: { key: SubTab; label: string; count?: number; visible: boolean }[] = [
    { key: "official", label: "Official Missions", visible: true },
    { key: "my", label: "My Missions", count: myList.length, visible: canCreate },
    { key: "shared", label: "Shared Missions", count: sharedList.length, visible: true },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Sub tabs */}
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

      {/* Sort toggle */}
      <div className="flex items-center gap-2">
        <ArrowUpDown className="h-3 w-3 text-white/30" />
        {(["date", "name", "maxPlayers"] as SortKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setSortKey(key)}
            className={`rounded-md px-2 py-1 text-xs transition-colors ${
              sortKey === key ? "bg-white/10 text-white" : "text-white/30 hover:text-white/50"
            }`}
          >
            {key === "maxPlayers" ? "Players" : key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-white/30" />
        </div>
      ) : sortedList.length === 0 ? (
        <p className="py-12 text-center text-sm text-white/30">
          {subTab === "my" ? "You haven't created any missions yet." : "No missions found."}
        </p>
      ) : (
        <div className="space-y-1">
          {sortedList.map((m) => (
            <div
              key={m.id}
              className="flex cursor-pointer items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:bg-white/10"
              onClick={() => setSelected(m)}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">{m.title}</p>
                <p className="text-xs text-white/30">
                  {m.maxPlayers} players &middot; {m.creatorGamertag}
                </p>
              </div>
              {subTab === "my" && (
                <div className="flex shrink-0 items-center gap-1 ml-2">
                  {onEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(m);
                      }}
                      className="rounded-md p-1.5 text-white/30 transition-colors hover:bg-white/10 hover:text-white/60"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(m.id);
                    }}
                    className="rounded-md p-1.5 text-red-400/40 transition-colors hover:bg-red-400/10 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Detail overlay */}
      {selected && (
        <MissionDetailView
          mission={selected}
          onClose={() => setSelected(null)}
          onCopied={handleCopied}
        />
      )}
    </div>
  );
}
