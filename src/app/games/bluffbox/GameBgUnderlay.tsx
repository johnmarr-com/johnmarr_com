"use client";

export interface GameBgUnderlayProps {
  url?: string | null | undefined;
  /** e.g. `rounded-xl` to match a parent panel */
  className?: string;
}

/**
 * Game splash at 30% opacity, full-bleed. Parent must be `relative`/`fixed` with insets.
 * Renders nothing when `url` is empty.
 */
export function GameBgUnderlay({ url, className }: GameBgUnderlayProps) {
  if (url == null || url.length === 0) return null;
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat ${className ?? ""}`}
      style={{ backgroundImage: `url(${url})`, opacity: 0.3 }}
    />
  );
}
