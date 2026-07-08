"use client";

import { useState, useRef } from "react";
import { X, Check, Loader2, Upload, FileText } from "lucide-react";
import { useJMStyle } from "@/JMStyle";
import { useAuth } from "@/lib/AuthProvider";
import { JMImageUpload } from "@/JMKit";
import { createStory, uploadStoryCover, uploadStoryThumbnail, uploadStoryEpub } from "@/lib/stories";

interface StoryCreateModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export function StoryCreateModal({ onClose, onCreated }: StoryCreateModalProps) {
  const { theme } = useJMStyle();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [author, setAuthor] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [coverVideoURL, setCoverVideoURL] = useState("");
  const [coverImageURL, setCoverImageURL] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);
  const [pendingCoverPreview, setPendingCoverPreview] = useState<string | null>(null);
  const [pendingThumbFile, setPendingThumbFile] = useState<File | null>(null);
  const [pendingThumbPreview, setPendingThumbPreview] = useState<string | null>(null);
  const [pendingEpubFile, setPendingEpubFile] = useState<File | null>(null);
  const epubInputRef = useRef<HTMLInputElement>(null);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slug || slug === titleToSlug(title)) {
      setSlug(titleToSlug(value));
    }
  };

  const handlePendingCover = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      setPendingCoverFile(file);
      const preview = URL.createObjectURL(file);
      setPendingCoverPreview(preview);
      resolve(preview);
    });
  };

  const handlePendingThumb = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      setPendingThumbFile(file);
      const preview = URL.createObjectURL(file);
      setPendingThumbPreview(preview);
      resolve(preview);
    });
  };

  const handleCreate = async () => {
    if (!title.trim() || !author.trim() || !slug.trim() || !user?.uid) return;

    setIsCreating(true);
    setError(null);

    try {
      const storyInput: Parameters<typeof createStory>[0] = {
        title: title.trim(),
        author: author.trim(),
        slug: slug.trim(),
        coverImageURL: "",
      };
      if (subtitle.trim()) storyInput.subtitle = subtitle.trim();
      if (description.trim()) storyInput.description = description.trim();
      if (coverVideoURL.trim()) storyInput.coverVideoURL = coverVideoURL.trim();

      const story = await createStory(storyInput, user.uid);

      const updates: Parameters<typeof import("@/lib/stories").updateStory>[1] = {};
      if (pendingCoverFile && story.id) {
        updates.coverImageURL = await uploadStoryCover(pendingCoverFile, story.id);
      }
      if (pendingThumbFile && story.id) {
        updates.coverThumbnailURL = await uploadStoryThumbnail(pendingThumbFile, story.id);
      }
      if (pendingEpubFile && story.id) {
        updates.epubURL = await uploadStoryEpub(pendingEpubFile, story.id);
      }
      if (Object.keys(updates).length > 0) {
        const { updateStory } = await import("@/lib/stories");
        await updateStory(story.id, updates);
      }

      if (pendingCoverPreview) URL.revokeObjectURL(pendingCoverPreview);
      if (pendingThumbPreview) URL.revokeObjectURL(pendingThumbPreview);
      onCreated();
    } catch (err) {
      console.error("Failed to create story:", err);
      setError(err instanceof Error ? err.message : "Failed to create story");
    } finally {
      setIsCreating(false);
    }
  };

  const inputStyle = {
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderColor: "rgba(255, 255, 255, 0.2)",
    color: theme.text.primary,
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border-2"
        style={{
          backgroundColor: "rgba(20, 20, 20, 1)",
          borderColor: "rgba(255, 255, 255, 0.2)",
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between sticky top-0 z-10"
          style={{
            backgroundColor: "rgba(20, 20, 20, 1)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.15)",
          }}
        >
          <h3 className="text-lg font-semibold" style={{ color: theme.text.primary }}>
            New Story
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg transition-colors hover:bg-white/10">
            <X size={20} style={{ color: theme.text.tertiary }} />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {error && (
            <div
              className="p-3 rounded-lg text-sm"
              style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#EF4444" }}
            >
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: theme.text.secondary }}>
              Title <span style={{ color: theme.semantic.error }}>*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="The Great Adventure"
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1"
              style={inputStyle}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: theme.text.secondary }}>
              Subtitle
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="A Novel"
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1"
              style={inputStyle}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: theme.text.secondary }}>
              Author <span style={{ color: theme.semantic.error }}>*</span>
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="John Marr"
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1"
              style={inputStyle}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: theme.text.secondary }}>
              URL Slug <span style={{ color: theme.semantic.error }}>*</span>
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="the-great-adventure"
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1"
              style={inputStyle}
            />
            <p className="text-xs mt-1" style={{ color: theme.text.tertiary }}>
              /story/{slug || "..."}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: theme.text.secondary }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief synopsis or blurb for the landing page..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1 resize-none"
              style={inputStyle}
            />
          </div>

          <div className="flex gap-4">
            <JMImageUpload
              label="Full Cover (1:2)"
              value={pendingCoverPreview || coverImageURL}
              onChange={(url) => {
                if (!url) {
                  if (pendingCoverPreview) URL.revokeObjectURL(pendingCoverPreview);
                  setPendingCoverFile(null);
                  setPendingCoverPreview(null);
                  setCoverImageURL("");
                }
              }}
              onUpload={handlePendingCover}
              aspectRatio="portrait"
              previewSize={240}
              maxWidth={1200}
            />
            <JMImageUpload
              label="Thumbnail (1:2)"
              value={pendingThumbPreview || ""}
              onChange={(url) => {
                if (!url) {
                  if (pendingThumbPreview) URL.revokeObjectURL(pendingThumbPreview);
                  setPendingThumbFile(null);
                  setPendingThumbPreview(null);
                }
              }}
              onUpload={handlePendingThumb}
              aspectRatio="portrait"
              previewSize={180}
              maxWidth={400}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: theme.text.secondary }}>
              Animated Cover (Vimeo URL)
              <span className="ml-2 text-xs font-normal" style={{ color: theme.text.tertiary }}>
                optional - loops as cover when loaded
              </span>
            </label>
            <input
              type="url"
              value={coverVideoURL}
              onChange={(e) => setCoverVideoURL(e.target.value)}
              placeholder="https://vimeo.com/123456789"
              className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-1"
              style={inputStyle}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: theme.text.secondary }}>
              EPUB File
              <span className="ml-2 text-xs font-normal" style={{ color: theme.text.tertiary }}>
                max 50 MB
              </span>
            </label>
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
            {pendingEpubFile ? (
              <div
                className="flex items-center gap-3 px-3 py-2 rounded-lg border text-sm"
                style={inputStyle}
              >
                <FileText size={16} style={{ color: theme.accents.goldenGlow }} />
                <span className="flex-1 truncate">{pendingEpubFile.name}</span>
                <button
                  onClick={() => {
                    setPendingEpubFile(null);
                    if (epubInputRef.current) epubInputRef.current.value = "";
                  }}
                  className="text-xs hover:underline"
                  style={{ color: theme.text.tertiary }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                onClick={() => epubInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors hover:bg-white/5"
                style={inputStyle}
              >
                <Upload size={16} style={{ color: theme.text.tertiary }} />
                <span style={{ color: theme.text.tertiary }}>Choose .epub file</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex items-center justify-end gap-3 sticky bottom-0"
          style={{
            backgroundColor: "rgba(20, 20, 20, 1)",
            borderTop: "1px solid rgba(255, 255, 255, 0.15)",
          }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/10"
            style={{ color: theme.text.secondary }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || !author.trim() || !slug.trim() || isCreating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
            style={{
              backgroundColor: theme.accents.goldenGlow,
              color: theme.surfaces.base,
            }}
          >
            {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Create Story
          </button>
        </div>
      </div>
    </div>
  );
}

function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
