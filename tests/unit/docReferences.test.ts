import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, relative, resolve } from "path";
import { fileURLToPath } from "url";

/**
 * Guard: every `docs/**.md` path cited from code must resolve to a real file.
 *
 * Source comments in this repo carry a lot of load — a layer rule, a deferred
 * follow-on, the spec a constant exists to satisfy — and each one is a repo-root
 * relative path a reader is expected to open. When a document moves, nothing
 * fails: the comment keeps naming a path that no longer exists, and the next
 * reader concludes the reference is stale rather than the path.
 *
 * That is not hypothetical here. `docs/tasks/URGENT_NONPRODUCTION_ADMIN_BYPASS.md`
 * §7.2 reported two comments as dangling after an archive reorganisation. Both
 * were in fact correct; the two that were genuinely broken were somewhere else
 * entirely, and had been read past for long enough to be re-derived wrongly. A
 * one-line assertion is cheaper than that.
 *
 * Scope is deliberately code only (`src`, `tests`, `prisma`), where the
 * convention is unambiguous: a `docs/...` path is relative to the repository
 * root. Markdown-to-markdown links are *not* checked, because docs mix
 * root-relative and file-relative styles and settling that is a separate
 * decision — see the note at the bottom of this file.
 */

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const SEARCH_ROOTS = ["src", "tests", "prisma"];
const SOURCE_FILE = /\.(tsx?|mts|prisma)$/;

/**
 * Matches a repo-root-relative docs path. Deliberately not anchored to comment
 * syntax: a docs path is equally load-bearing in a string, a test fixture, or
 * JSDoc, and the check is the same in all three.
 *
 * The trailing `.md` is required so a bare directory mention ("under docs/tasks")
 * is not treated as a link. A `#section` suffix is stripped by the split below
 * rather than matched, so `LAYERS.md#L9` resolves to the file.
 */
const DOCS_REFERENCE = /docs\/[A-Za-z0-9_./-]+\.md/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SOURCE_FILE.test(full)) out.push(full);
  }
  return out;
}

type Citation = { file: string; line: number; ref: string };

function collectCitations(): Citation[] {
  const found: Citation[] = [];
  for (const root of SEARCH_ROOTS) {
    const dir = join(ROOT, root);
    if (!existsSync(dir)) continue;
    for (const abs of walk(dir)) {
      const lines = readFileSync(abs, "utf-8").split(/\r?\n/);
      lines.forEach((line, index) => {
        for (const match of line.match(DOCS_REFERENCE) ?? []) {
          found.push({
            file: relative(ROOT, abs).replace(/\\/g, "/"),
            line: index + 1,
            ref: match,
          });
        }
      });
    }
  }
  return found;
}

describe("Documentation references cited from code", () => {
  const citations = collectCitations();

  it("finds the citations it is meant to be guarding", () => {
    // Without this, a regex that silently stops matching turns the assertion
    // below into a vacuous pass — the failure mode that makes a guard worse than
    // no guard, because it reports safety it is not providing.
    expect(citations.length).toBeGreaterThan(20);
    expect(citations.some((c) => c.file.startsWith("src/"))).toBe(true);
    expect(citations.some((c) => c.file.startsWith("tests/"))).toBe(true);
  });

  it("resolves every one of them to a file that exists", () => {
    const broken = citations
      .filter(({ ref }) => !existsSync(join(ROOT, ref.split("#")[0])))
      .map(({ file, line, ref }) => `${file}:${line} -> ${ref}`);

    // Listed in full rather than counted: the whole value of this guard is that
    // the failure tells you which comment to edit, without a second search.
    expect(broken).toEqual([]);
  });
});

/**
 * Not guarded here, and known: relative links *between* markdown files under
 * `docs/` are inconsistent. Some are repo-root-relative (`docs/architecture/LAYERS.md`
 * written from inside `docs/`, which no relative resolver reaches), some are
 * genuinely file-relative, and a few archived documents still carry
 * `file:///c:/...` absolute paths from before the reorganisation. Asserting on
 * those means first deciding which style the repo uses, which is a documentation
 * decision rather than a code one.
 */
