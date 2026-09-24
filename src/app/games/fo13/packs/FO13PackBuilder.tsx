"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Trash2,
  Upload,
  Download,
  ChevronRight,
  ImageIcon,
  Check,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import {
  subscribeToFO13Cards,
  createFO13Card,
  updateFO13Card,
  deleteFO13Card,
  setFO13CardImage,
  isFO13TextCard,
  FO13_CARD_TYPES,
  FO13_CARD_TYPE_LABELS,
  type FO13Pack,
  type FO13Card,
  type FO13CardType,
} from "@/lib/fo13-packs";
import {
  uploadFO13CardArt,
  uploadFO13CardImage,
  validateFO13ImageFile,
  FO13_IMAGE_ACCEPT,
} from "@/lib/fo13-storage";
import {
  FO13_CARD_H,
  FO13_CARD_W,
  FO13_MAX_TEXT_LENGTH,
  backgroundForCard,
  fo13TextLines,
  fo13VisibleLength,
} from "./fo13CardSpec";
import { drawFO13Card, renderFO13Card } from "./fo13CardRenderer";
import { FO13_GENERATION_COUNT } from "./fo13Prompts";

interface FO13PackBuilderProps {
  pack: FO13Pack;
  onBack: () => void;
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-amber-400/40";
const labelClass = "text-xs font-bold uppercase tracking-wider text-white/40";

/** What a card shows in the list: its art, or its typed line on one row. */
function cardListLabel(card: FO13Card): string {
  if (card.cardType === "Rank") return card.imageURL ? "Rank card" : "No art yet";
  const text = card.text?.trim();
  // Break markers are layout — the list reads the copy straight through.
  return text ? fo13TextLines(text).join(" ") : "(empty)";
}

/**
 * Field Office 13 pack builder.
 *
 * Left is the card list, grouped by type — Rank rows show their art, typed
 * rows show their line, no previews until you open one. Opening a card swaps
 * in its form and a live 825×1125 preview drawn by the real renderer.
 */
export default function FO13PackBuilder({ pack, onBack }: FO13PackBuilderProps) {
  const { user } = useAuth();

  const [cards, setCards] = useState<FO13Card[]>([]);
  const [loading, setLoading] = useState(true);
  /** null = list mode; "new" or a card = form mode. */
  const [editing, setEditing] = useState<FO13Card | "new" | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // ── Form state ──────────────────────────────────────────────
  const [cardType, setCardType] = useState<FO13CardType>("Subject");
  const [text, setText] = useState("");
  const [imageURL, setImageURL] = useState("");
  const [pendingArtPreview, setPendingArtPreview] = useState<string | null>(null);
  const pendingArtBlobRef = useRef<Blob | null>(null);
  const artInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Render-all progress: null when idle, else "3 / 24". */
  const [renderProgress, setRenderProgress] = useState<string | null>(null);

  /** AI candidates awaiting review. Empty means the panel is closed. */
  const [aiCards, setAiCards] = useState<{ text: string; checked: boolean }[]>([]);
  /** Which candidate the preview is showing. */
  const [aiIndex, setAiIndex] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);

  /** Doc id fixed up-front so art can upload before the doc exists. */
  const cardIdRef = useRef<string>("");

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;
    void subscribeToFO13Cards(pack.id, (next) => {
      if (cancelled) return;
      setCards(next);
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

  useEffect(() => {
    return () => {
      if (pendingArtPreview) URL.revokeObjectURL(pendingArtPreview);
    };
  }, [pendingArtPreview]);

  const openForm = useCallback((card: FO13Card | "new") => {
    setEditing(card);
    setError(null);
    setConfirmingDelete(false);
    setAiCards([]);
    setAiIndex(null);
    pendingArtBlobRef.current = null;
    setPendingArtPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (card === "new") {
      cardIdRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      setCardType("Subject");
      setText("");
      setImageURL("");
    } else {
      cardIdRef.current = card.id;
      setCardType(card.cardType);
      setText(card.text ?? "");
      setImageURL(card.imageURL ?? "");
    }
  }, []);

  const handleArtFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const invalid = validateFO13ImageFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    pendingArtBlobRef.current = file;
    setPendingArtPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }, []);

  // ── Live preview — the real renderer, drawn into a scaled canvas ──
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  /** The candidate under review wins the preview; otherwise the form's text. */
  const previewText =
    aiIndex !== null ? (aiCards[aiIndex]?.text ?? "") : text;
  useEffect(() => {
    if (editing === null) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    let cancelled = false;
    void drawFO13Card(ctx, {
      cardType,
      text: previewText,
      imageURL: pendingArtPreview ?? imageURL,
    })
      .then(() => {
        if (cancelled) return;
      })
      .catch((err) => {
        if (!cancelled) console.error("[fo13] preview render failed:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [editing, cardType, previewText, pendingArtPreview, imageURL]);

  const handleSave = useCallback(async () => {
    if (!user || !editing) return;
    setSaving(true);
    setError(null);
    try {
      let finalArtURL = imageURL;
      if (pendingArtBlobRef.current) {
        finalArtURL = await uploadFO13CardArt(cardIdRef.current, pendingArtBlobRef.current);
        setImageURL(finalArtURL);
        pendingArtBlobRef.current = null;
      }
      const sameType = cards.filter((c) => c.cardType === cardType);
      const order =
        editing === "new"
          ? sameType.length
          : (cards.find((c) => c.id === editing.id)?.order ?? sameType.length);
      const fields = {
        cardType,
        order,
        ...(isFO13TextCard(cardType) && text.trim() ? { text: text.trim() } : {}),
        ...(cardType === "Rank" && finalArtURL ? { imageURL: finalArtURL } : {}),
      };
      if (editing === "new") {
        await createFO13Card({ ...fields, packId: pack.id, id: cardIdRef.current }, user.uid);
      } else {
        await updateFO13Card(editing.id, fields);
      }
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save card.");
    } finally {
      setSaving(false);
    }
  }, [user, editing, imageURL, cardType, text, cards, pack.id]);

  const handleDelete = useCallback(async () => {
    if (!editing || editing === "new") return;
    try {
      await deleteFO13Card(editing.id);
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete card.");
    }
  }, [editing]);

  /** Ask the model for a batch of candidates for the selected card type. */
  const handleGenerate = useCallback(async () => {
    if (!user || cardType === "Rank") return;
    setGenerating(true);
    setError(null);
    try {
      // Send what the pack already has of this type so a second run doesn't
      // repeat the first.
      const existing = cards
        .filter((c) => c.cardType === cardType)
        .map((c) => c.text ?? "")
        .filter(Boolean);
      const res = await fetch("/api/games/fo13/generate-cards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({ cardType, existing }),
      });
      const body = (await res.json()) as { cards?: string[]; error?: string };
      if (!res.ok || !body.cards) throw new Error(body.error ?? "Generation failed");
      setAiCards(body.cards.map((t) => ({ text: t, checked: false })));
      setAiIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }, [user, cardType, cards]);

  /** Save every checked candidate as its own card. */
  const handleSaveChecked = useCallback(async () => {
    if (!user) return;
    const chosen = aiCards.filter((c) => c.checked && c.text.trim());
    if (chosen.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const base = cards.filter((c) => c.cardType === cardType).length;
      for (const [i, candidate] of chosen.entries()) {
        await createFO13Card(
          {
            packId: pack.id,
            cardType,
            order: base + i,
            text: candidate.text.trim(),
          },
          user.uid,
        );
      }
      setAiCards([]);
      setAiIndex(null);
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save cards.");
    } finally {
      setSaving(false);
    }
  }, [user, aiCards, cards, cardType, pack.id]);

  /**
   * Render every card, upload each PNG, then ask the API for a zip of the
   * pack and hand the browser its URL.
   */
  const handleRenderAll = useCallback(async () => {
    if (cards.length === 0) return;
    setError(null);
    try {
      for (const [i, card] of cards.entries()) {
        setRenderProgress(`${i + 1} / ${cards.length}`);
        const blob = await renderFO13Card({
          cardType: card.cardType,
          ...(card.text ? { text: card.text } : {}),
          ...(card.imageURL ? { imageURL: card.imageURL } : {}),
        });
        const url = await uploadFO13CardImage(pack.id, `fo13-${card.id}`, blob);
        await setFO13CardImage(card.id, url);
      }
      setRenderProgress("Zipping…");
      const res = await fetch(`/api/games/fo13/download-cards?packId=${pack.id}`);
      const body = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !body.url) throw new Error(body.error ?? "Failed to build zip");
      window.location.href = body.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Render failed.");
    } finally {
      setRenderProgress(null);
    }
  }, [cards, pack.id]);

  /** Cards grouped by type, in card-type order. */
  const cardGroups = useMemo(() => {
    const groups: { type: FO13CardType; label: string; cards: FO13Card[] }[] = [];
    for (const type of FO13_CARD_TYPES) {
      const ofType = cards.filter((c) => c.cardType === type);
      if (ofType.length === 0) continue;
      groups.push({ type, label: FO13_CARD_TYPE_LABELS[type], cards: ofType });
    }
    return groups;
  }, [cards]);

  const previewArt = pendingArtPreview ?? imageURL;
  const isTextCard = isFO13TextCard(cardType);
  const visibleLength = fo13VisibleLength(text);
  const checkedCount = aiCards.filter((c) => c.checked).length;

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <button
          onClick={onBack}
          className="mb-4 flex items-center gap-1 text-sm text-white/40 transition-colors hover:text-white/60"
        >
          <ArrowLeft className="h-4 w-4" />
          All Packs
        </button>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black uppercase tracking-wider text-amber-400">
            {pack.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleRenderAll()}
              disabled={cards.length === 0 || renderProgress !== null}
              className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold text-white/80 transition-colors hover:bg-white/10 disabled:opacity-40"
            >
              {renderProgress ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {renderProgress ? `Rendering ${renderProgress}` : "Render & Download All"}
            </button>
            <button
              type="button"
              onClick={() => openForm("new")}
              className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-black transition-all hover:scale-[1.02] active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Add Card
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-6 lg:flex-row">
          {/* ── Left: card list, or the create/edit form in its place ── */}
          <div className="min-w-0 flex-1">
            {editing === null ? (
              loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-white/30" />
                </div>
              ) : cards.length === 0 ? (
                <p className="py-8 text-center text-sm text-white/30">No cards yet.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {cardGroups.map((group) => {
                    const open = openGroups[group.type] ?? true;
                    return (
                      <div
                        key={group.type}
                        className="overflow-hidden rounded-xl border border-white/10"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setOpenGroups((prev) => ({ ...prev, [group.type]: !open }))
                          }
                          className="flex w-full items-center gap-2 bg-white/5 px-4 py-3 text-left transition-colors hover:bg-white/10"
                        >
                          <ChevronRight
                            className={`h-4 w-4 shrink-0 text-white/40 transition-transform ${open ? "rotate-90" : ""}`}
                          />
                          <span className="flex-1 text-sm font-bold uppercase tracking-wider text-white/70">
                            {group.label}
                          </span>
                          <span className="text-xs text-white/30">{group.cards.length}</span>
                        </button>

                        {open && (
                          <div className="flex flex-col divide-y divide-white/5">
                            {group.cards.map((card) => (
                              <button
                                key={card.id}
                                type="button"
                                onClick={() => openForm(card)}
                                className="flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/5"
                              >
                                {card.cardType === "Rank" ? (
                                  <span className="flex h-14 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-white/5">
                                    {card.imageURL ? (
                                      /* eslint-disable-next-line @next/next/no-img-element -- asset/Storage URL */
                                      <img
                                        src={card.imageURL}
                                        alt=""
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <ImageIcon className="h-4 w-4 text-white/25" />
                                    )}
                                  </span>
                                ) : null}
                                <span
                                  className={`min-w-0 flex-1 truncate text-sm ${
                                    card.text?.trim() || card.cardType === "Rank"
                                      ? "text-white"
                                      : "text-white/30 italic"
                                  }`}
                                >
                                  {cardListLabel(card)}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-white/5 p-4">
                <div>
                  <label className={labelClass}>Card Type</label>
                  <select
                    value={cardType}
                    onChange={(e) => {
                      setCardType(e.target.value as FO13CardType);
                      // Candidates are written for one type; drop them.
                      setAiCards([]);
                      setAiIndex(null);
                    }}
                    disabled={editing !== "new"}
                    className={`${inputClass} mt-1.5 disabled:opacity-60`}
                  >
                    {FO13_CARD_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {FO13_CARD_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </div>

                {isTextCard ? (
                  <div>
                    <div className="flex items-baseline justify-between">
                      <label className={labelClass}>Card Text</label>
                      <span
                        className={`text-xs ${
                          visibleLength > FO13_MAX_TEXT_LENGTH ? "text-red-400" : "text-white/30"
                        }`}
                      >
                        {visibleLength} / {FO13_MAX_TEXT_LENGTH}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={text}
                      onChange={(e) => {
                        // Cap the VISIBLE characters — break markers are
                        // layout and shouldn't eat into the copy budget.
                        const next = e.target.value;
                        if (fo13VisibleLength(next) <= FO13_MAX_TEXT_LENGTH) setText(next);
                      }}
                      placeholder="One line, up to 40 characters…"
                      className={`${inputClass} mt-1.5`}
                      autoFocus
                    />
                    <p className="mt-1.5 text-xs text-white/30">
                      Type <code className="text-white/50">/n</code> (or{" "}
                      <code className="text-white/50">&lt;br&gt;</code>) to force a
                      line break.
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className={labelClass}>Card Art (825 × 1125)</label>
                    <button
                      type="button"
                      onClick={() => artInputRef.current?.click()}
                      className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 px-3 py-4 text-sm text-white/50 transition-colors hover:border-amber-400/40 hover:text-white/70"
                    >
                      <Upload className="h-4 w-4" />
                      {previewArt ? "Replace image" : "Upload image"}
                    </button>
                    <input
                      ref={artInputRef}
                      type="file"
                      accept={FO13_IMAGE_ACCEPT}
                      hidden
                      onChange={handleArtFileChange}
                    />
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving}
                    className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-black transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-white/60 transition-colors hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleGenerate()}
                    disabled={!isTextCard || generating}
                    title={
                      isTextCard
                        ? `Write ${FO13_GENERATION_COUNT} ${cardType} cards`
                        : "Rank cards are art, not text"
                    }
                    className="ml-auto flex items-center gap-1.5 rounded-xl border border-emerald-400/40 px-4 py-2.5 text-sm font-bold text-emerald-300 transition-colors hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/25 disabled:hover:bg-transparent"
                  >
                    {generating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {generating ? "Writing…" : "AI GEN"}
                  </button>
                  {editing !== "new" && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirmingDelete) void handleDelete();
                        else setConfirmingDelete(true);
                      }}
                      className="flex items-center gap-1.5 rounded-xl border border-red-500/30 px-4 py-2.5 text-sm font-bold text-red-400 transition-colors hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                      {confirmingDelete ? "Tap again to confirm" : "Delete"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── AI candidates — check the keepers, then save them all ── */}
            {editing !== null && aiCards.length > 0 && (
              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                <div className="flex items-baseline justify-between">
                  <span className={labelClass}>
                    AI {FO13_CARD_TYPE_LABELS[cardType]} Cards
                  </span>
                  <span className="text-xs text-white/40">
                    {checkedCount} checked
                  </span>
                </div>
                <p className="-mt-1 text-xs text-white/30">
                  Tap a line to preview it. Edit freely — only checked cards are
                  saved.
                </p>

                <div className="flex flex-col gap-2">
                  {aiCards.map((candidate, i) => {
                    const over = candidate.text.length > FO13_MAX_TEXT_LENGTH;
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={candidate.text}
                          onFocus={() => setAiIndex(i)}
                          onChange={(e) => {
                            const next = e.target.value;
                            setAiIndex(i);
                            setAiCards((prev) =>
                              prev.map((c, j) => (j === i ? { ...c, text: next } : c)),
                            );
                          }}
                          className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm text-white outline-none ${
                            aiIndex === i
                              ? "border-amber-400/50 bg-white/10"
                              : "border-white/10 bg-white/5"
                          }`}
                        />
                        <span
                          className={`w-10 shrink-0 text-right text-xs ${
                            over ? "text-red-400" : "text-white/25"
                          }`}
                        >
                          {candidate.text.length}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setAiCards((prev) =>
                              prev.map((c, j) =>
                                j === i ? { ...c, checked: !c.checked } : c,
                              ),
                            )
                          }
                          aria-pressed={candidate.checked}
                          aria-label={candidate.checked ? "Checked — will be saved" : "Not checked"}
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                            candidate.checked
                              ? "border-emerald-400 bg-emerald-500 text-black"
                              : "border-white/15 text-white/25 hover:border-white/30"
                          }`}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void handleSaveChecked()}
                    disabled={saving || checkedCount === 0}
                    className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-black transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save Cards{checkedCount > 0 ? ` (${checkedCount})` : ""}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAiCards([]);
                      setAiIndex(null);
                      setEditing(null);
                    }}
                    className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-white/60 transition-colors hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleGenerate()}
                    disabled={generating}
                    className="ml-auto flex items-center gap-1.5 rounded-xl border border-emerald-400/40 px-4 py-2.5 text-sm font-bold text-emerald-300 transition-colors hover:bg-emerald-400/10 disabled:opacity-40"
                  >
                    {generating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Regenerate
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Right: live preview, drawn by the real renderer ── */}
          {editing !== null && (
            <div className="min-w-0 lg:w-[22rem]">
              <div className="sticky top-6">
                <p className={`mb-2 ${labelClass}`}>
                  Card Preview ({FO13_CARD_W} × {FO13_CARD_H})
                </p>
                <canvas
                  ref={previewCanvasRef}
                  width={FO13_CARD_W}
                  height={FO13_CARD_H}
                  className="w-full rounded-xl border border-white/15 bg-neutral-900"
                  style={{ maxWidth: "min(22rem, calc(62vh * 0.7333))" }}
                />
                {!backgroundForCard(cardType) && !previewArt && (
                  <p className="mt-2 text-xs text-white/30">
                    Upload art to see this Rank card.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
