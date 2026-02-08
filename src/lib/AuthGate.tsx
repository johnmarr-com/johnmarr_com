"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { JMAuthModal } from "@/JMKit";

interface AuthGateProps {
  children: ReactNode;
}

/**
 * Global auth gate that protects all routes.
 * 
 * Route types:
 * - Public routes (/auth, /about): No auth required, no modal
 * - Semi-public routes (/artist/*): Content visible, auth modal overlay if not logged in
 * - Protected routes (everything else): Redirects to /about if not authenticated
 */
export function AuthGate({ children }: AuthGateProps) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();

  // Public routes that don't require auth at all
  const isPublicRoute = pathname === "/auth" || pathname === "/about" || pathname.startsWith("/artist");
  
  // Semi-public routes: show content with auth modal overlay
  // Add more patterns here as needed (e.g., /show/*, /story/*)
  const isSemiPublicRoute = false; // Disabled for now

  useEffect(() => {
    // Wait for auth to load
    if (isLoading) return;

    // Don't redirect if on a public or semi-public route
    if (isPublicRoute || isSemiPublicRoute) return;

    // Don't redirect if user is authenticated
    if (user) return;

    // No user on protected route - send to landing page
    window.location.href = "/about";
  }, [user, isLoading, isPublicRoute, isSemiPublicRoute]);

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#FF36AB', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  // On public route - always show content (no modal)
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // On semi-public route - show content + auth modal if not authenticated
  if (isSemiPublicRoute) {
    return (
      <>
        {children}
        {!user && <JMAuthModal />}
      </>
    );
  }

  // Not authenticated on protected route - show loading while redirecting
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

