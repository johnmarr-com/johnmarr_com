"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import {
  getOfficialBlarfPacks,
  getMyBlarfPacks,
  getSharedBlarfPacks,
  deleteBlarfPack,
  type BlarfPack,
} from "@/lib/blarf-packs";
import { VOICE_STYLE_LABELS } from "../blarfTypes";
import type { VoiceStyle } from "../blarfTypes";

type SubTab = "official" | "my" | "shared";
type SortKey = "date" | "name" | "rounds";

interface BlarfPackBrowserProps {
  onEdit?: ((pack: BlarfPack) => void) | undefined;
}

export default function BlarfPackBrowser({ onEdit }: BlarfPackBrowserProps) {
  const { user, userTier, isAdmin } = useAuth();
  const canCreate = isAdmin || userTier === "pro";

  const [subTab, setSubTab] = useState<SubTab>("official");
  const [sortKey, setSortKey] = useState<SortKey>("date");

  const [officialList, setOfficialList] = useState<BlarfPack[]>([]);
  const [myList, setMyList] = useState<BlarfPack[]>([]);
  const [sharedList, setSharedList] = useState<BlarfPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [off, shared] = await Promise.all([
        getOfficialBlarfPacks(),
        getSharedBlarfPacks(),
      ]);
      setOfficialList(off);
      setSharedList(shared);
      if (user) {
        const my = await getMyBlarfPacks(user.uid);
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
      case "rounds":
        list.sort((a, b) => b.rounds.length - a.rounds.length);
        break;
      case "date":
      default:
        break;
    }
    return list;
  }, [currentList, sortKey]);

  const handleDelete = useCallback(
    async (packId: string) => {
      if (!confirm("Delete this pack and all its rounds?")) return;
      await deleteBlarfPack(packId);
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
        {(["date", "name", "rounds"] as SortKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setSortKey(key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              sortKey === key
                ? "bg-white/10 text-white"
                : "text-white/30 active:bg-white/10 active:text-white/50"
            }`}
          >
            {key === "rounds" ? "Rounds" : key.charAt(0).toUpperCase() + key.slice(1)}
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
          {sortedList.map((pack) => {
            const isExpanded = expandedId === pack.id;
            return (
              <div key={pack.id} className="group relative">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : pack.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition active:scale-[0.99] ${
                    isExpanded
                      ? "border-[#F7D047]/40 bg-[#F7D047]/10"
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
                      {pack.rounds.length} round{pack.rounds.length !== 1 ? "s" : ""}
                      {" \u00b7 "}
                      Letters: {pack.rounds.map((r) => r.letter).join(", ")}
                      {pack.creatorGamertag && ` \u00b7 ${pack.creatorGamertag}`}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-white/40" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-white/40" />
                  )}
                </button>

                {/* Edit / Delete */}
                {subTab === "my" && (
                  <div className="absolute right-2 top-2 flex gap-1">
                    {onEdit && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onEdit(pack); }}
                        className="rounded-lg bg-[#F7D047]/15 p-2 text-[#F7D047] transition active:bg-[#F7D047]/25"
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

                {/* Expanded rounds preview */}
                {isExpanded && pack.rounds.length > 0 && (
                  <div className="mt-1.5 rounded-xl border border-white/5 bg-black/20 px-4 py-3">
                    <p className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-white/30">
                      Rounds preview
                    </p>
                    <div className="flex flex-col gap-3">
                      {pack.rounds.map((round, i) => (
                        <div key={i} className="rounded-lg border border-white/5 bg-white/3 px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-black" style={{ color: "#F7D047" }}>
                              {round.letter}
                            </span>
                            <span className="text-xs text-white/40">
                              {round.words.length} words
                            </span>
                            {round.voiceStyle && round.voiceStyle !== "normal" && (
                              <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                                {VOICE_STYLE_LABELS[round.voiceStyle as VoiceStyle] ?? round.voiceStyle}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-white/40">
                            {round.words.slice(0, 5).join(", ")}
                            {round.words.length > 5 && `, +${round.words.length - 5} more`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
