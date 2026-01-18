"use client";

import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/lib/AuthProvider";
import { useJMStyle } from "@/JMStyle";
import {
  signInWithGoogle,
  sendSignInLink,
  completeSignInWithEmailLink,
  isEmailSignInLink,
  logSourceVisit,
  logSignupAttempt,
} from "@/lib/auth";

function AuthContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { theme } = useJMStyle();

  const isLoginMode = searchParams.get("login") === "true";
  const emailFromUrl = searchParams.get("email");
  const nameFromUrl = searchParams.get("name");
  const sourceFromUrl = searchParams.get("source");
  const funnelFromUrl = searchParams.get("funnel");

  const [firstName, setFirstName] = useState("");
  const [funnelId, setFunnelId] = useState<string | null>(funnelFromUrl);

  // Log visit for analytics tracking (only if NOT returning from email link)
  useEffect(() => {
    // If funnelFromUrl is set, we're returning from email link - don't create new funnel
    if (funnelFromUrl) return;
    
    // Create a new funnel record for fresh page visits
    const source = sourceFromUrl || "direct";
    logSourceVisit(source, isLoginMode).then((docId) => {
      if (docId) {
        setFunnelId(docId);
      }
    });
  }, [sourceFromUrl, isLoginMode, funnelFromUrl]);
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [isCompletingSignIn, setIsCompletingSignIn] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (user && !authLoading) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  // Check for email sign-in link on mount
  useEffect(() => {
    const checkEmailLink = async () => {
      if (typeof window === "undefined") return;

      const url = window.location.href;
      const isSignInLink = await isEmailSignInLink(url);

      if (isSignInLink) {
        setIsCompletingSignIn(true);

        if (emailFromUrl) {
          try {
            // Pass the name and funnel ID from URL (for new signups coming from email link)
            const user = await completeSignInWithEmailLink(emailFromUrl, url, nameFromUrl, funnelFromUrl);
            if (user) {
              router.push("/");
            }
          } catch (err) {
            console.error("Error completing sign-in:", err);
            setError("Failed to complete sign-in. Please try again.");
          }
        } else {
          setError("Please enter your email to complete sign-in.");
        }
        setIsCompletingSignIn(false);
      }
    };

    checkEmailLink();
  }, [emailFromUrl, nameFromUrl, funnelFromUrl, router]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Log the signup attempt (Google method) - fire and forget
      logSignupAttempt({ funnelId, method: "google" });
      await signInWithGoogle(funnelId);
      router.push("/");
    } catch (err) {
      console.error("Google sign-in error:", err);
      setError("Failed to sign in with Google. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendSignInLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    // Require first name for signup
    if (!isLoginMode && !firstName.trim()) {
      setError("Please enter your first name.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Log the signup attempt (email method with name and email) - may return new funnelId
      const currentFunnelId = await logSignupAttempt({
        funnelId,
        method: "email",
        firstName: isLoginMode ? null : firstName.trim(),
        email: email,
      });
      // Pass firstName only for signup, not login; pass funnelId for tracking
      await sendSignInLink(email, isLoginMode ? undefined : firstName.trim(), currentFunnelId);
      setEmailSent(true);
    } catch (err) {
      console.error("Send link error:", err);
      setError("Failed to send sign-in link. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while checking auth state or completing sign-in
  if (authLoading || isCompletingSignIn) {
    return (
      <div 
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: theme.surfaces.base }}
      >
        <div className="flex flex-col items-center gap-4">
          <div 
            className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: '#FF36AB', borderTopColor: 'transparent' }}
          />
          <p className="font-mono text-sm" style={{ color: theme.text.secondary }}>
            {isCompletingSignIn ? "Completing sign-in..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  // Email sent confirmation
  if (emailSent) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <BackgroundImage />
        <main className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-24">
          <div 
            className="opacity-0 animate-fade-in-up rounded-2xl border p-8 backdrop-blur-md"
            style={{ 
              backgroundColor: `${theme.surfaces.base}ee`,
              borderColor: `${theme.surfaces.elevated2}`,
            }}
          >
            <div 
              className="mb-6 flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: `${theme.primary}20` }}
            >
              <svg
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke={theme.primary}
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold" style={{ color: theme.text.primary }}>
              Check your email
            </h1>
            <p className="mt-3" style={{ color: theme.text.secondary }}>
              We&apos;ve sent a sign-in link to{" "}
              <span className="font-medium" style={{ color: theme.text.primary }}>{email}</span>
            </p>
            <p className="mt-4 text-sm" style={{ color: theme.text.tertiary }}>
              Click the link in the email to complete your sign-up. The link
              will expire in 1 hour.
            </p>
            <button
              onClick={() => setEmailSent(false)}
              className="mt-6 text-sm hover:underline"
              style={{ color: theme.accents.neonPink }}
            >
              Use a different email
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <BackgroundImage />

      <main className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-24">
        {/* Back to home */}
        <Link
          href="/"
          className="opacity-0 animate-fade-in mb-8 inline-flex items-center gap-2 font-mono text-sm transition-colors"
          style={{ color: theme.text.secondary }}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to home
        </Link>

        {/* Auth card */}
        <div 
          className="opacity-0 animate-fade-in-up animation-delay-200 rounded-2xl border overflow-hidden backdrop-blur-md"
          style={{ 
            backgroundColor: `${theme.surfaces.base}ee`,
            borderColor: theme.surfaces.elevated2,
          }}
        >
          {/* Banner Image */}
          <div className="p-5 pb-0">
            <Image
              src={isLoginMode 
                ? "/images/banners/Banner-Welcome-Back-2.png" 
                : "/images/banners/Banner-Create-Free-Account-2.png"
              }
              alt={isLoginMode ? "Welcome Back" : "Create a Free Account"}
              width={800}
              height={200}
              className="w-full h-auto rounded-lg"
              priority
            />
          </div>

          {/* Content */}
          <div className="p-8 pt-6">
          {/* Error message */}
          {error && (
            <div 
              className="mb-6 rounded-lg p-4 text-sm"
              style={{ backgroundColor: `${theme.semantic.error}15`, color: theme.semantic.error }}
            >
              {error}
            </div>
          )}

          {/* Google Sign In */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border px-4 py-3 font-medium transition-all duration-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ 
              borderColor: theme.surfaces.elevated2,
              color: theme.text.primary,
            }}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1" style={{ backgroundColor: theme.surfaces.elevated2 }} />
            <span className="font-mono text-xs uppercase tracking-wider" style={{ color: theme.text.tertiary }}>
              or
            </span>
            <div className="h-px flex-1" style={{ backgroundColor: theme.surfaces.elevated2 }} />
          </div>

          {/* Passwordless email form */}
          <form onSubmit={handleSendSignInLink} className="space-y-4">
            {/* First name - only for signup */}
            {!isLoginMode && (
              <div>
                <label
                  htmlFor="firstName"
                  className="mb-2 block font-mono text-xs uppercase tracking-wider"
                  style={{ color: theme.text.tertiary }}
                >
                  First Name
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  placeholder="John"
                  className="w-full rounded-xl border px-4 py-3 transition-all focus:outline-none focus-visible:outline-none focus:ring-1"
                  style={{ 
                    borderColor: theme.surfaces.elevated2,
                    backgroundColor: "#171618",
                    color: theme.text.primary,
                    // @ts-expect-error CSS custom property for focus ring
                    "--tw-ring-color": theme.accents.neonPink,
                  }}
                />
              </div>
            )}
            <div>
              <label
                htmlFor="email"
                className="mb-2 block font-mono text-xs uppercase tracking-wider"
                style={{ color: theme.text.tertiary }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full rounded-xl border px-4 py-3 transition-all focus:outline-none focus-visible:outline-none focus:ring-1"
                style={{ 
                  borderColor: theme.surfaces.elevated2,
                  backgroundColor: "#171618",
                  color: theme.text.primary,
                  // @ts-expect-error CSS custom property for focus ring
                  "--tw-ring-color": theme.accents.neonPink,
                }}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !email || (!isLoginMode && !firstName.trim())}
              className="w-full rounded-xl px-4 py-3 font-semibold transition-all duration-300 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ 
                background: theme.gradient.css,
                color: theme.text.primary,
              }}
            >
              {isLoading ? "Sending link..." : "Send magic link ✨"}
            </button>
            <p className="text-center text-sm" style={{ color: theme.text.tertiary }}>
              We&apos;ll email you a magic link. No password needed!
            </p>
          </form>

          {/* Toggle mode */}
          <div className="mt-8 text-center">
            {isLoginMode ? (
              <p className="text-sm" style={{ color: theme.text.secondary }}>
                Don&apos;t have an account?{" "}
                <a
                  href="/auth"
                  className="font-medium hover:underline"
                  style={{ color: theme.accents.neonPink }}
                >
                  Sign up
                </a>
              </p>
            ) : (
              <p className="text-sm" style={{ color: theme.text.secondary }}>
                Already have an account?{" "}
                <a
                  href="/auth?login=true"
                  className="font-medium hover:underline"
                  style={{ color: theme.accents.neonPink }}
                >
                  Sign in
                </a>
              </p>
            )}
          </div>
          </div>
        </div>

        {/* Footer */}
        <p 
          className="opacity-0 animate-fade-in animation-delay-400 mt-8 text-center font-mono text-xs"
          style={{ color: theme.text.disabled }}
        >
          By continuing, you agree to our Terms of Service
        </p>
      </main>

    </div>
  );
}

function BackgroundImage() {
  return (
    <div 
      className="absolute inset-0 bg-cover bg-center bg-no-repeat"
      style={{ 
        backgroundImage: "url('/images/bgs/BG-Signup.jpg')",
      }}
    >
      {/* Dark overlay to ensure text readability */}
      <div className="absolute inset-0 bg-black/40" />
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#FF36AB', borderTopColor: 'transparent' }} />
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  );
}

