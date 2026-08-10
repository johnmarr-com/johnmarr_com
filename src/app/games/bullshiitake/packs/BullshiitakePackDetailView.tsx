"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Pencil, Trash2, Plus, Loader2, Link2, Video, Package, Search, ImagePlay, FolderDown } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import {
  subscribeToItemsForPack,
  deleteBullshiitakeItem,
  setBullshiitakeItemCardImage,
  setPackAnswerCards,
  cardLabel,
  cardFileName,
  BS_TYPE_LABELS,
  type BullshiitakePack,
  type BullshiitakeItem,
  type BullshiitakeAnswerCard,
  type BSType,
} from "@/lib/bullshiitake-packs";
import { uploadBullshiitakeCardImage } from "@/lib/bullshiitake-storage";
import {
  renderBullshiitakeCard,
  renderBullshiitakeAnswerCard,
  ANSWERS_PER_CARD,
} from "./cardRenderer";
import BullshiitakeItemEditor from "./BullshiitakeItemEditor";

/** True when `token` appears in `text` in order (subsequence) — cheap typo
 * tolerance for the title search ("blockbstr" still finds Blockbuster). */
function isSubsequence(token: string, text: string): boolean {
  let i = 0;
  for (const ch of text) {
    if (ch === token[i]) i++;
    if (i === token.length) return true;
  }
  return false;
}

/** Fuzzy story filter: every query token must hit the card label, title, or
 * short text (substring), or at least read as a subsequence of the title.
 * Runs client-side — the pack's stories are already fully loaded, so no
 * Firestore text-search limitation applies. */
function matchesQuery(item: BullshiitakeItem, query: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const title = item.title.toLowerCase();
  const haystack = `${cardLabel(item.searchPrefix, item.searchID)} ${title} ${
    item.shortText ?? ""
  }`.toLowerCase();
  return tokens.every((t) => haystack.includes(t) || isSubsequence(t, title));
}

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
  const [searchQuery, setSearchQuery] = useState("");
  /** BS-Type filter for the list — "all" shows every card. */
  const [typeFilter, setTypeFilter] = useState<BSType | "all">("all");
  const [editorItem, setEditorItem] = useState<BullshiitakeItem | "new" | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Live listener — simultaneous editors see each other's saves and approval
  // dots in real time; no manual reloads.
  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;
    void subscribeToItemsForPack(pack.id, (next) => {
      if (cancelled) return;
      setItems(next);
      setLoading(false);
    }).then((u) => {
      if (cancelled) u();
      else unsub = u;
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [pack.id]);

  const visibleItems = useMemo(
    () =>
      items.filter(
        (i) => (typeFilter === "all" || i.bsType === typeFilter) && matchesQuery(i, searchQuery),
      ),
    [items, searchQuery, typeFilter],
  );

  /** Print-card generation progress; null when idle. */
  const [cardGen, setCardGen] = useState<{ done: number; total: number } | null>(null);
  /** Rendered answer cards — from the pack doc, refreshed after generation. */
  const [answerCards, setAnswerCards] = useState<BullshiitakeAnswerCard[]>(
    pack.answerCards ?? [],
  );
  /** True while the server assembles the deck zip in Storage. */
  const [zipBusy, setZipBusy] = useState(false);

  /** The zip is built server-side into Storage (streaming it through Cloud
   * Run truncates at ~32MiB), then downloaded straight from Storage. */
  const handleDownloadAll = useCallback(async () => {
    setZipBusy(true);
    try {
      const res = await fetch(`/api/games/bullshiitake/download-cards?packId=${pack.id}`);
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Failed to build zip");
      window.open(data.url, "_self");
    } catch (err) {
      console.error("[cards] deck download failed:", err);
    } finally {
      setZipBusy(false);
    }
  }, [pack.id]);

  /** Render + upload a print card for every story that doesn't have one yet,
   * then (re)render every answer card — those always refresh, since any
   * story edit or type change can alter an answer. Sequential on purpose:
   * steady progress, no burst of parallel uploads. The live items listener
   * refreshes each row as its card URL lands. */
  const handleGenerateCards = useCallback(async () => {
    const targets = items.filter((i) => !i.cardImageURL);
    const maxId = items.reduce((m, i) => Math.max(m, i.searchID ?? 0), 0);
    const groupCount = Math.ceil(maxId / ANSWERS_PER_CARD);
    if (targets.length === 0 && groupCount === 0) return;
    const total = targets.length + groupCount;
    setCardGen({ done: 0, total });
    let done = 0;

    for (const item of targets) {
      try {
        const prefix = item.searchPrefix ?? pack.searchPrefix;
        const story = item.shortText?.trim() ? item.shortText : item.storyText;
        const blob = await renderBullshiitakeCard({
          cardId: cardLabel(prefix, item.searchID),
          storyText: story,
          bannerURL: item.imageURL,
        });
        const url = await uploadBullshiitakeCardImage(
          pack.id,
          cardFileName(prefix, item.searchID),
          blob,
        );
        await setBullshiitakeItemCardImage(item.id, url);
      } catch (err) {
        console.error(`[cards] render failed for ${item.title}:`, err);
      }
      done++;
      setCardGen({ done, total });
    }

    // Answer cards — one per ANSWERS_PER_CARD block, filled in searchID order.
    const prefix = pack.searchPrefix ?? items[0]?.searchPrefix;
    const nextAnswers: BullshiitakeAnswerCard[] = [];
    for (let g = 0; g < groupCount; g++) {
      const start = g * ANSWERS_PER_CARD + 1;
      const end = (g + 1) * ANSWERS_PER_CARD;
      try {
        const entries = items
          .filter((i) => (i.searchID ?? 0) >= start && (i.searchID ?? 0) <= end)
          .sort((a, b) => (a.searchID ?? 0) - (b.searchID ?? 0))
          .map((i) => ({
            label: cardLabel(i.searchPrefix ?? prefix, i.searchID),
            bsType: i.bsType,
            // No correction on print answer cards — the verdict alone resolves
            // the round; PT details live at BullShiitake.com (CTA in the art).
          }));
        if (entries.length > 0) {
          const rangeLabel = prefix ? `${prefix} ${start} - ${end}` : `${start} - ${end}`;
          const blob = await renderBullshiitakeAnswerCard({ rangeLabel, entries });
          const url = await uploadBullshiitakeCardImage(
            pack.id,
            `answers-${start}-${end}`,
            blob,
          );
          nextAnswers.push({ start, end, imageURL: url });
        }
      } catch (err) {
        console.error(`[cards] answer card ${start}-${end} failed:`, err);
      }
      done++;
      setCardGen({ done, total });
    }
    try {
      await setPackAnswerCards(pack.id, nextAnswers);
      setAnswerCards(nextAnswers);
    } catch (err) {
      console.error("[cards] saving answer cards failed:", err);
    }
    setCardGen(null);
  }, [items, pack.id, pack.searchPrefix]);

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
          className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-white/20 bg-neutral-900 xl:max-w-4xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header — title row + search bar, both fixed above the scroll body */}
          <div className="shrink-0 border-b border-white/10 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
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
                  <h3 className="truncate text-lg font-bold text-white">
                    {pack.name}
                    {pack.searchPrefix && (
                      <span className="ml-2 rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 align-middle font-mono text-xs font-normal text-white/50">
                        {pack.searchPrefix}-#
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-white/40">
                    {searchQuery.trim() || typeFilter !== "all"
                      ? `${visibleItems.length} of ${items.length} stories`
                      : `${items.length} stor${items.length !== 1 ? "ies" : "y"}`}
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

            {/* Story search + BS-Type filter */}
            <div className="mt-3 flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search stories by title or short text…"
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pr-3 pl-9 text-sm text-white placeholder-white/25 outline-none focus:border-lime-400/40"
                />
              </div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as BSType | "all")}
                className={`shrink-0 rounded-xl border px-3 py-2.5 text-sm font-bold outline-none ${
                  typeFilter === "all"
                    ? "border-white/10 bg-white/5 text-white/70"
                    : BS_TYPE_BADGE[typeFilter]
                }`}
                title="Filter by BS-Type"
              >
                <option value="all" className="bg-neutral-800 text-white">
                  All Cards
                </option>
                {(Object.keys(BS_TYPE_LABELS) as BSType[]).map((t) => (
                  <option key={t} value={t} className="bg-neutral-800 text-white">
                    {BS_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
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
            ) : visibleItems.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/30">
                No stories match &ldquo;{searchQuery.trim()}&rdquo;.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {visibleItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={canManage ? () => setEditorItem(item) : undefined}
                    className={`group flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-3 transition-colors ${
                      canManage ? "cursor-pointer hover:border-lime-400/30 hover:bg-white/10" : ""
                    }`}
                  >
                    {/* 2:1 banner thumb */}
                    <div className="aspect-2/1 w-36 shrink-0 overflow-hidden rounded-lg bg-neutral-800 sm:w-44">
                      {item.imageURL ? (
                        /* eslint-disable-next-line @next/next/no-img-element -- Storage URL */
                        <img src={item.imageURL} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-white/20">
                          no image
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-bold text-white">
                        {item.searchID != null && (
                          <span className="mr-2 font-mono text-sm font-normal text-white/40">
                            {cardLabel(item.searchPrefix ?? pack.searchPrefix, item.searchID)}
                          </span>
                        )}
                        {item.title}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${BS_TYPE_BADGE[item.bsType]}`}
                        >
                          {BS_TYPE_LABELS[item.bsType]}
                        </span>
                        {item.citations?.length ? (
                          <span className="flex items-center gap-1 text-[10px] text-white/30">
                            <Link2 className="h-3 w-3" />
                            {item.citations.length}
                          </span>
                        ) : null}
                        {item.videoURL ? (
                          <span className="flex items-center gap-1 text-[10px] text-white/30">
                            <Video className="h-3 w-3" />
                            video
                          </span>
                        ) : null}
                      </div>
                      {item.shortText?.trim() ? (
                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-white/40">
                          {item.shortText}
                        </p>
                      ) : null}
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 flex-col items-center gap-3">
                        {/* Back-office approval dot — mirrors the editor's
                            Admin Approved toggle (green = short form approved). */}
                        <span
                          className={`h-3.5 w-3.5 shrink-0 rounded-full ${
                            item.adminApproved
                              ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]"
                              : "border border-white/25 bg-black"
                          }`}
                          title={
                            item.adminApproved
                              ? "Short form approved"
                              : "Short form not yet approved"
                          }
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(item.id);
                          }}
                          className="rounded-md bg-black/40 p-2 text-red-400/50 transition-colors hover:text-red-400"
                          title="Delete story"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Answer cards — one per 20-card block, listed by range only */}
                {answerCards.length > 0 &&
                  !searchQuery.trim() &&
                  typeFilter === "all" &&
                  answerCards.map((ac) => (
                    <a
                      key={`answers-${ac.start}`}
                      href={ac.imageURL}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center gap-4 rounded-xl border border-orange-400/20 bg-orange-400/5 p-3 transition-colors hover:border-orange-400/40 hover:bg-orange-400/10"
                    >
                      <div className="aspect-3/5 w-12 shrink-0 overflow-hidden rounded-md border border-white/10 bg-neutral-800">
                        {/* eslint-disable-next-line @next/next/no-img-element -- Storage URL */}
                        <img src={ac.imageURL} alt="" className="h-full w-full object-cover" />
                      </div>
                      <p className="min-w-0 flex-1 truncate text-base font-bold text-orange-300">
                        Answers {cardLabel(pack.searchPrefix, ac.start)} to{" "}
                        {cardLabel(pack.searchPrefix, ac.end)}
                      </p>
                      <span className="shrink-0 text-[10px] uppercase tracking-wider text-white/30">
                        answer card
                      </span>
                    </a>
                  ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {(canManage || onEdit) && (
            <div className="shrink-0 space-y-2 border-t border-white/10 p-4">
              {/* Print tools — render missing cards / grab the whole deck */}
              {canManage && items.length > 0 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleGenerateCards()}
                    disabled={cardGen !== null}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-bold text-white/80 transition-colors hover:bg-white/10 disabled:opacity-40"
                  >
                    {cardGen ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating {cardGen.done}/{cardGen.total}…
                      </>
                    ) : (
                      <>
                        <ImagePlay className="h-4 w-4" />
                        Generate Preview Images
                        {items.some((i) => !i.cardImageURL) &&
                          ` (${items.filter((i) => !i.cardImageURL).length})`}
                        {" + answers"}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDownloadAll()}
                    disabled={
                      zipBusy || cardGen !== null || items.every((i) => !i.cardImageURL)
                    }
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 py-2.5 text-sm font-bold text-white/80 transition-colors hover:bg-white/10 disabled:opacity-40"
                  >
                    {zipBusy ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Preparing zip…
                      </>
                    ) : (
                      <>
                        <FolderDown className="h-4 w-4" />
                        Download All Cards
                      </>
                    )}
                  </button>
                </div>
              )}
              <div className="flex gap-2">
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
          packSearchPrefix={pack.searchPrefix}
          existingItem={editorItem === "new" ? undefined : editorItem}
          /* No local list bookkeeping needed — the live items listener picks
             up saves and instant approval-toggle writes on its own. */
          onSaved={() => setEditorItem(null)}
          onCancel={() => setEditorItem(null)}
        />
      )}
    </>,
    document.body,
  );
}
