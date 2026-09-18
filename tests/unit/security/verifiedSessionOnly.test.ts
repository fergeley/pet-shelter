import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Authorization reads the verified session, never the raw cookie.
 *
 * `getCurrentSession()` checks a cookie's signature and expiry and returns whatever role it
 * claims; `unsealSession()` does the same one level down. `getVerifiedSession()` (the DAL)
 * re-reads the member's status and role, which is the only thing that makes a suspension, a
 * deletion or a demotion take effect before the cookie's 24 hours are up. Every raw read outside
 * the security layer is a place where a suspended member can still act — the transparency and
 * FAQ actions were eleven such places until 2026-09-18.
 *
 * `tests/unit/serverActionAuth.test.ts` cannot see this: it checks that an action calls an
 * authorization helper, not where that helper's session came from.
 */

const ROOT = join(__dirname, "..", "..", "..");
const SRC = join(ROOT, "src");

/**
 * The raw readers, matched as names rather than calls, so an aliased import
 * (`getCurrentSession as readSession`) is still caught by the line that imports it.
 */
const RAW_READER = /\b(getCurrentSession|unsealSession)\b/;

/**
 * Files allowed a raw read, each pinned to its exact number of call sites. A new call in an
 * allowed file changes the count and fails here, so the allowance cannot quietly widen.
 */
const ALLOWED: Record<string, { reader: "getCurrentSession" | "unsealSession"; calls: number; reason: string }> = {
  "src/actions/auth.ts": {
    reader: "getCurrentSession",
    calls: 2,
    reason:
      "logoutAction names the actor in its audit row before clearing the cookie; " +
      "getCurrentUserAction reports the caller's own cookie back. Neither grants anything.",
  },
  "src/proxy.ts": {
    reader: "unsealSession",
    calls: 1,
    reason:
      "an early redirect for /admin/members; the page re-checks with getVerifiedSession and " +
      "every member action with requirePermission.",
  },
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const readers = sourceFiles(SRC)
  .map((path) => ({ file: relative(ROOT, path).replace(/\\/g, "/"), text: readFileSync(path, "utf8") }))
  .filter(({ file }) => !file.startsWith("src/lib/security/"))
  .filter(({ text }) => RAW_READER.test(text));

describe("session source for authorization", () => {
  it("reads the raw session only inside the security layer and the allowed files", () => {
    // The allowed files must still be found, or the scan has stopped matching and passes vacuously.
    expect(readers.map(({ file }) => file)).toEqual(expect.arrayContaining(Object.keys(ALLOWED)));
    expect(readers.map(({ file }) => file).filter((file) => !(file in ALLOWED))).toEqual([]);
  });

  it.each(Object.entries(ALLOWED))("%s makes exactly its allowed raw reads", (file, allowance) => {
    const text = readers.find((reader) => reader.file === file)?.text ?? "";
    const calls = text.match(new RegExp(`\\b${allowance.reader}\\s*\\(`, "g"))?.length ?? 0;

    expect(calls).toBe(allowance.calls);
  });
});
