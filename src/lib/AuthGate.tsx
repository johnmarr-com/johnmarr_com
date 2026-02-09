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
 * - Public routes (/auth, /about): No auth required
 * - Content routes (/artist/*, /show/*): Redirect to /auth with custom bg, then back after login
 * - Protected routes (everything else): Redirects to /about if not authenticated
 */
export function AuthGate({ children }: AuthGateProps) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();

  // Public routes that don't require auth at all
  const isPublicRoute = pathname === "/auth" || pathname === "/about";
  
  // Content routes: redirect to /auth with redirect param (custom bg support)
  // These routes pass info to auth page for custom backgrounds
  const isContentRoute = pathname.startsWith("/artist") || pathname.startsWith("/show");
  
  // Parse content type and slug from pathname
  const getContentInfo = (): { type: string; slug: string } | null => {
    if (pathname.startsWith("/artist/")) {
      const slug = pathname.split("/")[2];
      if (slug) return { type: "artist", slug };
    }
    if (pathname.startsWith("/show/")) {
      const slug = pathname.split("/")[2];
      if (slug) return { type: "show", slug };
    }
    return null;
  };

  useEffect(() => {
    // Wait for auth to load
    if (isLoading) return;

    // Don't redirect if on a public route
    if (isPublicRoute) return;

    // Don't redirect if user is authenticated
    if (user) return;

    // Content route - redirect to auth with params for custom bg
    if (isContentRoute) {
      const contentInfo = getContentInfo();
      if (contentInfo) {
        const params = new URLSearchParams({
          redirect: pathname,
          contentType: contentInfo.type,
          contentSlug: contentInfo.slug,
        });
        window.location.href = `/auth?${params.toString()}`;
        return;
      }
    }

    // No user on protected route - send to landing page
    window.location.href = "/about";
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

