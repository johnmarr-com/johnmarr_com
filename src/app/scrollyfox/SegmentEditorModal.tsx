"use client";

import { useState } from "react";
import { Plus, Settings, Trash2, X } from "lucide-react";
import { JMImageUpload, JMModal } from "@/JMKit";
import { useJMStyle } from "@/JMStyle";
import {
  newSegmentId,
  uploadSegmentImage,
  type ScrollyFoxSegment,
  type SegmentType,
} from "@/lib/scrollyfox";
import {
  resolveDocStyle,
  resolveStyle,
  toCss,
  type DeviceMode,
  type DeviceStyleLayers,
  type ScrollyFoxStyle,
} from "@/lib/scrollyfox-style";
import { StyleSettings } from "./StyleSettings";
import {
  HeroSegment,
  type HeroCTA,
  type HeroContent,
  type HeroLayout,
} from "./segments/HeroSegment";

interface SegmentEditorModalProps {
  /** Segment to edit. Omit to build a new one. */
  initialSegment?: ScrollyFoxSegment;
  /** ScrollyFox-level style layers — the base this segment inherits + overrides. */
  docStyle?: DeviceStyleLayers;
  /** Hand the finished segment back to the document editor. */
  onSave: (segment: ScrollyFoxSegment) => void;
  onClose: () => void;
}

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

/** Segment types offered in the top-right selector. Only Hero ships today. */
const SEGMENT_TYPES: { value: SegmentType; label: string }[] = [
  { value: "hero", label: "Hero" },
];

const LAYOUT_OPTIONS: { value: HeroLayout; label: string }[] = [
  { value: "split-image-left", label: "Image left" },
  { value: "split-image-right", label: "Image right" },
  { value: "centered", label: "Centered" },
  { value: "overlay", label: "Overlay" },
];

const DEVICE_OPTIONS: { value: DeviceMode; label: string; widthPx: number | null }[] = [
  { value: "desktop", label: "Desktop", widthPx: null },
  { value: "tablet", label: "Tablet", widthPx: 900 },
  { value: "mobile", label: "Mobile", widthPx: 360 },
];

export function SegmentEditorModal({
  initialSegment,
  docStyle,
  onSave,
  onClose,
}: SegmentEditorModalProps) {
  const { theme } = useJMStyle();
  const [segmentId] = useState(() => initialSegment?.id ?? newSegmentId());
  const [type, setType] = useState<SegmentType>(initialSegment?.type ?? "hero");
  const [content, setContent] = useState<HeroContent>(
    initialSegment?.content ?? DEFAULT_HERO,
  );
  const [styleOverride, setStyleOverride] = useState<DeviceStyleLayers>(
    initialSegment?.style ?? {},
  );
  const [layouts, setLayouts] = useState<{
    tablet?: HeroLayout;
    mobile?: HeroLayout;
  }>(initialSegment?.layouts ?? {});
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const ctas = content.ctas ?? [];

  const updateContent = <K extends keyof HeroContent>(
    key: K,
    value: HeroContent[K],
  ) => {
    setContent((prev) => ({ ...prev, [key]: value }));
  };

  const handleTypeChange = (next: SegmentType) => {
    if (next === type) return;
    // Hero is the only type today, so content carries over unchanged. When more
    // segment types land, map shared fields (image, title, subtitle, CTAs) here.
    setType(next);
  };

  // Layout is per-device: desktop lives in content.layout; tablet/mobile are
  // remembered overrides that inherit desktop until set.
  const activeLayout: HeroLayout =
    deviceMode === "tablet"
      ? (layouts.tablet ?? content.layout)
      : deviceMode === "mobile"
        ? (layouts.mobile ?? content.layout)
        : content.layout;

  const setLayoutForDevice = (next: HeroLayout) => {
    if (deviceMode === "tablet") setLayouts((p) => ({ ...p, tablet: next }));
    else if (deviceMode === "mobile") setLayouts((p) => ({ ...p, mobile: next }));
    else updateContent("layout", next);
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

  const handleSave = () => {
    onSave({
      id: segmentId,
      type,
      content,
      ...(Object.keys(layouts).length ? { layouts } : {}),
      ...(Object.keys(styleOverride).length ? { style: styleOverride } : {}),
    });
    onClose();
  };

  // Resolved style for the live preview (segment override on top of the doc style).
  const resolved = toCss(resolveStyle(docStyle, styleOverride, deviceMode));

  // Inherited base per device for the per-segment settings panel.
  const segmentBase: Record<DeviceMode, ScrollyFoxStyle> = {
    desktop: resolveDocStyle(docStyle, "desktop"),
    tablet: resolveDocStyle(docStyle, "tablet"),
    mobile: resolveDocStyle(docStyle, "mobile"),
  };

  const activeDevice = DEVICE_OPTIONS.find((d) => d.value === deviceMode);
  const previewWidth = activeDevice?.widthPx;

  return (
    <div
      className="fixed inset-0 z-60 flex flex-col"
      style={{ backgroundColor: theme.surfaces.base }}
      role="dialog"
      aria-modal="true"
      aria-label="Segment builder"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 border-b px-4 py-3"
        style={{ borderColor: theme.surfaces.elevated2 }}
      >
        <h2 className="text-lg font-bold" style={{ color: theme.text.primary }}>
          {initialSegment ? "Edit Segment" : "Add Segment"}
        </h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-md p-2"
            style={{ color: theme.text.secondary }}
            aria-label="Segment style settings"
            title="Segment style (overrides the ScrollyFox defaults)"
          >
            <Settings size={18} />
          </button>
          {/* Segment-type / template selector */}
          <label className="flex items-center gap-2">
            <span
              className="hidden text-xs font-semibold sm:inline"
              style={{ color: theme.text.secondary }}
            >
              Template
            </span>
            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value as SegmentType)}
              className="rounded-lg border-2 px-3 py-1.5 text-sm"
              style={{
                borderColor: theme.surfaces.elevated2,
                backgroundColor: theme.surfaces.elevated1,
                color: theme.text.primary,
              }}
              aria-label="Segment template"
            >
              {SEGMENT_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
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
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Editor controls */}
        <div
          className="border-b p-4 lg:p-6"
          style={{ borderColor: theme.surfaces.elevated2 }}
        >
          <div className="mx-auto grid w-full max-w-5xl gap-4 md:grid-cols-2">
            {/* Device (primary) + Layout (secondary, remembered per device) */}
            <div className="md:col-span-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              {/* Device — primary selector (drives preview + which device you edit) */}
              <div>
                <label
                  className="mb-2 block text-sm font-semibold"
                  style={{ color: theme.text.primary }}
                >
                  Device
                </label>
                <div className="flex gap-1">
                  {DEVICE_OPTIONS.map((opt) => {
                    const active = deviceMode === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setDeviceMode(opt.value)}
                        className="rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-all"
                        style={{
                          borderColor: active
                            ? theme.accents.neonPink
                            : theme.surfaces.elevated2,
                          color: active
                            ? theme.surfaces.base
                            : theme.text.secondary,
                          backgroundColor: active
                            ? theme.accents.neonPink
                            : "transparent",
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Layout — secondary, stored for the selected device */}
              <div className="sm:text-right">
                <label
                  className="mb-2 block text-sm font-semibold"
                  style={{ color: theme.text.primary }}
                >
                  Layout
                  <span
                    className="ml-1 text-xs font-normal"
                    style={{ color: theme.text.tertiary }}
                  >
                    · {activeDevice?.label}
                  </span>
                </label>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  {LAYOUT_OPTIONS.map((opt) => {
                    const active = activeLayout === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setLayoutForDevice(opt.value)}
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
                onUpload={(file) => uploadSegmentImage(file, "desktop", segmentId)}
                onChange={(url) => updateContent("imageUrl", url)}
              />
            </div>

            {/* Mobile image */}
            <div>
              <JMImageUpload
                label="Image (mobile, optional)"
                {...(content.imageMobileUrl
                  ? { value: content.imageMobileUrl }
                  : {})}
                aspectRatio="portrait"
                previewSize={200}
                onUpload={(file) => uploadSegmentImage(file, "mobile", segmentId)}
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
                  <p className="text-xs" style={{ color: theme.text.tertiary }}>
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
            <span className="text-xs" style={{ color: theme.text.secondary }}>
              {activeDevice?.label}
            </span>
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
              layout={activeLayout}
              style={resolved}
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
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm"
          style={{ color: theme.text.secondary }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-all"
          style={{
            borderColor: theme.accents.goldenGlow,
            color: theme.accents.goldenGlow,
            backgroundColor: "transparent",
          }}
        >
          Save
        </button>
      </div>

      {/* Per-segment style settings */}
      <JMModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Segment style"
        maxWidthClass="max-w-lg"
      >
        <StyleSettings
          base={segmentBase}
          initialLayers={styleOverride}
          onApply={(layers) => {
            setStyleOverride(layers);
            setSettingsOpen(false);
          }}
          onCancel={() => setSettingsOpen(false)}
        />
      </JMModal>
    </div>
  );
}
