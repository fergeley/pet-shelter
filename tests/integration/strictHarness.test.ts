import { describe, it, expect } from "vitest";
import { isStrictPersistence } from "@/lib/persistenceMode";

/**
 * Guards the `test:integration` script itself.
 *
 * `cross-env STRICT_PERSISTENCE=true` is the only thing standing between the
 * Tier-3 suite and the in-memory fallback silently green-lighting a broken
 * query. If the flag ever stops reaching the worker — a renamed script, a
 * dropped `cross-env`, a pool/fork config that does not inherit env — every
 * other integration test would keep passing while testing nothing. This fails
 * loudly instead.
 */
describe("integration harness", () => {
  it("runs under STRICT_PERSISTENCE=true", () => {
    expect(process.env.STRICT_PERSISTENCE).toBe("true");
    expect(isStrictPersistence()).toBe(true);
  });
});
