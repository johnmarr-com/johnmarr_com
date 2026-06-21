"use client";

import { useState } from "react";
import { JMFontPicker } from "@/JMKit";
import { useJMStyle } from "@/JMStyle";
import {
  buildLayers,
  DEVICE_MODES,
  fontStack,
  FONT_CATALOG,
  mergeStyle,
  WEIGHT_OPTIONS,
  type DeviceMode,
  type DeviceStyleLayers,
  type PartialScrollyFoxStyle,
  type ScrollyFoxStyle,
  type TypeStyle,
} from "@/lib/scrollyfox-style";

type RoleKey = "title" | "subtitle" | "text" | "cta";

const ROLES: { key: RoleKey; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "subtitle", label: "Subtitle" },
  { key: "text", label: "Text" },
  { key: "cta", label: "CTA" },
];

const DEVICE_LABELS: Record<DeviceMode, string> = {
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
};

export interface StyleSettingsProps {
  /** Inherited base per device this panel's overrides sit on top of. */
  base: Record<DeviceMode, ScrollyFoxStyle>;
  /** Existing override layers (doc-level or segment-level). */
  initialLayers?: DeviceStyleLayers;
  onApply: (layers: DeviceStyleLayers) => void;
  onCancel: () => void;
}

export function StyleSettings({
  base,
  initialLayers,
  onApply,
  onCancel,
}: StyleSettingsProps) {
  const { theme } = useJMStyle();
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [layers, setLayers] = useState<DeviceStyleLayers>(initialLayers ?? {});
  const [fontPickerRole, setFontPickerRole] = useState<RoleKey | null>(null);

  // Resolve the editable full style for a device: base[device] + desktop layer
  // (+ this device's layer for non-desktop). Edits to a tab read from here, so
  // inherited values show through.
  const resolveLocal = (d: DeviceMode): ScrollyFoxStyle => {
    let s = mergeStyle(base[d], layers.desktop);
    if (d !== "desktop") s = mergeStyle(s, layers[d]);
    return s;
  };

  const current = resolveLocal(device);

  const setDeviceLayer = (
    d: DeviceMode,
    update: (layer: PartialScrollyFoxStyle) => PartialScrollyFoxStyle,
  ) => {
    setLayers((prev) => {
      const result: DeviceStyleLayers = { ...prev };
      result[d] = update(prev[d] ?? {});
      return result;
    });
  };

  const patchLayer = (patch: PartialScrollyFoxStyle) => {
    setDeviceLayer(device, (l) => ({ ...l, ...patch }));
  };

  const patchRole = (role: RoleKey, patch: Partial<TypeStyle>) => {
    setDeviceLayer(device, (l) => {
      const merged: Partial<TypeStyle> = { ...(l[role] ?? {}), ...patch };
      switch (role) {
        case "title":
          return { ...l, title: merged };
        case "subtitle":
          return { ...l, subtitle: merged };
        case "text":
          return { ...l, text: merged };
        case "cta":
          return { ...l, cta: merged };
        default:
          return { ...l };
      }
    });
  };

  const handleApply = () => {
    const working: Record<DeviceMode, ScrollyFoxStyle> = {
      desktop: resolveLocal("desktop"),
      tablet: resolveLocal("tablet"),
      mobile: resolveLocal("mobile"),
    };
    onApply(buildLayers(working, base));
  };

  const labelStyle = { color: theme.text.primary };
  const inputStyle = {
    borderColor: theme.surfaces.elevated2,
    backgroundColor: theme.surfaces.elevated1,
    color: theme.text.primary,
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Device tabs */}
      <div className="flex gap-1">
        {DEVICE_MODES.map((d) => {
          const active = device === d;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDevice(d)}
              className="flex-1 rounded-md px-3 py-1.5 text-xs font-semibold"
              style={{
                backgroundColor: active ? theme.accents.neonPink : "transparent",
                color: active ? theme.surfaces.base : theme.text.secondary,
                border: `1px solid ${theme.surfaces.elevated2}`,
              }}
            >
              {DEVICE_LABELS[d]}
            </button>
          );
        })}
      </div>
      {device !== "desktop" && (
        <p className="-mt-3 text-xs" style={{ color: theme.text.tertiary }}>
          {DEVICE_LABELS[device]} inherits Desktop — change only what should differ.
        </p>
      )}

      {/* Type roles */}
      <div className="flex flex-col gap-3">
        {ROLES.map(({ key, label }) => {
          const t = current[key];
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-sm font-semibold" style={labelStyle}>
                {label}
              </span>
              <button
                type="button"
                onClick={() => setFontPickerRole(key)}
                className="flex-1 truncate rounded-lg border-2 px-3 py-2 text-left text-sm"
                style={{ ...inputStyle, fontFamily: fontStack(t.fontId) }}
              >
                {FONT_CATALOG.find((f) => f.id === t.fontId)?.label ?? t.fontId}
              </button>
              <select
                value={t.weight}
                onChange={(e) => patchRole(key, { weight: Number(e.target.value) })}
                className="rounded-lg border-2 px-2 py-2 text-sm"
                style={inputStyle}
                aria-label={`${label} weight`}
              >
                {WEIGHT_OPTIONS.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>
              <input
                type="color"
                value={t.color}
                onChange={(e) => patchRole(key, { color: e.target.value })}
                className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border-2"
                style={{ borderColor: theme.surfaces.elevated2 }}
                aria-label={`${label} color`}
              />
            </div>
          );
        })}
      </div>

      {/* Container */}
      <div
        className="flex flex-col gap-3 border-t pt-4"
        style={{ borderColor: theme.surfaces.elevated2 }}
      >
        {/* Background */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold" style={labelStyle}>
            Background
          </span>
          <input
            type="color"
            value={current.background}
            onChange={(e) => patchLayer({ background: e.target.value })}
            className="h-9 w-10 cursor-pointer rounded-lg border-2"
            style={{ borderColor: theme.surfaces.elevated2 }}
            aria-label="Background color"
          />
        </div>

        {/* Border */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold" style={labelStyle}>
            Border
          </span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs" style={{ color: theme.text.secondary }}>
              <input
                type="checkbox"
                checked={current.borderColor !== null}
                onChange={(e) =>
                  patchLayer({ borderColor: e.target.checked ? "#FFFFFF" : null })
                }
              />
              On
            </label>
            {current.borderColor !== null && (
              <>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={current.borderWidth}
                  onChange={(e) =>
                    patchLayer({ borderWidth: Number(e.target.value) })
                  }
                  className="w-16 rounded-lg border-2 px-2 py-1.5 text-sm"
                  style={inputStyle}
                  aria-label="Border width"
                />
                <input
                  type="color"
                  value={current.borderColor}
                  onChange={(e) => patchLayer({ borderColor: e.target.value })}
                  className="h-9 w-10 cursor-pointer rounded-lg border-2"
                  style={{ borderColor: theme.surfaces.elevated2 }}
                  aria-label="Border color"
                />
              </>
            )}
          </div>
        </div>

        {/* Drop shadow */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold" style={labelStyle}>
            Drop shadow
          </span>
          <label className="flex items-center gap-1 text-xs" style={{ color: theme.text.secondary }}>
            <input
              type="checkbox"
              checked={current.shadow}
              onChange={(e) => patchLayer({ shadow: e.target.checked })}
            />
            On
          </label>
        </div>

        {/* Corner radius */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold" style={labelStyle}>
            Corner radius
          </span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={60}
              value={current.cornerRadius}
              onChange={(e) => patchLayer({ cornerRadius: Number(e.target.value) })}
              aria-label="Corner radius"
            />
            <span className="w-10 text-right text-sm" style={{ color: theme.text.secondary }}>
              {current.cornerRadius}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm"
          style={{ color: theme.text.secondary }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="rounded-lg border-2 px-4 py-2 text-sm font-semibold"
          style={{
            borderColor: theme.accents.goldenGlow,
            color: theme.accents.goldenGlow,
            backgroundColor: "transparent",
          }}
        >
          Apply
        </button>
      </div>

      {fontPickerRole && (
        <JMFontPicker
          isOpen
          value={current[fontPickerRole].fontId}
          fonts={FONT_CATALOG}
          onSelect={(fontId) => patchRole(fontPickerRole, { fontId })}
          onClose={() => setFontPickerRole(null)}
          title={`${ROLES.find((r) => r.key === fontPickerRole)?.label} font`}
        />
      )}
    </div>
  );
}
