"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/AuthProvider";
import {
  getOfficialHeists,
  getMyHeists,
  getSharedHeists,
} from "@/lib/sevyn-heists";
import type { SevynHeist } from "./sevynTypes";
import { GameSectionHeader, GamePrimaryButton, GameStatusMessage } from "@/app/games/_gamecore";

type SubTab = "official" | "my" | "shared";

interface HeistPickerProps {
  isHost: boolean;
  onSelect: (heist: SevynHeist) => void;
}

export default function HeistPicker({ isHost, onSelect }: HeistPickerProps) {
  const { user } = useAuth();
  const [subTab, setSubTab] = useState<SubTab>("official");
  const [officialList, setOfficialList] = useState<SevynHeist[]>([]);
  const [myList, setMyList] = useState<SevynHeist[]>([]);
  const [sharedList, setSharedList] = useState<SevynHeist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHeist, setSelectedHeist] = useState<SevynHeist | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [off, shared] = await Promise.all([getOfficialHeists(), getSharedHeists()]);
        if (cancelled) return;
        setOfficialList(off);
        setSharedList(shared);
        if (user) {
          const my = await getMyHeists(user.uid);
          if (!cancelled) setMyList(my);
        }
      } catch (err) {
        console.error("Failed to load heists:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const currentList = useMemo(() => {
    return subTab === "official" ? officialList : subTab === "my" ? myList : sharedList;
  }, [subTab, officialList, myList, sharedList]);

  if (!isHost) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-4">
        <GameStatusMessage message="Host is selecting a Heist..." type="loading" />
      </div>
    );
  }

  // Detail view for selected heist
  if (selectedHeist) {
    return (
      <div className="flex min-h-dvh flex-col items-center px-4 py-20">
        <div className="w-full max-w-lg">
          {/* Back button */}
          <button
            className="mb-4 text-sm text-white/60 hover:text-white"
            onClick={() => setSelectedHeist(null)}
          >
            &larr; Back to Heists
          </button>

          {/* Heist detail */}
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-sm">
            {selectedHeist.backgroundImageUrl && (
              <div
                className="mb-4 h-40 w-full rounded-xl bg-cover bg-center"
                style={{ backgroundImage: `url(${selectedHeist.backgroundImageUrl})` }}
              />
            )}
            <h2 className="mb-1 text-2xl font-bold text-[#E84C1E]">{selectedHeist.title}</h2>
            <p className="mb-2 text-sm text-white/60">
              {selectedHeist.setting.location} &bull; {selectedHeist.setting.era}
            </p>
            <p className="mb-4 text-sm leading-relaxed text-white/80">
              {selectedHeist.briefing.slice(0, 200)}...
            </p>

            <div className="mb-4 text-xs text-white/60">
              <span className="text-white/40">Assets:</span> {selectedHeist.assets.length} &bull;{" "}
              <span className="text-white/40">Words:</span>{" "}
              {selectedHeist.words.tier1.length + selectedHeist.words.tier2.length + selectedHeist.words.tier3.length}
            </div>

            <GamePrimaryButton onClick={() => onSelect(selectedHeist)}>
              Select This Heist
            </GamePrimaryButton>
          </div>
        </div>
      </div>
    );
  }

  // Heist list view
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-20">
      <div className="w-full max-w-lg">
        <GameSectionHeader
          eyebrow="SEVYN"
          title="Select a Heist"
          titleColorClass="text-[#E84C1E]"
          eyebrowColorClass="text-[#E84C1E]/70"
        />

        {/* Sub-tabs */}
        <div className="mt-4 flex justify-center gap-2">
          {(["official", "my", "shared"] as SubTab[]).map((tab) => (
            <button
              key={tab}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
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

        {/* List */}
        <div className="mt-6 space-y-3">
          {loading ? (
            <GameStatusMessage message="Loading heists..." type="loading" />
          ) : currentList.length === 0 ? (
            <p className="text-center text-sm text-white/40">No heists available</p>
          ) : (
            currentList.map((heist) => (
              <button
                key={heist.id}
                className="w-full rounded-xl border border-white/10 bg-black/30 p-4 text-left backdrop-blur-sm transition hover:border-[#E84C1E]/40 hover:bg-black/50"
                onClick={() => setSelectedHeist(heist)}
              >
                <div className="flex items-center gap-3">
                  {heist.backgroundImageUrl && (
                    <div
                      className="h-14 w-14 shrink-0 rounded-lg bg-cover bg-center"
                      style={{ backgroundImage: `url(${heist.backgroundImageUrl})` }}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-bold text-white">{heist.title}</h3>
                    <p className="truncate text-xs text-white/50">
                      {heist.setting.location} &bull; {heist.setting.era}
                    </p>
                    <p className="mt-0.5 text-xs text-white/40">
                      {heist.assets.length} assets &bull; {heist.civilians.length} civilians
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
