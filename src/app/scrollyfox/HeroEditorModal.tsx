"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { JMImageUpload } from "@/JMKit";
import { useJMStyle } from "@/JMStyle";
import { useAuth } from "@/lib/AuthProvider";
import { DEFAULT_BRAND, type BrandObject } from "@/lib/brand";
import { saveHeroTemplate, uploadHeroTemplateImage } from "@/lib/scrollyfox";
import {
  HeroSegment,
  type HeroCTA,
  type HeroContent,
  type HeroLayout,
} from "./segments/HeroSegment";

interface HeroEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DeviceMode = "desktop" | "tablet" | "mobile";

const DEFAULT_HERO: HeroContent = {
  layout: "split-image-left",
  imageUrl: null,
  imageMobileUrl: null,
  imageAlt: "",
  title: "Your Title Here",
  subtitle:
    "A short subtitle that describes the experience you're inviting the visitor into.",
  ctas: [{ label: "Get Started", href: "#" }],
};

const LAYOUT_OPTIONS: { value: HeroLayout; label: string }[] = [
  { value: "split-image-left", label: "Image left" },
  { value: "split-image-right", label: "Image right" },
];

const DEVICE_OPTIONS: { value: DeviceMode; label: string; widthPx: number | null }[] = [
  { value: "desktop", label: "Desktop", widthPx: null },
  { value: "tablet", label: "Tablet", widthPx: 900 },
  { value: "mobile", label: "Mobile", widthPx: 360 },
];

export function HeroEditorModal({ isOpen, onClose }: HeroEditorModalProps) {
  const { theme } = useJMStyle();
  const { user, isAdmin } = useAuth();
  const [draftId] = useState(
    () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  const [content, setContent] = useState<HeroContent>(DEFAULT_HERO);
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const brand: BrandObject = DEFAULT_BRAND;

  if (!isOpen) return null;

  const ctas = content.ctas ?? [];

  const updateContent = <K extends keyof HeroContent>(
    key: K,
    value: HeroContent[K],
  ) => {
    setContent((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddCta = () => {
    updateContent("ctas", [...ctas, { label: "New CTA", href: "#" }]);
  };

  const handleRemoveCta = (idx: number) => {
    updateContent(
      "ctas",
      ctas.filter((_, i) => i !== idx),
    );
  };

  const updateCta = (idx: number, field: keyof HeroCTA, value: string) => {
    updateContent(
      "ctas",
      ctas.map((cta, i) => (i === idx ? { ...cta, [field]: value } : cta)),
    );
  };

  const handleSave = async () => {
    if (!user || !isAdmin) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveHeroTemplate(content.layout, content, user.uid);
      onClose();
    } catch (err) {
      console.error("Failed to save Hero template", err);
      setSaveError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setIsSaving(false);
    }
  };

  const activeDevice = DEVICE_OPTIONS.find((d) => d.value === deviceMode);
  const previewWidth = activeDevice?.widthPx;

  return (
    <div
      className="fixed inset-0 z-60 flex flex-col"
      style={{ backgroundColor: theme.surfaces.base }}
      role="dialog"
      aria-modal="true"
      aria-label="Hero template editor"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: theme.surfaces.elevated2 }}
      >
        <h2
          className="text-lg font-bold"
          style={{ color: theme.text.primary }}
        >
          Hero Template Editor
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-2"
          style={{ color: theme.text.secondary }}
          aria-label="Close editor"
        >
          <X size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Editor controls */}
        <div
          className="border-b p-4 lg:p-6"
          style={{ borderColor: theme.surfaces.elevated2 }}
        >
          <div className="mx-auto grid w-full max-w-5xl gap-4 md:grid-cols-2">
            {/* Layout toggle */}
            <div className="md:col-span-2">
              <label
                className="mb-2 block text-sm font-semibold"
                style={{ color: theme.text.primary }}
              >
                Layout
              </label>
              <div className="flex gap-2">
                {LAYOUT_OPTIONS.map((opt) => {
                  const active = content.layout === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateContent("layout", opt.value)}
                      className="rounded-lg border-2 px-4 py-2 text-sm transition-all"
                      style={{
                        borderColor: active
                          ? theme.accents.neonPink
                          : theme.surfaces.elevated2,
                        color: active
                          ? theme.accents.neonPink
                          : theme.text.secondary,
                        backgroundColor: "transparent",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div>
              <label
                className="mb-2 block text-sm font-semibold"
                style={{ color: theme.text.primary }}
              >
                Title
              </label>
              <input
                type="text"
                value={content.title}
                onChange={(e) => updateContent("title", e.target.value)}
                className="w-full rounded-lg border-2 px-3 py-2 text-sm"
                style={{
                  borderColor: theme.surfaces.elevated2,
                  backgroundColor: theme.surfaces.elevated1,
                  color: theme.text.primary,
                }}
              />
            </div>

            {/* Subtitle */}
            <div>
              <label
                className="mb-2 block text-sm font-semibold"
                style={{ color: theme.text.primary }}
              >
                Subtitle
              </label>
              <textarea
                value={content.subtitle ?? ""}
                onChange={(e) => updateContent("subtitle", e.target.value)}
                rows={2}
                className="w-full rounded-lg border-2 px-3 py-2 text-sm"
                style={{
                  borderColor: theme.surfaces.elevated2,
                  backgroundColor: theme.surfaces.elevated1,
                  color: theme.text.primary,
                }}
              />
            </div>

            {/* Desktop image */}
            <div>
              <JMImageUpload
                label="Image (desktop)"
                {...(content.imageUrl ? { value: content.imageUrl } : {})}
                aspectRatio="landscape"
                previewSize={300}
                onUpload={(file) =>
                  uploadHeroTemplateImage(file, "desktop", draftId)
                }
                onChange={(url) => updateContent("imageUrl", url)}
              />
            </div>

            {/* Mobile image */}
            <div>
              <JMImageUpload
                label="Image (mobile, optional)"
                {...(content.imageMobileUrl ? { value: content.imageMobileUrl } : {})}
                aspectRatio="portrait"
                previewSize={200}
                onUpload={(file) =>
                  uploadHeroTemplateImage(file, "mobile", draftId)
                }
                onChange={(url) => updateContent("imageMobileUrl", url)}
              />
            </div>

            {/* CTAs */}
            <div className="md:col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <label
                  className="text-sm font-semibold"
                  style={{ color: theme.text.primary }}
                >
                  CTAs
                </label>
                <button
                  type="button"
                  onClick={handleAddCta}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs"
                  style={{ color: theme.accents.neonPink }}
                >
                  <Plus size={14} /> Add CTA
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {ctas.map((cta, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Label"
                      value={cta.label}
                      onChange={(e) => updateCta(idx, "label", e.target.value)}
                      className="flex-1 rounded-lg border-2 px-3 py-2 text-sm"
                      style={{
                        borderColor: theme.surfaces.elevated2,
                        backgroundColor: theme.surfaces.elevated1,
                        color: theme.text.primary,
                      }}
                    />
                    <input
                      type="text"
                      placeholder="https://… or #anchor"
                      value={cta.href ?? ""}
                      onChange={(e) => updateCta(idx, "href", e.target.value)}
                      className="flex-1 rounded-lg border-2 px-3 py-2 text-sm"
                      style={{
                        borderColor: theme.surfaces.elevated2,
                        backgroundColor: theme.surfaces.elevated1,
                        color: theme.text.primary,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveCta(idx)}
                      className="rounded-md p-2"
                      style={{ color: theme.text.tertiary }}
                      aria-label="Remove CTA"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {ctas.length === 0 && (
                  <p
                    className="text-xs"
                    style={{ color: theme.text.tertiary }}
                  >
                    No CTAs. Add one with the button above.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="flex flex-col gap-3 p-4 lg:p-6">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
            <h3
              className="text-sm font-semibold"
              style={{ color: theme.text.primary }}
            >
              Preview
            </h3>
            <div className="flex gap-1">
              {DEVICE_OPTIONS.map((opt) => {
                const active = deviceMode === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDeviceMode(opt.value)}
                    className="rounded-md px-3 py-1 text-xs"
                    style={{
                      backgroundColor: active
                        ? theme.accents.neonPink
                        : "transparent",
                      color: active
                        ? theme.surfaces.base
                        : theme.text.secondary,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div
            className="mx-auto overflow-hidden rounded-lg border-2"
            style={{
              width: previewWidth ? `${previewWidth}px` : "100%",
              maxWidth: "100%",
              borderColor: theme.surfaces.elevated2,
            }}
          >
            <HeroSegment
              {...content}
              brand={brand}
              deviceMode={deviceMode}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-end gap-3 border-t px-4 py-3"
        style={{ borderColor: theme.surfaces.elevated2 }}
      >
        {saveError && (
          <span
            className="mr-auto text-xs"
            style={{ color: theme.semantic.error }}
          >
            {saveError}
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm"
          style={{ color: theme.text.secondary }}
        >
          Cancel
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-all"
            style={{
              borderColor: theme.accents.goldenGlow,
              color: theme.accents.goldenGlow,
              backgroundColor: "transparent",
              opacity: isSaving ? 0.5 : 1,
            }}
          >
            {isSaving ? "Saving…" : "Save to Templates"}
          </button>
        )}
      </div>
    </div>
  );
}
