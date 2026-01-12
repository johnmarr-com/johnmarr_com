"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { isHistoricalUser } from "./auth";

interface AuthGateProps {
  children: ReactNode;
}

/**
 * Global auth gate that protects all routes.
 * 
 * Logic:
 * - No user + historicalUser → /auth?login=true
 * - No user + no historicalUser → johnmarr.carrd.co (marketing site)
 * - Has user → allow access
 * 
 * The /auth route is excluded from redirects to allow sign-in/sign-up.
 */
export function AuthGate({ children }: AuthGateProps) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();

  // Public routes that don't require auth
  const isPublicRoute = pathname === "/auth" || pathname === "/about";

  useEffect(() => {
    // Wait for auth to load
    if (isLoading) return;

    // Don't redirect if on a public route
    if (isPublicRoute) return;

    // Don't redirect if user is authenticated
    if (user) return;

    // No user - check historical user status
    const historical = isHistoricalUser();

    if (historical) {
      // Returning user - send to login
      window.location.href = "/auth?login=true";
    } else {
      // New visitor - send to marketing site
      window.location.href = "https://about.johnmarr.com";
    }
  }, [user, isLoading, isPublicRoute]);

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  // On public route - always show content
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Not authenticated - show loading while redirecting
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  // Authenticated - show content
  return <>{children}</>;
}

