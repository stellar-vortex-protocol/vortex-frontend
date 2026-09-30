/**
 * In-memory per-key token bucket. Per-instance only (not shared across
 * serverless instances) — adequate to blunt abuse of the verification proxy.
 */
export function createTokenBucket(capacity: number, refillPerSecond: number, maxKeys = 10_000) {
  const buckets = new Map<string, { tokens: number; updatedAt: number }>();

  return function take(key: string, now: number = Date.now()): boolean {
    let bucket = buckets.get(key);
    if (!bucket) {
      if (buckets.size >= maxKeys) {
        const oldest = buckets.keys().next().value;
        if (oldest !== undefined) buckets.delete(oldest);
      }
      bucket = { tokens: capacity, updatedAt: now };
      buckets.set(key, bucket);
    }
    const elapsed = Math.max(0, now - bucket.updatedAt) / 1000;
    bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * refillPerSecond);
    bucket.updatedAt = now;
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  };
}
