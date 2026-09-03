import { describe, expect, it } from "vitest";

import {
  BODY_WRAP,
  NON_IMPERATIVE,
  SUBJECT_HARD_LIMIT,
  SUBJECT_SOFT_LIMIT,
  TYPES,
  lintCommitMessage,
} from "../../scripts/commit-msg.mjs";

/**
 * The standard is docs/reference/COMMIT_MESSAGES.md; the linter is
 * scripts/commit-msg.mjs. Every rule below is asserted twice — once on a message
 * that must fail it and once on a message that must pass — because a guard that
 * has only ever been seen green is not known to discriminate. The `capitalize`
 * rule fires on 190 of this repo's 203 commits and `imperative` on none of them,
 * so the second half of each pair is doing the real work here.
 */

/** Rule-clean baseline. Every negative case below is this, minus one property. */
const CLEAN = [
  "fix(donations): Serve the export from the ledger",
  "",
  "The statutory export was assembled from the 250 most recent audit",
  "rows of any kind, so older receipts fell off the end of a filing",
  "that has to be complete or it is worthless.",
  "",
  "Ledger: tasks/decisions/2026-08-31-lhdn-export-reads-the-ledger.md",
  "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>",
].join("\n");

const rules = (message: string) =>
  lintCommitMessage(message).findings.map((finding) => finding.rule);

const errors = (message: string) =>
  lintCommitMessage(message)
    .findings.filter((finding) => finding.level === "error")
    .map((finding) => finding.rule);

describe("the clean baseline", () => {
  it("raises nothing at all — not even a warning", () => {
    expect(lintCommitMessage(CLEAN).findings).toEqual([]);
  });

  it("keeps its subject inside the soft limit, so the fixture cannot rot", () => {
    expect(CLEAN.split("\n")[0].length).toBeLessThanOrEqual(SUBJECT_SOFT_LIMIT);
  });

  it("survives a CRLF tree", () => {
    expect(lintCommitMessage(CLEAN.replace(/\n/g, "\r\n")).findings).toEqual([]);
  });
});

describe("rule 1 — separate subject from body with a blank line", () => {
  it("fires when line 2 carries prose", () => {
    const message = "fix(ui): Add the button\nIt was missing entirely.";
    expect(errors(message)).toContain("blank-line");
  });

  it("does not fire on a subject-only message", () => {
    expect(errors("fix(ui): Add the button")).not.toContain("blank-line");
  });
});

describe("rule 2 — limit the subject line", () => {
  const subject = (length: number) => {
    const prefix = "fix(ui): A";
    return prefix + "a".repeat(length - prefix.length);
  };

  it(`warns past ${SUBJECT_SOFT_LIMIT} without failing the commit`, () => {
    const found = lintCommitMessage(subject(SUBJECT_SOFT_LIMIT + 1)).findings.find(
      (finding) => finding.rule === "subject-length",
    );
    expect(found?.level).toBe("warning");
  });

  it(`errors past ${SUBJECT_HARD_LIMIT}, where GitHub truncates`, () => {
    const found = lintCommitMessage(subject(SUBJECT_HARD_LIMIT + 1)).findings.find(
      (finding) => finding.rule === "subject-length",
    );
    expect(found?.level).toBe("error");
  });

  it(`is silent at exactly ${SUBJECT_SOFT_LIMIT}`, () => {
    expect(rules(subject(SUBJECT_SOFT_LIMIT))).not.toContain("subject-length");
  });
});

describe("rule 3 — capitalize the subject", () => {
  it("fires on a lowercase summary, which is how this repo wrote 190 commits", () => {
    expect(errors("fix(donations): serve the export from the ledger")).toContain(
      "capitalize",
    );
  });

  it("does not ask the machine-readable type prefix to be capitalized", () => {
    expect(errors("fix(donations): Serve the export")).not.toContain("capitalize");
  });

  it("accepts a summary opening on an identifier or a digit", () => {
    expect(errors("refactor(lib): `petRepository` loses its barrel")).not.toContain(
      "capitalize",
    );
    expect(errors("chore(deps): 19.2.8 replaces the react pin")).not.toContain(
      "capitalize",
    );
  });
});

describe("rule 4 — do not end the subject with a period", () => {
  it("fires on a trailing period", () => {
    expect(errors("fix(ui): Add the button.")).toContain("no-period");
  });

  it("does not fire without one", () => {
    expect(errors("fix(ui): Add the button")).not.toContain("no-period");
  });

  it("leaves a deliberate ellipsis alone", () => {
    expect(errors("docs(tasks): Record what the audit could not reach...")).not.toContain(
      "no-period",
    );
  });
});

describe("rule 5 — use the imperative mood", () => {
  it.each([
    ["fix(ui): Added the missing button", "added"],
    ["fix(ui): Adds the missing button", "adds"],
    ["fix(ui): Adding the missing button", "adding"],
    ["refactor(lib): Removed the barrel file", "removed"],
    ["docs(tasks): Updates the handoff", "updates"],
  ])("fires on %s", (message) => {
    expect(errors(message)).toContain("imperative");
  });

  it.each([
    "fix(ui): Add the missing button",
    "refactor(lib): Remove the barrel file",
    "docs(tasks): Update the handoff",
  ])("does not fire on %s", (message) => {
    expect(errors(message)).not.toContain("imperative");
  });

  /**
   * The reason the blocklist is explicit rather than an `-ed$` / `-s$` regex.
   * Every verb here is imperative and every one of them would be a false
   * positive under the naive pattern — `seed` and `needs` are real openers in
   * this repo's vocabulary.
   */
  it.each(["Seed", "Embed", "Feed", "Proceed", "Exceed", "Needs"])(
    "does not mistake the imperative %s for past tense",
    (verb) => {
      expect(errors(`chore(db): ${verb} the fixture rows`)).not.toContain("imperative");
      expect(NON_IMPERATIVE.has(verb.toLowerCase())).toBe(false);
    },
  );
});

describe("rule 6 — wrap the body at 72 columns", () => {
  const withBody = (line: string) => `fix(ui): Add the button\n\n${line}`;

  it("fires on prose past the limit", () => {
    expect(errors(withBody("a ".repeat(BODY_WRAP)))).toContain("body-wrap");
  });

  it("is silent at exactly the limit", () => {
    expect(errors(withBody("a".repeat(BODY_WRAP)))).not.toContain("body-wrap");
  });

  it("exempts a line whose single token cannot be broken", () => {
    const url = `See https://example.invalid/${"x".repeat(BODY_WRAP)}`;
    expect(errors(withBody(url))).not.toContain("body-wrap");
  });

  it("exempts trailers, whose payload is a path or an identity", () => {
    const trailer = `Ledger: tasks/decisions/${"long-slug-".repeat(9)}.md`;
    expect(trailer.length).toBeGreaterThan(BODY_WRAP);
    expect(errors(withBody(trailer))).not.toContain("body-wrap");
  });

  it("exempts fenced code, which wrapping would corrupt", () => {
    const fenced = ["```bash", `npm run ${"x".repeat(BODY_WRAP)} -- --flag`, "```"].join(
      "\n",
    );
    expect(errors(withBody(fenced))).not.toContain("body-wrap");
  });

  it("exempts indented code blocks for the same reason", () => {
    expect(errors(withBody(`    ${"x ".repeat(BODY_WRAP)}`))).not.toContain("body-wrap");
  });
});

describe("rule 7 — say what and why", () => {
  it("warns, never errors, when there is no body at all", () => {
    const found = lintCommitMessage("fix(ui): Add the button").findings.find(
      (finding) => finding.rule === "no-body",
    );
    expect(found?.level).toBe("warning");
  });

  it("counts trailers as metadata rather than as a body", () => {
    const message =
      "fix(ui): Add the button\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>";
    expect(rules(message)).toContain("no-body");
  });
});

describe("the conventional grammar this repo layers on top", () => {
  it("rejects a subject with no type prefix", () => {
    expect(errors("Add the missing button")).toContain("conventional");
  });

  it("rejects a type outside the allowed set", () => {
    expect(errors("clean(matchengine): Remove the unused import")).toContain(
      "conventional-type",
    );
  });

  it.each(TYPES)("accepts the type %s", (type) => {
    expect(errors(`${type}(ui): Add the button`)).not.toContain("conventional-type");
  });

  it("rejects a camelCase or comma-joined scope, both of which are in history", () => {
    expect(errors("clean(matchEngine): Remove the import")).toContain(
      "conventional-scope",
    );
    expect(errors("fix(pets,donations): Add the carousel")).toContain(
      "conventional-scope",
    );
  });

  it("allows a scope to be omitted", () => {
    expect(errors("test: Add the missing coverage")).not.toContain("conventional");
  });

  it("allows the breaking-change marker", () => {
    expect(errors("feat(api)!: Drop the v0 route")).not.toContain("conventional");
  });
});

describe("the shell delimiter this repo actually committed five times", () => {
  /**
   * Verbatim from a95ba33. A PowerShell here-string (`@'…'@`) passed its own
   * delimiter to `git commit -m`, so `git log --oneline` renders the commit as
   * a bare "@" and the real subject is stranded on line 2. Five commits carry
   * this. It is the one defect in this repo's history that a commit-msg hook
   * would have caught outright.
   */
  const real = [
    "@",
    "docs(tasks): record the pending decision on committing the encrypted env",
    "",
    ".env.production.enc is the only uncommitted file left.",
  ].join("\n");

  it("names the delimiter rather than reporting a vague grammar failure", () => {
    expect(errors(real)).toContain("stray-delimiter");
  });

  it("also trips the blank-line rule, because the real subject is on line 2", () => {
    expect(errors(real)).toContain("blank-line");
  });

  it("does not fire on an @ that is part of a real subject", () => {
    expect(errors("docs(ci): Pin @actions/checkout to a digest")).not.toContain(
      "stray-delimiter",
    );
  });
});

describe("messages the linter must not judge", () => {
  it.each([
    "Merge branch 'master' into feat/tnrm-rehabilitation",
    "Revert \"feat(ui): Add the carousel\"",
    "fixup! fix(ui): Add the button",
    "squash! fix(ui): Add the button",
  ])("skips %s", (message) => {
    expect(lintCommitMessage(message).skipped).toBe(true);
    expect(lintCommitMessage(message).findings).toEqual([]);
  });

  it("strips the comment block git puts in the buffer", () => {
    // The first line is over the 72-column wrap on purpose. A short comment
    // block passes whether or not it is stripped, so it proves nothing — this
    // one fails the body-wrap rule if the stripping ever regresses.
    const noise =
      "# Please enter the commit message for your changes. Lines starting with '#' are ignored.";
    expect(noise.length).toBeGreaterThan(BODY_WRAP);
    const buffer = [CLEAN, "", noise, "# On branch feat/tnrm-rehabilitation"].join("\n");
    expect(lintCommitMessage(buffer).findings).toEqual([]);
  });

  it("stops at the scissors line of `git commit --verbose`", () => {
    const buffer = [
      CLEAN,
      "# ------------------------ >8 ------------------------",
      "diff --git a/src/x.ts b/src/x.ts",
      `+${"a".repeat(200)}`,
    ].join("\n");
    expect(lintCommitMessage(buffer).findings).toEqual([]);
  });

  it("reports an empty buffer rather than passing it", () => {
    expect(errors("   \n\n  ")).toContain("empty");
  });
});

/**
 * Defects a code review found after the standard had already merged. Each one had
 * passed 62 tests and 12 killed mutants, because both techniques check the code
 * against the rules its author thought of. None of these is a rule that was
 * implemented wrongly; each is an input shape nobody had imagined.
 */
describe("defects found by review", () => {
  const FENCE = "```";

  // `git commit -F` — the path AGENTS.md mandates — uses cleanup=whitespace, which
  // keeps comment lines. Only an editor session uses cleanup=strip. Dropping every
  // `#` line meant linting different bytes than git commits.
  describe("author comment lines are content, not cruft", () => {
    it("treats a comment line as a body, so rule 7 does not misfire", () => {
      expect(
        rules("fix(ui): Add the button\n\n# git commit -F keeps this line"),
      ).not.toContain("no-body");
    });

    it("wraps a comment line like any other body line", () => {
      const long = "# " + "word ".repeat(20);
      expect(errors("fix(ui): Add the button\n\n" + long)).toContain("body-wrap");
    });

    it("still drops git's own template block", () => {
      const withTemplate = [
        "fix(ui): Add the button",
        "",
        "A real body line that says why.",
        "",
        "# Please enter the commit message for your changes. Lines starting",
        "# with '#' will be ignored, and an empty message aborts the commit.",
        "#",
        "# On branch feat/example",
        "# Changes to be committed:",
        "#\tmodified:   a.txt",
      ].join("\n");
      expect(rules(withTemplate)).toEqual([]);
    });

    it("still drops everything below the scissors line", () => {
      const withDiff = [
        "fix(ui): Add the button",
        "",
        "A real body line that says why.",
        "",
        "# ------------------------ >8 ------------------------",
        "diff --git a/a.txt b/a.txt",
        "x".repeat(200),
      ].join("\n");
      expect(rules(withDiff)).toEqual([]);
    });
  });

  // Git strips trailing whitespace from every line, so the subject that lands is the
  // trimmed one. Linting the raw line let one space hide the period entirely.
  describe("rule 4 — a trailing space must not hide the period", () => {
    it("fires on a period followed by a space", () => {
      expect(errors("fix(ui): Add the button. ")).toContain("no-period");
    });

    it("fires on a period followed by a tab", () => {
      expect(errors("fix(ui): Add the button.\t")).toContain("no-period");
    });

    it("does not fire on a clean subject that carries a trailing space", () => {
      expect(errors("fix(ui): Add the button ")).not.toContain("no-period");
    });

    it("does not count trailing whitespace toward the hard limit", () => {
      const atLimit = "fix(ui): " + "a".repeat(SUBJECT_HARD_LIMIT - "fix(ui): ".length);
      expect(atLimit).toHaveLength(SUBJECT_HARD_LIMIT);
      expect(errors(atLimit + "    ")).not.toContain("subject-length");
    });
  });

  // An unclosed fence used to latch the exemption on for the rest of the body.
  describe("rule 6 — an unclosed fence must not disable the wrap check", () => {
    const unclosed = "fix(ui): Add the button\n\n" + FENCE + "\n" + "a ".repeat(60);

    it("reports the unclosed fence", () => {
      expect(errors(unclosed)).toContain("unclosed-fence");
    });

    it("still checks the wrap on the lines after it", () => {
      expect(errors(unclosed)).toContain("body-wrap");
    });

    it("leaves a balanced fence exempt", () => {
      const balanced =
        "fix(ui): Add the button\n\n" + FENCE + "\n" + "a ".repeat(60) + "\n" + FENCE;
      expect(errors(balanced)).toEqual([]);
    });
  });

  // The mood check read the first token, which is empty when the summary opens on
  // punctuation — so rule 5 was skipped entirely for those subjects.
  describe("rule 5 — leading punctuation must not hide the verb", () => {
    it("sees past a quote", () => {
      expect(errors('fix(ui): "Added" the button')).toContain("imperative");
    });

    it("sees past an em-dash", () => {
      expect(errors("fix(ui): — Added the button")).toContain("imperative");
    });

    it("leaves rule 3's deliberate identifier exemption alone", () => {
      expect(errors("refactor(lib): `petRepository` loses its barrel")).not.toContain(
        "capitalize",
      );
    });
  });
});
