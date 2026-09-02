# ADR-001 — API Routing Standard: Path Parameters vs. Query Parameters

| | |
|---|---|
| **Status** | Proposed (revision 2) |
| **Supersedes** | revision 1 |
| **Applies to** | every `/api/v1` collection resource |
| **Verified against** | Next.js 16.3.1 (App Router), zod 4.4.3, TypeScript 5 strict |
| **Reference implementation** | [`docs/reference/api-standard/`](../reference/api-standard/) |

> **Scope note.** This standard was written for a B2B SaaS product catalogue API
> (`products`, `categories`), not for the Hope for Strays domain. It is kept here because
> the placement rules, error taxonomy, and conformance linter are domain-agnostic and
> apply to any collection resource we expose — including this app's own route handlers,
> which currently violate three of them (see §5).

---

## Context

Two candidate routing patterns were proposed for the product catalogue:

- **Approach A (path-based)** — `GET /api/v1/products/{identifier}`, where `{identifier}`
  is sometimes a product id (`123`) and sometimes a category slug (`electronics`).
- **Approach B (query-filtered)** — `GET /api/v1/products?category=electronics`.

We need a rule that settles this case and every case like it.

---

## §1 — The rule of thumb

**The path identifies. The query shapes the answer.**

A path segment *names a resource* — a thing with its own identity and lifecycle.
`/products/123` is a promise: there is exactly one product, and this URL is its permanent
address. A query string is a *modifier applied to a collection resource*. RFC 3986 draws
the same line: the path carries hierarchical identifying data, the query carries
non-hierarchical data that selects *within* the scope the path established.

### The deciding test

> Delete the value from the URL. If the correct response becomes **404**, it was a path
> parameter. If it becomes **everything**, it was a query parameter.

`/products/999999` with an unknown id is a `404` — you named something that does not
exist. `/products?category=nonsense` is a `200` with an empty array — the collection
exists, nothing matched. Two different error semantics for two different kinds of
question, and that difference is the whole rule.

### Three corollaries

1. **Cardinality.** A path addresses exactly one thing. A query addresses a view over a
   set that may legitimately return zero, one, or ten thousand rows.
2. **Optionality and order.** Path parameters are required and positional; query
   parameters are optional and commutative. An attribute that is sometimes absent cannot
   live in the path without spawning a second route.
3. **Contract permanence.** A path parameter becomes part of the resource's identity — it
   appears in `Location` headers, webhook payloads, audit logs and customer bookmarks.
   Changing it is a breaking change. Query parameters can be added forever without
   breaking a single integration.

The third point is decisive: we are choosing what can never change versus what can grow
indefinitely.

---

## §2 — Assessment of Approach A

### 2.1 Route collision is a build failure, not a style opinion

On this stack the filesystem router cannot express Approach A as two handlers:

```
src/app/api/v1/products/[productId]/route.ts
src/app/api/v1/products/[category]/route.ts   ← error

Error: You cannot use different slug names for the same
dynamic path ('productId' !== 'category').
```

So Approach A collapses into one `[identifier]` handler with a runtime disambiguation
branch, and every remaining flaw descends from that branch:

```ts
// Anti-pattern
export async function GET(_req: NextRequest, ctx: RouteContext<'/api/v1/products/[identifier]'>) {
  const { identifier } = await ctx.params
  if (/^\d+$/.test(identifier)) return getProductById(identifier)
  return getProductsByCategory(identifier)  // different shape, same URL
}
```

- **The heuristic has an expiry date.** "Numeric means id" holds until a customer creates
  a category named `2024`, or we migrate to ULIDs, or a SKU is literally `electronics`.
  The response shape then flips for a URL that worked yesterday. No test suite catches it,
  because the trigger is a row in a customer's tenant.
- **Polymorphic response shape.** One route returns `Product` on one branch and a
  paginated envelope on the other, forcing `oneOf` in the OpenAPI schema and runtime
  type-narrowing in every generated client. A compile-time error becomes an integration
  error.
- **Authorisation and rate limits cannot be declared per route.** Reading one product is
  cheap; scanning a category is expensive, and they may sit under different scopes. One
  route can only enforce that *after* parsing, inside the handler.
- **Namespace exhaustion.** The dynamic segment swallows the level, so `/products/search`,
  `/products/export` and `/products/count` become reserved words no category may use.

### 2.2 Combinatorics — paths multiply, queries add

Filtering is a cross product; a path is a tree. Take the charitable reading first, because
it is what an advocate would actually build: fix a canonical segment order and allow only
prefixes. That still needs one route per subset — **2ⁿ−1** — and makes filters positionally
dependent, so a client cannot filter by status without also naming a category and a brand.

| Filters | Fixed order (2ⁿ−1) | Any order | Query parameters |
|---|---:|---:|---:|
| 2 (category, brand) | 3 | 4 | **2** |
| 3 (+ status) | 7 | 15 | **3** |
| 4 (+ price band) | 15 | 64 | **4** |
| 5 (+ warehouse) | 31 | 325 | **5** |
| 6 (+ supplier) | 63 | 1,956 | **6** |

Query parameters are commutative and independent: *n* filters cost *n* parameters, and the
seventh is a non-breaking, zero-route change. Multiplicative versus additive growth is the
entire argument.

Paths also have no sane encoding for filters we already need — multi-valued
(`?status=active,draft`), ranged (`?price_gte=100&price_lte=500`), or temporal
(`?updated_after=2026-01-01T00:00:00Z`).

### 2.3 Caching

Both approaches are cacheable — the query string is part of the cache key under RFC 9111.
The problem with A is that *one URL space is doing two jobs with opposite cache profiles*.

- **Irreconcilable TTLs.** An entity read has a high hit rate and changes only when that
  product changes; a filtered collection has a low hit rate and is invalidated by any
  product in the category. One route cannot carry differentiated `Cache-Control` without
  first computing the response it is trying to describe.
- **Invalidation granularity collapses.** Split routes tag `product:123` and
  `catalog:electronics` as separate surrogate keys and purge each precisely. A polymorphic
  route makes the purge layer re-run the same unreliable heuristic.
- **Static optimisation is lost outright.** Route Handlers are uncached by default; a
  single-product `GET` is a natural `generateStaticParams` / `use cache` candidate, while a
  tenant-scoped filter must stay request-time. A polymorphic handler is pinned to the
  lowest common denominator — fully dynamic — so Approach A costs measurable latency.
- **Cross-tenant cache poisoning.** Collections are auth-dependent and must be `private`.
  Sharing a route with a potentially shared-cacheable record makes that a per-request
  judgement instead of a static, reviewable property.

One genuine cost of query parameters: unnormalised keys fragment the cache, so `?a=1&b=2`
and `?b=2&a=1` become two entries. Solve it once at the edge — sort keys, canonicalise
case, drop defaults.

---

## §3 — The standard

An attribute belongs in the **path** when *all five* hold: it identifies exactly one
resource; it is required; it is stable enough to bookmark, log and return in a `Location`
header; its absence is a 404 rather than an empty result; and it expresses genuine
containment, where the child cannot exist outside the parent.

It belongs in the **query string** when *any one* holds: it is optional; it narrows a
collection to 0..n results; it combines freely with other attributes; it controls
presentation rather than identity; or its value set will grow over time.

### Conventions

| Concern | Convention | Form |
|---|---|---|
| Identity | Plural collection, opaque prefixed id | `/products/{productId}` |
| Nesting | Only where the child is owned by the parent | `/products/{id}/variants/{variantId}` |
| Versioning | Path prefix, major only | `/api/v1/…` |
| Actions | Verb sub-resource, `POST` only | `POST /products/{id}/archive` |
| Filtering | `snake_case` field, `=` for equality | `?status=active` |
| Multi-value | Comma-separated — never repeated keys | `?status=active,draft` |
| Ranges | `_gte` / `_lte`, both inclusive | `?price_gte=100&price_lte=500` |
| Time ranges | `_after` / `_before`, ISO-8601 with offset | `?updated_after=2026-01-01T00:00:00Z` |
| Pagination | Signed keyset cursor, max 100/page | `?limit=50&cursor=eyJ…` |
| Sorting | `sort`, `-` for descending, max 3 terms | `?sort=-updated_at,name` |
| Sparse fields | `fields` allowlist | `?fields=id,name,price` |
| Relations | `expand`, depth 1 only | `?expand=brand,inventory` |
| Search | `q` is fuzzy; named filters are exact | `?q=usb-c` |
| Tenant | Neither — derived from the access token | *never in the URL* |

### Placement rules

| Rule | Requirement |
|---|---|
| **N1** | No path segment is type-polymorphic. One route, one response shape. Never dispatch on the *format* of a value. |
| **N2** | IDs are opaque and prefixed (`prod_01JQZX3K9…`, ULID-based). This makes Approach A's failure mode structurally impossible. |
| **N3** | Human-readable slugs are a lookup (`?slug=`), not an alternate id. Return the canonical `/products/{id}` in the payload. |
| **N4** | Unknown query parameters are a `400` **that names the offending key**. A silently ignored `?catgeory=` returns the entire catalogue — a typo that reads as a data leak. This does not conflict with additive evolution: the server accepting a *new* parameter never breaks an old client, because old clients do not send it. |
| **N5** | Filtering never 404s. No matches is `200` with `{ "data": [] }`. |
| **N6** | Collections always return an envelope, never a bare array. No `total` — an exact count over a filtered tenant-scoped table is a full scan on every page. |
| **N7** | Tenant lives in the credential, not the URL. `/tenants/{tenantId}/products` doubles every route and invites IDOR by address-bar editing. |
| **N8** | A cross-tenant resource is `404`, not `403`. A 403 confirms the id is real, turning `/products/{id}` into an existence oracle. Reserve 403 for a principal inside the owning tenant who lacks the scope. |

### Errors

| Rule | Requirement |
|---|---|
| **E1** | Every non-2xx is `application/problem+json` per RFC 9457 (which obsoletes 7807), carrying a stable `code` extension member that clients switch on. `title` may be reworded; `code` never changes. Field-level failures go in `errors[]`. |
| **E2** | Errors are never cacheable (`no-store`) and always carry a `request_id` correlating with server logs. |

```jsonc
{
  "type":    "https://errors.example.com/invalid-query",
  "title":   "Query parameters are not valid",
  "status":  400,
  "detail":  "One or more query parameters were rejected.",
  "instance": "/api/v1/products",
  "code":    "invalid_query",
  "request_id": "9f2c…",
  "errors": [
    { "field": "catgeory", "detail": "Unrecognized parameter 'catgeory'." }
  ]
}
```

### Writes

| Rule | Requirement |
|---|---|
| **W1** | Every unsafe method on a single resource requires `If-Match`. Missing header is `428`, stale validator is `412`. Optimistic concurrency by default, with no way to opt out by forgetting. |
| **W2** | Creating `POST`s require an `Idempotency-Key`, namespaced by tenant. Same key + different body is `409`; a `5xx` is never recorded against the key, or the client could never retry out of a transient failure. |

### Caching

| Rule | Requirement |
|---|---|
| **C1** | Every `GET` declares an explicit `Cache-Control`. Route Handlers are uncached by default, so silence forfeits both CDN caching and revalidation. Collections are `private`. |
| **C2** | Single resources carry an `ETag` and honour `If-None-Match`. Derive the tag from a version column, not from hashing the serialised body — otherwise a field-order change invalidates every client's cache for no semantic reason. |

### Evolution

| Rule | Requirement |
|---|---|
| **V1** | Major version in the path; additive changes never bump it. New optional query parameters, response fields and problem codes are minor. |
| **V2** | Deprecation is announced in headers, not release notes — `Deprecation` and `Sunset` (RFC 8594) on every response from the outgoing version, minimum twelve-month window. |

### Field casing

Wire format is `snake_case` throughout — query parameters, request bodies and response
bodies alike — with TypeScript staying `camelCase` internally and the mapping done once at
the serialisation boundary. The rule exists so that the boundary is in one place; either
casing would do, mixing them would not.

---

## §4 — Decision: the refactored design

**Adopt Approach B, and prefix the IDs (N2).**

```
src/app/api/v1/
├── products/
│   ├── route.ts                GET list · POST create
│   └── [productId]/
│       ├── route.ts            GET · PATCH · DELETE
│       └── variants/route.ts
└── categories/
    ├── route.ts                GET list
    └── [categorySlug]/route.ts GET
```

```http
GET /api/v1/products/prod_01JQZX3K9
    → 200 Product · 404 if unknown or foreign-tenant · ETag + 304 on revalidation

GET /api/v1/categories/electronics
    → 200 Category · 404 if unknown

GET /api/v1/products?category=electronics&brand=acme&status=active,draft
                    &price_gte=100&sort=-updated_at&limit=50&cursor=eyJpZCI6…
    → 200 { data: [], pagination: { next_cursor, has_more, limit } }
```

Note what is deliberately **absent**: there is no `/categories/{slug}/products`. A product
is not owned by a category — it can carry several, and a category is a facet rather than a
container. Nesting is reserved for true containment.

### Pagination, specified

"Cursor, never offset" names a preference and specifies nothing. The cursor is base64url of
a signed payload carrying the sort-key values of the last row, its id as tiebreaker, and a
fingerprint of the sort spec it was minted under. Each property earns its place:

- **Opaque** — an integrator who can read a cursor will construct one, and its internals
  become permanent API.
- **Signed** — an unsigned cursor is an injection vector into a `WHERE` clause.
- **Sort-bound** — changing `sort` mid-pagination must be a clean `400`, not pages that
  silently overlap.

Rows are fetched as `limit + 1` so `has_more` costs no `COUNT`.

### Reference implementation

Working, typechecked, tested code lives in [`docs/reference/api-standard/`](../reference/api-standard/):

| File | Contents |
|---|---|
| `problem.ts` | RFC 9457 problem catalogue, `notFound()` (N8), zod issue mapping |
| `collection.ts` | `collectionQuery()`, `csvEnum`, `sortParam`, envelope, `takePage` |
| `cursor.ts` | Signed sort-bound keyset cursors (WebCrypto, so Edge-compatible) |
| `preconditions.ts` | `ETag`, `If-None-Match`, `If-Match` (W1) |
| `idempotency.ts` | `withIdempotency()` + reference store (W2) |
| `conformance.ts` | The linter (§5) |
| `app/api/v1/products/**` | Drop-in route handlers wiring all of the above |
| `tests/` | 72 tests |

Note the schema builder uses `z.strictObject()` — the zod v4 spelling. `.strict()` is the
deprecated v3 form.

---

## §5 — Conformance

Eleven rules are statically detectable from a route tree's shape plus a handful of markers,
so they are enforced in CI rather than by reviewers remembering them. The linter is text-
and path-based rather than AST-based on purpose: it must run in a pre-commit hook in well
under a second, because a check that is slow gets turned off.

```bash
npx tsx docs/reference/api-standard/conformance.ts src/app/api
```

| Check | Rule | Detects | Severity |
|---|---|---|---|
| C1 | N1 | Dynamic segment that does not name what it identifies (`[identifier]`) | error |
| C2 | N1 | Handler branching on the *format* of a path parameter | error |
| C3 | N1 | Sibling dynamic segments at one level — the Approach A collision | error |
| C4 | N6 | Collection GET not returning the `{ data, pagination }` envelope | warn |
| C5 | E1 | Ad-hoc `{ error: "…" }` body instead of problem+json | error |
| C6 | N4 | `searchParams.get()` with no schema parse | error |
| C7 | C1 | GET with no explicit `Cache-Control` | warn |
| C8 | W1 | PUT/PATCH/DELETE on a resource with no `If-Match` check | error |
| C9 | W2 | POST with no `Idempotency-Key` handling | error |
| C10 | C2 | Single-resource GET returning no `ETag` | warn |
| C11 | N7 | Tenant identifier in the path | error |

Exit code is `1` when any error-severity finding is present.

### Current result against this repository

```
$ npx tsx docs/reference/api-standard/conformance.ts src/app/api
scanned 1 route handler(s) under src/app/api

src/app/api/upload/route.ts
  ERROR  C5 (standard E1)   Ad-hoc error body `{ error: "..." }`.
  ERROR  C6 (standard N4)   searchParams.get() with no schema parse.
  ERROR  C9 (standard W2)   POST without Idempotency-Key handling.

3 error(s), 0 warning(s)
exit 1
```

These are real findings against [`src/app/api/upload/route.ts`](../../src/app/api/upload/route.ts)
and are **not yet fixed** — remediating that route is out of scope for this ADR and should
be tracked separately. It is the argument for having the linter at all: the one route the
codebase has violates three rules, and none would have been caught by review.

### Verification

```bash
npx tsc --noEmit                                                  # clean
npx vitest run --config docs/reference/api-standard/vitest.config.mts   # 72/72
npx tsx docs/reference/api-standard/conformance.ts docs/reference/api-standard/app   # exit 0
```

---

## §6 — Revision notes

Revision 1 was reviewed and found to have these defects:

| | Change |
|---|---|
| **Fixed** | The zod idiom was a version behind — `.strict()` is the v3 form; this codebase is on zod 4.4.3 where `z.strictObject()` is documented. |
| **Fixed** | Repeated query keys were prose, not code. `Object.fromEntries` drops duplicates, so `?status=active&status=draft` was silently read as `draft` — a wrong answer returned with a 200. Now rejected explicitly. |
| **Reframed** | The combinatorics table led with the inflated ordered-permutation figure. The honest 2ⁿ−1 number now leads and makes the case on its own. |
| **Added** | Error taxonomy (E1–E2). Revision 1 mandated an error shape in its samples and never specified one. |
| **Added** | Concurrency (W1). An `ETag` was returned on read and never required back on write — a lost-update defect for concurrent syncs. |
| **Added** | Idempotency (W2). `POST /products` duplicated records on every retry. |
| **Added** | 404-over-403 for cross-tenant reads (N8). Revision 1 raised IDOR in N7 then left the enumeration oracle open. |
| **Added** | A cursor specification — signing, tiebreaker, and sort-change behaviour. |
| **Added** | Deprecation policy (V2), field casing, and the conformance linter. |

Two defects surfaced from writing the tests rather than the code:

- The idempotency scope namespaced only the request fingerprint and not the store key, so
  two tenants picking the same client-chosen key collided into a spurious `409` instead of
  two independent creates.
- `fieldIssues` collapsed zod's `unrecognized_keys` issue — which reports every unknown key
  in one issue attached to the parent — into a single `(root)` entry, so a `400` under rule
  N4 told the client something was wrong without naming `catgeory`.

Both are fixed and covered by tests.

---

## Consequences

- Every collection resource gains a uniform query grammar, so a client that can page
  `products` can page anything.
- Adding a filter is a schema change and nothing else — no route, no cache rule, no client
  change.
- Writes become concurrency-safe and retry-safe by default rather than by discipline.
- The cost is up-front strictness: `400` on unknown parameters and `428` on a missing
  `If-Match` will surface in integrators' first test runs. That is the intended trade —
  a loud failure at integration time instead of a silent one in production.
- The platform is unreleased, so every rule here is free to adopt now. After launch each
  one costs a deprecation window instead.
