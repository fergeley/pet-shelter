/**
 * Idempotent unsafe requests via the `Idempotency-Key` header.
 *
 * The other gap in the first draft. `POST /products` over a flaky network is a coin
 * flip: the client times out, retries, and now the customer has two products. Retries
 * are not an edge case in B2B — every SDK, queue worker, and webhook consumer retries
 * by default, so an endpoint without idempotency will duplicate records in normal
 * operation, not just during incidents.
 *
 * The standard: every `POST` that creates a resource requires an `Idempotency-Key`.
 * `PUT`, `PATCH` and `DELETE` on a single resource are made safe by `If-Match` instead
 * (see preconditions.ts), so they do not need a key.
 */

import { problem } from "./problem";

const encoder = new TextEncoder();

export interface IdempotencyRecord {
  /** Hash of scope + method + path + body, to detect key reuse with different content. */
  fingerprint: string;
  status: number;
  headers: [string, string][];
  body: string;
}

export type IdempotencyLookup =
  | { state: "fresh" }
  | { state: "in_flight"; fingerprint: string }
  | { state: "completed"; record: IdempotencyRecord };

export interface IdempotencyStore {
  lookup(key: string): Promise<IdempotencyLookup>;
  /** Returns false if another request won the race to reserve this key. */
  reserve(key: string, fingerprint: string): Promise<boolean>;
  complete(key: string, record: IdempotencyRecord): Promise<void>;
  /** Called when the handler throws, so a failed attempt does not wedge the key. */
  release(key: string): Promise<void>;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(value) as unknown as ArrayBuffer
  );
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

export interface IdempotencyOptions {
  store: IdempotencyStore;
  /**
   * Namespace for the key. MUST include the tenant id — idempotency keys are chosen by
   * clients, so a global namespace lets one customer's key collide with another's and
   * replay a response across the tenant boundary.
   */
  scope: string;
  instance?: string;
}

/**
 * Wraps a mutating handler. The handler receives the raw request body as text because
 * a `Request` body can only be consumed once and we need it for the fingerprint.
 */
export async function withIdempotency(
  request: Request,
  options: IdempotencyOptions,
  handler: (rawBody: string) => Promise<Response>
): Promise<Response> {
  const key = request.headers.get("Idempotency-Key");

  if (!key) {
    return problem("invalid_body", {
      detail:
        "This endpoint requires an Idempotency-Key header — a client-generated unique " +
        "value (a UUID is fine) that lets a retry be recognised as the same request.",
      instance: options.instance,
      errors: [{ field: "Idempotency-Key", detail: "Header is required." }],
    });
  }

  if (key.length < 8 || key.length > 255) {
    return problem("invalid_body", {
      detail: "Idempotency-Key must be between 8 and 255 characters.",
      instance: options.instance,
      errors: [{ field: "Idempotency-Key", detail: "Invalid length." }],
    });
  }

  const rawBody = await request.text();
  const fingerprint = await sha256Hex(
    [options.scope, request.method, new URL(request.url).pathname, rawBody].join("\n")
  );

  // The scope namespaces the *storage key*, not merely the fingerprint. Keys are chosen
  // by clients, so two tenants will eventually pick the same one; namespacing only the
  // fingerprint would turn that collision into a spurious 409 for whichever tenant
  // arrived second, rather than two independent requests.
  const storageKey = `${options.scope}:${key}`;

  const existing = await options.store.lookup(storageKey);

  if (existing.state === "completed") {
    if (existing.record.fingerprint !== fingerprint) {
      return problem("idempotency_key_reuse", {
        detail:
          "This Idempotency-Key was already used for a request with a different body. " +
          "Generate a new key for a new request.",
        instance: options.instance,
      });
    }
    return replay(existing.record);
  }

  if (existing.state === "in_flight") {
    return problem("conflict", {
      detail:
        "A request with this Idempotency-Key is still being processed. Retry shortly.",
      instance: options.instance,
      retryAfter: 1,
    });
  }

  if (!(await options.store.reserve(storageKey, fingerprint))) {
    return problem("conflict", {
      detail:
        "A request with this Idempotency-Key is still being processed. Retry shortly.",
      instance: options.instance,
      retryAfter: 1,
    });
  }

  let response: Response;
  try {
    response = await handler(rawBody);
  } catch (error) {
    await options.store.release(storageKey);
    throw error;
  }

  // Only durable outcomes are recorded. Replaying a 500 would pin a transient failure
  // to the key forever, and the client could never retry its way out of it.
  if (response.status >= 500) {
    await options.store.release(storageKey);
    return response;
  }

  const captured = response.clone();
  await options.store.complete(storageKey, {
    fingerprint,
    status: captured.status,
    headers: [...captured.headers.entries()],
    body: await captured.text(),
  });

  return response;
}

function replay(record: IdempotencyRecord): Response {
  const headers = new Headers(record.headers);
  headers.set("Idempotency-Replayed", "true");
  return new Response(record.body, { status: record.status, headers });
}

/**
 * Reference store for tests and local development only.
 *
 * Production needs shared, TTL'd storage (Redis or a Postgres table with an expiry
 * index) — an in-memory map is per-instance, so behind more than one server the same
 * retry can land on a process that has never seen the key and the duplicate is created
 * anyway. Records should expire after 24h.
 */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly reserved = new Map<string, string>();
  private readonly completed = new Map<string, IdempotencyRecord>();

  async lookup(key: string): Promise<IdempotencyLookup> {
    const record = this.completed.get(key);
    if (record) return { state: "completed", record };

    const fingerprint = this.reserved.get(key);
    if (fingerprint) return { state: "in_flight", fingerprint };

    return { state: "fresh" };
  }

  async reserve(key: string, fingerprint: string): Promise<boolean> {
    if (this.reserved.has(key) || this.completed.has(key)) return false;
    this.reserved.set(key, fingerprint);
    return true;
  }

  async complete(key: string, record: IdempotencyRecord): Promise<void> {
    this.reserved.delete(key);
    this.completed.set(key, record);
  }

  async release(key: string): Promise<void> {
    this.reserved.delete(key);
  }
}
