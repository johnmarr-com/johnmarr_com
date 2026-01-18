"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";

interface AdminGateProps {
  children: ReactNode;
  /** Where to redirect non-admins. Defaults to "/" */
  redirectTo?: string;
  /** Custom loading component */
  loadingComponent?: ReactNode;
  /** Custom unauthorized component (shown briefly before redirect) */
  unauthorizedComponent?: ReactNode;
}

/**
 * Admin Gate - Protects routes that require admin access
 * 
 * Usage:
 * ```tsx
 * <AdminGate>
 *   <AdminDashboard />
 * </AdminGate>
 * ```
 */
export function AdminGate({ 
  children, 
  redirectTo = "/",
  loadingComponent,
  unauthorizedComponent,
}: AdminGateProps) {
  const { user, isLoading, isAdmin } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    // Wait for auth to load
    if (isLoading) return;

    // If not authenticated, redirect to home
    if (!user) {
      window.location.href = redirectTo;
      return;
    }

    // If authenticated but not admin, redirect
    if (!isAdmin) {
      console.warn(`[AdminGate] Non-admin user attempted to access: ${pathname}`);
      window.location.href = redirectTo;
    }
  }, [user, isLoading, isAdmin, pathname, redirectTo]);

  // Default loading spinner
  const defaultLoading = (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div 
        className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" 
        style={{ borderColor: '#FF36AB', borderTopColor: 'transparent' }} 
      />
    </div>
  );

  // Show loading while checking auth
  if (isLoading) {
    return <>{loadingComponent || defaultLoading}</>;
  }

  // Not authenticated - show loading while redirecting
  if (!user) {
    return <>{unauthorizedComponent || loadingComponent || defaultLoading}</>;
  }

  // Authenticated but not admin - show loading while redirecting
  if (!isAdmin) {
    return <>{unauthorizedComponent || loadingComponent || defaultLoading}</>;
  }

  // Admin - show content
  return <>{children}</>;
}
