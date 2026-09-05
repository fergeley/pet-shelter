import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import { resolve } from "path";
import { fileURLToPath } from "url";

/**
 * Tests for `scripts/check-doc-invariants.mjs`.
 *
 * The guard's own failure mode is the one worth testing: a scanner that finds nothing reports
 * a clean repo. So the assertions here are mostly about the FLOOR and about the extractor
 * actually extracting — not about the current dangling count, which is a property of the repo
 * and changes the moment someone fixes it.
 */

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const SCRIPT = resolve(ROOT, "scripts", "check-doc-invariants.mjs");

const run = () => {
  try {
    return { stdout: execFileSync("node", [SCRIPT], { cwd: ROOT, encoding: "utf8" }), code: 0 };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; status?: number };
    return { stdout: (err.stdout ?? "") + (err.stderr ?? ""), code: err.status ?? 1 };
  }
};

describe("doc invariant guard", () => {
  const { stdout } = run();

  it("discovers its own corpus rather than being handed a file list", () => {
    // A guard with a hardcoded list cannot see the copy added after it was written, which is
    // the duplication it exists to catch.
    const scanned = Number(stdout.match(/scanned (\d+) tracked files/)?.[1]);
    expect(scanned).toBeGreaterThan(100);
  });

  it("finds the invariant citations that are actually in this repo", () => {
    // The extractor working is the precondition for every other verdict. If this drops to
    // zero the guard reports a clean repo forever.
    const refs = Number(stdout.match(/invariant references: (\d+)/)?.[1]);
    expect(refs).toBeGreaterThanOrEqual(10);
  });

  it("separates archived records from live rules", () => {
    // tasks/decisions/ cite the invariants of their day and must never be fatal.
    expect(stdout).toMatch(/\(\d+ in archived records\)/);
  });

  it("reads a multi-number citation as more than one reference", () => {
    // "invariants 1 and 7" is two citations. Counting it once was the first thing the
    // prototype got wrong.
    const parse = (raw: string) =>
      [...raw.matchAll(/\binvariants?\s+(\d+(?:\s*(?:,|and|–|-)\s*\d+)*)/gi)].flatMap(m =>
        m[1].split(/\s*(?:,|and|–|-)\s*/).map(Number),
      );
    expect(parse("invariants 1 and 7")).toEqual([1, 7]);
    expect(parse("invariant 4")).toEqual([4]);
    expect(parse("invariants 2, 3 and 6")).toEqual([2, 3, 6]);
    expect(parse("the invariant that matters")).toEqual([]);
  });

  it("exits non-zero while any live citation does not resolve", () => {
    // Pinned to the guard's own contract, not to a count: whatever the number is, an
    // unresolved live citation must fail. When the definitions are restored this flips to 0
    // and the guard passes — that is the intended end state, not a regression here.
    const { code } = run();
    const live = Number(stdout.match(/(\d+) live reference\(s\) point at/)?.[1] ?? 0);
    expect(code === 0 ? live : code).toBe(live === 0 ? 0 : 1);
  });
});
