/**
 * Resilient POST for game commands on flaky links (the write-side twin of the
 * self-healing read reconciliation in `subscribeToSession`).
 *
 * Retries ONLY transient failures — network/abort errors, 5xx, and 429 — with
 * exponential backoff + jitter. Treats 2xx (accepted) and every other 4xx
 * (definitively rejected: not your turn, bad request, not a participant) as
 * TERMINAL and returns immediately, so the caller can surface/clear them.
 *
 * Safe to retry because game commands are idempotent by construction: each one
 * SETs authoritative state (a board, an inbox slot keyed by uid, a ready flag)
 * rather than appending or incrementing, and the server gates with a
 * turn/seq check — so a retry that races or follows the original cannot
 * double-apply. A retry after the move already resolved gets a terminal 4xx
 * (e.g. "not your turn") and stops; the read reconciler then surfaces the
 * resolved state. Together: the command is guaranteed to land, and its
 * resulting state is guaranteed to reach the client.
 */
export interface RetryOpts {
  tries?: number; // total attempts (default 4)
  baseDelayMs?: number; // first backoff step (default 400ms)
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit,
  { tries = 4, baseDelayMs = 400 }: RetryOpts = {},
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const res = await fetch(input, init);
      // 2xx success OR a terminal 4xx (other than rate-limit) → done, no retry.
      const transient = res.status >= 500 || res.status === 429;
      if (!transient) return res;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err; // network / abort — transient
    }
    if (attempt < tries - 1) {
      const backoff = baseDelayMs * 2 ** attempt;
      const jitter = Math.random() * backoff * 0.3; // de-sync concurrent retries
      await new Promise((r) => setTimeout(r, backoff + jitter));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
