import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  collectionQuery,
  collectionResponse,
  csvEnum,
  numericRange,
  parseCollectionQuery,
  takePage,
} from "../collection";
import type { ProblemDocument } from "../problem";

const STATUSES = ["active", "draft", "archived"] as const;

const ProductQuery = collectionQuery(
  {
    category: z.string().min(1).optional(),
    brand: z.string().min(1).optional(),
    status: csvEnum(STATUSES).optional(),
    ...numericRange("price"),
  },
  { sortable: ["updated_at", "name", "price"], defaultSort: "-updated_at", maxLimit: 100 }
);

function parse(query: string) {
  return parseCollectionQuery(ProductQuery, new URL(`https://api.test/v1/products${query}`));
}

async function problemOf(response: Response): Promise<ProblemDocument> {
  return (await response.json()) as ProblemDocument;
}

describe("collectionQuery", () => {
  it("accepts the multi-attribute filter the standard is built around", () => {
    const result = parse("?category=electronics&brand=acme&status=active&price_gte=100");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.category).toBe("electronics");
    expect(result.data.brand).toBe("acme");
    expect(result.data.status).toEqual(["active"]);
    expect(result.data.price_gte).toBe(100);
  });

  it("applies pagination and sort defaults when absent", () => {
    const result = parse("");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.limit).toBe(25);
    expect(result.data.sort).toEqual([{ field: "updated_at", dir: "desc" }]);
  });

  it("parses a multi-term sort with direction prefixes", () => {
    const result = parse("?sort=-price,name");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.sort).toEqual([
      { field: "price", dir: "desc" },
      { field: "name", dir: "asc" },
    ]);
  });

  it("rejects sorting by a field that is not index-backed", async () => {
    const result = parse("?sort=internal_cost");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(400);
    expect((await problemOf(result.response)).code).toBe("invalid_query");
  });

  // Rule N4. This is the case that makes strict parsing worth the friction: a typo in a
  // filter name would otherwise return the entire catalogue with a 200.
  it("rejects a misspelled filter rather than ignoring it", async () => {
    const result = parse("?catgeory=electronics");

    expect(result.ok).toBe(false);
    if (result.ok) return;

    const problem = await problemOf(result.response);
    expect(problem.status).toBe(400);
    expect(problem.code).toBe("invalid_query");
    expect(problem.errors?.some((issue) => issue.field === "catgeory")).toBe(true);
  });

  it("rejects repeated keys instead of silently keeping the last one", async () => {
    const result = parse("?status=active&status=draft");

    expect(result.ok).toBe(false);
    if (result.ok) return;

    const problem = await problemOf(result.response);
    expect(problem.code).toBe("invalid_query");
    expect(problem.detail).toContain("more than once");
  });

  it("accepts comma-separated multi-values", () => {
    const result = parse("?status=active,archived");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toEqual(["active", "archived"]);
  });

  it("rejects a value outside the closed set", () => {
    expect(parse("?status=active,bogus").ok).toBe(false);
  });

  it("clamps page size to the configured ceiling", () => {
    expect(parse("?limit=100").ok).toBe(true);
    expect(parse("?limit=101").ok).toBe(false);
    expect(parse("?limit=0").ok).toBe(false);
    expect(parse("?limit=abc").ok).toBe(false);
  });

  it("refuses to build a schema whose filter shadows a reserved parameter", () => {
    expect(() =>
      collectionQuery(
        { limit: z.string().optional() },
        { sortable: ["updated_at"], defaultSort: "-updated_at" }
      )
    ).toThrow(/reserved/i);
  });
});

describe("envelope", () => {
  it("wraps items in { data, pagination } and never returns a bare array", async () => {
    const response = collectionResponse([{ id: "prod_1" }], {
      next_cursor: null,
      has_more: false,
      limit: 25,
    });

    const body = await response.json();
    expect(Array.isArray(body)).toBe(false);
    expect(body).toEqual({
      data: [{ id: "prod_1" }],
      pagination: { next_cursor: null, has_more: false, limit: 25 },
    });
  });

  // Rule N5 — an unmatched filter is an empty collection, not a missing resource.
  it("returns 200 with an empty array when nothing matches", async () => {
    const response = collectionResponse([], { next_cursor: null, has_more: false, limit: 25 });

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([]);
  });

  it("marks collection responses private", () => {
    const response = collectionResponse([], { next_cursor: null, has_more: false, limit: 25 });
    expect(response.headers.get("Cache-Control")).toContain("private");
  });
});

describe("takePage", () => {
  it("detects a further page from the probe row without a COUNT query", () => {
    const rows = [1, 2, 3, 4];
    expect(takePage(rows, 3)).toEqual({ items: [1, 2, 3], hasMore: true });
  });

  it("reports no further page when the probe row is absent", () => {
    expect(takePage([1, 2], 3)).toEqual({ items: [1, 2], hasMore: false });
  });
});
