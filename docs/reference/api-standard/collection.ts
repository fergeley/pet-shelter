/**
 * Shared primitives for every collection resource.
 *
 * The point of putting these in one module is that the conventions become the path of
 * least resistance. A standard that lives only in a wiki page is a standard that drifts;
 * a standard that is the easiest import in the repo is one that holds.
 */

import { z } from "zod";
import { fieldIssues, problem } from "./problem";

/**
 * Query parameter names reserved by the platform. A resource may not use these as
 * filter names — enforced at module-init time so it is a boot failure, never a
 * confusing request-time behaviour.
 */
export const RESERVED_QUERY_PARAMS = ["q", "sort", "limit", "cursor"] as const;

/** Hard ceiling on page size across every collection. */
export const ABSOLUTE_MAX_LIMIT = 100;

export interface SortTerm {
  field: string;
  dir: "asc" | "desc";
}

/**
 * `?status=active,draft` — comma-separated multi-value against a closed set.
 *
 * The standard mandates CSV rather than repeated keys (`?status=a&status=b`) for one
 * concrete reason: repeated keys have no agreed semantics across HTTP clients, proxies,
 * and CDN cache-key normalisation, so the same logical request produces different cache
 * entries depending on which SDK the customer used.
 */
export function csvEnum<V extends readonly [string, ...string[]]>(values: V) {
  return z
    .string()
    .transform((raw) =>
      raw
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    )
    .pipe(z.array(z.enum(values)).min(1).max(values.length));
}

/**
 * `?sort=-updated_at,name` — `-` prefix means descending.
 *
 * Capped at three terms and restricted to an allowlist. Both limits exist because every
 * sortable field must be backed by an index that also carries the pagination tiebreaker;
 * an open-ended sort parameter is a table scan a customer can trigger at will.
 */
export function sortParam<F extends readonly [string, ...string[]]>(
  allowed: F,
  fallback: string
) {
  const term = z.strictObject({
    field: z.enum(allowed),
    dir: z.enum(["asc", "desc"]),
  });

  return z
    .string()
    .default(fallback)
    .transform((raw): SortTerm[] =>
      raw
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) =>
          part.startsWith("-")
            ? { field: part.slice(1), dir: "desc" as const }
            : { field: part, dir: "asc" as const }
        )
    )
    .pipe(z.array(term).min(1).max(3));
}

/**
 * Builds the `_gte`/`_lte` pair for a numeric field, per the range convention.
 * Both bounds are inclusive; that is why the names are `gte`/`lte` and not `min`/`max`.
 */
export function numericRange<F extends string>(field: F) {
  return {
    [`${field}_gte`]: z.coerce.number().optional(),
    [`${field}_lte`]: z.coerce.number().optional(),
  } as unknown as Record<`${F}_gte` | `${F}_lte`, z.ZodType<number | undefined>>;
}

/** Same, for ISO-8601 instants. */
export function instantRange<F extends string>(field: F) {
  return {
    [`${field}_after`]: z.iso.datetime({ offset: true }).optional(),
    [`${field}_before`]: z.iso.datetime({ offset: true }).optional(),
  } as unknown as Record<`${F}_after` | `${F}_before`, z.ZodType<string | undefined>>;
}

export interface CollectionQueryOptions {
  /** Allowlist of sortable fields. Each must be index-backed. */
  sortable: readonly [string, ...string[]];
  /** Applied when `sort` is absent. Must be one of `sortable`, optionally `-` prefixed. */
  defaultSort: string;
  defaultLimit?: number;
  maxLimit?: number;
}

/**
 * Composes resource-specific filters with the four universal collection parameters.
 *
 * Built with `z.strictObject` (the zod v4 spelling — `.strict()` is the deprecated v3
 * form) so an unknown parameter is rejected rather than ignored. See standard rule N4:
 * a silently-dropped `?catgeory=` returns the entire catalogue, which is a typo that
 * behaves exactly like a data leak.
 */
export function collectionQuery<Filters extends Record<string, z.ZodType>>(
  filters: Filters,
  options: CollectionQueryOptions
) {
  for (const reserved of RESERVED_QUERY_PARAMS) {
    if (reserved in filters) {
      throw new Error(
        `Filter '${reserved}' collides with a reserved collection parameter. ` +
          `Reserved names: ${RESERVED_QUERY_PARAMS.join(", ")}.`
      );
    }
  }

  const maxLimit = Math.min(options.maxLimit ?? ABSOLUTE_MAX_LIMIT, ABSOLUTE_MAX_LIMIT);

  // Standard params are spread last so they always win a name collision; the guard
  // above means that collision can never actually happen.
  return z.strictObject({
    ...filters,
    q: z.string().min(1).max(200).optional(),
    sort: sortParam(options.sortable, options.defaultSort),
    limit: z.coerce.number().int().min(1).max(maxLimit).default(options.defaultLimit ?? 25),
    cursor: z.string().optional(),
  });
}

export type ParseResult<T> = { ok: true; data: T } | { ok: false; response: Response };

/**
 * Parses and validates a collection query string.
 *
 * Rejects repeated keys explicitly. `Object.fromEntries` keeps only the last occurrence,
 * so `?status=active&status=draft` would otherwise be silently read as `draft` — the
 * client believes it asked for two statuses and gets a filtered subset with a 200. That
 * is a wrong answer delivered as a success, which is strictly worse than an error.
 */
export function parseCollectionQuery<S extends z.ZodType>(
  schema: S,
  url: URL,
  instance?: string
): ParseResult<z.infer<S>> {
  const seen = new Set<string>();
  for (const key of url.searchParams.keys()) {
    if (seen.has(key)) {
      return {
        ok: false,
        response: problem("invalid_query", {
          detail:
            `Query parameter '${key}' was supplied more than once. ` +
            `Use a comma-separated list for multiple values.`,
          instance,
          errors: [{ field: key, detail: "Repeated query parameters are not supported." }],
        }),
      };
    }
    seen.add(key);
  }

  const parsed = schema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return {
      ok: false,
      response: problem("invalid_query", {
        detail: "One or more query parameters were rejected.",
        instance,
        errors: fieldIssues(parsed.error.issues),
      }),
    };
  }

  return { ok: true, data: parsed.data };
}

export interface Pagination {
  next_cursor: string | null;
  has_more: boolean;
  limit: number;
}

export interface CollectionBody<T> {
  data: T[];
  pagination: Pagination;
}

/**
 * The collection envelope. Never a bare top-level array — an array cannot grow a
 * sibling field, so returning one forecloses on ever adding pagination, warnings, or
 * partial-failure reporting without a major version bump. Standard rule N6.
 *
 * Collections are `private` by default: they are tenant-scoped and authorisation-
 * dependent, and a shared cache entry crossing tenants is the most expensive bug
 * available to us.
 */
export function collectionResponse<T>(
  items: T[],
  pagination: Pagination,
  init: ResponseInit = {}
): Response {
  const body: CollectionBody<T> = { data: items, pagination };

  return new Response(JSON.stringify(body), {
    status: 200,
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, max-age=0, must-revalidate",
      ...init.headers,
    },
  });
}

/**
 * Fetch `limit + 1` rows, then call this. Determines `has_more` without a second
 * COUNT query — the extra row is the probe, and it is discarded.
 *
 * There is deliberately no `total` in the envelope. An exact count over a filtered,
 * tenant-scoped table is a full scan on every page request; when a customer genuinely
 * needs one it belongs on a separate, explicitly-costed `/products/count` endpoint.
 */
export function takePage<T>(rows: T[], limit: number): { items: T[]; hasMore: boolean } {
  if (rows.length > limit) {
    return { items: rows.slice(0, limit), hasMore: true };
  }
  return { items: rows, hasMore: false };
}
