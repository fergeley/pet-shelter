import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Guard: `tasks/lessons/` stays one file per lesson.
 *
 * It was a single `tasks/lessons.md` until 2026-09-09, written by every session
 * at the same append point. Concurrent branches conflicted on prose where
 * nothing disagreed — and because GitHub runs `pull_request` workflows against
 * the computed merge commit, which a conflicted PR does not have, such a
 * conflict cost the branch its entire CI run rather than a manual resolve.
 * See `tasks/decisions/2026-09-09-lessons-become-one-file-per-lesson.md`.
 *
 * The split only keeps paying while the shape holds, and the shape is a
 * convention no tool otherwise enforces: nothing stops a session recreating the
 * single file, or dropping in an undated filename that breaks the chronological
 * `ls`. These assertions are cheap; rediscovering the conflict is not.
 */

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const LESSONS = join(ROOT, "tasks", "lessons");

/** `YYYY-MM-DD-some-slug.md` — the date leads so `ls` is chronological. */
const FILENAME = /^(\d{4}-\d{2}-\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;

function lessonFiles(): string[] {
  return readdirSync(LESSONS)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .sort();
}

describe("tasks/lessons layout", () => {
  it("is a directory with a contract, not a single file", () => {
    expect(existsSync(LESSONS)).toBe(true);
    // The regression this guard exists for: someone re-creates the old file.
    expect(existsSync(join(ROOT, "tasks", "lessons.md"))).toBe(false);
    expect(existsSync(join(LESSONS, "README.md"))).toBe(true);
  });

  it("holds the lessons that were split out, and then some", () => {
    // 97 were migrated on 2026-09-09. The count may only grow.
    expect(lessonFiles().length).toBeGreaterThanOrEqual(97);
  });

  it("names every file `YYYY-MM-DD-<slug>.md`", () => {
    for (const file of lessonFiles()) {
      expect(file, `${file} does not match ${FILENAME}`).toMatch(FILENAME);
    }
  });

  it("gives every lesson an H1 and a `**Learned:**` date matching its filename", () => {
    for (const file of lessonFiles()) {
      const body = readFileSync(join(LESSONS, file), "utf8");

      const heading = /^# (.+)$/m.exec(body);
      expect(heading, `${file} has no H1`).not.toBeNull();
      expect(heading![1].trim().length, `${file} has an empty H1`).toBeGreaterThan(0);

      const learned = /^\*\*Learned:\*\* (\d{4}-\d{2}-\d{2})$/m.exec(body);
      expect(learned, `${file} has no **Learned:** date`).not.toBeNull();

      // A date in the filename that disagrees with the one inside makes the
      // chronological `ls` lie, which is the directory's only ordering.
      const fromName = FILENAME.exec(file)![1];
      expect(learned![1], `${file}: filename date and **Learned:** disagree`).toBe(fromName);
    }
  });

  it("keeps one lesson per file", () => {
    for (const file of lessonFiles()) {
      const body = readFileSync(join(LESSONS, file), "utf8");
      const h1s = body.match(/^# /gm) ?? [];
      expect(h1s.length, `${file} has ${h1s.length} H1s; append a new file instead`).toBe(1);
    }
  });
});
