"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import type { BullshiitakePack } from "@/lib/bullshiitake-packs";
import BullshiitakePackEditor from "./BullshiitakePackEditor";
import BullshiitakePackBrowser from "./BullshiitakePackBrowser";

type Tab = "create" | "view";

export default function BullshiitakePacksPage() {
  const { user, userTier, isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const canCreate = isAdmin || userTier === "pro";

  const [tab, setTab] = useState<Tab>(canCreate ? "create" : "view");
  const [editingPack, setEditingPack] = useState<BullshiitakePack | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/games/bullshiitake");
    }
  }, [authLoading, user, router]);

  const handleSaved = useCallback(() => {
    setEditingPack(null);
    setTab("view");
    setRefreshKey((k) => k + 1);
  }, []);

  const handleEdit = useCallback((pack: BullshiitakePack) => {
    setEditingPack(pack);
    setTab("create");
  }, []);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-lime-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-lg px-4 py-6 lg:max-w-3xl xl:max-w-5xl">
        <button
          onClick={() => router.push("/games/bullshiitake")}
          className="mb-4 flex items-center gap-1 text-sm text-white/40 transition-colors hover:text-white/60"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Bull Shiitake
        </button>

        <h1 className="mb-6 text-2xl font-black uppercase tracking-wider text-lime-400">
          Story Packs
        </h1>

        <div className="mb-6 flex rounded-lg bg-white/5 p-1">
          {canCreate && (
            <button
              onClick={() => {
                setEditingPack(null);
                setTab("create");
              }}
              className={`flex-1 rounded-md py-2 text-sm font-bold transition-colors ${
                tab === "create" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
              }`}
            >
              {editingPack ? "Edit Pack" : "Create a Pack"}
            </button>
          )}
          <button
            onClick={() => setTab("view")}
            className={`flex-1 rounded-md py-2 text-sm font-bold transition-colors ${
              tab === "view" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
            }`}
          >
            Browse All Packs
          </button>
        </div>

        {tab === "create" && canCreate ? (
          <BullshiitakePackEditor
            key={editingPack?.id ?? "new"}
            existingPack={editingPack ?? undefined}
            onSaved={handleSaved}
          />
        ) : (
          <BullshiitakePackBrowser
            key={refreshKey}
            onEdit={canCreate ? handleEdit : undefined}
          />
        )}
      </div>
    </div>
  );
}
