import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Authorization reads the verified session, never the raw cookie.
 *
 * `getCurrentSession()` checks a cookie's signature and expiry and returns whatever role it
 * claims. `getVerifiedSession()` (the DAL) re-reads the member's status and role, which is
 * the only thing that makes a suspension, a deletion or a demotion take effect before the
 * cookie's 24 hours are up. Every `getCurrentSession()` outside the security layer is a place
 * where a suspended member can still act — the transparency and FAQ actions were eleven such
 * places until 2026-09-18.
 *
 * `tests/unit/serverActionAuth.test.ts` cannot see this: it checks that an action calls an
 * authorization helper, not where that helper's session came from.
 */

const ROOT = join(__dirname, "..", "..", "..");
const SRC = join(ROOT, "src");

/** Callers that read the cookie without authorizing anything with it, each with its reason. */
const ALLOWED: Record<string, string> = {
  // logoutAction reads the cookie only to name the actor in the audit row before clearing it;
  // getCurrentUserAction reports the caller's own cookie back to the client and grants nothing.
  "src/actions/auth.ts": "logout and self-report only",
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("session source for authorization", () => {
  it("reads the raw cookie only inside the security layer and the allowed callers", () => {
    const callers = sourceFiles(SRC)
      .map((path) => relative(ROOT, path).replace(/\\/g, "/"))
      .filter((file) => !file.startsWith("src/lib/security/"))
      .filter((file) => /\bgetCurrentSession\s*\(/.test(readFileSync(join(ROOT, file), "utf8")));

    // auth.ts must still be found, or the scan has stopped matching and passes vacuously.
    expect(callers).toContain("src/actions/auth.ts");
    expect(callers.filter((file) => !(file in ALLOWED))).toEqual([]);
  });
});
