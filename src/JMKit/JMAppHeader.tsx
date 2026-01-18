"use client";

import Image from "next/image";
import Link from "next/link";
import { ShieldUser } from "lucide-react";
import { useJMStyle } from "@/JMStyle";
import { useAuth } from "@/lib/AuthProvider";
import { JMSimpleButton } from "./JMSimpleButton";
import { JMBasicMenu } from "./JMBasicMenu";

interface JMAppHeaderProps {
  /** Override header height in pixels (default: 75) */
  height?: number;
}

/**
 * JMAppHeader - Main application header with logo and user menu
 * 
 * Features:
 * - Sticky positioning at top
 * - Theme-aware logo and background
 * - User button with dropdown menu
 * - Admin badge for admin users
 */
export function JMAppHeader({
  height = 75,
}: JMAppHeaderProps) {
  const { theme } = useJMStyle();
  const { user, isAdmin } = useAuth();
  
  // Calculate logo height (85% of available space)
  const logoHeight = Math.round(height * 0.85);
  
  // Get display name or fallback
  const displayName = user?.displayName?.split(" ")[0] ?? "Menu";

  return (
    <header
      className="sticky top-0 z-50 w-full"
      style={{
        height: `${height}px`,
        backgroundColor: theme.surfaces.header,
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

        {/* User section - right side */}
        <div className="flex items-center gap-3">
          {/* Admin badge - clickable link to admin */}
          {isAdmin && (
            <Link 
              href="/admin"
              className="transition-opacity hover:opacity-80"
            >
              <ShieldUser 
                size={22} 
                color={theme.accents.goldenGlow}
                strokeWidth={2}
              />
            </Link>
          )}
          
          {/* User button with dropdown menu */}
          <JMBasicMenu headerHeight={height}>
            <JMSimpleButton
              title={displayName}
              gradient={{
                from: theme.gradient.start,
                to: theme.gradient.middle,
                angle: theme.gradient.angle,
              }}
              backgroundOpacity={0.33}
              titleColor={theme.accents.neonPink}
            />
          </JMBasicMenu>
        </div>
      </div>
    </header>
  );
}

