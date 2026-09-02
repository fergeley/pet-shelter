/**
 * RFC 9457 — Problem Details for HTTP APIs.
 *
 * Every non-2xx response in the platform is a `application/problem+json` document.
 * A single machine-readable error shape is worth more to a B2B integrator than any
 * amount of prose: it is the difference between `catch (e) { retry() }` and a client
 * that can branch on `code`, surface `errors[].field` in a form, and honour `retry_after`.
 *
 * RFC 9457 obsoletes RFC 7807; the wire format is unchanged, so existing tooling works.
 *
 * Rules:
 *  - `type` is a stable, dereferenceable URI. It never changes for a given `code`.
 *  - `code` is the extension member clients should actually switch on. Stable forever.
 *  - `title` is human-readable and MAY be reworded; clients must not match on it.
 *  - `detail` describes *this occurrence* and may include identifiers.
 *  - New extension members may be added at any time; clients must ignore unknown ones.
 */

/** Base URI for dereferenceable problem type documents. */
const PROBLEM_BASE = "https://errors.example.com/";

/**
 * The closed set of problem codes. Adding one is a minor version change; removing or
 * repurposing one is a breaking change and requires a new major API version.
 */
export const PROBLEM_CATALOGUE = {
  invalid_query: {
    status: 400,
    title: "Query parameters are not valid",
  },
  invalid_body: {
    status: 400,
    title: "Request body is not valid",
  },
  cursor_invalid: {
    status: 400,
    title: "Pagination cursor is not valid",
  },
  cursor_sort_mismatch: {
    status: 400,
    title: "Pagination cursor does not match the requested sort order",
  },
  unauthenticated: {
    status: 401,
    title: "Authentication credentials are missing or invalid",
  },
  forbidden: {
    status: 403,
    title: "The authenticated principal may not perform this action",
  },
  not_found: {
    status: 404,
    title: "Resource not found",
  },
  method_not_allowed: {
    status: 405,
    title: "Method not allowed for this resource",
  },
  conflict: {
    status: 409,
    title: "The request conflicts with the current state of the resource",
  },
  idempotency_key_reuse: {
    status: 409,
    title: "Idempotency key was reused with a different request body",
  },
  precondition_failed: {
    status: 412,
    title: "The If-Match precondition failed",
  },
  unprocessable: {
    status: 422,
    title: "The request was well-formed but semantically invalid",
  },
  precondition_required: {
    status: 428,
    title: "This request requires an If-Match header",
  },
  rate_limited: {
    status: 429,
    title: "Rate limit exceeded",
  },
  internal: {
    status: 500,
    title: "Internal server error",
  },
} as const satisfies Record<string, { status: number; title: string }>;

export type ProblemCode = keyof typeof PROBLEM_CATALOGUE;

/** A single field-level failure. `field` is a dotted path into the request. */
export interface FieldIssue {
  field: string;
  detail: string;
}

export interface ProblemDocument {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  /** Extension: the stable code clients switch on. */
  code: ProblemCode;
  /** Extension: correlates this response with server logs. Always present. */
  request_id: string;
  /** Extension: present on 400/422 to drive form-level error display. */
  errors?: FieldIssue[];
  /** Extension: present on 429 and 503, in seconds. */
  retry_after?: number;
}

export interface ProblemOptions {
  detail?: string;
  /** Request path, for the `instance` member. */
  instance?: string;
  errors?: FieldIssue[];
  retryAfter?: number;
  requestId?: string;
  /** Extra response headers, e.g. `Allow` on a 405 or `WWW-Authenticate` on a 401. */
  headers?: Record<string, string>;
}

/** Slug form of a code, for the type URI: `cursor_invalid` -> `cursor-invalid`. */
function typeUri(code: ProblemCode): string {
  return PROBLEM_BASE + code.replace(/_/g, "-");
}

/**
 * Builds an RFC 9457 response.
 *
 * `Cache-Control: no-store` is set unconditionally — an error is never a cacheable
 * representation of the resource, and a cached 404 is one of the more painful things
 * to debug in a CDN-fronted API.
 */
export function problem(code: ProblemCode, options: ProblemOptions = {}): Response {
  const entry = PROBLEM_CATALOGUE[code];
  const requestId = options.requestId ?? crypto.randomUUID();

  const body: ProblemDocument = {
    type: typeUri(code),
    title: entry.title,
    status: entry.status,
    code,
    request_id: requestId,
  };

  if (options.detail) body.detail = options.detail;
  if (options.instance) body.instance = options.instance;
  if (options.errors?.length) body.errors = options.errors;
  if (options.retryAfter !== undefined) body.retry_after = options.retryAfter;

  const headers: Record<string, string> = {
    "Content-Type": "application/problem+json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Request-Id": requestId,
    ...options.headers,
  };

  if (options.retryAfter !== undefined) {
    headers["Retry-After"] = String(options.retryAfter);
  }

  return new Response(JSON.stringify(body), { status: entry.status, headers });
}

/**
 * 404 for a resource that exists but belongs to another tenant.
 *
 * Deliberately NOT 403. A 403 confirms the identifier is real, which turns any
 * `/products/{id}` endpoint into an existence oracle a competitor can walk to
 * enumerate another customer's catalogue size. The scoped query returns no row and
 * we report exactly what a genuinely-absent row would report. Standard rule N7/N8.
 *
 * Use 403 only when the principal is authenticated *into the owning tenant* and
 * merely lacks the scope — there, the existence of the record is not a secret.
 */
export function notFound(resource: string, id: string, instance?: string): Response {
  return problem("not_found", {
    detail: `No ${resource} with id '${id}' is visible to this principal.`,
    instance,
  });
}

/** Shape of a zod v4 issue, structurally typed so this module stays zod-version-agnostic. */
interface ZodLikeIssue {
  path: readonly PropertyKey[];
  message: string;
  code?: string;
  /** Present on `unrecognized_keys` issues. */
  keys?: readonly string[];
}

/**
 * Maps zod issues onto `errors[]`, converting each path array to a dotted field path.
 *
 * `unrecognized_keys` needs special handling: zod reports every unknown key as a *single*
 * issue attached to the parent object, so the naive mapping files them all under
 * `(root)`. That defeats the purpose of rule N4 — the client is told something is wrong
 * but not which parameter, which is barely better than ignoring it. Expanding the
 * `keys` array gives one entry per offending parameter, so a typo like `?catgeory=`
 * comes back naming `catgeory`.
 */
export function fieldIssues(issues: readonly ZodLikeIssue[]): FieldIssue[] {
  return issues.flatMap((issue) => {
    const prefix = issue.path.map(String);

    if (issue.code === "unrecognized_keys" && issue.keys?.length) {
      return issue.keys.map((key) => ({
        field: [...prefix, key].join("."),
        detail: `Unrecognized parameter '${key}'.`,
      }));
    }

    return [
      {
        field: prefix.length ? prefix.join(".") : "(root)",
        detail: issue.message,
      },
    ];
  });
}
