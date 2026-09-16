import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * Every Postgres pool in this repository takes its TLS settings from `resolveDatabaseSsl`.
 *
 * The app stopped accepting unverified certificates on 2026-09-08
 * (`tasks/decisions/2026-09-08-database-tls-is-decided-by-host-not-url-spelling.md`), but
 * `prisma/seed.ts` and `scripts/migrate-faqs.ts` kept their own copy of the old sniff with
 * `rejectUnauthorized: false` — and `migrate-faqs.ts` exists to be pointed at a hosted branch.
 * They could not import the policy, because the module holding it built a pool on import.
 */

const ROOT = join(__dirname, "..", "..");
const CODE_DIRS = ["src", "prisma", "scripts"];

function codeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : codeFiles(path);
    return /\.(ts|tsx|mts|js|mjs|cjs)$/.test(name) ? [path] : [];
  });
}

const sources = CODE_DIRS.flatMap((dir) => codeFiles(join(ROOT, dir))).map((path) => ({
  file: relative(ROOT, path).replace(/\\/g, "/"),
  text: readFileSync(path, "utf8"),
}));

describe("database pool TLS", () => {
  it("builds every pg Pool from resolveDatabaseSsl", () => {
    const pools = sources.filter((s) => /new Pool\(/.test(s.text));

    // prisma.ts, seed.ts and migrate-faqs.ts. An empty scan would pass the next line vacuously.
    expect(pools.length).toBeGreaterThanOrEqual(3);
    expect(pools.filter((s) => !/resolveDatabaseSsl\(/.test(s.text)).map((s) => s.file)).toEqual([]);
  });

  it("accepts no unverified certificate anywhere", () => {
    expect(sources.filter((s) => /ssl:[^\n]*rejectUnauthorized:\s*false/.test(s.text)).map((s) => s.file)).toEqual([]);
  });

  it("keeps the policy in a module that imports nothing, so a script can load it without a pool", () => {
    // Asserted on the source rather than by spying on `pg`: the test harness has already
    // imported `prisma.ts` before any test runs, and that module caches its client on
    // globalThis, so "no pool was constructed" would pass whatever this module imported.
    const policy = sources.find((s) => s.file === "src/lib/server/databaseSsl.ts");

    expect(policy?.text).toMatch(/export function resolveDatabaseSsl\(/);
    expect(policy?.text).not.toMatch(/^\s*import\s|\brequire\(/m);
  });
});
