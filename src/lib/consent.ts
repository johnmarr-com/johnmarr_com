/**
 * Marketing-consent capture (client side).
 *
 * The auth page records the visitor's opt-in choice BEFORE the sign-in flow
 * starts (Google may bounce through a redirect; magic links complete on a
 * later page load), then flushes it to `/api/user/consent` once a signed-in
 * user exists. The pending choice survives in localStorage across the
 * redirect/email round-trip.
 */

const PENDING_KEY = "jm_pending_consent";

interface PendingConsent {
  granted: boolean;
  source: string;
}

/** Stash the opt-in choice made on the auth screen. */
export function setPendingConsent(granted: boolean, source: string): void {
  try {
    const pending: PendingConsent = { granted, source };
    localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    // Storage blocked — consent just won't be recorded for this signup.
  }
}

/**
 * If a pending choice exists and a user is signed in, persist it server-side
 * and clear the stash. Safe to call on every auth completion; no-ops fast.
 */
export async function flushPendingConsent(): Promise<void> {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PENDING_KEY);
  } catch {
    return;
  }
  if (!raw) return;

  try {
    const pending = JSON.parse(raw) as PendingConsent;
    const { getAuth } = await import("@/lib/auth");
    const auth = await getAuth();
    const token = await auth.currentUser?.getIdToken();
    if (!token) return; // not signed in yet — keep it pending

    const res = await fetch("/api/user/consent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(pending),
    });
    if (res.ok) {
      localStorage.removeItem(PENDING_KEY);
    }
  } catch {
    // Transient failure — the stash stays and the next auth completion retries.
  }
}
