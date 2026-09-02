/**
 * GET  /api/v1/products  — filter the catalogue
 * POST /api/v1/products  — create a product
 *
 * The whole argument of the standard, in one file: the collection is addressed by the
 * path, and every way of narrowing it is a query parameter. Adding a seventh filter
 * next quarter touches the schema below and nothing else — no new route, no new
 * cache rule, no client change.
 *
 * In the real app the second argument of a dynamic handler is typed with the generated
 * `RouteContext<'/api/v1/products'>` helper; this file types things explicitly so it
 * compiles outside the app directory.
 */

import { z } from "zod";
import {
  collectionQuery,
  collectionResponse,
  csvEnum,
  numericRange,
  parseCollectionQuery,
  takePage,
} from "../../../../collection";
import { encodeCursor, decodeCursor, sortFingerprint } from "../../../../cursor";
import { problem, fieldIssues } from "../../../../problem";
import { withIdempotency, InMemoryIdempotencyStore } from "../../../../idempotency";
import {
  PRODUCT_STATUSES,
  authenticate,
  getProductRepository,
  sortKeyValues,
  unauthenticated,
  forbidden,
} from "../../../../runtime";

const CURSOR_SECRET = process.env.CURSOR_SIGNING_KEY ?? "";

/**
 * Every sortable field here is index-backed as `(field, id)` — the id tiebreaker is
 * what makes keyset pagination total-ordered and therefore stable.
 */
const SORTABLE = ["updated_at", "created_at", "name", "price"] as const;

const ProductQuery = collectionQuery(
  {
    category: z.string().min(1).max(64).optional(),
    brand: z.string().min(1).max(64).optional(),
    status: csvEnum(PRODUCT_STATUSES).optional(),
    ...numericRange("price"),
  },
  {
    sortable: SORTABLE,
    defaultSort: "-updated_at",
    defaultLimit: 25,
    maxLimit: 100,
  }
);

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const instance = url.pathname;

  const principal = await authenticate(request);
  if (!principal) return unauthenticated(instance);
  if (!principal.scopes.includes("catalog:read")) {
    return forbidden("catalog:read", instance);
  }

  const parsed = parseCollectionQuery(ProductQuery, url, instance);
  if (!parsed.ok) return parsed.response;

  const { limit, sort, cursor, status, category, brand, q } = parsed.data;

  // The cursor is bound to the sort it was minted under. Without this check, changing
  // `sort` between pages yields pages that silently overlap or skip rows.
  let after: { keys: (string | number | null)[]; id: string } | undefined;
  if (cursor) {
    const decoded = await decodeCursor(cursor, CURSOR_SECRET);
    if (!decoded.ok) {
      return problem("cursor_invalid", {
        detail: "The pagination cursor is not valid. Restart from the first page.",
        instance,
      });
    }
    if (decoded.value.s !== sortFingerprint(sort)) {
      return problem("cursor_sort_mismatch", {
        detail:
          "This cursor was issued for a different sort order. Restart pagination after " +
          "changing `sort`.",
        instance,
      });
    }
    after = { keys: decoded.value.k, id: decoded.value.id };
  }

  const rows = await getProductRepository().list({
    tenantId: principal.tenantId,
    category,
    brand,
    status,
    price_gte: parsed.data.price_gte,
    price_lte: parsed.data.price_lte,
    q,
    sort,
    after,
    take: limit + 1,
  });

  const { items, hasMore } = takePage(rows, limit);
  const last = items[items.length - 1];

  const nextCursor =
    hasMore && last
      ? await encodeCursor(
          { k: sortKeyValues(last, sort), id: last.id, s: sortFingerprint(sort) },
          CURSOR_SECRET
        )
      : null;

  // 200 with an empty array when nothing matches — filtering never 404s. Rule N5.
  return collectionResponse(items, {
    next_cursor: nextCursor,
    has_more: hasMore,
    limit,
  });
}

const CreateProduct = z.strictObject({
  name: z.string().min(1).max(200),
  category_id: z.string().min(1),
  brand_id: z.string().min(1),
  status: z.enum(PRODUCT_STATUSES).default("draft"),
  price: z.number().nonnegative(),
});

/** Replace with a Redis- or Postgres-backed store; see idempotency.ts. */
const idempotencyStore = new InMemoryIdempotencyStore();

export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const instance = url.pathname;

  const principal = await authenticate(request);
  if (!principal) return unauthenticated(instance);
  if (!principal.scopes.includes("catalog:write")) {
    return forbidden("catalog:write", instance);
  }

  return withIdempotency(
    request,
    // The tenant is part of the scope so one customer's key can never replay another's
    // response back to them.
    { store: idempotencyStore, scope: `${principal.tenantId}:products:create`, instance },
    async (rawBody) => {
      let json: unknown;
      try {
        json = JSON.parse(rawBody);
      } catch {
        return problem("invalid_body", {
          detail: "Request body is not valid JSON.",
          instance,
        });
      }

      const parsed = CreateProduct.safeParse(json);
      if (!parsed.success) {
        return problem("invalid_body", {
          detail: "One or more fields were rejected.",
          instance,
          errors: fieldIssues(parsed.error.issues),
        });
      }

      const created = await getProductRepository().create(principal.tenantId, parsed.data);

      return new Response(JSON.stringify(created), {
        status: 201,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          // The canonical address of the new resource — which exists precisely because
          // identity lives in the path.
          Location: `/api/v1/products/${created.id}`,
          "Cache-Control": "no-store",
        },
      });
    }
  );
}
