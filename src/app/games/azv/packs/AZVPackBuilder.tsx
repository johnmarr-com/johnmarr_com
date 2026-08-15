"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Plus, Loader2, Trash2, Upload, Wand2, X, Type } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { listAZVStyleSets, type AZVStyleSet } from "@/lib/azv-packs";
import {
  subscribeToAZVCards,
  createAZVCard,
  updateAZVCard,
  deleteAZVCard,
  setAZVCardImage,
  AZV_CARD_TYPES,
  AZV_CARD_TYPE_LABELS,
  AZV_WEAPON_TYPES,
  AZV_CONDITION_TYPES,
  type AZVPack,
  type AZVCard,
  type AZVCardFields,
  type AZVCardType,
  type AZVWeaponType,
  type AZVCondition,
  type AZVConditionType,
} from "@/lib/azv-packs";
import {
  uploadAZVCardBackground,
  uploadAZVCardImage,
  validateAZVImageFile,
  AZV_IMAGE_ACCEPT,
} from "@/lib/azv-storage";
import { ensureJMFont, jmFontFamily } from "@/JMKit";
import {
  AZV_TYPE_SPEC,
  AZV_LAYOUT,
  overlayForCard,
  weaponIconPath,
  resolveAZVTextStyle,
} from "./azvCardSpec";
import { renderAZVCard, fitAZVTextSize, fitAZVBlockSize } from "./azvCardRenderer";
import type { AZVTextStyles } from "@/lib/azv-packs";
import AZVTextStyleModal from "./AZVTextStyleModal";

interface AZVPackBuilderProps {
  pack: AZVPack;
  onBack: () => void;
}

/** List label: title when set, else the type (+level). */
function cardListLabel(card: { cardType: AZVCardType; title: string; level?: number }): string {
  if (card.title.trim()) return card.title;
  const base = AZV_CARD_TYPE_LABELS[card.cardType];
  return card.level ? `${base} · L${card.level}` : base;
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-lime-400/40";
const labelClass = "text-xs font-bold uppercase tracking-wider text-white/40";

/**
 * AZV pack builder — left column is the card list (or, while creating /
 * editing, the card form in its place); right side is a live 900×1500 card
 * preview: the background image with the type/level overlay composited on
 * top. Text/stat placement on the preview comes later, type by type.
 */
export default function AZVPackBuilder({ pack, onBack }: AZVPackBuilderProps) {
  const { user } = useAuth();

  const [cards, setCards] = useState<AZVCard[]>([]);
  const [loading, setLoading] = useState(true);
  /** All saved style sets — cards point at one via styleSetId. */
  const [styleSets, setStyleSets] = useState<AZVStyleSet[]>([]);
  /** The open card's set pointer, and the working copy of that set's values
   * (drives preview + render; persisted by saving the SET, not the card). */
  const [styleSetId, setStyleSetId] = useState("");
  const [textStyles, setTextStyles] = useState<AZVTextStyles>({});
  const [styleModalOpen, setStyleModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listAZVStyleSets()
      .then((sets) => {
        if (!cancelled) setStyleSets(sets);
      })
      .catch((err) => console.error("[azv] loading style sets failed:", err));
    return () => {
      cancelled = true;
    };
  }, []);
  /** null = list mode; "new" or a card = form mode. */
  const [editing, setEditing] = useState<AZVCard | "new" | null>(null);

  // ── Form state ──────────────────────────────────────────────
  const [cardType, setCardType] = useState<AZVCardType>("Humans");
  const [title, setTitle] = useState("");
  const [weaponType, setWeaponType] = useState<AZVWeaponType | "">("");
  const [level, setLevel] = useState(1);
  const [hits, setHits] = useState("");
  const [hunger, setHunger] = useState("");
  const [hope, setHope] = useState("");
  const [conditions, setConditions] = useState<AZVCondition[]>([]);
  const [description, setDescription] = useState("");
  const [oneTimePower, setOneTimePower] = useState("");
  const [bgURL, setBgURL] = useState("");
  const [pendingBgPreview, setPendingBgPreview] = useState<string | null>(null);
  const pendingBgBlobRef = useRef<Blob | null>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Doc id fixed up-front so the background can upload before the doc exists. */
  const cardIdRef = useRef<string>("");

  /** Scale factor mapping the 900×1500 design space onto the preview box. */
  const previewBoxRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(0.4);
  useEffect(() => {
    const el = previewBoxRef.current;
    if (!el) return;
    const update = () => setPreviewScale(el.getBoundingClientRect().width / 900);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Title font size, fitted exactly like the final render. */
  const [titleFitSize, setTitleFitSize] = useState<number>(AZV_LAYOUT.title.maxFontSize);
  useEffect(() => {
    let cancelled = false;
    const style = resolveAZVTextStyle("title", textStyles);
    void ensureJMFont(style.font).then(() => {
      if (cancelled) return;
      setTitleFitSize(fitAZVTextSize(title, style, AZV_LAYOUT.title.w));
    });
    return () => {
      cancelled = true;
    };
  }, [title, textStyles]);

  /** Fitted (wrapped) size for the description block in the preview. */
  const [descFitSize, setDescFitSize] = useState<number>(32);
  useEffect(() => {
    let cancelled = false;
    const style = resolveAZVTextStyle("description", textStyles);
    void ensureJMFont(style.font).then(() => {
      if (cancelled) return;
      setDescFitSize(fitAZVBlockSize(description, style, AZV_LAYOUT.description));
    });
    return () => {
      cancelled = true;
    };
  }, [description, textStyles]);

  /** Fitted sizes for the two stat slots in the preview. */
  const [statFitSizes, setStatFitSizes] = useState({ hits: 90, hopeHunger: 90 });
  useEffect(() => {
    let cancelled = false;
    const style = resolveAZVTextStyle("numbers", textStyles);
    void ensureJMFont(style.font).then(() => {
      if (cancelled) return;
      const hitsN = parseInt(hits, 10);
      const hhRaw = AZV_TYPE_SPEC[cardType].fields.hope ? hope : hunger;
      const hhN = parseInt(hhRaw, 10);
      setStatFitSizes({
        hits: Number.isNaN(hitsN)
          ? style.size
          : fitAZVTextSize(String(hitsN), style, AZV_LAYOUT.hits.size),
        hopeHunger: Number.isNaN(hhN)
          ? style.size
          : fitAZVTextSize(String(hhN), style, AZV_LAYOUT.hopeHunger.size),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [textStyles, hits, hope, hunger, cardType]);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;
    void subscribeToAZVCards(pack.id, (next) => {
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
      if (pendingBgPreview) URL.revokeObjectURL(pendingBgPreview);
    };
  }, [pendingBgPreview]);

  const openForm = useCallback((card: AZVCard | "new") => {
    setEditing(card);
    setError(null);
    setConfirmingDelete(false);
    pendingBgBlobRef.current = null;
    setPendingBgPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    const pointer = card === "new" ? "" : (card.styleSetId ?? "");
    setStyleSetId(pointer);
    const set = pointer ? styleSets.find((x) => x.id === pointer) : undefined;
    setTextStyles(set ? (JSON.parse(JSON.stringify(set.styles)) as AZVTextStyles) : {});
    if (card === "new") {
      cardIdRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      setCardType("Humans");
      setTitle("");
      setWeaponType("");
      setLevel(1);
      setHits("");
      setHunger("");
      setHope("");
      setConditions([]);
      setDescription("");
      setOneTimePower("");
      setBgURL("");
    } else {
      cardIdRef.current = card.id;
      setCardType(card.cardType);
      setTitle(card.title);
      setWeaponType(card.weaponType ?? "");
      setLevel(card.level ?? 1);
      setHits(card.hits != null ? String(card.hits) : "");
      setHunger(card.hunger != null ? String(card.hunger) : "");
      setHope(card.hope != null ? String(card.hope) : "");
      setConditions(card.conditions ?? []);
      setDescription(card.description ?? "");
      setOneTimePower(card.oneTimePower ?? "");
      setBgURL(card.backgroundImageURL ?? "");
    }
  }, [styleSets]);

  const handleBgFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const invalid = validateAZVImageFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    pendingBgBlobRef.current = file;
    setPendingBgPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }, []);

  const spec = AZV_TYPE_SPEC[cardType];
  const parseNum = (v: string): number | undefined => {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? undefined : n;
  };

  const buildFields = useCallback(
    (finalBgURL: string): AZVCardFields => {
      const lvl = Math.min(5, Math.max(1, level));
      const hitsN = parseNum(hits);
      const hungerN = parseNum(hunger);
      const hopeN = parseNum(hope);
      return {
        cardType,
        title: title.trim(),
        ...(spec.fields.weaponType && weaponType ? { weaponType } : {}),
        ...(spec.fields.level ? { level: lvl } : {}),
        ...(spec.fields.hits && hitsN != null ? { hits: hitsN } : {}),
        ...(spec.fields.hunger && hungerN != null ? { hunger: hungerN } : {}),
        ...(spec.fields.hope && hopeN != null ? { hope: hopeN } : {}),
        ...(spec.fields.conditions && conditions.length ? { conditions } : {}),
        ...(spec.fields.description && description.trim()
          ? { description: description.trim() }
          : {}),
        ...(spec.fields.oneTimePower && oneTimePower.trim()
          ? { oneTimePower: oneTimePower.trim() }
          : {}),
        ...(styleSetId ? { styleSetId } : {}),
        ...(finalBgURL ? { backgroundImageURL: finalBgURL } : {}),
      };
    },
    [cardType, title, weaponType, level, hits, hunger, hope, conditions, description, oneTimePower, styleSetId, spec],
  );

  const handleSave = useCallback(async () => {
    if (!user || !editing) return;
    setSaving(true);
    setError(null);
    try {
      let finalBgURL = bgURL;
      if (pendingBgBlobRef.current) {
        finalBgURL = await uploadAZVCardBackground(cardIdRef.current, pendingBgBlobRef.current);
        setBgURL(finalBgURL);
        pendingBgBlobRef.current = null;
      }
      const fields = buildFields(finalBgURL);
      if (editing === "new") {
        await createAZVCard({ ...fields, packId: pack.id, id: cardIdRef.current }, user.uid);
      } else {
        await updateAZVCard(editing.id, fields);
      }
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save card.");
    } finally {
      setSaving(false);
    }
  }, [user, editing, bgURL, buildFields, pack.id]);

  /** Render the 900×1500 card (bg + overlay) and save its link on the card. */
  const handleGenerate = useCallback(async () => {
    if (!editing || editing === "new") return;
    setGenerating(true);
    setError(null);
    try {
      const hitsN = parseNum(hits);
      const hopeHungerN = parseNum(spec.fields.hope ? hope : hunger);
      const blob = await renderAZVCard({
        cardType,
        level,
        backgroundImageURL: pendingBgPreview ?? bgURL ?? undefined,
        title,
        ...(spec.fields.hits && hitsN != null ? { hits: hitsN } : {}),
        ...(hopeHungerN != null ? { hopeOrHunger: hopeHungerN } : {}),
        ...(spec.fields.weaponType && weaponType ? { weaponType } : {}),
        ...(spec.fields.description && description.trim() ? { description: description.trim() } : {}),
        textStyles,
      });
      const url = await uploadAZVCardImage(pack.id, `azv-${cardIdRef.current}`, blob);
      await setAZVCardImage(editing.id, url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Card generation failed.");
    } finally {
      setGenerating(false);
    }
  }, [editing, cardType, level, pendingBgPreview, bgURL, pack.id, title, hits, hope, hunger, weaponType, description, textStyles, spec]);

  const handleDelete = useCallback(async () => {
    if (!editing || editing === "new") return;
    try {
      await deleteAZVCard(editing.id);
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete card.");
    }
  }, [editing]);

  const previewBg = editing ? (pendingBgPreview ?? bgURL) : "";
  const previewOverlay = editing ? overlayForCard(cardType, level) : null;
  const previewHits = spec.fields.hits ? parseNum(hits) : undefined;
  const previewHopeHunger = parseNum(spec.fields.hope ? hope : spec.fields.hunger ? hunger : "");
  const previewWeapon = spec.fields.weaponType && weaponType ? weaponType : undefined;
  const titleStyle = resolveAZVTextStyle("title", textStyles);
  const numbersStyle = resolveAZVTextStyle("numbers", textStyles);
  const descStyle = resolveAZVTextStyle("description", textStyles);
  const previewDescription = spec.fields.description ? description.trim() : "";
  const styleColor = (c: "black" | "white") => (c === "black" ? "#000" : "#fff");
  const styleAlign = (a: "left" | "center" | "right") =>
    a === "left" ? "flex-start" : a === "right" ? "flex-end" : "center";
  const generatedURL = editing && editing !== "new" ? editing.cardImageURL : undefined;

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

        <h1 className="mb-6 text-2xl font-black uppercase tracking-wider text-lime-400">
          {pack.name}
        </h1>

        <div className="flex flex-col gap-6 lg:flex-row">
          {/* ── Left column: card list, or the create/edit form in its place ── */}
          <div className="w-full shrink-0 lg:w-105">
            {editing === null ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => openForm("new")}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime-500 py-3 text-sm font-bold text-black transition-all hover:scale-[1.01] active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                  Add Card
                </button>

                {loading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-white/30" />
                  </div>
                ) : cards.length === 0 ? (
                  <p className="py-8 text-center text-sm text-white/30">No cards yet.</p>
                ) : (
                  cards.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => openForm(card)}
                      className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2.5 text-left transition-colors hover:border-lime-400/30 hover:bg-white/10"
                    >
                      <div className="aspect-3/5 w-10 shrink-0 overflow-hidden rounded-md bg-neutral-800">
                        {card.backgroundImageURL ? (
                          /* eslint-disable-next-line @next/next/no-img-element -- Storage URL */
                          <img
                            src={card.backgroundImageURL}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-white">
                          {cardListLabel(card)}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-white/35">
                          {AZV_CARD_TYPE_LABELS[card.cardType]}
                          {card.level ? ` · L${card.level}` : ""}
                        </p>
                      </div>
                      {card.cardImageURL && (
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full bg-lime-400"
                          title="Card generated"
                        />
                      )}
                    </button>
                  ))
                )}
              </div>
            ) : (
              /* ── Card form (replaces the list) ── */
              <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black uppercase tracking-wider text-white/70">
                    {editing === "new" ? "New Card" : "Edit Card"}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Card type — drives which inputs show and which overlay applies */}
                <div className="space-y-1.5">
                  <label className={labelClass}>Card Type</label>
                  <select
                    value={cardType}
                    onChange={(e) => setCardType(e.target.value as AZVCardType)}
                    className="w-full rounded-lg border border-white/20 bg-neutral-800 px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-lime-400/50"
                  >
                    {AZV_CARD_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {AZV_CARD_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className={labelClass}>Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Card title…"
                    className={inputClass}
                  />
                </div>

                {spec.fields.level && (
                  <div className="space-y-1.5">
                    <label className={labelClass}>Level (1–5)</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      value={level}
                      onChange={(e) =>
                        setLevel(Math.min(5, Math.max(1, parseInt(e.target.value, 10) || 1)))
                      }
                      className={inputClass}
                    />
                  </div>
                )}

                {spec.fields.weaponType && (
                  <div className="space-y-1.5">
                    <label className={labelClass}>
                      Weapon Type{" "}
                      <span className="font-normal normal-case text-white/25">(optional)</span>
                    </label>
                    <select
                      value={weaponType}
                      onChange={(e) => setWeaponType(e.target.value as AZVWeaponType | "")}
                      className="w-full rounded-lg border border-white/20 bg-neutral-800 px-3 py-2.5 text-sm text-white outline-none focus:border-lime-400/50"
                    >
                      <option value="">None</option>
                      {AZV_WEAPON_TYPES.map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  {spec.fields.hits && (
                    <div className="space-y-1.5">
                      <label className={labelClass}>Hits</label>
                      <input
                        type="number"
                        value={hits}
                        onChange={(e) => setHits(e.target.value)}
                        placeholder="0"
                        className={inputClass}
                      />
                    </div>
                  )}
                  {spec.fields.hunger && (
                    <div className="space-y-1.5">
                      <label className={labelClass}>Hunger</label>
                      <input
                        type="number"
                        value={hunger}
                        onChange={(e) => setHunger(e.target.value)}
                        placeholder="0"
                        className={inputClass}
                      />
                    </div>
                  )}
                  {spec.fields.hope && (
                    <div className="space-y-1.5">
                      <label className={labelClass}>Hope</label>
                      <input
                        type="number"
                        value={hope}
                        onChange={(e) => setHope(e.target.value)}
                        placeholder="0"
                        className={inputClass}
                      />
                    </div>
                  )}
                </div>

                {spec.fields.conditions && (
                  <div className="space-y-1.5">
                    <label className={labelClass}>Conditions</label>
                    {conditions.map((c, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <select
                          value={c.condition}
                          onChange={(e) =>
                            setConditions((prev) =>
                              prev.map((x, j) =>
                                j === i
                                  ? { ...x, condition: e.target.value as AZVConditionType }
                                  : x,
                              ),
                            )
                          }
                          className="min-w-0 flex-1 rounded-lg border border-white/20 bg-neutral-800 px-2 py-2 text-xs text-white outline-none"
                        >
                          {AZV_CONDITION_TYPES.map((ct) => (
                            <option key={ct} value={ct}>
                              {ct}
                            </option>
                          ))}
                        </select>
                        <select
                          value={c.weapon}
                          onChange={(e) =>
                            setConditions((prev) =>
                              prev.map((x, j) =>
                                j === i ? { ...x, weapon: e.target.value as AZVWeaponType } : x,
                              ),
                            )
                          }
                          className="min-w-0 flex-1 rounded-lg border border-white/20 bg-neutral-800 px-2 py-2 text-xs text-white outline-none"
                        >
                          {AZV_WEAPON_TYPES.map((w) => (
                            <option key={w} value={w}>
                              {w}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={c.value}
                          onChange={(e) =>
                            setConditions((prev) =>
                              prev.map((x, j) =>
                                j === i ? { ...x, value: parseInt(e.target.value, 10) || 0 } : x,
                              ),
                            )
                          }
                          className="w-16 shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs text-white outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setConditions((prev) => prev.filter((_, j) => j !== i))}
                          className="shrink-0 rounded p-1 text-red-400/50 transition-colors hover:text-red-400"
                          aria-label="Remove condition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setConditions((prev) => [
                          ...prev,
                          { condition: "Weakness", weapon: "Slimy", value: 1 },
                        ])
                      }
                      className="flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-bold text-white/60 transition-colors hover:bg-white/10"
                    >
                      <Plus className="h-3 w-3" />
                      Add Condition
                    </button>
                  </div>
                )}

                {spec.fields.description && (
                  <div className="space-y-1.5">
                    <label className={labelClass}>Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className={`${inputClass} resize-y`}
                    />
                  </div>
                )}

                {spec.fields.oneTimePower && (
                  <div className="space-y-1.5">
                    <label className={labelClass}>One-Time Power</label>
                    <input
                      type="text"
                      value={oneTimePower}
                      onChange={(e) => setOneTimePower(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                )}

                {/* Background image (900×1500) */}
                <div className="space-y-1.5">
                  <label className={labelClass}>Background Image (900×1500)</label>
                  <input
                    ref={bgFileInputRef}
                    type="file"
                    accept={AZV_IMAGE_ACCEPT}
                    className="sr-only"
                    onChange={handleBgFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => bgFileInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 py-2.5 text-sm font-bold text-white/60 transition-colors hover:bg-white/10"
                  >
                    <Upload className="h-4 w-4" />
                    {previewBg ? "Replace background" : "Upload background"}
                  </button>
                </div>

                {error && <p className="text-center text-sm text-red-400">{error}</p>}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving}
                    className="flex-1 rounded-xl bg-lime-500 py-3 text-sm font-bold uppercase tracking-wider text-black transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    ) : editing === "new" ? (
                      "Add Card"
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleGenerate()}
                    disabled={generating || editing === "new"}
                    title={
                      editing === "new" ? "Save the card first" : "Render + save the 900×1500 card"
                    }
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-lime-400/30 bg-lime-400/10 px-4 py-3 text-sm font-bold text-lime-300 transition-colors hover:bg-lime-400/20 disabled:opacity-40"
                  >
                    {generating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4" />
                    )}
                    Generate
                  </button>
                </div>

                {generatedURL && (
                  <a
                    href={generatedURL}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-xs text-lime-300/80 underline-offset-2 hover:underline"
                  >
                    {generatedURL}
                  </a>
                )}

                {editing !== "new" && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmingDelete) void handleDelete();
                      else setConfirmingDelete(true);
                    }}
                    className={`flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-bold transition-colors ${
                      confirmingDelete
                        ? "border-red-500 bg-red-500/20 text-red-300"
                        : "border-white/10 text-red-400/60 hover:bg-red-500/10"
                    }`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {confirmingDelete ? "Tap again to delete this card" : "Delete Card"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Right: live 900×1500 preview (scaled to fit) ── */}
          <div className="min-w-0 flex-1">
            <div className="sticky top-6">
              <p className={`mb-2 ${labelClass}`}>Card Preview (900 × 1500)</p>
              {/* Exactly 3:5 — width-driven aspect box; the width cap encodes
                  the height budget (62vh × 3/5), so the ratio never distorts.
                  Generated output stays 900×1500 = 3"×5" at 300 DPI. */}
              <div
                ref={previewBoxRef}
                className="relative aspect-3/5 w-full overflow-hidden rounded-2xl border border-white/15 bg-neutral-900"
                style={{ maxWidth: "min(24rem, calc(62vh * 0.6))" }}
              >
                {editing === null ? (
                  <div className="flex h-full items-center justify-center px-8 text-center text-sm text-white/25">
                    Add a card or tap one in the list to see its preview.
                  </div>
                ) : (
                  /* 900×1500 design space, scaled to the box — positions and
                     font sizes below are the real card coordinates. */
                  <div
                    className="absolute top-0 left-0 origin-top-left"
                    style={{ width: 900, height: 1500, transform: `scale(${previewScale})` }}
                  >
                    {previewBg ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- Storage/blob URL */
                      <img
                        src={previewBg}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-4xl text-white/20">
                        No background yet
                      </div>
                    )}
                    {previewOverlay && (
                      /* eslint-disable-next-line @next/next/no-img-element -- local asset */
                      <img
                        src={previewOverlay}
                        alt=""
                        className="absolute inset-0 h-full w-full"
                      />
                    )}

                    {/* Title — transparent box, centered, fit ≤60px */}
                    {title.trim() && (
                      <div
                        className="absolute flex items-center whitespace-nowrap"
                        style={{
                          left: AZV_LAYOUT.title.x,
                          top: AZV_LAYOUT.title.y + titleStyle.offsetY,
                          width: AZV_LAYOUT.title.w,
                          height: AZV_LAYOUT.title.h,
                          justifyContent: styleAlign(titleStyle.align),
                          fontFamily: jmFontFamily(titleStyle.font),
                          fontSize: titleFitSize,
                          fontWeight: titleStyle.weight === "bold" ? 700 : 400,
                          color: styleColor(titleStyle.color),
                        }}
                      >
                        {title}
                      </div>
                    )}

                    {/* Description block */}
                    {previewDescription && (
                      <div
                        className="absolute flex items-center"
                        style={{
                          left: AZV_LAYOUT.description.x,
                          top: AZV_LAYOUT.description.y + descStyle.offsetY,
                          width: AZV_LAYOUT.description.w,
                          height: AZV_LAYOUT.description.h,
                          fontFamily: jmFontFamily(descStyle.font),
                          fontSize: descFitSize,
                          lineHeight: 1.2,
                          fontWeight: descStyle.weight === "bold" ? 700 : 400,
                          color: styleColor(descStyle.color),
                        }}
                      >
                        <div className="w-full" style={{ textAlign: descStyle.align }}>
                          {previewDescription}
                        </div>
                      </div>
                    )}

                    {/* Hits number (or weapon badge) at (212, 1000) */}
                    {previewHits != null && (
                      <div
                        className="absolute flex items-center"
                        style={{
                          left: AZV_LAYOUT.hits.cx - AZV_LAYOUT.hits.size / 2,
                          top: AZV_LAYOUT.hits.cy - AZV_LAYOUT.hits.size / 2 + numbersStyle.offsetY,
                          width: AZV_LAYOUT.hits.size,
                          height: AZV_LAYOUT.hits.size,
                          justifyContent: styleAlign(numbersStyle.align),
                          fontFamily: jmFontFamily(numbersStyle.font),
                          fontSize: statFitSizes.hits,
                          fontWeight: numbersStyle.weight === "bold" ? 700 : 400,
                          color: styleColor(numbersStyle.color),
                        }}
                      >
                        {previewHits}
                      </div>
                    )}
                    {previewWeapon && (
                      /* eslint-disable-next-line @next/next/no-img-element -- local asset */
                      <img
                        src={weaponIconPath(previewWeapon)}
                        alt={previewWeapon}
                        className="absolute"
                        style={{
                          left: AZV_LAYOUT.hits.cx - AZV_LAYOUT.hits.size / 2,
                          top: AZV_LAYOUT.hits.cy - AZV_LAYOUT.hits.size / 2,
                          width: AZV_LAYOUT.hits.size,
                          height: AZV_LAYOUT.hits.size,
                        }}
                      />
                    )}

                    {/* Hope / Hunger number at (684, 1000) */}
                    {previewHopeHunger != null && (
                      <div
                        className="absolute flex items-center"
                        style={{
                          left: AZV_LAYOUT.hopeHunger.cx - AZV_LAYOUT.hopeHunger.size / 2,
                          top: AZV_LAYOUT.hopeHunger.cy - AZV_LAYOUT.hopeHunger.size / 2 + numbersStyle.offsetY,
                          width: AZV_LAYOUT.hopeHunger.size,
                          height: AZV_LAYOUT.hopeHunger.size,
                          justifyContent: styleAlign(numbersStyle.align),
                          fontFamily: jmFontFamily(numbersStyle.font),
                          fontSize: statFitSizes.hopeHunger,
                          fontWeight: numbersStyle.weight === "bold" ? 700 : 400,
                          color: styleColor(numbersStyle.color),
                        }}
                      >
                        {previewHopeHunger}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Per-card text styling — the popup creates/edits sets; the
                  dropdown assigns a saved set without leaving the preview */}
              {editing !== null && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStyleModalOpen(true)}
                    className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold text-white/80 transition-colors hover:bg-white/10"
                  >
                    <Type className="h-4 w-4" />
                    Text Styles
                  </button>
                  <select
                    value={styleSetId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setStyleSetId(id);
                      const set = styleSets.find((x) => x.id === id);
                      setTextStyles(
                        set
                          ? (JSON.parse(JSON.stringify(set.styles)) as AZVTextStyles)
                          : {},
                      );
                    }}
                    className="rounded-xl border border-white/20 bg-neutral-800 px-3 py-2.5 text-sm text-white outline-none focus:border-lime-400/50"
                    title="Assign a saved style set to this card"
                  >
                    <option value="">No style set</option>
                    {styleSets.map((set) => (
                      <option key={set.id} value={set.id}>
                        {set.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AZVTextStyleModal
        isOpen={styleModalOpen}
        onClose={() => setStyleModalOpen(false)}
        styles={textStyles}
        onChange={setTextStyles}
        sets={styleSets}
        selectedSetId={styleSetId}
        onSelectSet={(id, styles) => {
          setStyleSetId(id);
          setTextStyles(styles);
        }}
        onSetSaved={(saved) => {
          setStyleSets((prev) => {
            const idx = prev.findIndex((x) => x.id === saved.id);
            const next = idx === -1 ? [...prev, saved] : prev.map((x) => (x.id === saved.id ? saved : x));
            return next.sort((a, b) => a.name.localeCompare(b.name));
          });
          setStyleSetId(saved.id);
        }}
      />
    </div>
  );
}
