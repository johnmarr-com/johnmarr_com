"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/AuthProvider";
import {
  getOfficialHeists,
  getMyHeists,
  getSharedHeists,
  deleteHeist,
} from "@/lib/sevyn-heists";
import type { SevynHeist } from "../sevynTypes";
import { GameStatusMessage } from "@/app/games/_gamecore";

type SubTab = "official" | "my" | "shared";

interface HeistBrowserProps {
  onEditHeist?: (heist: SevynHeist) => void;
}

export default function HeistBrowser({ onEditHeist }: HeistBrowserProps = {}) {
  const { user, isAdmin } = useAuth();
  const [subTab, setSubTab] = useState<SubTab>("official");
  const [officialList, setOfficialList] = useState<SevynHeist[]>([]);
  const [myList, setMyList] = useState<SevynHeist[]>([]);
  const [sharedList, setSharedList] = useState<SevynHeist[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [off, shared] = await Promise.all([getOfficialHeists(), getSharedHeists()]);
      setOfficialList(off);
      setSharedList(shared);
      if (user) {
        const my = await getMyHeists(user.uid);
        setMyList(my);
      }
    } catch (err) {
      console.error("Failed to load heists:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const currentList = useMemo(() => {
    return subTab === "official" ? officialList : subTab === "my" ? myList : sharedList;
  }, [subTab, officialList, myList, sharedList]);

  const handleDelete = async (heist: SevynHeist) => {
    if (!confirm(`Delete "${heist.title}"?`)) return;
    await deleteHeist(heist.id);
    await load();
  };

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex justify-center gap-2">
        {(["official", "my", "shared"] as SubTab[]).map((tab) => (
          <button
            key={tab}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              subTab === tab
                ? "bg-[#E84C1E] text-white"
                : "bg-white/10 text-white/60 hover:bg-white/20"
            }`}
            onClick={() => setSubTab(tab)}
          >
            {tab === "official" ? "Official" : tab === "my" ? "My Heists" : "Shared"}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          <GameStatusMessage message="Loading..." type="loading" />
        ) : currentList.length === 0 ? (
          <p className="text-center text-sm text-white/40">No heists</p>
        ) : (
          currentList.map((heist) => (
            <div
              key={heist.id}
              className="rounded-xl border border-white/10 bg-black/30 p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white">{heist.title}</h3>
                    {heist.draft && (
                      <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-yellow-400">
                        Draft
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/50">
                    {heist.setting.location} &bull; {heist.setting.era}
                  </p>
                  <p className="mt-1 text-xs text-white/40">
                    {heist.assets.length} assets &bull;{" "}
                    {heist.words.tier1.length + heist.words.tier2.length + heist.words.tier3.length} words
                  </p>
                </div>
                <div className="flex shrink-0 gap-3">
                  {(heist.creatorId === user?.uid || isAdmin) && onEditHeist && (
                    <button
                      className="text-xs text-[#E84C1E] hover:text-[#E84C1E]/80"
                      onClick={() => onEditHeist(heist)}
                    >
                      Edit
                    </button>
                  )}
                  {(heist.creatorId === user?.uid || isAdmin) && (
                    <button
                      className="text-xs text-red-400 hover:text-red-300"
                      onClick={() => handleDelete(heist)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
