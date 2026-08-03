"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Pencil, Trash2, Plus, Loader2, Link2, Video, Package } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import {
  listItemsForPack,
  deleteBullshiitakeItem,
  BS_TYPE_LABELS,
  type BullshiitakePack,
  type BullshiitakeItem,
  type BSType,
} from "@/lib/bullshiitake-packs";
import BullshiitakeItemEditor from "./BullshiitakeItemEditor";

interface BullshiitakePackDetailViewProps {
  pack: BullshiitakePack;
  onClose: () => void;
  onEdit?: (() => void) | undefined;
}

const BS_TYPE_BADGE: Record<BSType, string> = {
  true: "border-green-400/30 bg-green-400/10 text-green-300",
  partlytrue: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  bullshiitake: "border-red-400/30 bg-red-400/10 text-red-300",
};

/**
 * Pack detail — story list with count plus add/edit/delete. Follows the
 * canonical popup anatomy (JMModal): portaled to <body>, fixed full-viewport
 * wrapper, blurred backdrop, panel capped at max-h with an inner scroll body.
 */
export default function BullshiitakePackDetailView({
  pack,
  onClose,
  onEdit,
}: BullshiitakePackDetailViewProps) {
  const { user, isAdmin } = useAuth();
  const canManage = isAdmin || user?.uid === pack.creatorId;

  const [items, setItems] = useState<BullshiitakeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorItem, setEditorItem] = useState<BullshiitakeItem | "new" | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listItemsForPack(pack.id));
    } catch (err) {
      console.error("Failed to load stories:", err);
    } finally {
      setLoading(false);
    }
  }, [pack.id]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleDelete = useCallback(
    async (itemId: string) => {
      setDeleting(true);
      try {
        await deleteBullshiitakeItem(itemId);
        setItems((prev) => prev.filter((i) => i.id !== itemId));
      } catch (err) {
        console.error("Failed to delete story:", err);
      } finally {
        setDeleting(false);
        setConfirmDeleteId(null);
      }
    },
    [],
  );

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={pack.name}
      >
        {/* Backdrop visual — separate element so backdrop-filter doesn't
            create a compositing layer over the panel (Safari bug). */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden />

        <div
          className="relative flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-[28px] border border-white/20 bg-neutral-900 xl:max-w-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {pack.iconURL ? (
                /* eslint-disable-next-line @next/next/no-img-element -- Storage URL */
                <img src={pack.iconURL} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/5">
                  <Package className="h-5 w-5 text-white/20" />
                </div>
              )}
              <div className="min-w-0">
                <h3 className="truncate text-lg font-bold text-white">{pack.name}</h3>
                <p className="text-xs text-white/40">
                  {items.length} stor{items.length !== 1 ? "ies" : "y"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable body */}
          <div
            className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain p-4"
            style={{ WebkitOverflowScrolling: "touch" }}
            onWheel={(e) => e.stopPropagation()}
          >
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-white/30" />
              </div>
            ) : items.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/30">
                No stories in this pack yet.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2.5"
                  >
                    {/* 2:1 banner thumb */}
                    <div className="aspect-2/1 w-24 shrink-0 overflow-hidden rounded-lg bg-neutral-800">
                      {item.imageURL ? (
                        /* eslint-disable-next-line @next/next/no-img-element -- Storage URL */
                        <img src={item.imageURL} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[9px] text-white/20">
                          no image
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white">
                        {item.searchID != null && (
                          <span className="mr-1.5 font-mono text-xs font-normal text-white/35">
                            #{item.searchID}
                          </span>
                        )}
                        {item.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${BS_TYPE_BADGE[item.bsType]}`}
                        >
                          {BS_TYPE_LABELS[item.bsType]}
                        </span>
                        {item.citations?.length ? (
                          <span className="flex items-center gap-0.5 text-[9px] text-white/30">
                            <Link2 className="h-2.5 w-2.5" />
                            {item.citations.length}
                          </span>
                        ) : null}
                        {item.videoURL ? (
                          <span className="flex items-center gap-0.5 text-[9px] text-white/30">
                            <Video className="h-2.5 w-2.5" />
                            video
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 gap-0.5">
                        <button
                          type="button"
                          onClick={() => setEditorItem(item)}
                          className="rounded-md bg-black/40 p-2 text-white/50 transition-colors hover:text-white"
                          title="Edit story"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          className="rounded-md bg-black/40 p-2 text-red-400/50 transition-colors hover:text-red-400"
                          title="Delete story"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {(canManage || onEdit) && (
            <div className="flex shrink-0 gap-2 border-t border-white/10 p-4">
              {canManage && (
                <button
                  type="button"
                  onClick={() => setEditorItem("new")}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-lime-500 py-3 text-sm font-bold text-black transition-all hover:scale-[1.02] active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                  Add Story
                </button>
              )}
              {onEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-lime-400/30 bg-lime-400/10 py-3 text-sm font-bold text-lime-300 transition-colors hover:bg-lime-400/20"
                >
                  <Pencil className="h-4 w-4" />
                  Edit Pack
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirm delete story popup */}
      {confirmDeleteId && (
        <div
          className="pointer-events-auto fixed inset-0 z-510 flex items-center justify-center p-8"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div className="fixed inset-0 bg-black/50" />
          <div
            className="relative z-10 w-full max-w-xs rounded-xl border border-white/20 bg-neutral-900 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-4 text-center text-sm font-bold text-white">Delete this story?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 rounded-lg border border-white/10 py-2 text-sm text-white/60 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-500 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {deleting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Story editor (stacked above the detail panel) */}
      {editorItem && (
        <BullshiitakeItemEditor
          packId={pack.id}
          existingItem={editorItem === "new" ? undefined : editorItem}
          onSaved={(saved) => {
            setItems((prev) => {
              const idx = prev.findIndex((i) => i.id === saved.id);
              if (idx === -1) return [...prev, saved];
              const next = [...prev];
              next[idx] = saved;
              return next;
            });
            setEditorItem(null);
          }}
          onCancel={() => setEditorItem(null)}
        />
      )}
    </>,
    document.body,
  );
}
