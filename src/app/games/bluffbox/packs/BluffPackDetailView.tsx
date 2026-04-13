"use client";

import { useState, useCallback } from "react";
import { X, Pencil, Trash2, Copy, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import {
  removeCardFromPack,
  getMyPacks,
  copyCardToPack,
  type BluffBoxPack,
} from "@/lib/bluffbox-packs";
import { BluffPackCover, BluffCard } from "@/JMKit";
import { cn } from "@/lib/utils";

interface BluffPackDetailViewProps {
  pack: BluffBoxPack;
  onClose: () => void;
  onEdit?: (() => void) | undefined;
  /** Called after a card is removed from the pack — use to refresh lists; do not close the modal here. */
  onCardRemoved?: ((imageURL: string) => void) | undefined;
  onSelect?: ((pack: BluffBoxPack) => void) | undefined;
  /** Stack above the asset picker (e.g. `JM_SELECT_ASSET_DETAIL_Z` from JMKit). */
  overlayClassName?: string;
  /**
   * Pack picker / browse-only: no per-card actions; grid is non-interactive so touch drags
   * scroll the list (images otherwise capture gestures).
   */
  readOnlyCards?: boolean | undefined;
}

export default function BluffPackDetailView({
  pack,
  onClose,
  onEdit,
  onCardRemoved,
  onSelect,
  overlayClassName,
  readOnlyCards = false,
}: BluffPackDetailViewProps) {
  const { user } = useAuth();
  const isOwner = user?.uid === pack.creatorId;
  const showCardActions = isOwner && !readOnlyCards;

  const [confirmDeleteCard, setConfirmDeleteCard] = useState<string | null>(null);
  const [deletingCard, setDeletingCard] = useState(false);
  const [copyingCard, setCopyingCard] = useState<string | null>(null);
  const [myPacks, setMyPacks] = useState<BluffBoxPack[] | null>(null);
  const [loadingPacks, setLoadingPacks] = useState(false);

  const handleDeleteCard = useCallback(async (imageURL: string) => {
    setDeletingCard(true);
    try {
      await removeCardFromPack(pack.id, imageURL);
      onCardRemoved?.(imageURL);
    } catch (err) {
      console.error("Failed to delete card:", err);
    } finally {
      setDeletingCard(false);
      setConfirmDeleteCard(null);
    }
  }, [pack.id, onCardRemoved]);

  const handleStartCopy = useCallback(async (imageURL: string) => {
    setCopyingCard(imageURL);
    if (!myPacks && user) {
      setLoadingPacks(true);
      try {
        const packs = await getMyPacks(user.uid);
        setMyPacks(packs.filter((p) => p.id !== pack.id));
      } catch {
        setMyPacks([]);
      } finally {
        setLoadingPacks(false);
      }
    }
  }, [myPacks, user, pack.id]);

  const handleCopyTo = useCallback(async (targetPackId: string) => {
    if (!copyingCard) return;
    try {
      await copyCardToPack(targetPackId, copyingCard);
      setCopyingCard(null);
    } catch (err) {
      console.error("Failed to copy card:", err);
    }
  }, [copyingCard]);

  return (
    <div
      className={cn(
        "pointer-events-auto fixed inset-0 flex items-center justify-center p-4",
        overlayClassName ?? "z-50",
      )}
      onClick={onClose}
    >
      {/* `absolute` (not `fixed`) so stacking stays inside this overlay; avoids full-viewport layers stealing scroll/hit-testing */}
      <div className="pointer-events-auto absolute inset-0 z-0 bg-black/70 backdrop-blur-sm" aria-hidden />
      <div
        className="relative z-10 flex h-[min(85dvh,85vh,calc(100dvh-2rem))] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/20 bg-neutral-900 xl:max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-bold text-white">{pack.name}</h3>
            <p className="text-xs text-white/40">
              by {pack.creatorGamertag} &middot; {pack.cards.length} cards
            </p>
            {pack.subtitle && (
              <p className="mt-0.5 text-xs text-white/50">{pack.subtitle}</p>
            )}
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body — cover + description + card grid scroll together so iOS touch works on the whole region */}
        <div
          className="touch-pan-y min-h-0 flex-1 select-none overflow-y-auto overscroll-y-contain"
          style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "thin" }}
        >
          {/* Cover — half the old size on mobile, larger on sm+ */}
          <div className="flex justify-center pb-3 pt-4">
            <div className="w-[140px] sm:w-[200px]">
              <BluffPackCover coverImageURL={pack.coverImageURL} name={pack.name} />
            </div>
          </div>

          {pack.description && (
            <p className="px-5 pb-3 text-center text-sm text-white/50">{pack.description}</p>
          )}

          <div className="p-4">
            {pack.cards.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/30">No cards in this pack yet.</p>
            ) : (
              <div className={cn(
                "grid gap-2",
                showCardActions
                  ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5"
                  : "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6",
              )}>
                {pack.cards.map((url, idx) => (
                  <div key={`${idx}-${url}`} className="group relative">
                    <BluffCard imageURL={url} nonInteractive={readOnlyCards} />
                    {showCardActions && (
                      <div className="absolute right-0.5 top-0.5 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => handleStartCopy(url)}
                          className="rounded bg-black/60 p-1 text-white/60 backdrop-blur hover:text-white"
                          title="Copy to another pack"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteCard(url)}
                          className="rounded bg-black/60 p-1 text-red-400/60 backdrop-blur hover:text-red-400"
                          title="Delete card"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 gap-2 border-t border-white/10 p-4">
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 py-3 text-sm font-bold text-amber-300 transition-colors hover:bg-amber-400/20"
            >
              <Pencil className="h-4 w-4" />
              Edit Pack
            </button>
          )}
          {onSelect && (
            <button
              onClick={() => onSelect(pack)}
              className="flex-1 rounded-xl bg-green-500 py-3 text-sm font-bold uppercase tracking-wider text-black transition-all hover:scale-[1.02] active:scale-95"
            >
              Select This Pack
            </button>
          )}
        </div>
      </div>

      {/* Confirm delete card popup */}
      {confirmDeleteCard && (
        <div
          className="fixed inset-0 z-510 flex items-center justify-center p-8"
          onClick={() => setConfirmDeleteCard(null)}
        >
          <div className="fixed inset-0 bg-black/50" />
          <div
            className="relative z-10 w-full max-w-xs rounded-xl border border-white/20 bg-neutral-900 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-4 text-center text-sm font-bold text-white">Delete this card?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteCard(null)}
                className="flex-1 rounded-lg border border-white/10 py-2 text-sm text-white/60 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteCard(confirmDeleteCard)}
                disabled={deletingCard}
                className="flex-1 rounded-lg bg-red-500 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {deletingCard ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copy card picker */}
      {copyingCard && (
        <div
          className="fixed inset-0 z-510 flex items-center justify-center p-8"
          onClick={() => setCopyingCard(null)}
        >
          <div className="fixed inset-0 bg-black/50" />
          <div
            className="relative z-10 w-full max-w-xs rounded-xl border border-white/20 bg-neutral-900 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-center text-sm font-bold text-white">Copy to which pack?</p>
            {loadingPacks ? (
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-white/30" />
            ) : !myPacks || myPacks.length === 0 ? (
              <p className="py-4 text-center text-xs text-white/30">No other packs available.</p>
            ) : (
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {myPacks.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleCopyTo(p.id)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white transition-colors hover:bg-white/10"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setCopyingCard(null)}
              className="mt-3 w-full rounded-lg border border-white/10 py-2 text-sm text-white/40 hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
