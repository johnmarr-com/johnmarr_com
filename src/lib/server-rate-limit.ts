/**
 * Shared per-UID rate limiting backed by Firestore (`rateLimits/{key}`).
 *
 * The old in-memory Map limiter was per-Cloud-Run-instance, so horizontal
 * scaling multiplied every limit by the instance count. A fixed-window
 * counter in Firestore is shared across instances. Fail-open: a limiter
 * outage must never take gameplay down with it.
 */
import { getAdminFirestore } from "@/lib/firebase-admin";

export interface RateLimitBucket {
  /** Bucket name, e.g. "ai-text" — combined with uid for the doc key. */
  bucket: string;
  /** Window length in ms. */
  windowMs: number;
  /** Max requests per window. */
  max: number;
}

/**
 * Count one request against `uid` in the bucket. Returns true when the
 * request is ALLOWED. Checks every bucket passed (e.g. hourly + daily).
 */
export async function allowRequest(
  uid: string,
  buckets: RateLimitBucket[],
): Promise<boolean> {
  const db = getAdminFirestore();
  const now = Date.now();
  try {
    return await db.runTransaction(async (txn) => {
      const refs = buckets.map((b) => db.doc(`rateLimits/${uid}_${b.bucket}`));
      const snaps = await Promise.all(refs.map((ref) => txn.get(ref)));

      // Check all buckets first (reads before writes).
      for (let i = 0; i < buckets.length; i++) {
        const b = buckets[i]!;
        const data = snaps[i]!.data();
        const windowStart = (data?.["windowStart"] as number | undefined) ?? 0;
        const count = (data?.["count"] as number | undefined) ?? 0;
        const inWindow = now - windowStart < b.windowMs;
        if (inWindow && count >= b.max) return false;
      }

      for (let i = 0; i < buckets.length; i++) {
        const b = buckets[i]!;
        const data = snaps[i]!.data();
        const windowStart = (data?.["windowStart"] as number | undefined) ?? 0;
        const count = (data?.["count"] as number | undefined) ?? 0;
        const inWindow = now - windowStart < b.windowMs;
        txn.set(refs[i]!, {
          windowStart: inWindow ? windowStart : now,
          count: inWindow ? count + 1 : 1,
          updatedAt: now,
        });
      }
      return true;
    });
  } catch (err) {
    // Fail-open: log loudly, don't block the product on the limiter.
    console.error("[rate-limit] transaction failed — allowing request:", err);
    return true;
  }
}
