import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  ABSOLUTE_MAX_LIMIT,
  collectionQuery,
  collectionResponse,
  csvEnum,
  numericRange,
  parseCollectionQuery,
  sortParam,
  takePage,
} from "../collection";
import { decodeCursor, encodeCursor, sortFingerprint } from "../cursor";
import { PROBLEM_CATALOGUE, fieldIssues, notFound, problem } from "../problem";
import {
  checkIfMatch,
  enforceIfMatch,
  etagFor,
  isNotModified,
} from "../preconditions";
import { InMemoryIdempotencyStore, withIdempotency } from "../idempotency";

const SECRET = "test-signing-key";
const STATUSES = ["active", "draft", "archived"] as const;

function url(query: string): URL {
  return new URL(`https://api.example.com/api/v1/products${query}`);
}

const ProductQuery = collectionQuery(
  {
    category: z.string().min(1).optional(),
    brand: z.string().min(1).optional(),
    status: csvEnum(STATUSES).optional(),
    ...numericRange("price"),
  },
  { sortable: ["updated_at", "name", "price"], defaultSort: "-updated_at" }
);

describe("problem details (RFC 9457)", () => {
  it("serialises the documented media type and never caches", async () => {
    const response = problem("not_found", { instance: "/api/v1/products/prod_1" });

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toBe(
      "application/problem+json; charset=utf-8"
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const body = await response.json();
    expect(body.code).toBe("not_found");
    expect(body.type).toBe("https://errors.example.com/not-found");
    expect(body.instance).toBe("/api/v1/products/prod_1");
    expect(typeof body.request_id).toBe("string");
  });

  it("emits Retry-After as both a header and a member on 429", async () => {
    const response = problem("rate_limited", { retryAfter: 30 });

    expect(response.headers.get("Retry-After")).toBe("30");
    expect((await response.json()).retry_after).toBe(30);
  });

  it("reports a foreign-tenant row as 404, never 403", () => {
    // A 403 would confirm the id exists and turn the endpoint into an existence oracle.
    expect(notFound("product", "prod_x").status).toBe(404);
    expect(PROBLEM_CATALOGUE.forbidden.status).toBe(403);
  });

  it("flattens zod paths into dotted field names", () => {
    const result = z
      .strictObject({ nested: z.strictObject({ price: z.number() }) })
      .safeParse({ nested: { price: "no" } });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(fieldIssues(result.error.issues)[0].field).toBe("nested.price");
  });
});

describe("query parsing (rule N4)", () => {
  it("rejects an unknown parameter rather than ignoring it", async () => {
    // The motivating case: `catgeory` silently ignored would return the whole catalogue
    // with a 200 — a typo that behaves exactly like a data leak.
    const result = parseCollectionQuery(ProductQuery, url("?catgeory=electronics"));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(400);

    const body = await result.response.json();
    expect(body.code).toBe("invalid_query");
    expect(body.errors.some((issue: { field: string }) => issue.field === "catgeory")).toBe(
      true
    );
  });

  it("rejects a repeated key instead of silently keeping the last value", async () => {
    const result = parseCollectionQuery(ProductQuery, url("?status=active&status=draft"));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect((await result.response.json()).code).toBe("invalid_query");
  });

  it("accepts the documented multi-value CSV form", () => {
    const result = parseCollectionQuery(ProductQuery, url("?status=active,draft"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toEqual(["active", "draft"]);
  });

  it("applies the default sort and limit when absent", () => {
    const result = parseCollectionQuery(ProductQuery, url(""));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.limit).toBe(25);
    expect(result.data.sort).toEqual([{ field: "updated_at", dir: "desc" }]);
  });

  it("parses combined filters independently of order", () => {
    const a = parseCollectionQuery(ProductQuery, url("?category=electronics&brand=acme"));
    const b = parseCollectionQuery(ProductQuery, url("?brand=acme&category=electronics"));

    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.data).toEqual(b.data);
  });

  it("coerces inclusive numeric range bounds", () => {
    const result = parseCollectionQuery(ProductQuery, url("?price_gte=100&price_lte=500"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.price_gte).toBe(100);
    expect(result.data.price_lte).toBe(500);
  });

  it("rejects a page size above the ceiling rather than silently clamping", () => {
    const result = parseCollectionQuery(ProductQuery, url("?limit=5000"));

    expect(result.ok).toBe(false);
    expect(ABSOLUTE_MAX_LIMIT).toBe(100);
  });
});

describe("sort parameter", () => {
  const schema = sortParam(["updated_at", "name"], "-updated_at");

  it("reads the - prefix as descending", () => {
    expect(schema.parse("-updated_at,name")).toEqual([
      { field: "updated_at", dir: "desc" },
      { field: "name", dir: "asc" },
    ]);
  });

  it("refuses a field outside the index-backed allowlist", () => {
    expect(schema.safeParse("internal_cost").success).toBe(false);
  });

  it("caps the number of terms", () => {
    expect(schema.safeParse("name,name,name,name").success).toBe(false);
  });
});

describe("reserved parameter names", () => {
  it("fails at construction, not at request time", () => {
    expect(() =>
      collectionQuery({ limit: z.string() }, { sortable: ["name"], defaultSort: "name" })
    ).toThrow(/reserved/i);
  });
});

describe("collection envelope (rule N6)", () => {
  it("wraps data and pagination and marks the response private", async () => {
    const response = collectionResponse([{ id: "prod_1" }], {
      next_cursor: null,
      has_more: false,
      limit: 25,
    });

    expect(response.headers.get("Cache-Control")).toBe(
      "private, max-age=0, must-revalidate"
    );

    const body = await response.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toEqual({ next_cursor: null, has_more: false, limit: 25 });
  });

  it("returns 200 with an empty array when nothing matches (rule N5)", async () => {
    const response = collectionResponse([], { next_cursor: null, has_more: false, limit: 25 });

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([]);
  });

  it("derives has_more from the probe row without a COUNT", () => {
    expect(takePage([1, 2, 3, 4], 3)).toEqual({ items: [1, 2, 3], hasMore: true });
    expect(takePage([1, 2], 3)).toEqual({ items: [1, 2], hasMore: false });
  });
});

describe("cursors", () => {
  const payload = {
    k: ["2026-08-18T10:00:00Z"] as (string | number | null)[],
    id: "prod_01JQZX3K9",
    s: "updated_at:desc",
  };

  it("round-trips through sign and verify", async () => {
    const token = await encodeCursor(payload, SECRET);
    const decoded = await decodeCursor(token, SECRET);

    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.id).toBe("prod_01JQZX3K9");
    expect(decoded.value.k).toEqual(["2026-08-18T10:00:00Z"]);
  });

  it("is opaque — the payload is not readable as plain text", async () => {
    const token = await encodeCursor(payload, SECRET);
    expect(token).not.toContain("prod_01JQZX3K9");
  });

  it("detects a tampered payload", async () => {
    const token = await encodeCursor(payload, SECRET);
    const [body, signature] = token.split(".");
    const forged = `${body.slice(0, -4)}AAAA.${signature}`;

    const decoded = await decodeCursor(forged, SECRET);
    expect(decoded.ok).toBe(false);
    if (decoded.ok) return;
    expect(decoded.reason).toBe("bad_signature");
  });

  it("rejects a cursor minted with a different key", async () => {
    const token = await encodeCursor(payload, SECRET);
    const decoded = await decodeCursor(token, "another-key");

    expect(decoded.ok).toBe(false);
  });

  it("fails closed on malformed input", async () => {
    for (const bad of ["", ".", "no-separator", "a.b"]) {
      expect((await decodeCursor(bad, SECRET)).ok).toBe(false);
    }
  });

  it("binds the cursor to the sort it was issued under", async () => {
    const sort = [{ field: "updated_at", dir: "desc" as const }];
    const token = await encodeCursor(
      { k: ["x"], id: "prod_1", s: sortFingerprint(sort) },
      SECRET
    );

    const decoded = await decodeCursor(token, SECRET);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;

    // Same sort continues cleanly; a changed sort is detectable rather than silently
    // producing overlapping or skipped pages.
    expect(decoded.value.s).toBe(sortFingerprint(sort));
    expect(decoded.value.s).not.toBe(
      sortFingerprint([{ field: "name", dir: "asc" as const }])
    );
  });
});

describe("conditional requests", () => {
  const request = (headers: Record<string, string>) =>
    new Request("https://api.example.com/api/v1/products/prod_1", { headers });

  it("produces a stable strong tag for identical state", async () => {
    expect(await etagFor("prod_1:7")).toBe(await etagFor("prod_1:7"));
    expect(await etagFor("prod_1:7")).not.toBe(await etagFor("prod_1:8"));
    expect(await etagFor("prod_1:7")).toMatch(/^"[0-9a-f]{32}"$/);
  });

  it("matches If-None-Match weakly so a W/ tag still yields 304", async () => {
    const etag = await etagFor("prod_1:7");

    expect(isNotModified(request({ "If-None-Match": etag }), etag)).toBe(true);
    expect(isNotModified(request({ "If-None-Match": `W/${etag}` }), etag)).toBe(true);
    expect(isNotModified(request({ "If-None-Match": '"stale"' }), etag)).toBe(false);
    expect(isNotModified(request({}), etag)).toBe(false);
  });

  it("matches If-Match strongly, because a write is about to happen", async () => {
    const etag = await etagFor("prod_1:7");

    expect(checkIfMatch(request({ "If-Match": etag }), etag)).toBe("ok");
    expect(checkIfMatch(request({ "If-Match": "*" }), etag)).toBe("ok");
    expect(checkIfMatch(request({ "If-Match": `W/${etag}` }), etag)).toBe("mismatch");
    expect(checkIfMatch(request({ "If-Match": '"stale"' }), etag)).toBe("mismatch");
    expect(checkIfMatch(request({}), etag)).toBe("missing");
  });

  it("answers a missing precondition with 428 and a stale one with 412", async () => {
    const etag = await etagFor("prod_1:7");

    const missing = enforceIfMatch(request({}), etag);
    expect(missing?.status).toBe(428);
    expect(missing?.headers.get("ETag")).toBe(etag);

    const stale = enforceIfMatch(request({ "If-Match": '"old"' }), etag);
    expect(stale?.status).toBe(412);

    expect(enforceIfMatch(request({ "If-Match": etag }), etag)).toBeNull();
  });
});

describe("idempotency", () => {
  const post = (key: string | null, body: string) =>
    new Request("https://api.example.com/api/v1/products", {
      method: "POST",
      headers: key ? { "Idempotency-Key": key } : {},
      body,
    });

  const options = (store: InMemoryIdempotencyStore) => ({
    store,
    scope: "tenant_a:products:create",
  });

  it("requires a key on creating POSTs", async () => {
    const response = await withIdempotency(
      post(null, "{}"),
      options(new InMemoryIdempotencyStore()),
      async () => new Response("{}", { status: 201 })
    );

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("invalid_body");
  });

  it("runs the handler once and replays the stored response on retry", async () => {
    const store = new InMemoryIdempotencyStore();
    let calls = 0;

    const handler = async () => {
      calls++;
      return new Response(JSON.stringify({ id: "prod_1" }), {
        status: 201,
        headers: { Location: "/api/v1/products/prod_1" },
      });
    };

    const first = await withIdempotency(post("key-12345678", '{"name":"a"}'), options(store), handler);
    const retry = await withIdempotency(post("key-12345678", '{"name":"a"}'), options(store), handler);

    expect(calls).toBe(1);
    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect(retry.headers.get("Idempotency-Replayed")).toBe("true");
    expect(retry.headers.get("Location")).toBe("/api/v1/products/prod_1");
    expect(await retry.json()).toEqual({ id: "prod_1" });
  });

  it("rejects the same key used for a different body", async () => {
    const store = new InMemoryIdempotencyStore();
    const handler = async () => new Response("{}", { status: 201 });

    await withIdempotency(post("key-12345678", '{"name":"a"}'), options(store), handler);
    const reused = await withIdempotency(
      post("key-12345678", '{"name":"DIFFERENT"}'),
      options(store),
      handler
    );

    expect(reused.status).toBe(409);
    expect((await reused.json()).code).toBe("idempotency_key_reuse");
  });

  it("does not pin a 5xx to the key, so the client can retry out of it", async () => {
    const store = new InMemoryIdempotencyStore();
    let calls = 0;

    const flaky = async () => {
      calls++;
      return calls === 1
        ? new Response("{}", { status: 503 })
        : new Response(JSON.stringify({ id: "prod_1" }), { status: 201 });
    };

    const failed = await withIdempotency(post("key-12345678", "{}"), options(store), flaky);
    const recovered = await withIdempotency(post("key-12345678", "{}"), options(store), flaky);

    expect(failed.status).toBe(503);
    expect(recovered.status).toBe(201);
    expect(calls).toBe(2);
  });

  it("releases the key when the handler throws", async () => {
    const store = new InMemoryIdempotencyStore();

    await expect(
      withIdempotency(post("key-12345678", "{}"), options(store), async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    expect(await store.lookup("key-12345678")).toEqual({ state: "fresh" });
  });
});
