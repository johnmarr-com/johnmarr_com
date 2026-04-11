"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2, Loader2, Clock, AlertTriangle } from "lucide-react";
import { useJMStyle } from "@/JMStyle";

interface CleanupLog {
  id: string;
  trigger: "manual" | "scheduled";
  sessionsDeleted: number;
  inviteCodesDeleted: number;
  gameInvitesDeleted: number;
  sketchesDeleted: number;
  errors: string[];
  createdAt: { seconds: number; nanoseconds: number } | null;
}

function formatDate(ts: CleanupLog["createdAt"]): string {
  if (!ts) return "—";
  const d = new Date(ts.seconds * 1000);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AdminDataCleanupPanel() {
  const { theme } = useJMStyle();
  const [logs, setLogs] = useState<CleanupLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cleanupBusy, setCleanupBusy] = useState(false);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { initializeFirebase } = await import("@/lib/firebase");
      const { getFirestore, collection, query, orderBy, limit, getDocs } =
        await import("firebase/firestore");
      const { app } = await initializeFirebase();
      const db = getFirestore(app);

      const q = query(
        collection(db, "cleanupLogs"),
        orderBy("createdAt", "desc"),
        limit(180),
      );
      const snap = await getDocs(q);
      const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;
      const results: CleanupLog[] = snap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<CleanupLog, "id">),
        }))
        .filter((log) => log.createdAt && log.createdAt.seconds * 1000 >= sixMonthsAgo);
      setLogs(results);
    } catch (err) {
      console.error("Failed to fetch cleanup logs:", err);
      setError(err instanceof Error ? err.message : "Failed to load logs");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleCleanup = useCallback(async () => {
    setCleanupBusy(true);
    try {
      const { getAuth } = await import("@/lib/auth");
      const auth = await getAuth();
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not authenticated");

      const res = await fetch("/api/admin/game-cleanup", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Cleanup failed");

      await fetchLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cleanup failed");
    } finally {
      setCleanupBusy(false);
    }
  }, [fetchLogs]);

  return (
    <div className="mt-6 space-y-4">
      {/* Toolbar */}
      <div
        className="rounded-2xl border backdrop-blur-md"
        style={{
          backgroundColor: `${theme.surfaces.base}ee`,
          borderColor: theme.surfaces.elevated2,
        }}
      >
        <div className="flex items-center justify-between gap-4 px-8 py-5">
          <div className="flex items-center gap-3">
            <Trash2 size={18} style={{ color: theme.text.tertiary }} />
            <span className="text-sm font-medium" style={{ color: theme.text.secondary }}>
              Expired sessions, invite codes, game invites, and sketches are purged on each run.
            </span>
          </div>
          <button
            onClick={handleCleanup}
            disabled={cleanupBusy}
            className="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-all hover:scale-105 disabled:opacity-50"
            style={{
              backgroundColor: theme.accents.goldenGlow,
              color: theme.surfaces.base,
            }}
          >
            {cleanupBusy ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Trash2 size={16} />
                Run Cleanup Now
              </>
            )}
          </button>
        </div>
      </div>

      {/* Logs */}
      <div
        className="overflow-hidden rounded-2xl border backdrop-blur-md"
        style={{
          backgroundColor: `${theme.surfaces.base}ee`,
          borderColor: theme.surfaces.elevated2,
        }}
      >
        <div
          className="border-b px-8 py-4"
          style={{ borderColor: theme.surfaces.elevated2 }}
        >
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: theme.text.tertiary }}>
            Cleanup History (last 6 months)
          </h3>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2
                size={24}
                className="animate-spin"
                style={{ color: theme.accents.goldenGlow }}
              />
            </div>
          ) : error ? (
            <div className="px-8 py-12 text-center text-sm" style={{ color: theme.semantic.error }}>
              {error}
            </div>
          ) : logs.length === 0 ? (
            <div className="px-8 py-12 text-center text-sm" style={{ color: theme.text.tertiary }}>
              No cleanup runs yet. Click &quot;Run Cleanup Now&quot; to start.
            </div>
          ) : (
            <div
              className="divide-y"
              style={{ borderColor: theme.surfaces.elevated2 }}
            >
              {logs.map((log) => {
                const hadWork = log.sessionsDeleted > 0 || log.sketchesDeleted > 0;
                const hadErrors = log.errors.length > 0;

                return (
                  <div key={log.id} className="px-8 py-4">
                    {/* Top row: timestamp + trigger badge */}
                    <div className="mb-2 flex items-center gap-3">
                      <Clock size={14} style={{ color: theme.text.tertiary }} />
                      <span className="text-sm font-medium" style={{ color: theme.text.primary }}>
                        {formatDate(log.createdAt)}
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{
                          backgroundColor:
                            log.trigger === "scheduled"
                              ? `${theme.accents.goldenGlow}15`
                              : `${theme.semantic.info ?? "#3b82f6"}15`,
                          color:
                            log.trigger === "scheduled"
                              ? theme.accents.goldenGlow
                              : theme.semantic.info ?? "#3b82f6",
                        }}
                      >
                        {log.trigger}
                      </span>
                    </div>

                    {/* Stats row */}
                    <div className="flex flex-wrap gap-4 text-xs" style={{ color: theme.text.secondary }}>
                      <span>
                        <strong style={{ color: hadWork ? theme.text.primary : theme.text.tertiary }}>
                          {log.sessionsDeleted}
                        </strong>{" "}
                        session{log.sessionsDeleted !== 1 ? "s" : ""}
                      </span>
                      <span>
                        <strong style={{ color: hadWork ? theme.text.primary : theme.text.tertiary }}>
                          {log.inviteCodesDeleted}
                        </strong>{" "}
                        invite code{log.inviteCodesDeleted !== 1 ? "s" : ""}
                      </span>
                      <span>
                        <strong style={{ color: hadWork ? theme.text.primary : theme.text.tertiary }}>
                          {log.gameInvitesDeleted}
                        </strong>{" "}
                        game invite{log.gameInvitesDeleted !== 1 ? "s" : ""}
                      </span>
                      <span>
                        <strong style={{ color: hadWork ? theme.text.primary : theme.text.tertiary }}>
                          {log.sketchesDeleted}
                        </strong>{" "}
                        sketch{log.sketchesDeleted !== 1 ? "es" : ""}
                      </span>
                    </div>

                    {/* Errors (if any) */}
                    {hadErrors && (
                      <div className="mt-2 flex items-start gap-2 rounded-lg p-2 text-xs"
                        style={{ backgroundColor: `${theme.semantic.error}10` }}
                      >
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" style={{ color: theme.semantic.error }} />
                        <div style={{ color: theme.semantic.error }}>
                          {log.errors.map((e, i) => (
                            <div key={i}>{e}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
