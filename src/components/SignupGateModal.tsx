"use client";

import { X } from "lucide-react";
import { useJMStyle } from "@/JMStyle";

/**
 * The soft email gate: a friendly full-screen prompt shown to anonymous
 * visitors after they've had a taste of free content (an episode, a chapter).
 * Everything on the site is free — the trade is an email. CTA routes to /auth
 * carrying `redirect` (come right back), `source` (funnel attribution), and
 * optional content params (custom auth background).
 */
export interface SignupGateModalProps {
  /** Headline, e.g. "Enjoying the show?" */
  title: string;
  /** One-sentence pitch under the headline. */
  message: string;
  /** Where to return after auth (e.g. `/show/abc123`). */
  redirect: string;
  /** Funnel attribution, e.g. "show_gate" | "story_gate". */
  source: string;
  onClose: () => void;
}

export function SignupGateModal({ title, message, redirect, source, onClose }: SignupGateModalProps) {
  const { theme } = useJMStyle();
  const authQuery = new URLSearchParams({ redirect, source });

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Card — bottom sheet on mobile, centered card on larger screens */}
      <div
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border p-6 sm:p-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        style={{
          backgroundColor: theme.surfaces.base,
          borderColor: theme.surfaces.elevated2,
        }}
      >
        <button
          onClick={onClose}
          aria-label="Not now"
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
          style={{ color: theme.text.tertiary }}
        >
          <X size={20} />
        </button>

        <h2 className="text-2xl font-bold pr-8" style={{ color: theme.text.primary }}>
          {title}
        </h2>
        <p className="mt-3 text-base leading-relaxed" style={{ color: theme.text.secondary }}>
          {message}
        </p>
        <p className="mt-2 text-sm" style={{ color: theme.text.tertiary }}>
          Free forever. No password — just a magic link.
        </p>

        <a
          href={`/auth?${authQuery.toString()}`}
          className="mt-6 block w-full rounded-xl px-4 py-4 text-center font-semibold transition-all duration-300 hover:opacity-90"
          style={{ background: theme.gradient.css, color: theme.text.primary }}
        >
          Create my free account
        </a>

        <div className="mt-4 flex items-center justify-between">
          <a
            href={`/auth?login=true&${authQuery.toString()}`}
            className="text-sm font-medium hover:underline"
            style={{ color: theme.accents.neonPink }}
          >
            I already have an account
          </a>
          <button
            onClick={onClose}
            className="text-sm hover:underline"
            style={{ color: theme.text.tertiary }}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
