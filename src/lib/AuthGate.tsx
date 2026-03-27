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
 * Route types:
 * - Public routes (/auth, /x, /y): No auth required
 * - Home (/): Redirects to random landing (/x or /y) if not authenticated
 * - Content routes (/artist/*, /show/*, /auction/*): Redirect to /auth with custom bg, then back after login
 * - Protected routes (everything else): Redirects to /auth if not authenticated
 */
export function AuthGate({ children }: AuthGateProps) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();

  // Public routes that don't require auth at all
  const isPublicRoute = pathname === "/auth" || pathname === "/x" || pathname === "/y";
  
  // Content routes: redirect to /auth with redirect param (custom bg support)
  // Auction requires auth - redirect to /auth
  const isContentRoute =
    pathname.startsWith("/artist") ||
    pathname.startsWith("/show") ||
    pathname.startsWith("/auction");
  
  useEffect(() => {
    // Wait for auth to load
    if (isLoading) return;

    // Don't redirect if on a public route
    if (isPublicRoute) return;

    // Don't redirect if user is authenticated
    if (user) return;

    // Content route - redirect to auth with params
    if (isContentRoute) {
      const params = new URLSearchParams({ redirect: pathname });
      const segments = pathname.split("/");
      const type = segments[1];
      const slug = segments[2];
      if (type && slug) {
        params.set("contentType", type);
        params.set("contentSlug", slug);
      }
      window.location.href = `/auth?${params.toString()}`;
      return;
    }

    // Home page — send unauthenticated users to a random landing variant
    if (pathname === "/") {
      const landing = Math.random() < 0.5 ? "/x" : "/y";
      window.location.href = landing;
      return;
    }

    // No user on protected route - send to auth with redirect back
    const params = new URLSearchParams({ redirect: pathname });
    window.location.href = `/auth?${params.toString()}`;
  }, [user, isLoading, isPublicRoute, isContentRoute, pathname]);

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

