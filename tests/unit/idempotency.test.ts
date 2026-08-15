import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { withIdempotency } from "@/lib/security/idempotency";

describe("Idempotency Middleware & TTL Caching", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should execute the operation on the first call and cache the result for duplicate calls", async () => {
    const operation = vi.fn<() => Promise<{ applicationId: string; processedAt: number }>>().mockImplementation(async () => {
      return { applicationId: "app-xyz-99", processedAt: Date.now() };
    });

    const key = "idemp-req-unique-1";

    // First call
    const result1 = await withIdempotency(key, operation);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(result1.applicationId).toBe("app-xyz-99");

    // Second call with same key (within TTL)
    const result2 = await withIdempotency(key, operation);
    expect(operation).toHaveBeenCalledTimes(1); // Not called again
    expect(result2).toEqual(result1);

    // Third call with same key
    const result3 = await withIdempotency(key, operation);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(result3).toEqual(result1);
  });

  it("should re-execute the operation after the TTL has expired", async () => {
    let counter = 0;
    const operation = vi.fn<() => Promise<{ executionCount: number }>>().mockImplementation(async () => {
      counter++;
      return { executionCount: counter };
    });

    const key = "idemp-req-ttl-test";
    const ttlMs = 1000 * 60 * 5; // 5 minutes

    // T = 0m
    const res1 = await withIdempotency(key, operation, ttlMs);
    expect(res1.executionCount).toBe(1);
    expect(operation).toHaveBeenCalledTimes(1);

    // T = 4m (before TTL expiry)
    vi.advanceTimersByTime(1000 * 60 * 4);
    const res2 = await withIdempotency(key, operation, ttlMs);
    expect(res2.executionCount).toBe(1);
    expect(operation).toHaveBeenCalledTimes(1);

    // T = 6m (after TTL expiry of 5 minutes)
    vi.advanceTimersByTime(1000 * 60 * 2);
    const res3 = await withIdempotency(key, operation, ttlMs);
    expect(res3.executionCount).toBe(2);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("should bypass caching and always execute when key is null, undefined, empty, or whitespace", async () => {
    const operation = vi.fn<() => Promise<string>>().mockResolvedValue("executed");

    const bypassKeys = [null, undefined, "", "   ", "\t\n"];

    for (const key of bypassKeys) {
      operation.mockClear();
      const res1 = await withIdempotency(key, operation);
      const res2 = await withIdempotency(key, operation);

      expect(res1).toBe("executed");
      expect(res2).toBe("executed");
      expect(operation).toHaveBeenCalledTimes(2);
    }
  });

  it("should maintain isolated cache entries for different keys", async () => {
    const opA = vi.fn<() => Promise<{ target: string }>>().mockResolvedValue({ target: "Entity A" });
    const opB = vi.fn<() => Promise<{ target: string }>>().mockResolvedValue({ target: "Entity B" });

    const keyA = "idemp-entity-a";
    const keyB = "idemp-entity-b";

    const resA = await withIdempotency(keyA, opA);
    const resB = await withIdempotency(keyB, opB);

    expect(resA.target).toBe("Entity A");
    expect(resB.target).toBe("Entity B");
    expect(opA).toHaveBeenCalledTimes(1);
    expect(opB).toHaveBeenCalledTimes(1);
  });

  it("should propagate operation errors and allow subsequent retry if operation failed", async () => {
    const errorOp = vi.fn<() => Promise<{ success: boolean }>>()
      .mockRejectedValueOnce(new Error("Database transient error"))
      .mockResolvedValueOnce({ success: true });

    const key = "idemp-fail-and-retry";

    // First attempt fails
    await expect(withIdempotency(key, errorOp)).rejects.toThrow("Database transient error");
    expect(errorOp).toHaveBeenCalledTimes(1);

    // Second attempt should re-attempt the operation since failure wasn't cached
    const successResult = await withIdempotency(key, errorOp);
    expect(successResult).toEqual({ success: true });
    expect(errorOp).toHaveBeenCalledTimes(2);
  });
});
