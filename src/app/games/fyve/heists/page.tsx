"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { GameSectionHeader } from "@/app/games/_gamecore";
import { JMCloseCircleButton } from "@/JMKit/JMCloseCircleButton";
import HeistEditor from "./HeistEditor";
import HeistBrowser from "./HeistBrowser";
import type { FyveHeist } from "../fyveTypes";

type Tab = "browse" | "create";

export default function HeistBuilderPage() {
  const { isAdmin, userTier } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("browse");
  const [editingHeist, setEditingHeist] = useState<FyveHeist | null>(null);

  const canCreate = isAdmin || userTier === "pro";

  if (!canCreate) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black">
        <p className="text-white/60">Pro or Admin access required</p>
      </div>
    );
  }

  const handleEditHeist = (heist: FyveHeist) => {
    setEditingHeist(heist);
    setTab("create");
  };

  const handleCreateTab = () => {
    // Tapping the Create tab while already on it clears any editing heist
    if (tab === "create" && editingHeist) {
      setEditingHeist(null);
    }
    setTab("create");
  };

  return (
    <div className="relative min-h-dvh bg-black px-4 py-8">
      {/* Close button — top right */}
      <div className="absolute right-4 top-4 z-10">
        <JMCloseCircleButton onClick={() => router.back()} />
      </div>

      <div className="mx-auto max-w-2xl">
        <GameSectionHeader
          eyebrow="FYVE"
          title="Heist Builder"
          titleColorClass="text-[#E84C1E]"
          eyebrowColorClass="text-[#E84C1E]/70"
        />

        {/* Top tabs — Browse | Create/Editing */}
        <div className="mt-5 flex rounded-xl border border-white/10 bg-white/5 p-1">
          <button
            className={`flex-1 rounded-lg py-2.5 text-sm font-bold tracking-wide transition ${
              tab === "browse"
                ? "bg-[#E84C1E] text-white shadow-lg"
                : "text-white/50 active:bg-white/10"
            }`}
            onClick={() => setTab("browse")}
          >
            Browse
          </button>
          <button
            className={`flex-1 rounded-lg py-2.5 text-sm font-bold tracking-wide transition ${
              tab === "create"
                ? "bg-[#E84C1E] text-white shadow-lg"
                : "text-white/50 active:bg-white/10"
            }`}
            onClick={handleCreateTab}
          >
            {editingHeist ? "Editing" : "Create"}
          </button>
        </div>

        <div className="mt-5">
          {tab === "create" && (
            <HeistEditor key={editingHeist?.id ?? "new"} {...(editingHeist ? { editHeist: editingHeist } : {})} />
          )}
          {tab === "browse" && <HeistBrowser onEditHeist={handleEditHeist} />}
        </div>
      </div>
    </div>
  );
}
