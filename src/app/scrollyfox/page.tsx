"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  Pencil,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import { JMAppHeader, JMModal } from "@/JMKit";
import { useJMStyle } from "@/JMStyle";
import { AdminGate } from "@/lib/AdminGate";
import { useAuth } from "@/lib/AuthProvider";
import {
  emptyScrollyFox,
  listScrollyFoxes,
  loadScrollyFox,
  saveScrollyFox,
  type ScrollyFoxDoc,
  type ScrollyFoxListItem,
  type ScrollyFoxSegment,
} from "@/lib/scrollyfox";
import { DEFAULT_STYLE, resolveStyle, toCss } from "@/lib/scrollyfox-style";
import { StyleSettings } from "./StyleSettings";
import { HeroSegment } from "./segments/HeroSegment";
import { SegmentEditorModal } from "./SegmentEditorModal";

function ScrollyFoxHomeContent() {
  const { theme } = useJMStyle();
  const { user } = useAuth();

  const [view, setView] = useState<"list" | "editor">("list");
  const [docs, setDocs] = useState<ScrollyFoxListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [currentDoc, setCurrentDoc] = useState<ScrollyFoxDoc | null>(null);
  // null = closed; { index: null } = new segment; { index: n } = edit segment n.
  const [segmentEditor, setSegmentEditor] = useState<{
    index: number | null;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sfSettingsOpen, setSfSettingsOpen] = useState(false);

  const refreshList = useCallback(async () => {
    setListLoading(true);
    try {
      setDocs(await listScrollyFoxes());
    } catch (err) {
      console.error("Failed to list ScrollyFoxes", err);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  const openNewDoc = () => {
    setCurrentDoc(emptyScrollyFox());
    setSaveError(null);
    setView("editor");
  };

  const openExistingDoc = async (id: string) => {
    setSaveError(null);
    const loaded = await loadScrollyFox(id);
    if (!loaded) {
      void refreshList();
      return;
    }
    setCurrentDoc(loaded);
    setView("editor");
  };

  const goToList = async () => {
    setView("list");
    setCurrentDoc(null);
    setSegmentEditor(null);
    setSaveError(null);
    await refreshList();
  };

  const persistDoc = useCallback(
    async (next: ScrollyFoxDoc): Promise<void> => {
      setIsSaving(true);
      setSaveError(null);
      try {
        const id = await saveScrollyFox(next, user?.uid ?? "");
        setCurrentDoc({ ...next, id });
      } catch (err) {
        console.error("Failed to save ScrollyFox", err);
        setSaveError(err instanceof Error ? err.message : "Save failed.");
      } finally {
        setIsSaving(false);
      }
    },
    [user?.uid],
  );

  const handleSegmentSave = async (segment: ScrollyFoxSegment) => {
    if (!currentDoc) return;
    const editingIndex = segmentEditor?.index ?? null;
    const segments =
      editingIndex === null
        ? [...currentDoc.segments, segment]
        : currentDoc.segments.map((s, i) =>
            i === editingIndex ? segment : s,
          );
    const next: ScrollyFoxDoc = { ...currentDoc, segments };
    setCurrentDoc(next); // optimistic
    await persistDoc(next);
  };

  const handleRemoveSegment = async (index: number) => {
    if (!currentDoc) return;
    const next: ScrollyFoxDoc = {
      ...currentDoc,
      segments: currentDoc.segments.filter((_, i) => i !== index),
    };
    setCurrentDoc(next);
    await persistDoc(next);
  };

  const handleMoveSegment = async (index: number, dir: -1 | 1) => {
    if (!currentDoc) return;
    const target = index + dir;
    const segments = [...currentDoc.segments];
    const a = segments[index];
    const b = segments[target];
    if (!a || !b) return;
    segments[index] = b;
    segments[target] = a;
    const next: ScrollyFoxDoc = { ...currentDoc, segments };
    setCurrentDoc(next);
    await persistDoc(next);
  };

  const handleTitleBlur = async () => {
    // Persist a rename only once the doc exists (i.e. has at least one saved segment).
    if (currentDoc?.id) await persistDoc(currentDoc);
  };

  const handleDocStyleApply = async (style: ScrollyFoxDoc["style"]) => {
    if (!currentDoc) return;
    const next: ScrollyFoxDoc = { ...currentDoc, style };
    setCurrentDoc(next);
    setSfSettingsOpen(false);
    await persistDoc(next);
  };

  const editingSegment =
    segmentEditor && segmentEditor.index !== null && currentDoc
      ? currentDoc.segments[segmentEditor.index]
      : undefined;

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ backgroundColor: theme.surfaces.base }}
    >
      <JMAppHeader />

      <div className="relative z-10 flex w-full items-center justify-between px-[clamp(16px,5vw,50px)] pt-6 pb-2">
        <h1 className="text-2xl font-bold" style={{ color: theme.text.primary }}>
          ScrollyFox
        </h1>
        {/* TODO: replace with animating ScrollyFox logo asset */}
        <div
          className="text-sm font-semibold tracking-wide"
          style={{ color: theme.accents.neonPink }}
        >
          SCROLLYFOX
        </div>
      </div>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-col px-[clamp(16px,5vw,50px)] py-8">
        {view === "list" ? (
          <ListView
            docs={docs}
            loading={listLoading}
            onCreate={openNewDoc}
            onOpen={openExistingDoc}
          />
        ) : (
          currentDoc && (
            <EditorView
              doc={currentDoc}
              isSaving={isSaving}
              saveError={saveError}
              onBack={goToList}
              onTitleChange={(title) =>
                setCurrentDoc((prev) => (prev ? { ...prev, title } : prev))
              }
              onTitleBlur={handleTitleBlur}
              onAddSegment={() => setSegmentEditor({ index: null })}
              onEditSegment={(index) => setSegmentEditor({ index })}
              onRemoveSegment={handleRemoveSegment}
              onMoveSegment={handleMoveSegment}
              onOpenSettings={() => setSfSettingsOpen(true)}
            />
          )
        )}
      </main>

      {segmentEditor && currentDoc && (
        <SegmentEditorModal
          key={segmentEditor.index === null ? "new" : `edit-${segmentEditor.index}`}
          {...(editingSegment ? { initialSegment: editingSegment } : {})}
          docStyle={currentDoc.style}
          onSave={handleSegmentSave}
          onClose={() => setSegmentEditor(null)}
        />
      )}

      {currentDoc && (
        <JMModal
          isOpen={sfSettingsOpen}
          onClose={() => setSfSettingsOpen(false)}
          title="ScrollyFox style"
          maxWidthClass="max-w-lg"
        >
          <StyleSettings
            base={{
              desktop: DEFAULT_STYLE,
              tablet: DEFAULT_STYLE,
              mobile: DEFAULT_STYLE,
            }}
            initialLayers={currentDoc.style}
            onApply={handleDocStyleApply}
            onCancel={() => setSfSettingsOpen(false)}
          />
        </JMModal>
      )}
    </div>
  );
}

/* ─── List view ───────────────────────────────────────────── */

function ListView({
  docs,
  loading,
  onCreate,
  onOpen,
}: {
  docs: ScrollyFoxListItem[];
  loading: boolean;
  onCreate: () => void;
  onOpen: (id: string) => void;
}) {
  const { theme } = useJMStyle();

  if (loading) {
    return (
      <p className="py-16 text-center text-sm" style={{ color: theme.text.tertiary }}>
        Loading…
      </p>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-6 py-16 text-center">
        <p className="max-w-md text-base" style={{ color: theme.text.secondary }}>
          Build scroll-driven stories, one-pagers, and interactive adventures.
        </p>
        <NeonButton onClick={onCreate} label="Create your first ScrollyFox" big />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
        <NeonButton onClick={onCreate} label="New ScrollyFox" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {docs.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onOpen(d.id)}
            className="flex flex-col gap-1 rounded-xl border-2 px-4 py-3 text-left transition-all"
            style={{
              borderColor: theme.surfaces.elevated2,
              backgroundColor: theme.surfaces.elevated1,
            }}
          >
            <span
              className="text-base font-semibold"
              style={{ color: theme.text.primary }}
            >
              {d.title}
            </span>
            <span className="text-xs" style={{ color: theme.text.tertiary }}>
              {d.segmentCount} segment{d.segmentCount === 1 ? "" : "s"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Editor view ─────────────────────────────────────────── */

function EditorView({
  doc,
  isSaving,
  saveError,
  onBack,
  onTitleChange,
  onTitleBlur,
  onAddSegment,
  onEditSegment,
  onRemoveSegment,
  onMoveSegment,
  onOpenSettings,
}: {
  doc: ScrollyFoxDoc;
  isSaving: boolean;
  saveError: string | null;
  onBack: () => void;
  onTitleChange: (title: string) => void;
  onTitleBlur: () => void;
  onAddSegment: () => void;
  onEditSegment: (index: number) => void;
  onRemoveSegment: (index: number) => void;
  onMoveSegment: (index: number, dir: -1 | 1) => void;
  onOpenSettings: () => void;
}) {
  const { theme } = useJMStyle();

  return (
    <div className="flex flex-col gap-5">
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-sm"
          style={{ color: theme.text.secondary }}
        >
          <ChevronLeft size={18} /> All ScrollyFoxes
        </button>
        <span className="ml-auto text-xs" style={{ color: theme.text.tertiary }}>
          {isSaving ? "Saving…" : saveError ? "" : "Saved"}
        </span>
        {saveError && (
          <span className="text-xs" style={{ color: theme.semantic.error }}>
            {saveError}
          </span>
        )}
      </div>

      {/* Title + ScrollyFox-level settings */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={doc.title}
          placeholder="Untitled ScrollyFox"
          onChange={(e) => onTitleChange(e.target.value)}
          onBlur={onTitleBlur}
          className="min-w-0 flex-1 rounded-lg border-2 bg-transparent px-3 py-2 text-2xl font-bold"
          style={{
            borderColor: theme.surfaces.elevated2,
            color: theme.text.primary,
          }}
        />
        <button
          type="button"
          onClick={onOpenSettings}
          className="shrink-0 rounded-lg border-2 p-2.5"
          style={{
            borderColor: theme.surfaces.elevated2,
            color: theme.text.secondary,
          }}
          aria-label="ScrollyFox style settings"
          title="ScrollyFox style — applies to every segment"
        >
          <Settings size={20} />
        </button>
      </div>

      {/* Segment stack */}
      <div className="flex flex-col gap-4">
        {doc.segments.length === 0 && (
          <p
            className="rounded-xl border-2 border-dashed px-4 py-10 text-center text-sm"
            style={{
              borderColor: theme.surfaces.elevated2,
              color: theme.text.tertiary,
            }}
          >
            No segments yet. Add your first below.
          </p>
        )}

        {doc.segments.map((segment, index) => (
          <div
            key={segment.id}
            className="overflow-hidden rounded-xl border-2"
            style={{ borderColor: theme.surfaces.elevated2 }}
          >
            {/* Segment control bar */}
            <div
              className="flex items-center justify-between border-b px-3 py-2"
              style={{
                borderColor: theme.surfaces.elevated2,
                backgroundColor: theme.surfaces.elevated1,
              }}
            >
              <span
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: theme.text.secondary }}
              >
                {index + 1}. {segment.type}
              </span>
              <div className="flex items-center gap-1">
                <IconBtn
                  label="Move up"
                  disabled={index === 0}
                  onClick={() => onMoveSegment(index, -1)}
                >
                  <ArrowUp size={16} />
                </IconBtn>
                <IconBtn
                  label="Move down"
                  disabled={index === doc.segments.length - 1}
                  onClick={() => onMoveSegment(index, 1)}
                >
                  <ArrowDown size={16} />
                </IconBtn>
                <IconBtn label="Edit segment" onClick={() => onEditSegment(index)}>
                  <Pencil size={16} />
                </IconBtn>
                <IconBtn label="Remove segment" onClick={() => onRemoveSegment(index)}>
                  <Trash2 size={16} />
                </IconBtn>
              </div>
            </div>
            {/* Live preview (non-interactive in the stack) */}
            <div className="pointer-events-none">
              <HeroSegment
                {...segment.content}
                style={toCss(resolveStyle(doc.style, segment.style, "desktop"))}
              />
            </div>
          </div>
        ))}

        {/* Add Segment */}
        <button
          type="button"
          onClick={onAddSegment}
          className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-4 text-sm font-semibold transition-all"
          style={{
            borderColor: theme.accents.neonPink,
            color: theme.accents.neonPink,
            backgroundColor: "transparent",
          }}
        >
          <Plus size={18} /> Add Segment
        </button>
      </div>
    </div>
  );
}

/* ─── Small shared bits ───────────────────────────────────── */

function NeonButton({
  onClick,
  label,
  big = false,
}: {
  onClick: () => void;
  label: string;
  big?: boolean;
}) {
  const { theme } = useJMStyle();
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-2xl border-2 transition-all duration-150 ${
        big ? "px-6 py-4 text-lg" : "px-4 py-2 text-sm"
      } font-semibold`}
      style={{
        borderColor: theme.accents.neonPink,
        color: theme.accents.neonPink,
        backgroundColor: "transparent",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = theme.accents.neonPink;
        e.currentTarget.style.color = theme.surfaces.base;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
        e.currentTarget.style.color = theme.accents.neonPink;
      }}
    >
      <Plus size={big ? 24 : 18} /> {label}
    </button>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const { theme } = useJMStyle();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="rounded-md p-1.5 transition-all"
      style={{
        color: theme.text.secondary,
        opacity: disabled ? 0.3 : 1,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

export default function ScrollyFoxHomePage() {
  return (
    <AdminGate redirectTo="/auth">
      <ScrollyFoxHomeContent />
    </AdminGate>
  );
}
