// In-memory fixed-window rate limiter.
//
// State lives in module scope, so on serverless deploys each warm instance
// keeps its own counters and a cold start resets them. That still throttles
// any sustained brute force (which hammers the same warm instances), and the
// real defense against offline guessing is the 64-bit gallery passwords —
// this is the online-attempt backstop the issue asks for, without adding a
// datastore.

type Bucket = {
  count: number;
  resetAt: number;
};

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterMs: number };

const buckets = new Map<string, Bucket>();

// Beyond this many live keys, expired buckets are swept on the next check.
const SWEEP_THRESHOLD = 1000;

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= SWEEP_THRESHOLD) sweep(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (bucket.count >= limit) {
    return { ok: false, retryAfterMs: bucket.resetAt - now };
  }

  bucket.count += 1;
  return { ok: true };
}

export function clearRateLimits() {
  buckets.clear();
}
