"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthProvider";
import {
  getOfficialPacks,
  getMyPacks,
  getSharedPacks,
  type BluffBoxPack,
} from "@/lib/bluffbox-packs";
import { BluffPackCover } from "@/JMKit";

interface BluffPackGridPickerProps {
  onSelect: (pack: BluffBoxPack) => void;
}

export default function BluffPackGridPicker({ onSelect }: BluffPackGridPickerProps) {
  const { user } = useAuth();
  const [packs, setPacks] = useState<BluffBoxPack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const fetches: Promise<BluffBoxPack[]>[] = [getOfficialPacks(), getSharedPacks()];
        if (user) fetches.push(getMyPacks(user.uid));
        const results = await Promise.all(fetches);
        if (cancelled) return;
        const all = results.flat().filter((p) => p.cards.length > 0);
        // Dedupe by id (official/shared/my could overlap)
        const seen = new Set<string>();
        const unique = all.filter((p) => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });
        setPacks(unique);
      } catch (err) {
        console.error("Failed to load packs:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
        <p className="text-sm text-white/50">Loading packs&hellip;</p>
      </div>
    );
  }

  if (packs.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-white/40">
        No packs available.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {packs.map((pack) => (
        <button
          key={pack.id}
          type="button"
          onClick={() => onSelect(pack)}
          className="group flex flex-col items-center gap-2 rounded-2xl p-2 transition-all hover:bg-white/5 active:scale-95"
        >
          <div className="w-full overflow-hidden rounded-xl shadow-lg shadow-black/40 transition-transform group-hover:scale-[1.03]">
            <BluffPackCover coverImageURL={pack.coverImageURL} name={pack.name} />
          </div>
          <p className="line-clamp-2 text-center text-sm font-semibold leading-tight text-white/80">
            {pack.name}
          </p>
        </button>
      ))}
    </div>
  );
}
