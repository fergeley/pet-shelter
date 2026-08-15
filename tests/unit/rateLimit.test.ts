import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkRateLimit } from "@/lib/security/rateLimit";

describe("Sliding Window Rate Limiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should allow requests up to the configured limit and report remaining quota", () => {
    const key = "test-user-ip-1";
    const limit = 5;
    const windowMs = 60000;

    for (let i = 1; i <= limit; i++) {
      const result = checkRateLimit(key, limit, windowMs);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(limit - i);
      expect(result.retryAfterSeconds).toBe(0);
    }
  });

  it("should block requests once the limit is reached within the window", () => {
    const key = "test-user-ip-blocked";
    const limit = 3;
    const windowMs = 60000;

    // Use all 3 attempts
    for (let i = 0; i < limit; i++) {
      expect(checkRateLimit(key, limit, windowMs).success).toBe(true);
    }

    // 4th attempt should be blocked
    const blockedResult = checkRateLimit(key, limit, windowMs);
    expect(blockedResult.success).toBe(false);
    expect(blockedResult.remaining).toBe(0);
    expect(blockedResult.retryAfterSeconds).toBe(60);

    // 5th attempt should also be blocked
    const blockedResult2 = checkRateLimit(key, limit, windowMs);
    expect(blockedResult2.success).toBe(false);
    expect(blockedResult2.remaining).toBe(0);
    expect(blockedResult2.retryAfterSeconds).toBe(60);
  });

  it("should dynamically calculate retryAfterSeconds as time advances", () => {
    const key = "test-user-retry-calc";
    const limit = 2;
    const windowMs = 60000;

    // First request at T=0
    checkRateLimit(key, limit, windowMs);
    // Second request at T=10s
    vi.advanceTimersByTime(10000);
    checkRateLimit(key, limit, windowMs);

    // Blocked at T=10s. Oldest request was at T=0.
    // Window = 60s, elapsed since oldest = 10s => retryAfter = 50s.
    const blocked1 = checkRateLimit(key, limit, windowMs);
    expect(blocked1.success).toBe(false);
    expect(blocked1.retryAfterSeconds).toBe(50);

    // Advance 25 seconds (T=35s). Elapsed since oldest (T=0) = 35s => retryAfter = 25s.
    vi.advanceTimersByTime(25000);
    const blocked2 = checkRateLimit(key, limit, windowMs);
    expect(blocked2.success).toBe(false);
    expect(blocked2.retryAfterSeconds).toBe(25);
  });

  it("should restore quota as timestamps slide outside the active window", () => {
    const key = "test-user-sliding-restore";
    const limit = 2;
    const windowMs = 60000;

    // 2 requests at T=0
    checkRateLimit(key, limit, windowMs);
    checkRateLimit(key, limit, windowMs);

    expect(checkRateLimit(key, limit, windowMs).success).toBe(false);

    // Advance past the window (T=61s)
    vi.advanceTimersByTime(61000);

    // Should now be permitted again
    const result = checkRateLimit(key, limit, windowMs);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(1);
    expect(result.retryAfterSeconds).toBe(0);
  });

  it("should isolate rate limits across different keys", () => {
    const keyA = "login:ip:10.0.0.1";
    const keyB = "login:ip:10.0.0.2";
    const limit = 2;
    const windowMs = 60000;

    // Exhaust keyA
    checkRateLimit(keyA, limit, windowMs);
    checkRateLimit(keyA, limit, windowMs);
    expect(checkRateLimit(keyA, limit, windowMs).success).toBe(false);

    // keyB should remain completely unaffected
    const resultB = checkRateLimit(keyB, limit, windowMs);
    expect(resultB.success).toBe(true);
    expect(resultB.remaining).toBe(1);
  });

  it("should support custom limits and custom sliding window durations", () => {
    const key = "custom-config-key";
    const limit = 1;
    const windowMs = 5000; // 5 seconds window

    const res1 = checkRateLimit(key, limit, windowMs);
    expect(res1.success).toBe(true);
    expect(res1.remaining).toBe(0);

    const res2 = checkRateLimit(key, limit, windowMs);
    expect(res2.success).toBe(false);
    expect(res2.retryAfterSeconds).toBe(5);

    // Advance 6 seconds
    vi.advanceTimersByTime(6000);

    const res3 = checkRateLimit(key, limit, windowMs);
    expect(res3.success).toBe(true);
  });
});
