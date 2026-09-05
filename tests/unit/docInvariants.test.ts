import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
// The shipped parser, not a copy of it. A test that reimplements the regex it is checking
// stays green while the real one is broken.
import { citedNumbers } from "../../scripts/check-doc-invariants.mjs";

/**
 * Tests for `scripts/check-doc-invariants.mjs`.
 *
 * The guard's own failure mode is what is worth testing: a scanner that finds nothing reports
 * a clean repo. So these pin the floor and the extractor, not the current citation count —
 * that is a property of the repo and changes the moment someone edits a doc.
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
  const { stdout, code } = run();

  it("passes, because every live citation now names its rule in words", () => {
    expect(stdout).toContain("OK: every live invariant reference resolves");
    expect(code).toBe(0);
  });

  it("discovers its own corpus rather than being handed a file list", () => {
    // A guard with a hardcoded list cannot see the copy added after it was written, which is
    // the duplication it exists to catch.
    const scanned = Number(stdout.match(/scanned (\d+) tracked files/)?.[1]);
    expect(scanned).toBeGreaterThan(100);
  });

  it("still finds the citations left in the archived records", () => {
    // If this reaches zero the guard reports a clean repo forever, whatever the regex does.
    const refs = Number(stdout.match(/invariant references: (\d+)/)?.[1]);
    expect(refs).toBeGreaterThanOrEqual(5);
  });

  it("treats archived records as reportable but never fatal", () => {
    // tasks/decisions/ cite the invariants of their day and are correct to.
    expect(stdout).toMatch(/\(\d+ in archived records\)/);
    expect(code).toBe(0);
  });

  it("reads a multi-number citation as more than one reference", () => {
    const nums = (raw: string) => citedNumbers(raw).map(c => c.number);
    expect(nums("invariants 1 and 7")).toEqual([1, 7]);
    expect(nums("invariant 4")).toEqual([4]);
    expect(nums("invariants 2, 3 and 6")).toEqual([2, 3, 6]);
    expect(nums("Invariant 9")).toEqual([9]);
    expect(nums("the invariant that matters")).toEqual([]);
    expect(nums("")).toEqual([]);
  });

  it("keeps its self-exclusion to exactly the two files that must spell the pattern out", () => {
    // The guard and this file necessarily contain example citations. Excluding them is
    // correct; letting that list grow would be a way to silence a real finding, so the size
    // is pinned rather than the mechanism trusted.
    const src = readFileSync(SCRIPT, "utf8");
    const self = src.match(/const SELF = \[([^\]]*)\]/)?.[1] ?? "";
    const paths = self.split(",").map(s => s.trim()).filter(Boolean);
    expect(paths).toHaveLength(2);
    expect(self).toContain("check-doc-invariants.mjs");
    expect(self).toContain("docInvariants.test.ts");
  });
});
