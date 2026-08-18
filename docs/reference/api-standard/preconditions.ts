/**
 * Conditional requests: ETag, If-None-Match, If-Match.
 *
 * This was the most serious omission in the first draft of the standard. It returned an
 * ETag on GET and never required one back on write, which means two integrators PATCHing
 * the same product interleave into a lost update — the second write silently clobbers
 * the first and nobody gets an error. For a B2B platform where customers run concurrent
 * sync jobs against the same catalogue, that is a data-loss defect, not a nicety.
 *
 * The rule the standard adopts: **every unsafe method on a single resource requires
 * `If-Match`.** Missing header is 428, stale value is 412. Optimistic concurrency by
 * default; no way to opt out by forgetting.
 */

import { problem } from "./problem";

const encoder = new TextEncoder();

/**
 * Strong entity tag over the resource's canonical representation.
 *
 * Derive it from a version column or `updated_at` where one exists — hashing the
 * serialised body works but couples the tag to incidental serialisation details, so a
 * field-order change invalidates every client's cache for no semantic reason.
 */
export async function etagFor(input: string | object): Promise<string> {
  const source = typeof input === "string" ? input : JSON.stringify(input);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(source) as unknown as ArrayBuffer
  );

  let hex = "";
  const bytes = new Uint8Array(digest);
  for (let i = 0; i < 16; i++) hex += bytes[i].toString(16).padStart(2, "0");

  return `"${hex}"`;
}

/** Splits a comma-separated entity-tag list, preserving `W/` markers. */
function parseTagList(header: string): string[] {
  return header
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/** Strips the weakness marker for weak comparison (RFC 9110 §8.8.3.2). */
function weakForm(tag: string): string {
  return tag.startsWith("W/") ? tag.slice(2) : tag;
}

/**
 * `If-None-Match` uses *weak* comparison — the client only wants to know whether the
 * representation is semantically unchanged, so `W/"x"` and `"x"` match.
 */
export function isNotModified(request: Request, currentEtag: string): boolean {
  const header = request.headers.get("If-None-Match");
  if (!header) return false;
  if (header.trim() === "*") return true;

  return parseTagList(header).some((tag) => weakForm(tag) === weakForm(currentEtag));
}

export type PreconditionOutcome = "ok" | "missing" | "mismatch";

/**
 * `If-Match` uses *strong* comparison — we are about to mutate state, so a merely
 * semantically-equivalent representation is not good enough. A weak tag never matches.
 */
export function checkIfMatch(request: Request, currentEtag: string): PreconditionOutcome {
  const header = request.headers.get("If-Match");
  if (!header) return "missing";

  const trimmed = header.trim();
  if (trimmed === "*") return "ok";

  const tags = parseTagList(trimmed);
  const strongMatch = tags.some((tag) => !tag.startsWith("W/") && tag === currentEtag);

  return strongMatch ? "ok" : "mismatch";
}

/**
 * Enforces the precondition, returning a ready-to-send problem response when it fails
 * and `null` when the caller may proceed.
 */
export function enforceIfMatch(
  request: Request,
  currentEtag: string,
  instance?: string
): Response | null {
  switch (checkIfMatch(request, currentEtag)) {
    case "ok":
      return null;

    case "missing":
      return problem("precondition_required", {
        detail:
          "This endpoint requires an If-Match header carrying the ETag of the version " +
          "you intend to modify. GET the resource first and echo back its ETag.",
        instance,
        headers: { ETag: currentEtag },
      });

    case "mismatch":
      return problem("precondition_failed", {
        detail:
          "The resource has been modified since the version you fetched. Re-read it, " +
          "reapply your change, and retry with the new ETag.",
        instance,
        headers: { ETag: currentEtag },
      });
  }
}

/** 304 carries no body and must echo the validator. */
export function notModifiedResponse(etag: string, cacheControl: string): Response {
  return new Response(null, {
    status: 304,
    headers: { ETag: etag, "Cache-Control": cacheControl },
  });
}
