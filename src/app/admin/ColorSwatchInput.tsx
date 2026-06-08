"use client";

/**
 * Color swatch + picker for the admin game editors.
 *
 * The visible swatch is a plain <div> (the native <input type="color"> swatch
 * renders unreliably under our Tailwind reset). When a color IS set, the div
 * shows that hex. When it is NOT set, it shows a checkerboard so an unset color
 * is unmistakable rather than looking like a solid white color. A transparent
 * native color input is layered on top purely to open the OS picker on click.
 */
const UNSET_CHECKERBOARD =
  "repeating-conic-gradient(rgba(255,255,255,0.35) 0% 25%, transparent 0% 50%) 50% / 8px 8px";

export function ColorSwatchInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (hex: string) => void;
  ariaLabel?: string;
}) {
  const hasValue = !!value.trim();
  return (
    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-white/20">
      <div
        className="absolute inset-0"
        style={hasValue ? { backgroundColor: value } : { background: UNSET_CHECKERBOARD }}
      />
      <input
        type="color"
        value={hasValue ? value : "#ffffff"}
        onChange={(e) => onChange(e.target.value)}
        {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}
