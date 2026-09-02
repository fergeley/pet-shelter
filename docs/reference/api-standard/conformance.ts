/**
 * Conformance linter for the API routing standard.
 *
 * A standard nobody can check is a wish. This walks a Next.js route tree and reports
 * violations of the rules the document asserts, so the convention is enforced in CI
 * rather than in code review from memory.
 *
 *   npx tsx docs/reference/api-standard/conformance.ts src/app/api
 *
 * Deliberately text- and path-based rather than AST-based: it must run in a pre-commit
 * hook in well under a second, and every rule below is detectable from the route's shape
 * plus a handful of markers. It trades a little precision for being cheap enough that
 * nobody turns it off. Exit code is 1 when any `error`-severity finding is present.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

type Severity = "error" | "warn";

interface Finding {
  rule: string;
  standardRule: string;
  severity: Severity;
  file: string;
  detail: string;
}

/** Dynamic segment names that do not say what they identify. */
const AMBIGUOUS_SEGMENTS = new Set([
  "identifier",
  "param",
  "value",
  "key",
  "thing",
  "item",
  "ref",
]);

/** Markers that show the file dispatches on the *format* of a path parameter. */
const FORMAT_SNIFFING = [
  /\/\^\\d\+\$\/\s*\.test\s*\(/,
  /\bisNaN\s*\(\s*Number\s*\(/,
  /\bNumber\.isInteger\s*\(\s*Number\s*\(/,
  /\.test\s*\(\s*(?:params|ctx\.params)?\.?\w*(?:identifier|slugOrId|idOrSlug)\w*\s*\)/i,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry === "route.ts" || entry === "route.js") out.push(full);
  }
  return out;
}

function exportsMethod(source: string, method: string): boolean {
  return new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b`).test(source);
}

/** Checks every directory level for more than one dynamic child. */
function checkSiblingDynamicSegments(root: string, findings: Finding[]): void {
  const visit = (dir: string): void => {
    const entries = readdirSync(dir).filter((entry) =>
      statSync(join(dir, entry)).isDirectory()
    );

    const dynamic = entries.filter((entry) => entry.startsWith("[") && entry.endsWith("]"));
    if (dynamic.length > 1) {
      findings.push({
        rule: "C3",
        standardRule: "N1",
        severity: "error",
        file: relative(process.cwd(), dir),
        detail:
          `Sibling dynamic segments ${dynamic.join(", ")} at one level. Next.js cannot ` +
          `build this ("You cannot use different slug names for the same dynamic path"), ` +
          `and it is the exact Approach A collision the standard forbids.`,
      });
    }

    for (const entry of entries) visit(join(dir, entry));
  };

  visit(root);
}

function checkRouteFile(file: string, findings: Finding[]): void {
  const source = readFileSync(file, "utf8");
  const rel = relative(process.cwd(), file);
  const segments = rel.split(sep);
  const isDynamicResource = segments.some((s) => s.startsWith("[") && s.endsWith("]"));

  const add = (
    rule: string,
    standardRule: string,
    severity: Severity,
    detail: string
  ): void => {
    findings.push({ rule, standardRule, severity, file: rel, detail });
  };

  // C1 — a dynamic segment whose name does not say what it identifies.
  for (const segment of segments) {
    if (!segment.startsWith("[") || !segment.endsWith("]")) continue;
    const name = segment.slice(1, -1).replace(/^\.{3}/, "").replace(/[[\]]/g, "");
    if (AMBIGUOUS_SEGMENTS.has(name.toLowerCase())) {
      add(
        "C1",
        "N1",
        "error",
        `Dynamic segment [${name}] does not name what it identifies. A type-ambiguous ` +
          `segment forces runtime format-sniffing. Use [productId], [categorySlug], etc.`
      );
    }
  }

  // C2 — dispatching on the format of a path parameter.
  if (FORMAT_SNIFFING.some((pattern) => pattern.test(source))) {
    add(
      "C2",
      "N1",
      "error",
      `Handler appears to branch on the format of a path parameter. One route must have ` +
        `one response shape; a numeric-vs-slug heuristic breaks the first time a slug is ` +
        `all digits.`
    );
  }

  // C5 — ad-hoc error bodies instead of RFC 9457 problem+json.
  if (/\.json\s*\(\s*\{\s*error\s*:\s*["'`]/.test(source)) {
    add(
      "C5",
      "E1",
      "error",
      `Ad-hoc error body \`{ error: "..." }\`. Errors must be application/problem+json ` +
        `with a stable \`code\` (see problem.ts) so clients can branch on the failure.`
    );
  }

  // C6 — reading query parameters without schema validation.
  const readsRawQuery = /searchParams\.get\s*\(/.test(source);
  const validates = /safeParse\s*\(|parseCollectionQuery\s*\(/.test(source);
  if (readsRawQuery && !validates) {
    add(
      "C6",
      "N4",
      "error",
      `Query parameters read via searchParams.get() with no schema parse. Unknown or ` +
        `misspelled parameters are then silently ignored — \`?catgeory=\` returns the ` +
        `whole collection with a 200.`
    );
  }

  if (exportsMethod(source, "GET")) {
    // C7 — no explicit cache policy on a read.
    const setsCache =
      /Cache-Control/.test(source) ||
      /collectionResponse\s*\(/.test(source) ||
      /notModifiedResponse\s*\(/.test(source);
    if (!setsCache) {
      add(
        "C7",
        "C1",
        "warn",
        `GET sets no explicit Cache-Control. Route Handlers are uncached by default, so ` +
          `this silently forfeits both CDN caching and revalidation.`
      );
    }

    // C4 — collection responses must use the envelope.
    if (!isDynamicResource) {
      const enveloped =
        /collectionResponse\s*\(/.test(source) || /pagination\s*:/.test(source);
      if (!enveloped) {
        add(
          "C4",
          "N6",
          "warn",
          `Collection GET does not appear to return the { data, pagination } envelope. ` +
            `A bare array can never grow metadata without a major version bump.`
        );
      }
    }

    // C10 — single-resource reads should be revalidatable.
    if (isDynamicResource && !/ETag|etagFor\s*\(/.test(source)) {
      add(
        "C10",
        "C2",
        "warn",
        `Single-resource GET returns no ETag, so every repeat read transfers a full body ` +
          `and no write can be made concurrency-safe.`
      );
    }
  }

  // C8 — unsafe methods on a single resource need optimistic concurrency.
  const unsafeOnResource = ["PUT", "PATCH", "DELETE"].filter((m) =>
    exportsMethod(source, m)
  );
  if (isDynamicResource && unsafeOnResource.length > 0) {
    if (!/If-Match|enforceIfMatch\s*\(/.test(source)) {
      add(
        "C8",
        "W1",
        "error",
        `${unsafeOnResource.join("/")} on a single resource without an If-Match check. ` +
          `Concurrent writers silently overwrite each other — a lost update with no error.`
      );
    }
  }

  // C9 — creates must be replay-safe.
  if (exportsMethod(source, "POST")) {
    if (!/Idempotency-Key|withIdempotency\s*\(/.test(source)) {
      add(
        "C9",
        "W2",
        "error",
        `POST without Idempotency-Key handling. Every B2B client retries on timeout, so ` +
          `duplicate records are normal operation, not an edge case.`
      );
    }
  }

  // C11 — tenancy must come from the credential, never the URL.
  if (/\[tenantId\]|\[tenant\]|\[orgId\]|\[accountId\]/.test(rel)) {
    add(
      "C11",
      "N7",
      "error",
      `Tenant identifier in the path. Tenancy belongs to the access token; a tenant in ` +
        `the URL doubles every route and invites IDOR by address-bar editing.`
    );
  }
}

function main(): void {
  const targets = process.argv.slice(2);
  if (targets.length === 0) {
    console.error("usage: tsx conformance.ts <route-dir> [<route-dir> ...]");
    process.exit(2);
  }

  const findings: Finding[] = [];

  for (const target of targets) {
    let files: string[];
    try {
      files = walk(target);
    } catch {
      console.error(`  ! cannot read ${target}`);
      process.exit(2);
    }

    checkSiblingDynamicSegments(target, findings);
    for (const file of files) checkRouteFile(file, findings);

    console.log(`scanned ${files.length} route handler(s) under ${target}`);
  }

  if (findings.length === 0) {
    console.log("\n  PASS — no conformance findings.\n");
    return;
  }

  const byFile = new Map<string, Finding[]>();
  for (const finding of findings) {
    const list = byFile.get(finding.file) ?? [];
    list.push(finding);
    byFile.set(finding.file, list);
  }

  console.log("");
  for (const [file, list] of byFile) {
    console.log(file);
    for (const finding of list) {
      const tag = finding.severity === "error" ? "ERROR" : " WARN";
      console.log(`  ${tag}  ${finding.rule} (standard ${finding.standardRule})`);
      console.log(`         ${finding.detail}`);
    }
    console.log("");
  }

  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.length - errors;
  console.log(`${errors} error(s), ${warnings} warning(s)\n`);

  if (errors > 0) process.exit(1);
}

main();
