"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { JMCompleteProfileModal } from "@/JMKit";

interface AuthGateProps {
  children: ReactNode;
}

/**
 * Global auth gate that protects all routes.
 * 
 * Route types:
 * - Public routes (/auth, /landing, /landing-2): No auth required
 * - Home (/): Redirects to /landing if not authenticated (A/B logic preserved but bypassed to /landing)
 * - Content routes (/artist/*, /show/*, /auction/*): Redirect to /auth with custom bg, then back after login
 * - Protected routes (everything else): Redirects to /auth if not authenticated
 *
 * Also enforces gamertag setup: authenticated users without a gamertag
 * see a mandatory modal before they can use the app.
 */
export function AuthGate({ children }: AuthGateProps) {
  const { user, isLoading, gamertag, refreshUserData } = useAuth();
  const pathname = usePathname();

  const isPublicRoute = pathname === "/auth" || pathname === "/landing" || pathname === "/landing-2";

  /** Modals (e.g. JMSelectAsset) set `body.style.overflow = hidden`; SPA navigations can leave it stuck. */
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.removeProperty("overflow");
  }, [pathname]);

  const isContentRoute =
    pathname.startsWith("/artist") ||
    pathname.startsWith("/show") ||
    pathname.startsWith("/auction");
  
  useEffect(() => {
    if (isLoading) return;
    if (isPublicRoute) return;
    if (user) return;

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

    if (pathname === "/") {
      window.location.href = "/landing";
      return;
    }

    const params = new URLSearchParams({ redirect: pathname });
    window.location.href = `/auth?${params.toString()}`;
  }, [user, isLoading, isPublicRoute, isContentRoute, pathname]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#FF36AB', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (isPublicRoute) {
    return <>{children}</>;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#FF36AB', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  // Authenticated but no gamertag — force setup before anything else
  if (gamertag === null) {
    return (
      <>
        {children}
        <JMCompleteProfileModal
          isOpen
          onComplete={async () => {
            await refreshUserData();
          }}
        />
      </>
    );
  }

  return <>{children}</>;
}

