"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/AuthProvider";
import { getOfficialBombs, getMyBombs, getSharedBombs } from "@/lib/fyve-bombs";
import type { FyveBombEntity } from "../fyveTypes";
import BombCreator from "./BombCreator";

type BombTab = "official" | "my" | "shared";

interface BombPickerProps {
  /** Currently selected bomb ID */
  selectedBombId: string | null;
  /** Called when a bomb is selected */
  onSelect: (bomb: FyveBombEntity) => void;
}

/**
 * Bomb picker with Official/My/Shared tabs + inline creation.
 */
export default function BombPicker({ selectedBombId, onSelect }: BombPickerProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<BombTab>("official");
  const [officialList, setOfficialList] = useState<FyveBombEntity[]>([]);
  const [myList, setMyList] = useState<FyveBombEntity[]>([]);
  const [sharedList, setSharedList] = useState<FyveBombEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreator, setShowCreator] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [off, shared] = await Promise.all([getOfficialBombs(), getSharedBombs()]);
      setOfficialList(off);
      setSharedList(shared);
      if (user) {
        const my = await getMyBombs(user.uid);
        setMyList(my);
      }
    } catch (err) {
      console.error("Failed to load bombs:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const currentList = tab === "official" ? officialList : tab === "my" ? myList : sharedList;

  const handleCreated = useCallback(
    (bomb: FyveBombEntity) => {
      setMyList((prev) => [bomb, ...prev]);
      setShowCreator(false);
      onSelect(bomb);
      setTab("my");
    },
    [onSelect],
  );

  if (showCreator) {
    return (
      <BombCreator
        onCreated={handleCreated}
        onCancel={() => setShowCreator(false)}
      />
    );
  }

  return (
    <div>
      {/* Tabs + Create button */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-1">
          {(["official", "my", "shared"] as BombTab[]).map((t) => (
            <button
              key={t}
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition ${
                tab === t
                  ? "bg-red-500 text-white"
                  : "bg-white/10 text-white/60 hover:bg-white/20"
              }`}
              onClick={() => setTab(t)}
            >
              {t === "official" ? "Official" : t === "my" ? "Mine" : "Shared"}
            </button>
          ))}
        </div>
        <button
          className="rounded-lg bg-red-600/20 px-3 py-1 text-xs font-semibold text-red-400 transition hover:bg-red-600/30"
          onClick={() => setShowCreator(true)}
        >
          + New Bomb
        </button>
      </div>

      {/* List */}
      {loading ? (
        <p className="py-4 text-center text-xs text-white/40 animate-pulse">Loading bombs...</p>
      ) : currentList.length === 0 ? (
        <p className="py-4 text-center text-xs text-white/40">
          No bombs yet.{" "}
          <button
            className="text-red-400 hover:underline"
            onClick={() => setShowCreator(true)}
          >
            Create one
          </button>
        </p>
      ) : (
        <div className="max-h-48 space-y-1.5 overflow-y-auto">
          {currentList.map((bomb) => (
            <button
              key={bomb.id}
              className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition ${
                selectedBombId === bomb.id
                  ? "border-red-500/50 bg-red-950/30"
                  : "border-white/10 bg-black/20 hover:border-white/20"
              }`}
              onClick={() => onSelect(bomb)}
            >
              {/* Thumbnail */}
              { }
              {bomb.imageUrl ? (
                <Image
                  src={bomb.imageUrl}
                  alt={bomb.name}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-lg object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-900/30 text-lg">
                  💣
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">{bomb.name}</p>
              </div>
              {selectedBombId === bomb.id && (
                <span className="shrink-0 text-xs font-bold text-red-400">Selected</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
