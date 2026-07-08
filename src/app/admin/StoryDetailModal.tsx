"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  X, Save, Trash2,
  Check, Loader2, Eye, EyeOff, Upload, FileText,
} from "lucide-react";
import { useJMStyle } from "@/JMStyle";
import { JMImageUpload } from "@/JMKit";
import {
  getStory,
  updateStory,
  deleteStory,
  uploadStoryCover,
  uploadStoryThumbnail,
  uploadStoryEpub,
} from "@/lib/stories";
import type { JMStory } from "@/lib/content-types";

interface StoryDetailModalProps {
  storyId: string;
  onClose: () => void;
  onUpdated: () => void;
}

interface EditState {
  title: string;
  subtitle: string;
  author: string;
  slug: string;
  description: string;
  coverImageURL: string;
  coverThumbnailURL: string;
  coverVideoURL: string;
  epubURL: string;
  isPublished: boolean;
}

export function StoryDetailModal({ storyId, onClose, onUpdated }: StoryDetailModalProps) {
  const { theme } = useJMStyle();

  const [story, setStory] = useState<JMStory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editState, setEditState] = useState<EditState | null>(null);
  const [originalState, setOriginalState] = useState<EditState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);

  const [pendingEpubFile, setPendingEpubFile] = useState<File | null>(null);
  const epubInputRef = useRef<HTMLInputElement>(null);

  const handleCoverUpload = useCallback(async (file: File) => {
    return uploadStoryCover(file, storyId);
  }, [storyId]);

  const handleThumbnailUpload = useCallback(async (file: File) => {
    return uploadStoryThumbnail(file, storyId);
  }, [storyId]);

  const fetchStory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getStory(storyId);
      if (data) {
        setStory(data);
        const state: EditState = {
          title: data.title,
          subtitle: data.subtitle || "",
          author: data.author,
          slug: data.slug,
          description: data.description || "",
          coverImageURL: data.coverImageURL || "",
          coverThumbnailURL: data.coverThumbnailURL || "",
          coverVideoURL: data.coverVideoURL || "",
          epubURL: data.epubURL || "",
          isPublished: data.isPublished,
        };
        setEditState(state);
        setOriginalState(state);
      }
    } catch (err) {
      console.error("Failed to fetch story:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch story");
    } finally {
      setIsLoading(false);
    }
  }, [storyId]);

  useEffect(() => {
    fetchStory();
  }, [fetchStory]);

  const hasChanges = (editState && originalState &&
    JSON.stringify(editState) !== JSON.stringify(originalState)) || pendingEpubFile !== null;

  const handleSave = async () => {
    if (!editState || !hasChanges) return;

    setIsSaving(true);
    try {
      const updates: Record<string, unknown> = {
        title: editState.title,
        author: editState.author,
        slug: editState.slug,
        isPublished: editState.isPublished,
        coverImageURL: editState.coverImageURL || null,
        coverThumbnailURL: editState.coverThumbnailURL || null,
        description: editState.description || null,
      };
      if (editState.subtitle) updates["subtitle"] = editState.subtitle;
      else updates["subtitle"] = null;
      if (editState.coverVideoURL) updates["coverVideoURL"] = editState.coverVideoURL;
      else updates["coverVideoURL"] = null;

      if (pendingEpubFile) {
        const epubURL = await uploadStoryEpub(pendingEpubFile, storyId);
        updates["epubURL"] = epubURL;
        setEditState(prev => prev ? { ...prev, epubURL } : prev);
        setPendingEpubFile(null);
        if (epubInputRef.current) epubInputRef.current.value = "";
      }

      await updateStory(storyId, updates as Parameters<typeof updateStory>[1]);

      setOriginalState(editState);
      onUpdated();
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 2500);
    } catch (err) {
      console.error("Failed to save:", err);
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this story?")) return;
    try {
      await deleteStory(storyId);
      onUpdated();
      onClose();
    } catch (err) {
      console.error("Failed to delete:", err);
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 pt-20">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-2xl max-h-[calc(100vh-6rem)] rounded-2xl border-2 overflow-hidden flex flex-col"
        style={{
          backgroundColor: "rgba(20, 20, 20, 1)",
          borderColor: "rgba(255, 255, 255, 0.2)",
        }}
      >
        {/* Header */}
        <div
          className="shrink-0 flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "rgba(255, 255, 255, 0.15)" }}
        >
          <h2 className="text-lg font-semibold" style={{ color: theme.text.primary }}>
            {story?.title || "Loading..."}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              className="p-2 rounded-lg transition-colors hover:bg-red-500/20"
              style={{ color: theme.semantic.error }}
              title="Delete story"
            >
              <Trash2 size={18} />
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="p-2 rounded-lg transition-all disabled:opacity-30"
              style={{
                backgroundColor: hasChanges ? `${theme.accents.goldenGlow}20` : "transparent",
                color: hasChanges ? theme.accents.goldenGlow : theme.text.tertiary,
              }}
              title={hasChanges ? "Save changes" : "No changes"}
            >
              <Save size={18} className={isSaving ? "animate-pulse" : ""} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors hover:bg-white/10"
              style={{ color: theme.text.secondary }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6" style={{ scrollbarWidth: "none" }}>
          {isLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="inline-block h-6 w-6 animate-spin" style={{ color: theme.accents.goldenGlow }} />
            </div>
          ) : error ? (
            <div className="py-12 text-center text-sm" style={{ color: theme.semantic.error }}>
              {error}
            </div>
          ) : story && editState ? (
            <>
              <Section title="Details" theme={theme}>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditState({ ...editState, isPublished: !editState.isPublished })}
                      className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full transition-colors"
                      style={{
                        backgroundColor: editState.isPublished ? `${theme.semantic.success}20` : theme.surfaces.elevated2,
                        color: editState.isPublished ? theme.semantic.success : theme.text.tertiary,
                      }}
                    >
                      {editState.isPublished ? <Eye size={12} /> : <EyeOff size={12} />}
                      {editState.isPublished ? "Published" : "Draft"}
                    </button>
                  </div>

                  <Field label="Title" value={editState.title} onChange={(v) => setEditState({ ...editState, title: v })} theme={theme} required />
                  <Field label="Subtitle" value={editState.subtitle} onChange={(v) => setEditState({ ...editState, subtitle: v })} theme={theme} />
                  <Field label="Author" value={editState.author} onChange={(v) => setEditState({ ...editState, author: v })} theme={theme} required />
                  <Field label="URL Slug" value={editState.slug} onChange={(v) => setEditState({ ...editState, slug: v })} theme={theme} required />

                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: theme.text.secondary }}>
                      Description
                    </label>
                    <textarea
                      value={editState.description}
                      onChange={(e) => setEditState({ ...editState, description: e.target.value })}
                      placeholder="A brief synopsis or blurb for the landing page..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 resize-none"
                      style={{
                        backgroundColor: "rgba(0, 0, 0, 0.4)",
                        borderColor: "rgba(255, 255, 255, 0.2)",
                        color: theme.text.primary,
                      }}
                    />
                  </div>

                  <div className="flex gap-4">
                    <JMImageUpload
                      label="Full Cover (1:2)"
                      value={editState.coverImageURL}
                      onChange={(url) => setEditState({ ...editState, coverImageURL: url || "" })}
                      onUpload={handleCoverUpload}
                      aspectRatio="portrait"
                      previewSize={240}
                      maxWidth={1200}
                    />
                    <JMImageUpload
                      label="Thumbnail (1:2)"
                      value={editState.coverThumbnailURL}
                      onChange={(url) => setEditState({ ...editState, coverThumbnailURL: url || "" })}
                      onUpload={handleThumbnailUpload}
                      aspectRatio="portrait"
                      previewSize={180}
                      maxWidth={400}
                    />
                  </div>

                  <Field
                    label="Animated Cover (Vimeo URL)"
                    value={editState.coverVideoURL}
                    onChange={(v) => setEditState({ ...editState, coverVideoURL: v })}
                    theme={theme}
                    type="url"
                    placeholder="https://vimeo.com/123456789"
                  />
                </div>
              </Section>

              <Section title="EPUB File" theme={theme}>
                <div className="space-y-3">
                  <input
                    ref={epubInputRef}
                    type="file"
                    accept=".epub"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setPendingEpubFile(file);
                    }}
                  />

                  {editState.epubURL && !pendingEpubFile && (
                    <div
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm"
                      style={{
                        backgroundColor: `${theme.semantic.success}10`,
                        border: `1px solid ${theme.semantic.success}30`,
                        color: theme.text.secondary,
                      }}
                    >
                      <FileText size={16} style={{ color: theme.semantic.success }} />
                      <span className="flex-1">EPUB uploaded</span>
                      <button
                        onClick={() => epubInputRef.current?.click()}
                        className="text-xs hover:underline"
                        style={{ color: theme.accents.goldenGlow }}
                      >
                        Replace
                      </button>
                    </div>
                  )}

                  {pendingEpubFile && (
                    <div
                      className="flex items-center gap-3 px-3 py-2 rounded-lg border text-sm"
                      style={{
                        backgroundColor: "rgba(0, 0, 0, 0.4)",
                        borderColor: theme.accents.goldenGlow,
                        color: theme.text.primary,
                      }}
                    >
                      <FileText size={16} style={{ color: theme.accents.goldenGlow }} />
                      <span className="flex-1 truncate">{pendingEpubFile.name}</span>
                      <span className="text-xs" style={{ color: theme.text.tertiary }}>
                        (save to upload)
                      </span>
                      <button
                        onClick={() => {
                          setPendingEpubFile(null);
                          if (epubInputRef.current) epubInputRef.current.value = "";
                        }}
                        className="text-xs hover:underline"
                        style={{ color: theme.text.tertiary }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {!editState.epubURL && !pendingEpubFile && (
                    <button
                      onClick={() => epubInputRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors hover:bg-white/5"
                      style={{
                        backgroundColor: "rgba(0, 0, 0, 0.4)",
                        borderColor: "rgba(255, 255, 255, 0.2)",
                        color: theme.text.tertiary,
                      }}
                    >
                      <Upload size={16} />
                      Choose .epub file
                    </button>
                  )}

                  <p className="text-xs" style={{ color: theme.text.tertiary }}>
                    The EPUB file powers the in-browser reader and download. Max 50 MB.
                  </p>
                </div>
              </Section>

              {/* Image layout is automatic: "Chapter-*" images get full left page, "End-*" images get page break after */}
            </>
          ) : null}
        </div>
      </div>

      {/* Success Toast */}
      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-3 rounded-xl border-2 shadow-lg transition-all duration-300 ${
          showSaveToast ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
        style={{
          backgroundColor: "rgba(20, 20, 20, 0.95)",
          borderColor: theme.semantic.success,
          zIndex: 60,
        }}
      >
        <div
          className="flex items-center justify-center w-6 h-6 rounded-full"
          style={{ backgroundColor: `${theme.semantic.success}30` }}
        >
          <Check size={14} style={{ color: theme.semantic.success }} />
        </div>
        <span className="text-sm font-medium" style={{ color: theme.text.primary }}>
          Changes saved
        </span>
      </div>
    </div>
  );
}

function Section({
  title,
  theme,
  children,
}: {
  title: string;
  theme: ReturnType<typeof useJMStyle>["theme"];
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3
        className="text-sm font-semibold mb-3 uppercase tracking-wider"
        style={{ color: theme.accents.goldenGlow }}
      >
        {title}
      </h3>
      <div
        className="p-4 rounded-xl border-2"
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.06)",
          borderColor: "rgba(255, 255, 255, 0.18)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  theme,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  theme: ReturnType<typeof useJMStyle>["theme"];
  type?: "text" | "url" | "number";
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: theme.text.secondary }}>
        {label}
        {required && <span style={{ color: theme.semantic.error }}> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.4)",
          borderColor: "rgba(255, 255, 255, 0.2)",
          color: theme.text.primary,
        }}
      />
    </div>
  );
}
