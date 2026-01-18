"use client";

import { useRef, useState, useEffect } from "react";
import Lottie, { LottieRefCurrentProps } from "lottie-react";
import { useJMStyle } from "@/JMStyle";
import { User } from "lucide-react";

export interface JMLottieAvatarProps {
  /** Lottie animation JSON data or URL to fetch from */
  animationData?: object | null;
  /** URL to fetch Lottie JSON from (alternative to animationData) */
  animationUrl?: string | null;
  /** Avatar size in pixels (default: 48) */
  size?: number;
  /** Whether the animation should loop (default: true) */
  loop?: boolean;
  /** Whether to autoplay (default: true) */
  autoplay?: boolean;
  /** Pause animation on hover (default: false) */
  pauseOnHover?: boolean;
  /** Play animation on hover only (default: false) */
  playOnHover?: boolean;
  /** Fallback image URL if no animation */
  fallbackImageUrl?: string | null;
  /** Additional CSS classes */
  className?: string;
  /** Border width in pixels (default: 2) */
  borderWidth?: number;
  /** Custom border color (defaults to theme accent) */
  borderColor?: string;
  /** Show background color behind animation (default: true) */
  showBackground?: boolean;
  /** Click handler */
  onClick?: () => void;
}

/**
 * JMLottieAvatar - Animated avatar component using Lottie
 * 
 * Displays a Lottie animation in a circular avatar format.
 * Falls back to an image or default user icon if no animation provided.
 * 
 * Usage:
 * ```tsx
 * // With animation data
 * <JMLottieAvatar animationData={myAnimation} size={64} />
 * 
 * // With animation URL
 * <JMLottieAvatar animationUrl="/animations/avatar.json" />
 * 
 * // With hover interaction
 * <JMLottieAvatar animationData={myAnimation} playOnHover />
 * ```
 */
export function JMLottieAvatar({
  animationData,
  animationUrl,
  size = 48,
  loop = true,
  autoplay = true,
  pauseOnHover = false,
  playOnHover = false,
  fallbackImageUrl,
  className = "",
  borderWidth = 2,
  borderColor,
  showBackground = true,
  onClick,
}: JMLottieAvatarProps) {
  const { theme } = useJMStyle();
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const [isHovered, setIsHovered] = useState(false);
  // Track loaded animation and which URL it came from
  const [loadState, setLoadState] = useState<{
    url: string | null;
    data: object | null;
    error: boolean;
  }>({ url: null, data: null, error: false });

  // Fetch animation from URL if provided
  useEffect(() => {
    if (!animationUrl || animationData) return;
    
    // Skip if we already loaded this URL
    if (loadState.url === animationUrl && (loadState.data || loadState.error)) {
      return;
    }

    let cancelled = false;
    
    fetch(animationUrl)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch animation");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setLoadState({ url: animationUrl, data, error: false });
        }
      })
      .catch((err) => {
        console.error("Failed to load Lottie animation:", err);
        if (!cancelled) {
          setLoadState({ url: animationUrl, data: null, error: true });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [animationUrl, animationData, loadState.url, loadState.data, loadState.error]);

  // Handle hover interactions
  useEffect(() => {
    if (!lottieRef.current) return;
    
    if (playOnHover) {
      if (isHovered) {
        lottieRef.current.play();
      } else {
        lottieRef.current.stop();
      }
    } else if (pauseOnHover) {
      if (isHovered) {
        lottieRef.current.pause();
      } else {
        lottieRef.current.play();
      }
    }
  }, [isHovered, playOnHover, pauseOnHover]);

  const effectiveBorderColor = borderColor || theme.accents.goldenGlow;
  const finalAnimation = animationData || loadState.data;
  const hasAnimation = finalAnimation && !loadState.error;

  // Base styles for the avatar container
  const containerStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    border: `${borderWidth}px solid ${effectiveBorderColor}`,
    backgroundColor: showBackground ? theme.surfaces.elevated1 : "transparent",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: onClick ? "pointer" : "default",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
    boxShadow: isHovered && onClick 
      ? `0 0 12px ${effectiveBorderColor}40` 
      : "none",
    transform: isHovered && onClick ? "scale(1.05)" : "scale(1)",
  };

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => setIsHovered(false);

  return (
    <div
      className={className}
      style={containerStyle}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {hasAnimation ? (
        <Lottie
          lottieRef={lottieRef}
          animationData={finalAnimation}
          loop={loop}
          autoplay={playOnHover ? false : autoplay}
          style={{
            width: "100%",
            height: "100%",
          }}
        />
      ) : fallbackImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fallbackImageUrl}
          alt="Avatar"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        <User 
          size={size * 0.5} 
          style={{ color: theme.text.tertiary }} 
        />
      )}
    </div>
  );
}
