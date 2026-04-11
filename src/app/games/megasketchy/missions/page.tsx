"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import type { MegaSketchyMission } from "@/lib/megasketchy-missions";
import MissionEditor from "./MissionEditor";
import MissionBrowser from "./MissionBrowser";

type Tab = "create" | "view";

export default function MissionsPage() {
  const { user, userTier, isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const canCreate = isAdmin || userTier === "pro";

  const [tab, setTab] = useState<Tab>(canCreate ? "create" : "view");
  const [editingMission, setEditingMission] = useState<MegaSketchyMission | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/games/megasketchy");
    }
  }, [authLoading, user, router]);

  const handleSaved = useCallback(
    () => {
      setEditingMission(null);
      setTab("view");
      setRefreshKey((k) => k + 1);
    },
    [],
  );

  const handleEdit = useCallback((mission: MegaSketchyMission) => {
    setEditingMission(mission);
    setTab("create");
  }, []);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-lg px-4 py-6">
        {/* Back link */}
        <button
          onClick={() => router.push("/games/megasketchy")}
          className="mb-4 flex items-center gap-1 text-sm text-white/40 transition-colors hover:text-white/60"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Mega Sketchy
        </button>

        <h1 className="mb-6 text-2xl font-black uppercase tracking-wider text-green-400">
          Missions
        </h1>

        {/* Tabs */}
        <div className="mb-6 flex rounded-lg bg-white/5 p-1">
          {canCreate && (
            <button
              onClick={() => {
                setEditingMission(null);
                setTab("create");
              }}
              className={`flex-1 rounded-md py-2 text-sm font-bold transition-colors ${
                tab === "create" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
              }`}
            >
              {editingMission ? "Edit Mission" : "Create a Mission"}
            </button>
          )}
          <button
            onClick={() => setTab("view")}
            className={`flex-1 rounded-md py-2 text-sm font-bold transition-colors ${
              tab === "view" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
            }`}
          >
            View All Missions
          </button>
        </div>

        {/* Content */}
        {tab === "create" && canCreate ? (
          <MissionEditor
            key={editingMission?.id ?? "new"}
            existingMission={editingMission ?? undefined}
            onSaved={handleSaved}
          />
        ) : (
          <MissionBrowser
            key={refreshKey}
            onEdit={canCreate ? handleEdit : undefined}
            onCopied={() => setRefreshKey((k) => k + 1)}
          />
        )}
      </div>
    </div>
  );
}
