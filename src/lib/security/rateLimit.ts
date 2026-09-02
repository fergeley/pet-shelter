interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup stale keys every 5 minutes to prevent memory leaks
if (typeof setInterval !== "undefined") {
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      const valid = record.timestamps.filter((t) => now - t < 1000 * 60 * 10);
      if (valid.length === 0) {
        rateLimitStore.delete(key);
      } else {
        rateLimitStore.set(key, { timestamps: valid });
      }
    }
  }, 1000 * 60 * 5);

  // Unref in Node environment so it does not block process exit
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }
}

/**
 * Test-only reset so a suite that exercises the limiter does not starve the cases that
 * run after it. Never called from application code.
 */
export function resetRateLimitStore(): void {
  rateLimitStore.clear();
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Sliding Window Rate Limiter
 * @param key Unique identifier (e.g. `login:ip` or `submit:email`)
 * @param limit Max allowed requests within window
 * @param windowMs Time window in milliseconds
 */
export function checkRateLimit(key: string, limit = 5, windowMs = 60000): RateLimitResult {
  const now = Date.now();
  const record = rateLimitStore.get(key) || { timestamps: [] };

  // Filter timestamps within the current sliding window
  const activeTimestamps = record.timestamps.filter((t) => now - t < windowMs);

  if (activeTimestamps.length >= limit) {
    const oldestTimestamp = activeTimestamps[0];
    const retryAfterMs = windowMs - (now - oldestTimestamp);
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));

    return {
      success: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  // Record this hit
  activeTimestamps.push(now);
  rateLimitStore.set(key, { timestamps: activeTimestamps });

  return {
    success: true,
    remaining: limit - activeTimestamps.length,
    retryAfterSeconds: 0,
  };
}
