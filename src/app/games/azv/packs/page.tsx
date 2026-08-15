"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Loader2, Package } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { createAZVPack, listAZVPacks, type AZVPack } from "@/lib/azv-packs";
import AZVPackBuilder from "./AZVPackBuilder";

/**
 * AZV pack home: list packs / create one by name, then open the two-column
 * card builder for the selected pack.
 */
export default function AZVPacksPage() {
  const { user, userTier, isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const canCreate = isAdmin || userTier === "pro";

  const [packs, setPacks] = useState<AZVPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [openPack, setOpenPack] = useState<AZVPack | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/games/azv");
    }
  }, [authLoading, user, router]);

  const loadPacks = useCallback(async () => {
    setLoading(true);
    try {
      setPacks(await listAZVPacks());
    } catch (err) {
      console.error("[azv] failed to load packs:", err);
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
      const pack = await createAZVPack(newName.trim(), user.uid);
      setNewName("");
      setPacks((prev) => [pack, ...prev]);
      setOpenPack(pack);
    } catch (err) {
      console.error("[azv] failed to create pack:", err);
    } finally {
      setCreating(false);
    }
  }, [user, newName, creating]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-lime-400 border-t-transparent" />
      </div>
    );
  }

  if (openPack) {
    return <AZVPackBuilder pack={openPack} onBack={() => setOpenPack(null)} />;
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-lg px-4 py-6">
        <button
          onClick={() => router.push("/games/azv")}
          className="mb-4 flex items-center gap-1 text-sm text-white/40 transition-colors hover:text-white/60"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Atomic Zombie Vampires
        </button>

        <h1 className="mb-6 text-2xl font-black uppercase tracking-wider text-lime-400">
          Card Packs
        </h1>

        {canCreate && (
          <div className="mb-6 flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New pack name…"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-lime-400/40"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreate();
              }}
            />
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={!newName.trim() || creating}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-lime-500 px-4 py-3 text-sm font-bold text-black transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40"
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
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left transition-colors hover:border-lime-400/30 hover:bg-white/10"
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
