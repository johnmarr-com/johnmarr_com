"use client";

import Link from "next/link";
import { ShieldUser, User, Mail, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/AuthProvider";
import { useJMStyle } from "@/JMStyle";

export default function ProfilePage() {
  const { user, isAdmin, isLoading } = useAuth();
  const { theme } = useJMStyle();

  // Show loading while checking auth state
  if (isLoading) {
    return (
      <div 
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: theme.surfaces.base }}
      >
        <div className="flex flex-col items-center gap-4">
          <div 
            className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: theme.accents.neonPink, borderTopColor: 'transparent' }}
          />
          <p className="font-mono text-sm" style={{ color: theme.text.secondary }}>
            Loading...
          </p>
        </div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!user) {
    if (typeof window !== "undefined") {
      window.location.href = "/auth";
    }
    return (
      <div 
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: theme.surfaces.base }}
      >
        <div 
          className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: theme.accents.neonPink, borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  const displayName = user.displayName || "User";
  const email = user.email || "No email";

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: "url('/images/bgs/BG-Signup.jpg')",
        }}
      >
        <div className="absolute inset-0 bg-black/60" />
      </div>

      <main className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-24">
        {/* Back to home */}
        <Link
          href="/"
          className="opacity-0 animate-fade-in mb-8 inline-flex items-center gap-2 font-mono text-sm transition-colors hover:opacity-80"
          style={{ color: theme.text.secondary }}
        >
          <ArrowLeft size={16} />
          Back to home
        </Link>

        {/* Profile card */}
        <div 
          className="opacity-0 animate-fade-in-up animation-delay-200 rounded-2xl border overflow-hidden backdrop-blur-md"
          style={{ 
            backgroundColor: `${theme.surfaces.base}ee`,
            borderColor: theme.surfaces.elevated2,
          }}
        >
          {/* Header */}
          <div 
            className="px-8 py-6 border-b"
            style={{ borderColor: theme.surfaces.elevated2 }}
          >
            <h1 
              className="text-2xl font-semibold"
              style={{ color: theme.text.primary }}
            >
              Your Profile
            </h1>
            <p 
              className="mt-1 text-sm"
              style={{ color: theme.text.tertiary }}
            >
              Account information
            </p>
          </div>

          {/* Content */}
          <div className="p-8 space-y-6">
            {/* Display Name */}
            <div>
              <label
                className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider"
                style={{ color: theme.text.tertiary }}
              >
                <User size={14} />
                Name
              </label>
              <div 
                className="rounded-xl border px-4 py-3"
                style={{ 
                  borderColor: theme.surfaces.elevated2,
                  backgroundColor: theme.surfaces.elevated1,
                  color: theme.text.primary,
                }}
              >
                {displayName}
              </div>
            </div>

            {/* Email */}
            <div>
              <label
                className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider"
                style={{ color: theme.text.tertiary }}
              >
                <Mail size={14} />
                Email
              </label>
              <div 
                className="rounded-xl border px-4 py-3"
                style={{ 
                  borderColor: theme.surfaces.elevated2,
                  backgroundColor: theme.surfaces.elevated1,
                  color: theme.text.primary,
                }}
              >
                {email}
              </div>
            </div>

            {/* Admin Status */}
            <div>
              <label
                className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider"
                style={{ color: theme.text.tertiary }}
              >
                <ShieldUser size={14} />
                Role
              </label>
              <div 
                className="rounded-xl border px-4 py-3 flex items-center gap-3"
                style={{ 
                  borderColor: theme.surfaces.elevated2,
                  backgroundColor: theme.surfaces.elevated1,
                }}
              >
                {isAdmin ? (
                  <>
                    <ShieldUser 
                      size={20} 
                      color={theme.accents.goldenGlow}
                    />
                    <span style={{ color: theme.accents.goldenGlow, fontWeight: 600 }}>
                      Admin
                    </span>
                  </>
                ) : (
                  <span style={{ color: theme.text.secondary }}>
                    Member
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sign out link */}
        <div className="mt-8 text-center">
          <button
            onClick={async () => {
              const { signOut } = await import("@/lib/auth");
              await signOut();
              window.location.href = "/auth";
            }}
            className="text-sm font-medium hover:underline"
            style={{ color: theme.accents.neonPink }}
          >
            Sign out
          </button>
        </div>
      </main>
    </div>
  );
}
