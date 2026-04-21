"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { GameSectionHeader } from "@/app/games/_gamecore";
import { JMCloseCircleButton } from "@/JMKit/JMCloseCircleButton";
import type { WordonkulousPack } from "@/lib/wordonkulous-packs";
import WordonkulousPackEditor from "./WordonkulousPackEditor";
import WordonkulousPackBrowser from "./WordonkulousPackBrowser";

type Tab = "browse" | "create";

export default function WordonkulousPacksPage() {
  const { user, userTier, isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const canCreate = isAdmin || userTier === "pro";

  const [tab, setTab] = useState<Tab>("browse");
  const [editingPack, setEditingPack] = useState<WordonkulousPack | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/games/wordonkulous");
    }
  }, [authLoading, user, router]);

  const handleSaved = useCallback(() => {
    setEditingPack(null);
    setTab("browse");
    setRefreshKey((k) => k + 1);
  }, []);

  const handleEdit = useCallback((pack: WordonkulousPack) => {
    setEditingPack(pack);
    setTab("create");
  }, []);

  const handleCreateTab = () => {
    if (tab === "create" && editingPack) {
      setEditingPack(null);
    }
    setTab("create");
  };

  if (authLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  if (!canCreate) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black">
        <p className="text-white/60">Pro or Admin access required</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh bg-black px-4 py-8">
      {/* Close button — top right */}
      <div className="absolute right-4 top-4 z-10">
        <JMCloseCircleButton onClick={() => router.push("/games/wordonkulous")} />
      </div>

      <div className="mx-auto max-w-2xl">
        <GameSectionHeader
          eyebrow="WORDONKULOUS"
          title="Definition Packs"
          titleColorClass="text-amber-400"
          eyebrowColorClass="text-amber-400/70"
        />

        {/* Top tabs — Browse | Create/Editing */}
        <div className="mt-5 flex rounded-xl border border-white/10 bg-white/5 p-1">
          <button
            className={`flex-1 rounded-lg py-2.5 text-sm font-bold tracking-wide transition ${
              tab === "browse"
                ? "bg-amber-500 text-black shadow-lg"
                : "text-white/50 active:bg-white/10"
            }`}
            onClick={() => setTab("browse")}
          >
            Browse
          </button>
          <button
            className={`flex-1 rounded-lg py-2.5 text-sm font-bold tracking-wide transition ${
              tab === "create"
                ? "bg-amber-500 text-black shadow-lg"
                : "text-white/50 active:bg-white/10"
            }`}
            onClick={handleCreateTab}
          >
            {editingPack ? "Editing" : "Create"}
          </button>
        </div>

        <div className="mt-5">
          {tab === "create" && (
            <WordonkulousPackEditor
              key={editingPack?.id ?? "new"}
              existingPack={editingPack ?? undefined}
              onSaved={handleSaved}
            />
          )}
          {tab === "browse" && (
            <WordonkulousPackBrowser
              key={refreshKey}
              onEdit={canCreate ? handleEdit : undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
}
