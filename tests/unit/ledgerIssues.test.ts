import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import { resolve } from "path";
import { fileURLToPath } from "url";
// The shipped planner, not a copy of it.
import {
  isMirroredPath,
  markerFor,
  pathFromMarker,
  parseEntry,
  renderIssue,
  planSync,
} from "../../scripts/ledger-issues.mjs";

/**
 * Tests for `scripts/ledger-issues.mjs`, the one-way mirror from `tasks/open/` to GitHub issues.
 *
 * Only the pure half is tested here. The `gh` calls are a thin shell around `planSync`, and
 * exercising them would publish to a public repository, which is a one-way door.
 */

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const SCRIPT = resolve(ROOT, "scripts", "ledger-issues.mjs");
const TARGET = { repo: "owner/repo", branch: "master" };

const entryText = [
  "# The pet reader cannot tell an empty table from an unreachable one",
  "",
  "**Status:** ASSERTED · opened 2026-09-03",
  "",
  "Body paragraph with `code`.",
  "",
  "# A second top-level heading stays in the body",
  "",
  "**Settles when:** someone decides.",
  "",
].join("\n");

const rendered = (path: string, text = entryText) => renderIssue(parseEntry(path, text), TARGET);

describe("which files are mirrored", () => {
  it("mirrors a top-level entry in tasks/open", () => {
    expect(isMirroredPath("tasks/open/drift-test-not-run.md")).toBe(true);
  });

  it("skips session claims, which are locks rather than threads", () => {
    expect(isMirroredPath("tasks/open/CLAIM-home-bulletins.md")).toBe(false);
  });

  it("skips anything outside tasks/open, nested, or not markdown", () => {
    expect(isMirroredPath("tasks/decisions/2026-09-08-x.md")).toBe(false);
    expect(isMirroredPath("tasks/open/archive/old.md")).toBe(false);
    expect(isMirroredPath("tasks/open/notes.txt")).toBe(false);
  });
});

describe("parsing an entry", () => {
  it("takes the title from the first H1 and drops only that line from the body", () => {
    const entry = parseEntry("tasks/open/x.md", entryText);
    expect(entry.title).toBe("The pet reader cannot tell an empty table from an unreachable one");
    expect(entry.body.startsWith("**Status:** ASSERTED")).toBe(true);
    expect(entry.body).toContain("# A second top-level heading stays in the body");
  });

  it("normalises CRLF, because a Windows checkout stores entries that way", () => {
    const entry = parseEntry("tasks/open/x.md", entryText.replace(/\n/g, "\r\n"));
    expect(entry.title).not.toContain("\r");
    expect(entry.body).not.toContain("\r");
  });

  it("falls back to the slug when an entry has no H1", () => {
    expect(parseEntry("tasks/open/no-heading.md", "just a body\n").title).toBe("no-heading");
  });
});

describe("rendering an issue", () => {
  it("links the source file on the mirrored branch and warns that edits are overwritten", () => {
    const { body } = rendered("tasks/open/x.md");
    expect(body).toContain("https://github.com/owner/repo/blob/master/tasks/open/x.md");
    expect(body.toLowerCase()).toContain("overwritten");
  });

  it("carries a marker that round-trips to the source path, even after GitHub adds CRLF", () => {
    const { body } = rendered("tasks/open/x.md");
    expect(pathFromMarker(body)).toBe("tasks/open/x.md");
    expect(pathFromMarker(body.replace(/\n/g, "\r\n"))).toBe("tasks/open/x.md");
    expect(body.startsWith(markerFor("tasks/open/x.md"))).toBe(true);
  });

  it("finds no marker in an issue a human wrote", () => {
    expect(pathFromMarker("Something is broken on the donate page")).toBeNull();
    expect(pathFromMarker(null)).toBeNull();
  });
});

describe("planning a sync", () => {
  const issue = (
    number: number,
    path: string,
    overrides: Partial<{ title: string; body: string; state: string }> = {},
  ) => ({ number, state: "OPEN", ...rendered(path), ...overrides });

  it("creates an issue for an entry that has none", () => {
    const actions = planSync([rendered("tasks/open/a.md")], []);
    expect(actions).toEqual([expect.objectContaining({ type: "create", path: "tasks/open/a.md" })]);
  });

  it("does nothing when the issue already matches, including a CRLF-only difference", () => {
    const current = issue(7, "tasks/open/a.md");
    const crlf = { ...current, body: current.body.replace(/\n/g, "\r\n") };
    expect(planSync([rendered("tasks/open/a.md")], [current])).toEqual([]);
    expect(planSync([rendered("tasks/open/a.md")], [crlf])).toEqual([]);
  });

  it("updates an issue whose body or title drifted from the file", () => {
    const bodyEdited = issue(7, "tasks/open/a.md", { body: `${markerFor("tasks/open/a.md")}\nedited on GitHub` });
    const titleEdited = issue(8, "tasks/open/b.md", { title: "Renamed on GitHub" });
    const actions = planSync([rendered("tasks/open/a.md"), rendered("tasks/open/b.md")], [bodyEdited, titleEdited]);
    expect(actions).toEqual([
      expect.objectContaining({ type: "update", number: 7, path: "tasks/open/a.md" }),
      expect.objectContaining({ type: "update", number: 8, path: "tasks/open/b.md" }),
    ]);
  });

  it("reopens a closed issue whose entry is still open, and updates it if it drifted", () => {
    const closedSame = issue(7, "tasks/open/a.md", { state: "CLOSED" });
    const closedDrifted = issue(8, "tasks/open/b.md", { state: "CLOSED", title: "old" });
    const actions = planSync([rendered("tasks/open/a.md"), rendered("tasks/open/b.md")], [closedSame, closedDrifted]);
    expect(actions.map((a: { type: string; number?: number }) => [a.type, a.number])).toEqual([
      ["reopen", 7],
      ["reopen", 8],
      ["update", 8],
    ]);
  });

  it("closes an open issue whose entry has left tasks/open, and leaves a closed one alone", () => {
    const actions = planSync([], [issue(7, "tasks/open/settled.md"), issue(8, "tasks/open/old.md", { state: "CLOSED" })]);
    expect(actions).toEqual([expect.objectContaining({ type: "close", number: 7, path: "tasks/open/settled.md" })]);
  });

  it("never touches an issue without a marker, even one sharing an entry's title", () => {
    const entry = rendered("tasks/open/a.md");
    const human = { number: 3, state: "OPEN", title: entry.title, body: "filed by hand" };
    expect(planSync([entry], [human])).toEqual([expect.objectContaining({ type: "create", path: "tasks/open/a.md" })]);
  });

  it("refuses to plan when two issues claim the same entry, rather than picking one", () => {
    expect(() => planSync([rendered("tasks/open/a.md")], [issue(7, "tasks/open/a.md"), issue(9, "tasks/open/a.md")])).toThrow(
      /#7.*#9|#9.*#7/,
    );
  });
});

describe("the CLI", () => {
  it("prints usage for --help without reaching git or GitHub", () => {
    const out = execFileSync("node", [SCRIPT, "--help"], { cwd: ROOT, encoding: "utf8" });
    expect(out).toContain("--apply");
  });
});
