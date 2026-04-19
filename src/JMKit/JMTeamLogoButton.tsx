"use client";

/**
 * JMTeamLogoButton — Circular team logo with color tint overlay.
 *
 * Renders a grayscale team logo tinted with the supplied team color
 * using `mixBlendMode: "color"`. Optionally wraps in a tappable button
 * when `onPress` is provided.
 */

export interface JMTeamLogoButtonProps {
  /** URL to the team logo image (grayscale JPG) */
  logoUrl: string;
  /** Team color hex (e.g. "#E84C1E") — used for tint overlay */
  color: string;
  /** Size of the circle in px (default 160) */
  size?: number;
  /** If provided, the logo becomes tappable */
  onPress?: () => void;
  /** Additional className on the outer wrapper */
  className?: string;
}

export function JMTeamLogoButton({
  logoUrl,
  color,
  size = 160,
  onPress,
  className,
}: JMTeamLogoButtonProps) {
  const circle = (
    <div className="flex justify-center">
      <div
        className="relative shrink-0 overflow-hidden rounded-full"
        style={{ width: size, height: size, backgroundColor: `${color}20` }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${logoUrl})` }}
        />
        <div
          className="absolute inset-0"
          style={{ backgroundColor: color, mixBlendMode: "color" }}
        />
      </div>
    </div>
  );

  if (onPress) {
    return (
      <button
        type="button"
        className={`mb-3 w-full transition-transform active:scale-95 ${className ?? ""}`}
        onClick={onPress}
      >
        {circle}
      </button>
    );
  }

  return <div className={`mb-3 ${className ?? ""}`}>{circle}</div>;
}
