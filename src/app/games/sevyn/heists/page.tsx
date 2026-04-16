"use client";

import { useState } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { GameSectionHeader } from "@/app/games/_gamecore";
import HeistEditor from "./HeistEditor";
import HeistBrowser from "./HeistBrowser";
import type { SevynHeist } from "../sevynTypes";

type Tab = "create" | "browse";

export default function HeistBuilderPage() {
  const { isAdmin, userTier } = useAuth();
  const [tab, setTab] = useState<Tab>("browse");
  const [editingHeist, setEditingHeist] = useState<SevynHeist | null>(null);

  const canCreate = isAdmin || userTier === "pro";

  if (!canCreate) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black">
        <p className="text-white/60">Pro or Admin access required</p>
      </div>
    );
  }

  const handleEditHeist = (heist: SevynHeist) => {
    setEditingHeist(heist);
    setTab("create");
  };

  const handleNewHeist = () => {
    setEditingHeist(null);
  };

  return (
    <div className="min-h-dvh bg-black px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <GameSectionHeader
          eyebrow="SEVYN"
          title="Heist Builder"
          titleColorClass="text-[#E84C1E]"
          eyebrowColorClass="text-[#E84C1E]/70"
        />

        {/* Tabs */}
        <div className="mt-4 flex justify-center gap-2">
          <button
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              tab === "create" ? "bg-[#E84C1E] text-white" : "bg-white/10 text-white/60 hover:bg-white/20"
            }`}
            onClick={() => setTab("create")}
          >
            {editingHeist ? "Editing" : "Create"}
          </button>
          <button
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              tab === "browse" ? "bg-[#E84C1E] text-white" : "bg-white/10 text-white/60 hover:bg-white/20"
            }`}
            onClick={() => setTab("browse")}
          >
            Browse
          </button>
        </div>

        <div className="mt-6">
          {tab === "create" && (
            <>
              {editingHeist && (
                <div className="mb-4 flex items-center justify-between rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-2">
                  <p className="text-xs text-yellow-400">
                    Editing: <span className="font-bold">{editingHeist.title}</span>
                  </p>
                  <button
                    className="text-xs text-white/40 hover:text-white/60"
                    onClick={handleNewHeist}
                  >
                    New Heist
                  </button>
                </div>
              )}
              <HeistEditor key={editingHeist?.id ?? "new"} {...(editingHeist ? { editHeist: editingHeist } : {})} />
            </>
          )}
          {tab === "browse" && <HeistBrowser onEditHeist={handleEditHeist} />}
        </div>
      </div>
    </div>
  );
}
