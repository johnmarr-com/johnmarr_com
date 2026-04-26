"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Pause, Play, RotateCcw } from "lucide-react";
import { useJMStyle } from "@/JMStyle";
import { useAuth } from "@/lib/AuthProvider";
import {
  ALL_TRIVIA_GAMES,
  TRIVIA_GAME_COLORS,
  TRIVIA_GAME_DISPLAY_NAMES,
  TRIVIA_GAME_LISTS,
  compositeKey,
  getDefaultUrl,
  listConfig,
  listLabel,
} from "@/lib/trivia/constants";
import {
  type TriviaActivityEntry,
  type TriviaAgentStatus,
  type TriviaCitation,
  type TriviaContentTier,
  type TriviaGameId,
  type TriviaListType,
  type TriviaResearchBatchResult,
  TRIVIA_TARGET_COUNT,
} from "@/lib/trivia/types";

// ─── Local types ─────────────────────────────────────────────

type AgentTab = "trivia"; // future: "mysteries" | "content"

interface CountState {
  totalFound: number;
  status: TriviaAgentStatus;
}

interface TagRow {
  category: string;
  value: string;
  count: number;
}

interface LogLine extends TriviaActivityEntry {
  id: string;
  ts: number;
}

interface GameListPair {
  gameId: TriviaGameId;
  listType: TriviaListType;
}

// All (game, list) pairs the registry knows about, in display order.
const ALL_PAIRS: GameListPair[] = ALL_TRIVIA_GAMES.flatMap((gameId) =>
  (TRIVIA_GAME_LISTS[gameId] ?? []).map((cfg) => ({ gameId, listType: cfg.id })),
);

// ─── Panel ───────────────────────────────────────────────────

export function AdminAgentsPanel() {
  const { theme } = useJMStyle();
  const [activeTab] = useState<AgentTab>("trivia");

  return (
    <div
      className="mt-6 opacity-0 animate-fade-in-up animation-delay-400 rounded-2xl border backdrop-blur-md"
      style={{
        backgroundColor: `${theme.surfaces.base}ee`,
        borderColor: theme.surfaces.elevated2,
      }}
    >
      <div
        className="px-8 py-6"
        style={{ borderBottom: `1px solid ${theme.surfaces.elevated2}` }}
      >
        <h2 className="text-lg font-semibold" style={{ color: theme.text.primary }}>
          AI Agents
        </h2>
        <p className="text-sm mt-1" style={{ color: theme.text.tertiary }}>
          Autonomous content workers
        </p>
        <div className="flex gap-1 mt-4">
          {(["trivia"] as AgentTab[]).map((tab) => (
            <button
              key={tab}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: activeTab === tab ? theme.surfaces.elevated1 : "transparent",
                color: activeTab === tab ? theme.accents.goldenGlow : theme.text.secondary,
                border: `1px solid ${activeTab === tab ? theme.surfaces.elevated2 : "transparent"}`,
              }}
            >
              Trivia
            </button>
          ))}
        </div>
      </div>

      <div className="p-8">{activeTab === "trivia" && <TriviaTab />}</div>
    </div>
  );
}

// ─── Trivia tab ──────────────────────────────────────────────

function TriviaTab() {
  const { theme } = useJMStyle();
  const counts = useTriviaCounts();
  const tags = useTriviaTags();

  return (
    <div className="space-y-6">
      <DashboardGrid counts={counts} />
      <TagsPanel tags={tags} />
      <AgentAssignment />
      <ContentBrowser />
      <p className="text-xs" style={{ color: theme.text.tertiary }}>
        Subjects → <code>trivia-content</code>. Tags → <code>trivia-tags</code>. Source list cache →{" "}
        <code>trivia-source-cache</code>. Progress → <code>trivia-agent-state</code>.
      </p>
    </div>
  );
}

// ─── Dashboard grid ──────────────────────────────────────────

function DashboardGrid({
  counts,
}: {
  counts: Record<string, CountState>;
}) {
  const { theme } = useJMStyle();
  return (
    <div
      className="rounded-xl border"
      style={{
        backgroundColor: theme.surfaces.elevated1,
        borderColor: theme.surfaces.elevated2,
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-3">
        {ALL_PAIRS.map((pair) => {
          const key = compositeKey(pair.gameId, pair.listType);
          const c = counts[key] ?? { totalFound: 0, status: "idle" as const };
          return (
            <DashboardCell
              key={key}
              gameId={pair.gameId}
              listType={pair.listType}
              count={c.totalFound}
              status={c.status}
            />
          );
        })}
      </div>
    </div>
  );
}

function DashboardCell({
  gameId,
  listType,
  count,
  status,
}: {
  gameId: TriviaGameId;
  listType: TriviaListType;
  count: number;
  status: TriviaAgentStatus;
}) {
  const { theme } = useJMStyle();
  const dotColor = TRIVIA_GAME_COLORS[gameId];
  const cfg = listConfig(gameId, listType);

  const countColor =
    count >= TRIVIA_TARGET_COUNT
      ? "#22C55E"
      : count >= 300
      ? "#60A5FA"
      : count >= 100
      ? "#EAB308"
      : count > 0
      ? "#F97316"
      : theme.text.tertiary;

  return (
    <div
      className="flex items-center justify-between rounded-lg px-3 py-2 min-h-[44px]"
      style={{
        backgroundColor: theme.surfaces.base,
        border: `1px solid ${theme.surfaces.elevated2}`,
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: dotColor }}
        />
        <div className="flex flex-col min-w-0">
          <span
            className="text-sm font-medium truncate"
            style={{ color: theme.text.primary }}
          >
            {TRIVIA_GAME_DISPLAY_NAMES[gameId]}
          </span>
          <span className="text-[10px] truncate" style={{ color: theme.text.tertiary }}>
            {cfg?.label ?? listType}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {status === "running" && (
          <Loader2 size={12} className="animate-spin" style={{ color: theme.accents.goldenGlow }} />
        )}
        <span className="text-sm tabular-nums" style={{ color: countColor }}>
          {count}
        </span>
        <span className="text-xs" style={{ color: theme.text.tertiary }}>
          / {TRIVIA_TARGET_COUNT}
        </span>
      </div>
    </div>
  );
}

// ─── Tags panel ──────────────────────────────────────────────

function TagsPanel({ tags }: { tags: TagRow[] }) {
  const { theme } = useJMStyle();
  const [expanded, setExpanded] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, TagRow[]>();
    for (const t of tags) {
      const existing = map.get(t.category) ?? [];
      existing.push(t);
      map.set(t.category, existing);
    }
    for (const arr of map.values()) arr.sort((a, b) => b.count - a.count);
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [tags]);

  const totalCategories = grouped.length;
  const totalTags = tags.length;

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        backgroundColor: theme.surfaces.elevated1,
        borderColor: theme.surfaces.elevated2,
      }}
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-white/5"
      >
        {expanded ? (
          <ChevronDown size={16} style={{ color: theme.text.tertiary }} />
        ) : (
          <ChevronRight size={16} style={{ color: theme.text.tertiary }} />
        )}
        <span className="text-sm font-medium" style={{ color: theme.text.primary }}>
          Tags
        </span>
        <span className="text-xs" style={{ color: theme.text.tertiary }}>
          ({totalTags} tag{totalTags === 1 ? "" : "s"} across {totalCategories} categor
          {totalCategories === 1 ? "y" : "ies"})
        </span>
      </button>

      {expanded && (
        <div
          className="px-4 pb-4 space-y-3"
          style={{ borderTop: `1px solid ${theme.surfaces.elevated2}` }}
        >
          {grouped.length === 0 ? (
            <p className="pt-3 text-sm" style={{ color: theme.text.tertiary }}>
              No tags yet. The agent will create them as it enriches subjects.
            </p>
          ) : (
            grouped.map(([category, rows]) => (
              <div key={category} className="pt-3">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: theme.text.secondary }}
                  >
                    {category}
                  </span>
                  <span className="text-xs" style={{ color: theme.text.tertiary }}>
                    ({rows.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {rows.map((row) => (
                    <span
                      key={`${category}__${row.value}`}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
                      style={{
                        backgroundColor: theme.surfaces.base,
                        border: `1px solid ${theme.surfaces.elevated2}`,
                        color: theme.text.primary,
                      }}
                    >
                      {row.value}
                      <span className="text-[10px] tabular-nums" style={{ color: theme.text.tertiary }}>
                        {row.count}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Agent assignment + run ─────────────────────────────────

function AgentAssignment() {
  const { theme } = useJMStyle();
  const [gameId, setGameId] = useState<TriviaGameId | "">("");
  const [list, setList] = useState<TriviaListType | "">("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [pastedJson, setPastedJson] = useState("");
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const stopRequested = useRef(false);
  const logScrollRef = useRef<HTMLDivElement>(null);

  const lists = gameId ? TRIVIA_GAME_LISTS[gameId] ?? [] : [];

  const handleGameChange = (id: TriviaGameId | "") => {
    setGameId(id);
    setPastedJson("");
    if (id) {
      const first = TRIVIA_GAME_LISTS[id]?.[0];
      const firstId = first?.id ?? "";
      setList(firstId);
      setSourceUrl(firstId ? getDefaultUrl(id, firstId) : "");
    } else {
      setList("");
      setSourceUrl("");
    }
  };

  const handleListChange = (l: TriviaListType | "") => {
    setList(l);
    setPastedJson("");
    if (gameId && l) setSourceUrl(getDefaultUrl(gameId, l));
    else setSourceUrl("");
  };

  const appendLog = useCallback((entries: TriviaActivityEntry[]) => {
    setLog((prev) => {
      const ts = Date.now();
      const lines: LogLine[] = entries.map((e, i) => ({
        ...e,
        ts: ts + i,
        id: `${ts}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      }));
      return [...prev, ...lines].slice(-300);
    });
  }, []);

  useEffect(() => {
    if (logScrollRef.current) logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
  }, [log]);

  const stop = () => {
    stopRequested.current = true;
    abortRef.current?.abort();
  };

  const run = async (resetFirst: boolean) => {
    if (!gameId || !list || running) return;
    stopRequested.current = false;
    setRunning(true);
    appendLog([
      {
        type: "info",
        message: resetFirst
          ? `Resetting ${TRIVIA_GAME_DISPLAY_NAMES[gameId]} · ${listLabel(gameId, list)} and starting fresh…`
          : `Starting ${TRIVIA_GAME_DISPLAY_NAMES[gameId]} · ${listLabel(gameId, list)}…`,
      },
      {
        type: "info",
        message:
          "First run: fetching source URL + Claude normalizing the JSON (~30-60s). Subsequent runs use the cache and are instant.",
      },
    ]);

    try {
      const { getAuth } = await import("@/lib/auth");
      const auth = await getAuth();
      let resetThisCall = resetFirst;

      while (!stopRequested.current) {
        const user = auth.currentUser;
        if (!user) {
          appendLog([{ type: "error", message: "Not signed in." }]);
          break;
        }
        const idToken = await user.getIdToken();

        const ac = new AbortController();
        abortRef.current = ac;

        let res: Response;
        try {
          res = await fetch("/api/admin/trivia-research", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({
              gameId,
              listType: list,
              sourceUrl: sourceUrl.trim() || undefined,
              pastedJson: pastedJson.trim() || undefined,
              reset: resetThisCall,
            }),
            signal: ac.signal,
          });
        } catch (fetchErr) {
          if ((fetchErr as { name?: string })?.name === "AbortError") {
            // user-initiated stop; loop check below will exit
            break;
          }
          throw fetchErr;
        } finally {
          abortRef.current = null;
        }

        resetThisCall = false;

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          const msg =
            (errBody as { details?: string }).details ||
            (errBody as { error?: string }).error ||
            `HTTP ${res.status}`;
          appendLog([{ type: "error", message: msg }]);
          break;
        }

        const data = (await res.json()) as TriviaResearchBatchResult;
        appendLog(data.log);

        if (data.done) break;
        if (data.added === 0 && data.skipped === 0) {
          appendLog([{ type: "error", message: "Empty batch — pausing to avoid a tight loop." }]);
          break;
        }
        // breath
        await new Promise((r) => setTimeout(r, 800));
      }

      if (stopRequested.current) appendLog([{ type: "info", message: "Paused by user." }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      appendLog([{ type: "error", message: msg }]);
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const canRun = !!gameId && !!list && !running;

  return (
    <div
      className="rounded-xl border"
      style={{
        backgroundColor: theme.surfaces.elevated1,
        borderColor: theme.surfaces.elevated2,
      }}
    >
      <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: theme.text.secondary }}>
            Game *
          </label>
          <select
            value={gameId}
            onChange={(e) => handleGameChange(e.target.value as TriviaGameId | "")}
            disabled={running}
            className="w-full px-4 py-3 rounded-lg outline-none transition-colors disabled:opacity-50"
            style={{
              backgroundColor: theme.surfaces.base,
              color: theme.text.primary,
              border: `1px solid ${theme.surfaces.elevated2}`,
            }}
          >
            <option value="">Select a trivia game</option>
            {ALL_TRIVIA_GAMES.map((id) => (
              <option key={id} value={id}>
                {TRIVIA_GAME_DISPLAY_NAMES[id]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: theme.text.secondary }}>
            List *
          </label>
          <select
            value={list}
            onChange={(e) => handleListChange(e.target.value as TriviaListType | "")}
            disabled={running || !gameId}
            className="w-full px-4 py-3 rounded-lg outline-none transition-colors disabled:opacity-50"
            style={{
              backgroundColor: theme.surfaces.base,
              color: theme.text.primary,
              border: `1px solid ${theme.surfaces.elevated2}`,
            }}
          >
            <option value="">{gameId ? "Select a list" : "Pick a game first"}</option>
            {lists.map((cfg) => (
              <option key={cfg.id} value={cfg.id}>
                {cfg.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: theme.text.secondary }}>
            Source URL {pastedJson.trim() ? "" : "*"}
          </label>
          <input
            type="text"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="Auto-fills from selected list"
            disabled={running || !!pastedJson.trim()}
            className="w-full px-4 py-3 rounded-lg outline-none transition-colors disabled:opacity-50"
            style={{
              backgroundColor: theme.surfaces.base,
              color: theme.text.primary,
              border: `1px solid ${theme.surfaces.elevated2}`,
            }}
          />
        </div>
      </div>

      {/* Paste JSON — overrides Source URL when filled. */}
      <div className="px-5 pb-4">
        <label className="block text-sm font-medium mb-2" style={{ color: theme.text.secondary }}>
          Or paste JSON directly
          <span className="ml-2 text-xs" style={{ color: theme.text.tertiary }}>
            (overrides Source URL — useful when you have a Claude Max output and no host)
          </span>
        </label>
        <textarea
          value={pastedJson}
          onChange={(e) => setPastedJson(e.target.value)}
          placeholder={'[{"rank":1,"name":"Subject","creator":"…","year":1969,"genre":"…","citationUrl":"https://en.wikipedia.org/wiki/…"}, …]'}
          disabled={running}
          rows={6}
          className="w-full px-4 py-3 rounded-lg outline-none transition-colors disabled:opacity-50 font-mono text-xs"
          style={{
            backgroundColor: theme.surfaces.base,
            color: theme.text.primary,
            border: `1px solid ${theme.surfaces.elevated2}`,
          }}
        />
        {pastedJson.trim() && (
          <div className="mt-1 flex items-center gap-2 text-xs" style={{ color: theme.text.tertiary }}>
            <span>{(new Blob([pastedJson]).size / 1024).toFixed(1)} KB pasted — Source URL ignored.</span>
            <button
              onClick={() => setPastedJson("")}
              disabled={running}
              className="underline hover:text-white disabled:opacity-50"
              style={{ color: theme.text.secondary }}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <div
        className="px-5 py-4 flex flex-wrap items-center gap-3"
        style={{ borderTop: `1px solid ${theme.surfaces.elevated2}` }}
      >
        {!running ? (
          <>
            <button
              onClick={() => run(false)}
              disabled={!canRun}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: theme.accents.goldenGlow, color: theme.surfaces.base }}
            >
              <Play size={16} fill="currentColor" />
              Run Agent
            </button>
            <button
              onClick={() => run(true)}
              disabled={!canRun}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ color: theme.text.secondary, border: `1px solid ${theme.surfaces.elevated2}` }}
              title="Reset agent state and start from scratch"
            >
              <RotateCcw size={14} />
              Reset & Run
            </button>
          </>
        ) : (
          <button
            onClick={stop}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors"
            style={{ backgroundColor: "#EF4444", color: "white" }}
          >
            <Pause size={16} fill="currentColor" />
            Pause
          </button>
        )}

        {running && (
          <span className="text-sm flex items-center gap-2" style={{ color: theme.text.tertiary }}>
            <Loader2 size={14} className="animate-spin" />
            Running…
          </span>
        )}
      </div>

      <div
        className="mx-5 mb-5 rounded-lg overflow-hidden"
        style={{ backgroundColor: theme.surfaces.base, border: `1px solid ${theme.surfaces.elevated2}` }}
      >
        <div
          className="px-4 py-2 text-xs font-semibold uppercase tracking-wide"
          style={{ color: theme.text.tertiary, borderBottom: `1px solid ${theme.surfaces.elevated2}` }}
        >
          Live Activity Log
        </div>
        <div ref={logScrollRef} className="px-4 py-3 font-mono text-xs h-64 overflow-y-auto space-y-1.5">
          {log.length === 0 ? (
            <p style={{ color: theme.text.tertiary }}>Pick a game + list and hit Run to begin.</p>
          ) : (
            log.map((line) => <ActivityLine key={line.id} line={line} />)
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityLine({ line }: { line: LogLine }) {
  const { theme } = useJMStyle();
  const time = new Date(line.ts).toLocaleTimeString([], { hour12: false });
  const color =
    line.type === "error"
      ? "#EF4444"
      : line.type === "found"
      ? theme.accents.goldenGlow
      : line.type === "complete"
      ? "#22C55E"
      : line.type === "skipped"
      ? theme.text.tertiary
      : theme.text.secondary;
  const tagsStr = line.tags ? Object.entries(line.tags).map(([k, v]) => `${k}:${v}`).join(", ") : "";

  return (
    <div className="leading-snug">
      <span style={{ color: theme.text.tertiary }}>[{time}]</span>{" "}
      <span style={{ color }}>
        {line.type === "found" && line.rank ? `#${line.rank} ` : ""}
        {line.message}
      </span>
      {tagsStr && (
        <div className="ml-12 text-[11px]" style={{ color: theme.text.tertiary }}>
          tags: {tagsStr}
          {typeof line.citations === "number" && line.citations > 0
            ? ` · ${line.citations} citation${line.citations === 1 ? "" : "s"}`
            : ""}
        </div>
      )}
    </div>
  );
}

// ─── Content browser ─────────────────────────────────────────

interface ContentRow {
  id: string;
  name: string;
  subtitle: string;
  popularityRank: number;
  tier: TriviaContentTier;
  tags: Record<string, string>;
  citations: TriviaCitation[];
  sourceUrl: string | null;
  sourceDb: string;
  status: "indexed" | "ready";
}

function ContentBrowser() {
  const { theme } = useJMStyle();
  const [gameId, setGameId] = useState<TriviaGameId | "">("");
  const [list, setList] = useState<TriviaListType | "">("");
  const lists = gameId ? TRIVIA_GAME_LISTS[gameId] ?? [] : [];
  const { rows, loading, error } = useTriviaContent(gameId || null, list || null);

  const handleGame = (id: TriviaGameId | "") => {
    setGameId(id);
    if (id) {
      const first = TRIVIA_GAME_LISTS[id]?.[0];
      setList(first?.id ?? "");
    } else setList("");
  };

  return (
    <div
      className="rounded-xl border"
      style={{ backgroundColor: theme.surfaces.elevated1, borderColor: theme.surfaces.elevated2 }}
    >
      <div
        className="px-5 py-4 flex flex-wrap items-center gap-3"
        style={{ borderBottom: `1px solid ${theme.surfaces.elevated2}` }}
      >
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: theme.text.tertiary }}>
            Content Browser
          </span>
          <span className="text-sm" style={{ color: theme.text.secondary }}>
            Inspect saved subjects for any vertical / list
          </span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <select
            value={gameId}
            onChange={(e) => handleGame(e.target.value as TriviaGameId | "")}
            className="px-4 py-2 rounded-lg outline-none text-sm"
            style={{
              backgroundColor: theme.surfaces.base,
              color: theme.text.primary,
              border: `1px solid ${theme.surfaces.elevated2}`,
              minWidth: "160px",
            }}
          >
            <option value="">Game</option>
            {ALL_TRIVIA_GAMES.map((id) => (
              <option key={id} value={id}>
                {TRIVIA_GAME_DISPLAY_NAMES[id]}
              </option>
            ))}
          </select>
          <select
            value={list}
            onChange={(e) => setList(e.target.value as TriviaListType | "")}
            disabled={!gameId}
            className="px-4 py-2 rounded-lg outline-none text-sm disabled:opacity-50"
            style={{
              backgroundColor: theme.surfaces.base,
              color: theme.text.primary,
              border: `1px solid ${theme.surfaces.elevated2}`,
              minWidth: "160px",
            }}
          >
            <option value="">List</option>
            {lists.map((cfg) => (
              <option key={cfg.id} value={cfg.id}>
                {cfg.label}
              </option>
            ))}
          </select>
          {gameId && list && (
            <span className="text-sm tabular-nums" style={{ color: theme.text.tertiary }}>
              {loading ? "…" : `${rows.length} row${rows.length === 1 ? "" : "s"}`}
            </span>
          )}
        </div>
      </div>

      <div className="p-5">
        {!gameId || !list ? (
          <p className="text-sm" style={{ color: theme.text.tertiary }}>
            Pick a game + list to load saved content (sorted by rank, low to high).
          </p>
        ) : error ? (
          <div
            className="text-sm rounded-lg p-3"
            style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#EF4444" }}
          >
            {error}
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 text-sm" style={{ color: theme.text.tertiary }}>
            <Loader2 size={14} className="animate-spin" />
            Loading content…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm" style={{ color: theme.text.tertiary }}>
            No content yet for {TRIVIA_GAME_DISPLAY_NAMES[gameId]} · {listLabel(gameId, list)}. Run the agent to start populating.
          </p>
        ) : (
          <ContentTable rows={rows} />
        )}
      </div>
    </div>
  );
}

function ContentTable({ rows }: { rows: ContentRow[] }) {
  const { theme } = useJMStyle();
  return (
    <div
      className="max-h-[600px] overflow-y-auto rounded-lg"
      style={{ backgroundColor: theme.surfaces.base, border: `1px solid ${theme.surfaces.elevated2}` }}
    >
      <div
        className="sticky top-0 z-10 grid grid-cols-[60px_1fr_60px_60px] gap-3 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide"
        style={{
          backgroundColor: theme.surfaces.elevated1,
          color: theme.text.tertiary,
          borderBottom: `1px solid ${theme.surfaces.elevated2}`,
        }}
      >
        <span className="text-right">Rank</span>
        <span>Subject</span>
        <span className="text-center">Tier</span>
        <span className="text-right">Cites</span>
      </div>
      <ul>
        {rows.map((row) => (
          <ContentRowItem key={row.id} row={row} />
        ))}
      </ul>
    </div>
  );
}

function ContentRowItem({ row }: { row: ContentRow }) {
  const { theme } = useJMStyle();
  const tierColor = row.tier === 1 ? "#22C55E" : row.tier === 2 ? "#60A5FA" : theme.text.tertiary;
  const tagEntries = Object.entries(row.tags);

  return (
    <li
      className="grid grid-cols-[60px_1fr_60px_60px] gap-3 px-4 py-3 text-sm"
      style={{ borderBottom: `1px solid ${theme.surfaces.elevated2}` }}
    >
      <span className="text-right tabular-nums font-mono" style={{ color: theme.text.tertiary }}>
        #{row.popularityRank}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          {row.sourceUrl ? (
            <a
              href={row.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:underline truncate"
              style={{ color: theme.text.primary }}
            >
              {row.name}
            </a>
          ) : (
            <span className="font-medium truncate" style={{ color: theme.text.primary }}>
              {row.name}
            </span>
          )}
          {row.subtitle && (
            <span className="text-xs" style={{ color: theme.text.tertiary }}>
              {row.subtitle}
            </span>
          )}
        </div>
        {tagEntries.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {tagEntries.map(([k, v]) => (
              <span
                key={`${k}__${v}`}
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px]"
                style={{
                  backgroundColor: theme.surfaces.elevated1,
                  color: theme.text.secondary,
                  border: `1px solid ${theme.surfaces.elevated2}`,
                }}
              >
                {k}:{v}
              </span>
            ))}
          </div>
        )}
      </div>
      <span className="text-center text-xs font-semibold tabular-nums" style={{ color: tierColor }}>
        T{row.tier}
      </span>
      <span className="text-right text-xs tabular-nums" style={{ color: theme.text.tertiary }}>
        {row.citations.length}
      </span>
    </li>
  );
}

function useTriviaContent(
  gameId: TriviaGameId | null,
  list: TriviaListType | null,
): { rows: ContentRow[]; loading: boolean; error: string | null } {
  const { user } = useAuth();
  const [rows, setRows] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !gameId || !list) {
      setRows([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    let unsub: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const { initializeFirebase } = await import("@/lib/firebase");
        const { getFirestore, collection, query, where, orderBy, onSnapshot } = await import(
          "firebase/firestore"
        );
        const { app } = await initializeFirebase();
        if (cancelled) return;
        const db = getFirestore(app);
        const q = query(
          collection(db, "trivia-content"),
          where("gameId", "==", gameId),
          where("listType", "==", list),
          orderBy("popularityRank", "asc"),
        );
        unsub = onSnapshot(
          q,
          (snap) => {
            const next: ContentRow[] = [];
            for (const docSnap of snap.docs) {
              const d = docSnap.data();
              next.push({
                id: docSnap.id,
                name: typeof d["name"] === "string" ? d["name"] : "(unnamed)",
                subtitle: typeof d["subtitle"] === "string" ? d["subtitle"] : "",
                popularityRank: typeof d["popularityRank"] === "number" ? d["popularityRank"] : 0,
                tier: d["tier"] === 1 || d["tier"] === 2 || d["tier"] === 3 ? d["tier"] : 3,
                tags:
                  d["tags"] && typeof d["tags"] === "object"
                    ? (d["tags"] as Record<string, string>)
                    : {},
                citations: Array.isArray(d["citations"]) ? (d["citations"] as TriviaCitation[]) : [],
                sourceUrl: typeof d["sourceUrl"] === "string" ? d["sourceUrl"] : null,
                sourceDb: typeof d["sourceDb"] === "string" ? d["sourceDb"] : "",
                status: d["status"] === "ready" ? "ready" : "indexed",
              });
            }
            setRows(next);
            setLoading(false);
          },
          (err) => {
            const msg = err.message.includes("index")
              ? "Firestore needs a composite index on (gameId, listType, popularityRank). Open the browser console for a one-click create link."
              : err.message;
            setError(msg);
            setLoading(false);
          },
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(msg);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [user, gameId, list]);

  return { rows, loading, error };
}

// ─── Realtime hooks ──────────────────────────────────────────

function useTriviaCounts(): Record<string, CountState> {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Record<string, CountState>>({});

  useEffect(() => {
    if (!user) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const { initializeFirebase } = await import("@/lib/firebase");
      const { getFirestore, collection, onSnapshot } = await import("firebase/firestore");
      const { app } = await initializeFirebase();
      if (cancelled) return;
      const db = getFirestore(app);
      unsub = onSnapshot(collection(db, "trivia-agent-state"), (snap) => {
        const next: Record<string, CountState> = {};
        for (const doc of snap.docs) {
          const data = doc.data();
          const totalFound = typeof data["totalFound"] === "number" ? data["totalFound"] : 0;
          const status: TriviaAgentStatus =
            data["status"] === "running" ||
            data["status"] === "paused" ||
            data["status"] === "complete"
              ? data["status"]
              : "idle";
          next[doc.id] = { totalFound, status };
        }
        setCounts(next);
      });
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [user]);

  return counts;
}

function useTriviaTags(): TagRow[] {
  const { user } = useAuth();
  const [tags, setTags] = useState<TagRow[]>([]);
  useEffect(() => {
    if (!user) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const { initializeFirebase } = await import("@/lib/firebase");
      const { getFirestore, collection, onSnapshot } = await import("firebase/firestore");
      const { app } = await initializeFirebase();
      if (cancelled) return;
      const db = getFirestore(app);
      unsub = onSnapshot(collection(db, "trivia-tags"), (snap) => {
        const rows: TagRow[] = [];
        for (const doc of snap.docs) {
          const data = doc.data();
          const category = typeof data["category"] === "string" ? data["category"] : "";
          const value = typeof data["value"] === "string" ? data["value"] : "";
          const count = typeof data["count"] === "number" ? data["count"] : 0;
          if (category && value) rows.push({ category, value, count });
        }
        setTags(rows);
      });
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [user]);
  return tags;
}
