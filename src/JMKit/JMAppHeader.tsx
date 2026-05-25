"use client";

import { useState } from "react";
import Link from "next/link";
import { Lollipop, Eye } from "lucide-react";
import { useJMStyle } from "@/JMStyle";
import { useAuth, type UserTier } from "@/lib/AuthProvider";
import { JMSimpleButton } from "./JMSimpleButton";
import { JMBasicMenu } from "./JMBasicMenu";

interface JMAppHeaderProps {
  /** Override header height in pixels (default: 75) */
  height?: number;
  /**
   * "minimal" renders only the J logo — no admin controls, no user menu.
   * Used on open-access pages (e.g. audonna.com → /artist/audonna) where
   * visitors may not be signed in and shouldn't see auth-gated chrome.
   */
  variant?: "default" | "minimal";
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
  variant = "default",
}: JMAppHeaderProps) {
  const { theme } = useJMStyle();
  const { user, isAdmin, gamertag, adminViewAs, setAdminViewAs } = useAuth();
  const [viewAsOpen, setViewAsOpen] = useState(false);

  // Calculate logo height (85% of available space)
  const logoHeight = Math.round(height * 0.85);

  const displayName = gamertag || user?.displayName?.split(" ")[0] || "Menu";
  const isMinimal = variant === "minimal";

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
        <Link
          href="/"
          className="relative flex items-center"
          style={{ height: `${logoHeight}px` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/logos/JohnMarr-Signature.jpg"
            alt="John Marr"
            style={{ height: logoHeight, width: "auto" }}
          />
        </Link>

        {/* User section - right side */}
        <div className="flex items-center gap-3">
          {/* Admin: View-as eye icon */}
          {!isMinimal && isAdmin && (
            <div className="relative">
              <button
                onClick={() => setViewAsOpen(!viewAsOpen)}
                className="flex items-center justify-center transition-opacity hover:opacity-80"
              >
                <Eye
                  size={20}
                  color={adminViewAs ? theme.accents.goldenGlow : "rgba(255,255,255,0.2)"}
                  strokeWidth={2}
                />
              </button>

              {viewAsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setViewAsOpen(false)}
                  />
                  <div
                    className="absolute right-0 top-full mt-2 overflow-hidden rounded-lg shadow-xl z-50"
                    style={{
                      backgroundColor: theme.surfaces.base,
                      border: `1px solid ${theme.surfaces.elevated2}`,
                      minWidth: 150,
                    }}
                  >
                    {([
                      { tier: null, label: "Admin" },
                      { tier: "free" as UserTier, label: "Free User" },
                      { tier: "paid" as UserTier, label: "Paid User" },
                      { tier: "pro" as UserTier, label: "Pro User" },
                    ] as const).map(({ tier, label }, idx) => (
                      <button
                        key={label}
                        onClick={() => {
                          setAdminViewAs(tier);
                          setViewAsOpen(false);
                        }}
                        className="w-full px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-white/10"
                        style={{
                          color: adminViewAs === tier ? theme.accents.goldenGlow : theme.text.primary,
                          borderTop: idx > 0 ? `1px solid ${theme.surfaces.elevated2}` : undefined,
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Inventing.Studio — admin portal */}
          {!isMinimal && isAdmin && (
            <Link
              href="/admin"
              className="transition-opacity hover:opacity-80"
            >
              <Lollipop
                size={22}
                color={theme.accents.goldenGlow}
                strokeWidth={2}
              />
            </Link>
          )}

          {/* User button with dropdown menu */}
          {!isMinimal && (
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
          )}
        </div>
      </div>
    </header>
  );
}

