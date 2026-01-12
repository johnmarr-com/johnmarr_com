"use client";

import React from "react";

interface GradientConfig {
  from: string;
  to: string;
  /** Angle in degrees, defaults to 135 (bottom-left to top-right) */
  angle?: number;
}

interface JMSimpleButtonProps {
  /** Button label text */
  title: string;
  /** Solid background color (use this OR gradient, not both) */
  backgroundColor?: string;
  /** Gradient background (use this OR backgroundColor, not both) */
  gradient?: GradientConfig;
  /** Opacity of the background (0-1), defaults to 1 */
  backgroundOpacity?: number;
  /** Text color */
  titleColor?: string;
  /** Click handler */
  onClick?: (() => void) | undefined;
  /** Additional CSS classes */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * JMSimpleButton - A pill-shaped button with gradient or solid color support
 * 
 * @example
 * ```tsx
 * <JMSimpleButton
 *   title="John"
 *   gradient={{ from: "#6310ef", to: "#c529bf", angle: 135 }}
 *   backgroundOpacity={0.33}
 *   titleColor="#e03dff"
 *   onClick={() => console.log("clicked")}
 * />
 * ```
 */
export function JMSimpleButton({
  title,
  backgroundColor,
  gradient,
  backgroundOpacity = 1,
  titleColor = "#ffffff",
  onClick,
  className = "",
  disabled = false,
}: JMSimpleButtonProps) {
  // Build the background style
  const getBackgroundStyle = (): React.CSSProperties => {
    if (gradient) {
      const angle = gradient.angle ?? 135;
      return {
        background: `linear-gradient(${angle}deg, ${gradient.from}, ${gradient.to})`,
        opacity: backgroundOpacity,
      };
    }
    
    if (backgroundColor) {
      return {
        backgroundColor,
        opacity: backgroundOpacity,
      };
    }
    
    return {
      backgroundColor: "#333333",
      opacity: backgroundOpacity,
    };
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        relative
        overflow-hidden
        rounded-full
        px-5 py-2
        font-medium
        text-sm
        transition-all duration-200
        hover:scale-105
        active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
        ${className}
      `.trim().replace(/\s+/g, " ")}
      style={{ color: titleColor }}
    >
      {/* Background layer with opacity */}
      <span
        className="absolute inset-0 rounded-full"
        style={getBackgroundStyle()}
        aria-hidden="true"
      />
      {/* Text layer (always full opacity) */}
      <span className="relative z-10">{title}</span>
    </button>
  );
}

