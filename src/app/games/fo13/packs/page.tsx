"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Loader2, Package } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { createFO13Pack, listFO13Packs, type FO13Pack } from "@/lib/fo13-packs";
import FO13PackBuilder from "./FO13PackBuilder";

/**
 * Field Office 13 pack home: list packs / create one by name, then open the
 * card builder. A new pack arrives with its two Rank cards already in it.
 */
export default function FO13PacksPage() {
  const { user, userTier, isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const canCreate = isAdmin || userTier === "pro";

  const [packs, setPacks] = useState<FO13Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [openPack, setOpenPack] = useState<FO13Pack | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [authLoading, user, router]);

  const loadPacks = useCallback(async () => {
    setLoading(true);
    try {
      setPacks(await listFO13Packs());
    } catch (err) {
      console.error("[fo13] failed to load packs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void loadPacks();
  }, [user, loadPacks]);

  const handleCreate = useCallback(async () => {
    if (!user || !newName.trim() || creating) return;
    setCreating(true);
    try {
      const pack = await createFO13Pack(newName.trim(), user.uid);
      setNewName("");
      setPacks((prev) => [pack, ...prev]);
      setOpenPack(pack);
    } catch (err) {
      console.error("[fo13] failed to create pack:", err);
    } finally {
      setCreating(false);
    }
  }, [user, newName, creating]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  if (openPack) {
    return <FO13PackBuilder pack={openPack} onBack={() => setOpenPack(null)} />;
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-lg px-4 py-6">
        <button
          onClick={() => router.push("/admin")}
          className="mb-4 flex items-center gap-1 text-sm text-white/40 transition-colors hover:text-white/60"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admin
        </button>

        <h1 className="mb-6 text-2xl font-black uppercase tracking-wider text-amber-400">
          Field Office 13 — Card Packs
        </h1>

        {canCreate && (
          <div className="mb-6 flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New pack name…"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-amber-400/40"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreate();
              }}
            />
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={!newName.trim() || creating}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-black transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-white/30" />
          </div>
        ) : packs.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/30">No packs yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {packs.map((pack) => (
              <button
                key={pack.id}
                type="button"
                onClick={() => setOpenPack(pack)}
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left transition-colors hover:border-amber-400/30 hover:bg-white/10"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/5">
                  <Package className="h-5 w-5 text-white/25" />
                </div>
                <span className="min-w-0 flex-1 truncate text-base font-bold text-white">
                  {pack.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
