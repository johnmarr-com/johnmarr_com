"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";

interface AuthGateProps {
  children: ReactNode;
}

/**
 * Global auth gate that protects all routes.
 * 
 * Logic:
 * - No user → /about (landing page)
 * - Has user → allow access
 * 
 * Public routes (/auth, /about) are excluded from redirects.
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

    // No user - send to landing page
    window.location.href = "/about";
  }, [user, isLoading, isPublicRoute]);

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#FF36AB', borderTopColor: 'transparent' }} />
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
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#FF36AB', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  // Authenticated - show content
  return <>{children}</>;
}

