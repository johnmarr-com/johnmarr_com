"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Loader2, RefreshCw, Save } from "lucide-react";
import { useJMStyle } from "@/JMStyle";
import { useAuth } from "@/lib/AuthProvider";
import {
  ALL_TRIVIA_GAMES,
  TRIVIA_GAME_DISPLAY_NAMES,
  TRIVIA_GAME_LISTS,
} from "@/lib/trivia/constants";
import type { TriviaGameId, TriviaListType } from "@/lib/trivia/types";

// ─── Local types (mirror server response shapes) ────────────

interface SubjectListItem {
  id: string;
  firestoreId: string;
  gameId: string;
  listType: string;
  popularityRank: number;
  name: string;
  creator: string | null;
  year: number | null;
  questionSetCount: number;
  approvedCount: number;
  pendingCount: number;
  flaggedCount: number;
  falsePendingCount: number;
}

interface QuestionSet {
  id: string;
  verifiedTruthAnchor: string | null;
  truthText: string | null;
  partiallyTrueText: string | null;
  falseText: string | null;
  reviewed: boolean;
  approved: boolean;
  rejectionReason: string | null;
  tags: { category: string; value: string }[];
}

interface SubjectDetail {
  id: string;
  firestoreId: string;
  gameId: string;
  listType: string;
  popularityRank: number;
  name: string;
  creator: string | null;
  year: number | null;
  genre: string | null;
  citationUrl: string | null;
  questionSets: QuestionSet[];
}

// ─── Auth header helper ─────────────────────────────────────

async function authHeaders(): Promise<HeadersInit> {
  const { getAuth } = await import("@/lib/auth");
  const auth = await getAuth();
  const user = auth.currentUser;
  if (!user) return { "Content-Type": "application/json" };
  const token = await user.getIdToken();
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

// ─── Panel ───────────────────────────────────────────────────

type ReviewSubTab = "all" | "pending";

export function AdminTriviaReviewPanel() {
  const { theme } = useJMStyle();
  const { user } = useAuth();
  const [subTab, setSubTab] = useState<ReviewSubTab>("all");
  const [gameId, setGameId] = useState<TriviaGameId | "">("");
  const [listType, setListType] = useState<TriviaListType | "">("");
  const [subjects, setSubjects] = useState<SubjectListItem[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const lists = gameId ? TRIVIA_GAME_LISTS[gameId] ?? [] : [];

  const visibleSubjects = useMemo(
    () => (subTab === "pending" ? subjects.filter((s) => s.falsePendingCount > 0) : subjects),
    [subjects, subTab],
  );

  const handleGame = (id: TriviaGameId | "") => {
    setGameId(id);
    setSelectedId(null);
    if (id) {
      const first = TRIVIA_GAME_LISTS[id]?.[0];
      setListType(first?.id ?? "");
    } else {
      setListType("");
    }
  };

  const loadSubjects = useCallback(async () => {
    if (!user || !gameId || !listType) {
      setSubjects([]);
      return;
    }
    setLoadingSubjects(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(
        `/api/admin/trivia-review/subjects?gameId=${gameId}&listType=${listType}`,
        { headers },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { subjects: SubjectListItem[] };
      setSubjects(data.subjects);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load subjects");
    } finally {
      setLoadingSubjects(false);
    }
  }, [user, gameId, listType]);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  return (
    <div
      className="mt-6 opacity-0 animate-fade-in-up animation-delay-400 rounded-2xl border backdrop-blur-md"
      style={{
        backgroundColor: `${theme.surfaces.base}ee`,
        borderColor: theme.surfaces.elevated2,
      }}
    >
      {/* Header */}
      <div
        className="px-8 py-6"
        style={{ borderBottom: `1px solid ${theme.surfaces.elevated2}` }}
      >
        <h2 className="text-lg font-semibold" style={{ color: theme.text.primary }}>
          Trivia Review
        </h2>
        <p className="text-sm mt-1" style={{ color: theme.text.tertiary }}>
          Edit and approve generated T / PT / F question sets
        </p>

        {/* Sub-tabs */}
        <div className="flex gap-1 mt-4">
          {(["all", "pending"] as ReviewSubTab[]).map((id) => {
            const active = subTab === id;
            const pendingTotal = subjects.reduce((s, x) => s + x.falsePendingCount, 0);
            return (
              <button
                key={id}
                onClick={() => {
                  setSubTab(id);
                  setSelectedId(null);
                }}
                className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize flex items-center gap-2"
                style={{
                  backgroundColor: active ? theme.surfaces.elevated1 : "transparent",
                  color: active ? theme.accents.goldenGlow : theme.text.secondary,
                  border: `1px solid ${active ? theme.surfaces.elevated2 : "transparent"}`,
                }}
              >
                {id}
                {id === "pending" && pendingTotal > 0 && (
                  <span
                    className="inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums"
                    style={{
                      backgroundColor: "#F97316",
                      color: theme.surfaces.base,
                      minWidth: "18px",
                    }}
                  >
                    {pendingTotal}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <select
            value={gameId}
            onChange={(e) => handleGame(e.target.value as TriviaGameId | "")}
            className="px-4 py-2 rounded-lg outline-none text-sm"
            style={{
              backgroundColor: theme.surfaces.base,
              color: theme.text.primary,
              border: `1px solid ${theme.surfaces.elevated2}`,
              minWidth: "180px",
            }}
          >
            <option value="">Select a trivia game</option>
            {ALL_TRIVIA_GAMES.map((id) => (
              <option key={id} value={id}>
                {TRIVIA_GAME_DISPLAY_NAMES[id]}
              </option>
            ))}
          </select>
          <select
            value={listType}
            onChange={(e) => {
              setListType(e.target.value as TriviaListType | "");
              setSelectedId(null);
            }}
            disabled={!gameId}
            className="px-4 py-2 rounded-lg outline-none text-sm disabled:opacity-50"
            style={{
              backgroundColor: theme.surfaces.base,
              color: theme.text.primary,
              border: `1px solid ${theme.surfaces.elevated2}`,
              minWidth: "180px",
            }}
          >
            <option value="">{gameId ? "Select a list" : "Pick a game first"}</option>
            {lists.map((cfg) => (
              <option key={cfg.id} value={cfg.id}>
                {cfg.label}
              </option>
            ))}
          </select>
          <button
            onClick={loadSubjects}
            disabled={!gameId || !listType || loadingSubjects}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-40"
            style={{ color: theme.text.secondary, border: `1px solid ${theme.surfaces.elevated2}` }}
            title="Refresh"
          >
            <RefreshCw size={14} className={loadingSubjects ? "animate-spin" : ""} />
            Refresh
          </button>
          {gameId && listType && (
            <span className="text-sm tabular-nums" style={{ color: theme.text.tertiary }}>
              {loadingSubjects ? "loading…" : `${visibleSubjects.length} subject${visibleSubjects.length === 1 ? "" : "s"}`}
            </span>
          )}
        </div>
        {error && (
          <p className="mt-3 text-sm" style={{ color: "#EF4444" }}>
            {error}
          </p>
        )}
      </div>

      {/* Body */}
      <div className="grid md:grid-cols-[280px_1fr] gap-0">
        <SubjectListSidebar
          subjects={visibleSubjects}
          selectedId={selectedId}
          onSelect={setSelectedId}
          showPendingBadge={subTab === "pending"}
        />
        <SubjectDetailPane
          subjectId={selectedId}
          pendingOnly={subTab === "pending"}
          onChanged={loadSubjects}
        />
      </div>
    </div>
  );
}

// ─── Subject list sidebar ───────────────────────────────────

function SubjectListSidebar({
  subjects,
  selectedId,
  onSelect,
  showPendingBadge = false,
}: {
  subjects: SubjectListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  showPendingBadge?: boolean;
}) {
  const { theme } = useJMStyle();
  return (
    <div
      className="max-h-[80vh] overflow-y-auto"
      style={{
        borderRight: `1px solid ${theme.surfaces.elevated2}`,
        backgroundColor: theme.surfaces.elevated1,
      }}
    >
      {subjects.length === 0 ? (
        <p className="p-5 text-sm" style={{ color: theme.text.tertiary }}>
          {showPendingBadge
            ? "No subjects with pending F's for this game/list."
            : "Pick a game and list above. Subjects appear here once research has run."}
        </p>
      ) : (
        <ul>
          {subjects.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => onSelect(s.id)}
                className="w-full text-left px-4 py-3 transition-colors"
                style={{
                  backgroundColor:
                    selectedId === s.id ? theme.surfaces.elevated2 : "transparent",
                  borderBottom: `1px solid ${theme.surfaces.elevated2}`,
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="text-xs font-mono tabular-nums shrink-0"
                    style={{ color: theme.text.tertiary }}
                  >
                    #{s.popularityRank}
                  </span>
                  <span
                    className="text-sm font-medium truncate"
                    style={{ color: theme.text.primary }}
                  >
                    {s.name}
                  </span>
                  {showPendingBadge ? (
                    <span
                      className="ml-auto shrink-0 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums"
                      style={{
                        backgroundColor: "#F97316",
                        color: theme.surfaces.base,
                        minWidth: "22px",
                      }}
                    >
                      {s.falsePendingCount}
                    </span>
                  ) : (
                    <ChevronRight size={14} className="ml-auto shrink-0" style={{ color: theme.text.tertiary }} />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 text-[11px] tabular-nums" style={{ color: theme.text.tertiary }}>
                  <span>{s.questionSetCount} triple{s.questionSetCount === 1 ? "" : "s"}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Subject detail pane ───────────────────────────────────

function SubjectDetailPane({
  subjectId,
  pendingOnly = false,
  onChanged,
}: {
  subjectId: string | null;
  pendingOnly?: boolean;
  onChanged: () => void;
}) {
  const { theme } = useJMStyle();
  const { user } = useAuth();
  const [detail, setDetail] = useState<SubjectDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !subjectId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/admin/trivia-review/subjects/${subjectId}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDetail((await res.json()) as SubjectDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [user, subjectId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!subjectId) {
    return (
      <div className="p-8" style={{ color: theme.text.tertiary }}>
        Select a subject to review its question sets.
      </div>
    );
  }

  if (loading || !detail) {
    return (
      <div className="p-8 flex items-center gap-2 text-sm" style={{ color: theme.text.tertiary }}>
        <Loader2 size={14} className="animate-spin" />
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-sm" style={{ color: "#EF4444" }}>
        {error}
      </div>
    );
  }

  const visibleSets = pendingOnly
    ? detail.questionSets.filter((qs) => qs.falseText === "pending")
    : detail.questionSets;

  return (
    <div className="max-h-[80vh] overflow-y-auto">
      <SubjectHeader detail={detail} />
      <div className="p-5 space-y-5">
        {visibleSets.length === 0 ? (
          <p className="text-sm" style={{ color: theme.text.tertiary }}>
            {pendingOnly ? "No pending F's remain for this subject." : "No question sets generated yet."}
          </p>
        ) : (
          visibleSets.map((qs, i) => (
            <QuestionSetCard
              key={qs.id}
              index={i + 1}
              total={visibleSets.length}
              qs={qs}
              pendingOnly={pendingOnly}
              onAfterChange={() => {
                load();
                onChanged();
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

function SubjectHeader({ detail }: { detail: SubjectDetail }) {
  const { theme } = useJMStyle();
  return (
    <div
      className="px-5 py-4"
      style={{ borderBottom: `1px solid ${theme.surfaces.elevated2}` }}
    >
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-xs font-mono tabular-nums" style={{ color: theme.text.tertiary }}>
          #{detail.popularityRank}
        </span>
        <h3 className="text-xl font-semibold" style={{ color: theme.text.primary }}>
          {detail.name}
        </h3>
        {detail.creator && (
          <span className="text-sm" style={{ color: theme.text.secondary }}>
            — {detail.creator}
          </span>
        )}
        {detail.year && (
          <span className="text-sm tabular-nums" style={{ color: theme.text.tertiary }}>
            ({detail.year})
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2 mt-2 text-xs" style={{ color: theme.text.tertiary }}>
        <span>
          {detail.gameId} · {detail.listType}
        </span>
        {detail.genre && <span>· {detail.genre}</span>}
        {detail.citationUrl && (
          <a
            href={detail.citationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
            style={{ color: theme.accents.goldenGlow }}
          >
            Source ↗
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Question set card (editable + actions) ────────────────

function QuestionSetCard({
  index,
  total,
  qs,
  pendingOnly = false,
  onAfterChange,
}: {
  index: number;
  total: number;
  qs: QuestionSet;
  pendingOnly?: boolean;
  onAfterChange: () => void;
}) {
  const { theme } = useJMStyle();
  const [truth, setTruth] = useState(qs.truthText ?? "");
  const [pt, setPt] = useState(qs.partiallyTrueText ?? "");
  // In pending mode, blank the placeholder so the textarea starts empty.
  const [fls, setFls] = useState(
    pendingOnly && qs.falseText === "pending" ? "" : qs.falseText ?? "",
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const dirty = useMemo(
    () =>
      truth !== (qs.truthText ?? "") ||
      pt !== (qs.partiallyTrueText ?? "") ||
      fls !== (qs.falseText ?? ""),
    [truth, pt, fls, qs],
  );

  const save = async () => {
    setBusy("save");
    setSaveMsg(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/admin/trivia-review/question-sets/${qs.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          truthText: truth,
          partiallyTrueText: pt,
          falseText: fls,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaveMsg("saved");
      onAfterChange();
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "save failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{
        backgroundColor: theme.surfaces.elevated1,
        borderColor: theme.surfaces.elevated2,
      }}
    >
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs" style={{ color: theme.text.tertiary }}>
          Triple {index} / {total}
        </div>
        <div className="flex flex-wrap gap-1">
          {qs.tags.map((t) => (
            <span
              key={`${t.category}__${t.value}`}
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px]"
              style={{
                backgroundColor: theme.surfaces.base,
                color: theme.text.secondary,
                border: `1px solid ${theme.surfaces.elevated2}`,
              }}
            >
              {t.category}:{t.value}
            </span>
          ))}
        </div>
      </div>

      {/* Anchor (read-only context) */}
      {qs.verifiedTruthAnchor && (
        <div
          className="rounded-lg p-2 text-[11px] italic"
          style={{ backgroundColor: theme.surfaces.base, color: theme.text.tertiary }}
        >
          anchor: {qs.verifiedTruthAnchor}
        </div>
      )}

      {/* T / PT / F editors */}
      <EditableField
        label="T  Truth"
        labelColor={theme.accents.goldenGlow}
        value={truth}
        onChange={setTruth}
        readOnly={pendingOnly}
      />
      <EditableField
        label="PT  Partially True"
        labelColor="#60A5FA"
        value={pt}
        onChange={setPt}
        readOnly={pendingOnly}
      />
      <EditableField
        label="F  False"
        labelColor="#F472B6"
        value={fls}
        onChange={setFls}
        {...(pendingOnly ? { placeholder: "Write the F line for this slot…" } : {})}
      />

      {/* Actions — Save only. Spot-checks correct via edit; in-game flagging handles bad questions. */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          onClick={save}
          disabled={!dirty || busy !== null}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-40"
          style={{
            backgroundColor: dirty ? theme.accents.goldenGlow : theme.surfaces.base,
            color: dirty ? theme.surfaces.base : theme.text.primary,
            border: `1px solid ${theme.surfaces.elevated2}`,
          }}
        >
          <Save size={13} /> {dirty ? "Save changes" : "Saved"}
        </button>
        {busy && (
          <span className="flex items-center gap-1 text-xs" style={{ color: theme.text.tertiary }}>
            <Loader2 size={12} className="animate-spin" /> {busy}…
          </span>
        )}
        {saveMsg && (
          <span
            className="text-xs"
            style={{ color: saveMsg === "saved" ? "#22C55E" : "#EF4444" }}
          >
            {saveMsg}
          </span>
        )}
      </div>
    </div>
  );
}

function EditableField({
  label,
  labelColor,
  value,
  onChange,
  readOnly = false,
  placeholder,
  secondaryLabel,
  secondaryValue,
  onSecondaryChange,
}: {
  label: string;
  labelColor: string;
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  secondaryLabel?: string;
  secondaryValue?: string;
  onSecondaryChange?: (v: string) => void;
}) {
  const { theme } = useJMStyle();
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-grow to fit all content — no scrolling, no manual drag.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <div>
      <label
        className="block text-[11px] font-semibold uppercase tracking-wide mb-1"
        style={{ color: labelColor }}
      >
        {label}
      </label>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg outline-none text-sm overflow-hidden"
        style={{
          backgroundColor: readOnly ? theme.surfaces.elevated1 : theme.surfaces.base,
          color: readOnly ? theme.text.secondary : theme.text.primary,
          border: `1px solid ${theme.surfaces.elevated2}`,
          resize: "none",
        }}
      />
      {secondaryLabel && onSecondaryChange && (
        <div className="mt-1">
          <label
            className="block text-[10px] uppercase tracking-wide mb-1"
            style={{ color: theme.text.tertiary }}
          >
            {secondaryLabel}
          </label>
          <input
            type="text"
            value={secondaryValue ?? ""}
            onChange={(e) => onSecondaryChange(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg outline-none text-xs"
            style={{
              backgroundColor: theme.surfaces.base,
              color: theme.text.secondary,
              border: `1px solid ${theme.surfaces.elevated2}`,
            }}
          />
        </div>
      )}
    </div>
  );
}
