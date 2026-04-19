"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/AuthProvider";
import {
  getOfficialHeists,
  getMyHeists,
  getSharedHeists,
  deleteHeist,
} from "@/lib/fyve-heists";
import type { FyveHeist } from "../fyveTypes";
import { GameStatusMessage } from "@/app/games/_gamecore";
import { Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/JMKit/JMDialog";

type SubTab = "official" | "my" | "shared";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "official", label: "Official" },
  { key: "my", label: "My Heists" },
  { key: "shared", label: "Shared" },
];

interface HeistBrowserProps {
  onEditHeist?: (heist: FyveHeist) => void;
}

export default function HeistBrowser({ onEditHeist }: HeistBrowserProps = {}) {
  const { user, isAdmin } = useAuth();
  const [subTab, setSubTab] = useState<SubTab>("official");
  const [officialList, setOfficialList] = useState<FyveHeist[]>([]);
  const [myList, setMyList] = useState<FyveHeist[]>([]);
  const [sharedList, setSharedList] = useState<FyveHeist[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<FyveHeist | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [off, shared] = await Promise.all([getOfficialHeists(), getSharedHeists()]);
      setOfficialList(off);
      setSharedList(shared);
      if (user) {
        const my = await getMyHeists(user.uid);
        setMyList(my);
      }
    } catch (err) {
      console.error("Failed to load heists:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const currentList = useMemo(() => {
    return subTab === "official" ? officialList : subTab === "my" ? myList : sharedList;
  }, [subTab, officialList, myList, sharedList]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteHeist(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      console.error("Failed to delete heist:", err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      {/* Tri-segmented selector */}
      <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
        {SUB_TABS.map(({ key, label }) => (
          <button
            key={key}
            className={`flex-1 rounded-lg py-2.5 text-sm font-bold tracking-wide transition ${
              subTab === key
                ? "bg-white/20 text-white shadow-lg"
                : "text-white/40 active:bg-white/10"
            }`}
            onClick={() => setSubTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Heist list */}
      <div className="mt-4 space-y-3">
        {loading ? (
          <GameStatusMessage message="Loading..." type="loading" />
        ) : currentList.length === 0 ? (
          <p className="py-12 text-center text-base text-white/40">No heists yet</p>
        ) : (
          currentList.map((heist) => {
            const canEdit = heist.creatorId === user?.uid || isAdmin;
            const wordCount =
              heist.words.tier1.length + heist.words.tier2.length + heist.words.tier3.length;

            return (
              <div
                key={heist.id}
                className="flex gap-4 rounded-xl border border-white/10 bg-black/30 p-3"
              >
                {/* Target image — square, sized to row */}
                <div className="w-24 shrink-0">
                  {heist.targetObjectImageUrl ? (
                    <div
                      className="aspect-square w-full rounded-lg bg-cover bg-center"
                      style={{ backgroundImage: `url(${heist.targetObjectImageUrl})` }}
                    />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-white/5">
                      <span className="text-2xl text-white/15">?</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-bold text-white">{heist.title}</h3>
                      {heist.draft && (
                        <span className="shrink-0 rounded-md bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-yellow-400">
                          Draft
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-white/50">
                      {heist.setting.location} &bull; {heist.setting.era}
                    </p>
                    <p className="text-xs text-white/35">
                      {heist.assets.length} assets &bull; {wordCount} words
                    </p>
                  </div>

                  {/* Action buttons */}
                  {canEdit && (
                    <div className="mt-2 flex gap-2">
                      {onEditHeist && (
                        <button
                          className="flex items-center gap-1.5 rounded-lg bg-[#E84C1E]/15 px-3 py-2 text-xs font-semibold text-[#E84C1E] active:bg-[#E84C1E]/25"
                          onClick={() => onEditHeist(heist)}
                        >
                          <Pencil size={14} />
                          Edit
                        </button>
                      )}
                      <button
                        className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 active:bg-red-500/20"
                        onClick={() => setDeleteTarget(heist)}
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="mx-4 max-w-sm border-red-500/30 bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Heist</DialogTitle>
            <DialogDescription className="text-white/60">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-white">&ldquo;{deleteTarget?.title}&rdquo;</span>?
              This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 pt-2">
            <button
              className="flex-1 rounded-lg bg-white/10 py-2.5 text-sm font-semibold text-white/70 active:bg-white/20"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-bold text-white active:bg-red-700 disabled:opacity-50"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
