import { describe, expect, it } from "vitest";
import { PROBLEM_CATALOGUE, notFound, problem } from "../problem";
import type { ProblemDocument } from "../problem";
import {
  checkIfMatch,
  enforceIfMatch,
  etagFor,
  isNotModified,
} from "../preconditions";
import { InMemoryIdempotencyStore, withIdempotency } from "../idempotency";

describe("problem details (RFC 9457)", () => {
  it("serialises the required members and the problem content type", async () => {
    const response = problem("invalid_query", {
      detail: "One or more query parameters were rejected.",
      instance: "/api/v1/products",
      errors: [{ field: "catgeory", detail: "Unrecognized key." }],
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("Content-Type")).toContain("application/problem+json");

    const body = (await response.json()) as ProblemDocument;
    expect(body.type).toBe("https://errors.example.com/invalid-query");
    expect(body.title).toBe(PROBLEM_CATALOGUE.invalid_query.title);
    expect(body.status).toBe(400);
    expect(body.code).toBe("invalid_query");
    expect(body.instance).toBe("/api/v1/products");
    expect(body.errors).toHaveLength(1);
    expect(body.request_id).toMatch(/[0-9a-f-]{36}/);
  });

  it("never lets an error be cached", () => {
    expect(problem("not_found").headers.get("Cache-Control")).toBe("no-store");
  });

  it("sets Retry-After on a rate limit", () => {
    const response = problem("rate_limited", { retryAfter: 30 });
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("30");
  });

  it("keeps every catalogued status in the 4xx/5xx range", () => {
    for (const entry of Object.values(PROBLEM_CATALOGUE)) {
      expect(entry.status).toBeGreaterThanOrEqual(400);
      expect(entry.status).toBeLessThan(600);
    }
  });

  // Rule N8 — a 403 here would confirm the id is real, turning the endpoint into an
  // existence oracle for another tenant's catalogue.
  it("reports a cross-tenant resource as 404, not 403", async () => {
    const response = notFound("product", "prod_01JQZX3K9ABCDEFGHJKMNPQRST");
    expect(response.status).toBe(404);
    expect(((await response.json()) as ProblemDocument).code).toBe("not_found");
  });
});

describe("preconditions", () => {
  const etag = '"deadbeef"';

  it("derives a stable tag from the same input", async () => {
    expect(await etagFor("prod_1:7")).toBe(await etagFor("prod_1:7"));
    expect(await etagFor("prod_1:7")).not.toBe(await etagFor("prod_1:8"));
  });

  const withHeaders = (headers: Record<string, string>) =>
    new Request("https://api.test/v1/products/prod_1", { method: "PATCH", headers });

  it("reports a missing If-Match", () => {
    expect(checkIfMatch(withHeaders({}), etag)).toBe("missing");
  });

  it("accepts a matching strong tag and the wildcard", () => {
    expect(checkIfMatch(withHeaders({ "If-Match": etag }), etag)).toBe("ok");
    expect(checkIfMatch(withHeaders({ "If-Match": "*" }), etag)).toBe("ok");
  });

  it("rejects a stale tag", () => {
    expect(checkIfMatch(withHeaders({ "If-Match": '"stale"' }), etag)).toBe("mismatch");
  });

  // If-Match requires strong comparison; a weak validator is not sufficient to authorise
  // a mutation.
  it("rejects a weak tag on a write", () => {
    expect(checkIfMatch(withHeaders({ "If-Match": `W/${etag}` }), etag)).toBe("mismatch");
  });

  it("turns a missing precondition into 428 and a stale one into 412", async () => {
    const missing = enforceIfMatch(withHeaders({}), etag);
    expect(missing?.status).toBe(428);
    expect(((await missing!.json()) as ProblemDocument).code).toBe("precondition_required");

    const stale = enforceIfMatch(withHeaders({ "If-Match": '"old"' }), etag);
    expect(stale?.status).toBe(412);

    expect(enforceIfMatch(withHeaders({ "If-Match": etag }), etag)).toBeNull();
  });

  // If-None-Match uses weak comparison — the client only asks whether the representation
  // is semantically unchanged.
  it("matches weakly on a conditional read", () => {
    const read = (value: string) =>
      new Request("https://api.test/v1/products/prod_1", {
        headers: { "If-None-Match": value },
      });

    expect(isNotModified(read(etag), etag)).toBe(true);
    expect(isNotModified(read(`W/${etag}`), etag)).toBe(true);
    expect(isNotModified(read('"other"'), etag)).toBe(false);
  });
});

describe("idempotency", () => {
  const post = (body: unknown, key?: string) =>
    new Request("https://api.test/v1/products", {
      method: "POST",
      headers: key ? { "Idempotency-Key": key } : {},
      body: JSON.stringify(body),
    });

  const created = () =>
    new Response(JSON.stringify({ id: "prod_1" }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });

  it("requires a key on create", async () => {
    const response = await withIdempotency(
      post({ name: "Widget" }),
      { store: new InMemoryIdempotencyStore(), scope: "tenant_1:products:create" },
      async () => created()
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as ProblemDocument;
    expect(body.errors?.[0].field).toBe("Idempotency-Key");
  });

  it("replays the original response instead of creating twice", async () => {
    const store = new InMemoryIdempotencyStore();
    const options = { store, scope: "tenant_1:products:create" };
    let invocations = 0;

    const handler = async () => {
      invocations += 1;
      return created();
    };

    const first = await withIdempotency(post({ name: "Widget" }, "key-00000001"), options, handler);
    const retry = await withIdempotency(post({ name: "Widget" }, "key-00000001"), options, handler);

    expect(invocations).toBe(1);
    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect(retry.headers.get("Idempotency-Replayed")).toBe("true");
    expect(await retry.json()).toEqual({ id: "prod_1" });
  });

  it("rejects a key reused with a different body", async () => {
    const store = new InMemoryIdempotencyStore();
    const options = { store, scope: "tenant_1:products:create" };

    await withIdempotency(post({ name: "Widget" }, "key-00000002"), options, async () => created());
    const reuse = await withIdempotency(
      post({ name: "Different" }, "key-00000002"),
      options,
      async () => created()
    );

    expect(reuse.status).toBe(409);
    expect(((await reuse.json()) as ProblemDocument).code).toBe("idempotency_key_reuse");
  });

  it("scopes keys per tenant so one customer cannot replay another's response", async () => {
    const store = new InMemoryIdempotencyStore();
    let invocations = 0;
    const handler = async () => {
      invocations += 1;
      return created();
    };

    await withIdempotency(
      post({ name: "Widget" }, "shared-key-0001"),
      { store, scope: "tenant_1:products:create" },
      handler
    );
    await withIdempotency(
      post({ name: "Widget" }, "shared-key-0001"),
      { store, scope: "tenant_2:products:create" },
      handler
    );

    // Same client-chosen key, different tenants: the second must NOT be a replay.
    expect(invocations).toBe(2);
  });

  it("does not pin a transient 5xx to the key", async () => {
    const store = new InMemoryIdempotencyStore();
    const options = { store, scope: "tenant_1:products:create" };
    let invocations = 0;

    const flaky = async () => {
      invocations += 1;
      return invocations === 1 ? new Response("boom", { status: 500 }) : created();
    };

    const first = await withIdempotency(post({ name: "Widget" }, "key-00000003"), options, flaky);
    const second = await withIdempotency(post({ name: "Widget" }, "key-00000003"), options, flaky);

    expect(first.status).toBe(500);
    expect(second.status).toBe(201);
    expect(invocations).toBe(2);
  });
});
