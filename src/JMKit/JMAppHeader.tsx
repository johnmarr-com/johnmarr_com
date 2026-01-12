"use client";

import Image from "next/image";
import { useJMStyle } from "@/JMStyle";
import { useAuth } from "@/lib/AuthProvider";
import { JMSimpleButton } from "./JMSimpleButton";

interface JMAppHeaderProps {
  /** Override header height in pixels (default: 75) */
  height?: number;
  /** Called when user button is clicked */
  onUserButtonClick?: () => void;
}

/**
 * JMAppHeader - Main application header with logo and user menu button
 * 
 * Features:
 * - Sticky positioning at top
 * - Theme-aware logo and background
 * - User button with gradient styling
 */
export function JMAppHeader({
  height = 75,
  onUserButtonClick,
}: JMAppHeaderProps) {
  const { theme } = useJMStyle();
  const { user } = useAuth();
  
  // Calculate logo height (85% of available space)
  const logoHeight = Math.round(height * 0.85);
  
  // Get display name or fallback
  const displayName = user?.displayName?.split(" ")[0] ?? "Menu";

  return (
    <header
      className="sticky top-0 z-50 w-full"
      style={{
        height: `${height}px`,
        backgroundColor: theme.colors.headerBackground,
      }}
    >
      <div
        className="flex h-full items-center justify-between"
        style={{ padding: "0 25px" }}
      >
        {/* Logo - left side */}
        <div
          className="relative flex items-center"
          style={{ height: `${logoHeight}px` }}
        >
          <Image
            src={theme.logo}
            alt={theme.logoAlt}
            height={logoHeight}
            width={logoHeight * 3} // Approximate aspect ratio, will be auto-adjusted
            className="h-full w-auto object-contain"
            priority
          />
        </div>

        {/* User button - right side */}
        <JMSimpleButton
          title={displayName}
          gradient={{
            from: "#6310ef",
            to: "#c529bf",
            angle: 135,
          }}
          backgroundOpacity={0.33}
          titleColor={theme.colors.primaryPink}
          onClick={onUserButtonClick}
        />
      </div>
    </header>
  );
}

