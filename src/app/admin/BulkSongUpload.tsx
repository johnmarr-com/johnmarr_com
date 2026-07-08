"use client";

import { useCallback, useRef, useState } from "react";
import { Check, FolderUp, Loader2, Music, X } from "lucide-react";
import type { useJMStyle } from "@/JMStyle";
import { createSong, uploadSongAudio } from "@/lib/content";

type Theme = ReturnType<typeof useJMStyle>["theme"];

interface BulkSongUploadProps {
  albumId: string;
  /** Songs already in the album — new tracks are appended after these. */
  existingCount: number;
  creatorId: string;
  theme: Theme;
  /** Called once after the batch finishes (refetch the artist). */
  onComplete: () => void;
}

type RowStatus = "pending" | "uploading" | "done" | "error";

interface Row {
  name: string;
  title: string;
  status: RowStatus;
  error?: string;
}

/**
 * "01 - Neon Nights.mp3" → "Neon Nights". Strips the extension, any leading
 * track-number prefix, and underscore word-separators — the description is
 * intentionally left empty (edit a song later for lyrics/description).
 */
function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.[a-z0-9]{2,5}$/i, "");
  return (
    base
      .replace(/^\s*\d{1,3}\s*[-._)]\s*/, "")
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim() || base.trim()
  );
}

/** Natural filename order — "folder order" (2 before 10). */
const byName = (a: File, b: File): number =>
  a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });

const isAudio = (f: File): boolean =>
  f.type.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(f.name);

/** Track duration in whole seconds, decoded from the file's metadata. */
function readDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const finish = (seconds: number) => {
      URL.revokeObjectURL(url);
      resolve(seconds);
    };
    audio.addEventListener("loadedmetadata", () =>
      finish(Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0),
    );
    audio.addEventListener("error", () => finish(0));
    audio.src = url;
  });
}

/** Flatten a drag-drop payload (loose files AND dropped folders) to Files. */
async function filesFromDrop(dt: DataTransfer): Promise<File[]> {
  const entries = Array.from(dt.items)
    .map((item) => item.webkitGetAsEntry?.())
    .filter((e): e is FileSystemEntry => e != null);

  // No entry API (or plain files only) — use the flat file list.
  if (entries.length === 0) return Array.from(dt.files);

  const files: File[] = [];
  const walk = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File | null>((resolve) =>
        (entry as FileSystemFileEntry).file(resolve, () => resolve(null)),
      );
      if (file) files.push(file);
      return;
    }
    if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      // readEntries returns batches; keep reading until empty.
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((resolve) =>
          reader.readEntries(resolve, () => resolve([])),
        );
        if (batch.length === 0) break;
        for (const child of batch) await walk(child);
      }
    }
  };
  for (const entry of entries) await walk(entry);
  return files;
}

/**
 * Bulk song intake for an album: drop a folder (or a stack of audio files),
 * and each file becomes a PUBLISHED song — title from the filename, empty
 * description, track numbers appended in natural filename order ("folder
 * order"). Files upload one at a time with per-file status; reorder
 * afterwards by dragging the song rows as usual.
 */
export function BulkSongUpload({
  albumId,
  existingCount,
  creatorId,
  theme,
  onComplete,
}: BulkSongUploadProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    async (incoming: File[]) => {
      const files = incoming.filter(isAudio).sort(byName);
      if (files.length === 0 || running) return;

      setRunning(true);
      setRows(
        files.map((f) => ({
          name: f.name,
          title: titleFromFilename(f.name),
          status: "pending" as const,
        })),
      );

      const setRow = (i: number, patch: Partial<Row>) =>
        setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        setRow(i, { status: "uploading" });
        try {
          const [audioURL, duration] = await Promise.all([
            uploadSongAudio(file, `bulk-${Date.now().toString(36)}-${i}`),
            readDuration(file),
          ]);
          await createSong(
            {
              albumId,
              title: titleFromFilename(file.name),
              description: "",
              audioURL,
              duration,
              trackNumber: existingCount + i + 1,
              // Bulk-loaded tracks go live immediately — no click-to-publish
              // pass afterwards (the album itself still gates visibility).
              isPublished: true,
            },
            creatorId,
          );
          setRow(i, { status: "done" });
        } catch (err) {
          console.error(`[BulkSongUpload] ${file.name}:`, err);
          setRow(i, {
            status: "error",
            error: err instanceof Error ? err.message : "Upload failed",
          });
        }
      }

      setRunning(false);
      onComplete();
    },
    [albumId, existingCount, creatorId, running, onComplete],
  );

  const doneCount = rows.filter((r) => r.status === "done").length;
  const hasErrors = rows.some((r) => r.status === "error");

  return (
    <div className="mt-1">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void filesFromDrop(e.dataTransfer).then(processFiles);
        }}
        className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm transition-colors"
        style={{
          borderColor: dragOver ? theme.accents.goldenGlow : theme.surfaces.elevated2,
          backgroundColor: dragOver ? `${theme.accents.goldenGlow}10` : "transparent",
          color: theme.text.tertiary,
        }}
      >
        <FolderUp size={16} className="shrink-0" />
        <span className="flex-1">
          {running
            ? `Uploading ${doneCount + 1} of ${rows.length}…`
            : "Bulk add: drop a folder (or audio files) here — titles from filenames, ordered by name"}
        </span>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={running}
          className="shrink-0 rounded px-2 py-1 text-xs font-medium transition-colors hover:bg-white/10 disabled:opacity-50"
          style={{ color: theme.accents.goldenGlow }}
        >
          Choose files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac,.flac"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = ""; // allow re-selecting the same folder
            void processFiles(files);
          }}
        />
      </div>

      {/* Per-file status */}
      {rows.length > 0 && (
        <div
          className="mt-1 max-h-40 overflow-y-auto rounded-lg border px-2 py-1"
          style={{ borderColor: theme.surfaces.elevated2 }}
        >
          {rows.map((row, i) => (
            <div key={`${row.name}-${i}`} className="flex items-center gap-2 py-0.5 text-xs">
              {row.status === "uploading" ? (
                <Loader2 size={12} className="shrink-0 animate-spin" style={{ color: theme.accents.goldenGlow }} />
              ) : row.status === "done" ? (
                <Check size={12} className="shrink-0" style={{ color: theme.semantic.success }} />
              ) : row.status === "error" ? (
                <X size={12} className="shrink-0" style={{ color: theme.semantic.error }} />
              ) : (
                <Music size={12} className="shrink-0" style={{ color: theme.text.tertiary }} />
              )}
              <span className="flex-1 truncate" style={{ color: theme.text.secondary }}>
                {existingCount + i + 1}. {row.title}
              </span>
              {row.error && (
                <span className="truncate" style={{ color: theme.semantic.error }}>
                  {row.error}
                </span>
              )}
            </div>
          ))}
          {!running && (
            <button
              type="button"
              onClick={() => setRows([])}
              className="mt-1 text-xs hover:underline"
              style={{ color: hasErrors ? theme.semantic.error : theme.text.tertiary }}
            >
              {hasErrors ? "Some uploads failed — dismiss" : "Dismiss"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
