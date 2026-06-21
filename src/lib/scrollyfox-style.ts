/**
 * ScrollyFox — style model, font catalog, and the inheritance resolver.
 *
 * Styling is layered, resolved per device:
 *
 *   DEFAULT_STYLE  <  sf.desktop  <  sf[device]  <  seg.desktop  <  seg[device]
 *
 * The ScrollyFox document carries a full style (its `desktop` layer) plus
 * optional `tablet`/`mobile` partial overrides. Each segment may carry its own
 * partial overrides in the same shape. `resolveStyle()` flattens all of that
 * into one full style for a given device; `toCss()` turns it into concrete CSS.
 */

export type DeviceMode = "desktop" | "tablet" | "mobile";

export const DEVICE_MODES: DeviceMode[] = ["desktop", "tablet", "mobile"];

/** A typographic role — family + weight + color. */
export interface TypeStyle {
  /** References a FONT_CATALOG entry id. */
  fontId: string;
  weight: number;
  color: string;
}

/** A full, resolvable style for one device. */
export interface ScrollyFoxStyle {
  title: TypeStyle;
  subtitle: TypeStyle;
  /** Body / paragraph text — used by future text-heavy segments. */
  text: TypeStyle;
  cta: TypeStyle;
  background: string;
  /** `null` = no border. */
  borderColor: string | null;
  borderWidth: number;
  shadow: boolean;
  cornerRadius: number;
}

/** A partial override of a full style (any subset of fields). */
export interface PartialScrollyFoxStyle {
  title?: Partial<TypeStyle>;
  subtitle?: Partial<TypeStyle>;
  text?: Partial<TypeStyle>;
  cta?: Partial<TypeStyle>;
  background?: string;
  borderColor?: string | null;
  borderWidth?: number;
  shadow?: boolean;
  cornerRadius?: number;
}

/** Per-device layers. `desktop` is the base; `tablet`/`mobile` override it. */
export interface DeviceStyleLayers {
  desktop?: PartialScrollyFoxStyle;
  tablet?: PartialScrollyFoxStyle;
  mobile?: PartialScrollyFoxStyle;
}

/* ─── Font catalog ────────────────────────────────────────── */

export interface FontOption {
  id: string;
  label: string;
  /** CSS font-family stack. Web-safe stacks + the site's custom faces. */
  stack: string;
}

/**
 * Web-safe families (render everywhere with no loading) plus the site's own
 * custom faces. Loading a live Google-Fonts catalog is a follow-up — add
 * entries here once the faces are actually loaded.
 */
export const FONT_CATALOG: FontOption[] = [
  { id: "helvetica", label: "Helvetica", stack: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { id: "arial", label: "Arial", stack: "Arial, Helvetica, sans-serif" },
  { id: "verdana", label: "Verdana", stack: "Verdana, Geneva, sans-serif" },
  { id: "trebuchet", label: "Trebuchet MS", stack: '"Trebuchet MS", Helvetica, sans-serif' },
  { id: "tahoma", label: "Tahoma", stack: "Tahoma, Geneva, sans-serif" },
  { id: "georgia", label: "Georgia", stack: 'Georgia, "Times New Roman", serif' },
  { id: "times", label: "Times New Roman", stack: '"Times New Roman", Times, serif' },
  { id: "palatino", label: "Palatino", stack: '"Palatino Linotype", "Book Antiqua", Palatino, serif' },
  { id: "garamond", label: "Garamond", stack: 'Garamond, "Times New Roman", serif' },
  { id: "courier", label: "Courier", stack: '"Courier New", Courier, monospace' },
  { id: "system", label: "System Sans", stack: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" },
  // Site custom faces (loaded via next/font CSS variables in layout.tsx).
  { id: "jambo", label: "Jambo (site display)", stack: "var(--font-jm-jambo), system-ui, sans-serif" },
  { id: "crimson", label: "Crimson Pro (site)", stack: "var(--font-geist-sans), Georgia, serif" },
  { id: "jetbrains", label: "JetBrains Mono (site)", stack: "var(--font-geist-mono), monospace" },
];

export function fontStack(fontId: string): string {
  return FONT_CATALOG.find((f) => f.id === fontId)?.stack ?? FONT_CATALOG[0]!.stack;
}

export const WEIGHT_OPTIONS: { value: number; label: string }[] = [
  { value: 300, label: "Light" },
  { value: 400, label: "Normal" },
  { value: 500, label: "Medium" },
  { value: 600, label: "Semibold" },
  { value: 700, label: "Bold" },
  { value: 800, label: "Extra Bold" },
];

/* ─── Defaults ────────────────────────────────────────────── */

const WHITE = "#FFFFFF";

/**
 * Standard, neutral defaults — a clean sans (not the app's display font),
 * white type on a black background. Title bold, subtitle medium, text normal,
 * CTA small + bold (size is the segment's responsibility; weight lives here).
 */
export const DEFAULT_STYLE: ScrollyFoxStyle = {
  title: { fontId: "helvetica", weight: 700, color: WHITE },
  subtitle: { fontId: "helvetica", weight: 500, color: WHITE },
  text: { fontId: "helvetica", weight: 400, color: WHITE },
  cta: { fontId: "helvetica", weight: 700, color: WHITE },
  background: "#000000",
  borderColor: null,
  borderWidth: 2,
  shadow: false,
  cornerRadius: 15,
};

/* ─── Merge / diff / resolve ──────────────────────────────── */

function mergeType(base: TypeStyle, ov?: Partial<TypeStyle>): TypeStyle {
  if (!ov) return base;
  return {
    fontId: ov.fontId ?? base.fontId,
    weight: ov.weight ?? base.weight,
    color: ov.color ?? base.color,
  };
}

/** Merge a partial override onto a full style, producing a full style. */
export function mergeStyle(
  base: ScrollyFoxStyle,
  ov?: PartialScrollyFoxStyle,
): ScrollyFoxStyle {
  if (!ov) return base;
  return {
    title: mergeType(base.title, ov.title),
    subtitle: mergeType(base.subtitle, ov.subtitle),
    text: mergeType(base.text, ov.text),
    cta: mergeType(base.cta, ov.cta),
    background: ov.background ?? base.background,
    // borderColor may legitimately be null ("none"), so test for undefined.
    borderColor: ov.borderColor !== undefined ? ov.borderColor : base.borderColor,
    borderWidth: ov.borderWidth ?? base.borderWidth,
    shadow: ov.shadow ?? base.shadow,
    cornerRadius: ov.cornerRadius ?? base.cornerRadius,
  };
}

function diffType(value: TypeStyle, base: TypeStyle): Partial<TypeStyle> | null {
  const out: Partial<TypeStyle> = {};
  if (value.fontId !== base.fontId) out.fontId = value.fontId;
  if (value.weight !== base.weight) out.weight = value.weight;
  if (value.color !== base.color) out.color = value.color;
  return Object.keys(out).length ? out : null;
}

/** Produce the partial of `value` that differs from `base`. */
export function diffStyle(
  value: ScrollyFoxStyle,
  base: ScrollyFoxStyle,
): PartialScrollyFoxStyle {
  const out: PartialScrollyFoxStyle = {};
  const t = diffType(value.title, base.title);
  if (t) out.title = t;
  const s = diffType(value.subtitle, base.subtitle);
  if (s) out.subtitle = s;
  const x = diffType(value.text, base.text);
  if (x) out.text = x;
  const c = diffType(value.cta, base.cta);
  if (c) out.cta = c;
  if (value.background !== base.background) out.background = value.background;
  if (value.borderColor !== base.borderColor) out.borderColor = value.borderColor;
  if (value.borderWidth !== base.borderWidth) out.borderWidth = value.borderWidth;
  if (value.shadow !== base.shadow) out.shadow = value.shadow;
  if (value.cornerRadius !== base.cornerRadius)
    out.cornerRadius = value.cornerRadius;
  return out;
}

export function isEmptyPartial(p: PartialScrollyFoxStyle): boolean {
  return Object.keys(p).length === 0;
}

/** Base full style for one device, before any segment override. */
export function resolveDocStyle(
  layers: DeviceStyleLayers | undefined,
  device: DeviceMode,
): ScrollyFoxStyle {
  let s = mergeStyle(DEFAULT_STYLE, layers?.desktop);
  if (device !== "desktop") s = mergeStyle(s, layers?.[device]);
  return s;
}

/** Full style for a segment on a device: doc style + segment overrides. */
export function resolveStyle(
  docLayers: DeviceStyleLayers | undefined,
  segLayers: DeviceStyleLayers | undefined,
  device: DeviceMode,
): ScrollyFoxStyle {
  let s = resolveDocStyle(docLayers, device);
  if (segLayers) {
    s = mergeStyle(s, segLayers.desktop);
    if (device !== "desktop") s = mergeStyle(s, segLayers[device]);
  }
  return s;
}

/* ─── CSS resolution (what segments actually render with) ─── */

export interface ResolvedTypeStyle {
  fontFamily: string;
  fontWeight: number;
  color: string;
}

export interface ResolvedStyle {
  title: ResolvedTypeStyle;
  subtitle: ResolvedTypeStyle;
  text: ResolvedTypeStyle;
  cta: ResolvedTypeStyle;
  background: string;
  /** CSS `border` shorthand, or "none". */
  border: string;
  borderRadius: number;
  /** CSS `box-shadow`, or "none". */
  boxShadow: string;
}

function toCssType(t: TypeStyle): ResolvedTypeStyle {
  return { fontFamily: fontStack(t.fontId), fontWeight: t.weight, color: t.color };
}

export function toCss(style: ScrollyFoxStyle): ResolvedStyle {
  return {
    title: toCssType(style.title),
    subtitle: toCssType(style.subtitle),
    text: toCssType(style.text),
    cta: toCssType(style.cta),
    background: style.background,
    border: style.borderColor
      ? `${style.borderWidth}px solid ${style.borderColor}`
      : "none",
    borderRadius: style.cornerRadius,
    boxShadow: style.shadow ? "0 12px 32px rgba(0,0,0,0.45)" : "none",
  };
}

/**
 * Build the three stored layers from edited full styles per device, diffing
 * against the inherited base. `base[device]` is the full style this layer sits
 * on top of (DEFAULT_STYLE for the doc level; the doc-resolved style for a
 * segment). Empty layers are omitted so documents stay lean.
 */
export function buildLayers(
  working: Record<DeviceMode, ScrollyFoxStyle>,
  base: Record<DeviceMode, ScrollyFoxStyle>,
): DeviceStyleLayers {
  const desktop = diffStyle(working.desktop, base.desktop);
  // Non-desktop layers sit on top of (base[device] + this layer's desktop diff),
  // mirroring the resolver's application order.
  const tabletBase = mergeStyle(base.tablet, desktop);
  const mobileBase = mergeStyle(base.mobile, desktop);
  const tablet = diffStyle(working.tablet, tabletBase);
  const mobile = diffStyle(working.mobile, mobileBase);

  const out: DeviceStyleLayers = {};
  if (!isEmptyPartial(desktop)) out.desktop = desktop;
  if (!isEmptyPartial(tablet)) out.tablet = tablet;
  if (!isEmptyPartial(mobile)) out.mobile = mobile;
  return out;
}

/**
 * Seed editable full styles per device from existing layers stacked on a base.
 * Inverse of buildLayers — what the settings panel shows when it opens.
 */
export function seedWorking(
  layers: DeviceStyleLayers | undefined,
  base: Record<DeviceMode, ScrollyFoxStyle>,
): Record<DeviceMode, ScrollyFoxStyle> {
  const desktop = mergeStyle(base.desktop, layers?.desktop);
  const tablet = mergeStyle(mergeStyle(base.tablet, layers?.desktop), layers?.tablet);
  const mobile = mergeStyle(mergeStyle(base.mobile, layers?.desktop), layers?.mobile);
  return { desktop, tablet, mobile };
}
