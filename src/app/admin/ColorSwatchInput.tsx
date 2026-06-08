"use client";

/**
 * Color swatch + picker for the admin game editors.
 *
 * The visible swatch is a plain <div> whose backgroundColor is the hex value,
 * so it reliably reflects any valid CSS color (the native <input type="color">
 * swatch renders unreliably under our Tailwind reset / overrides — it was
 * showing white despite valid hex values). A transparent native color input is
 * layered on top purely to open the OS color picker on click.
 */
export function ColorSwatchInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (hex: string) => void;
  ariaLabel?: string;
}) {
  const display = value || "#ffffff";
  return (
    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-white/20">
      <div className="absolute inset-0" style={{ backgroundColor: display }} />
      <input
        type="color"
        value={display}
        onChange={(e) => onChange(e.target.value)}
        {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}
