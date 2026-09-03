import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join, relative, resolve } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

/**
 * Structural guards for the agent and skill definitions under `.claude/`.
 *
 * Like `designSystemGuards.test.ts`, these assert properties of the *source
 * text*. Nothing else in this repo can: `tsc` never looks at markdown, ESLint
 * never looks at YAML frontmatter, and Claude Code parses these files silently
 * — a definition that fails to parse does not error, it simply stops existing,
 * and the only symptom is an agent that never gets picked.
 *
 * That is not hypothetical. `test-writer`'s description was tightened on
 * 2026-08-31 to read "...what is being asked for: covering an existing
 * behaviour...". A bare `: ` inside an unquoted YAML scalar is a parse error,
 * so the definition was broken from that edit until this file was written, and
 * nothing in the repo could see it. Guard 4 is that bug.
 *
 * Background: docs/tasks/TARGET_MIDWIFE_ADOPTION.md,
 * tasks/decisions/2026-08-31-agent-roster-ported-and-pruned.md.
 */

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const AGENTS_DIR = join(ROOT, ".claude", "agents");
const SKILLS_DIR = join(ROOT, ".claude", "skills");

/**
 * Tool names Claude Code will honour in a `tools:` list. A typo here is
 * invisible — an unrecognised name is dropped, silently widening or narrowing
 * what the agent can reach. `schema-auditor`'s whole safety property is the
 * absence of `Bash` from its list, so the list has to be spelled correctly.
 */
const KNOWN_TOOLS = new Set([
  "Agent", "Artifact", "Bash", "Edit", "Glob", "Grep", "Monitor", "NotebookEdit",
  "PowerShell", "Read", "SendMessage", "Skill", "TaskOutput", "TaskStop",
  "TodoWrite", "ToolSearch", "WebFetch", "WebSearch", "Write",
]);

type Definition = {
  path: string;
  expectedName: string;
  frontmatter: string;
  lines: string[];
};

function toRepoPath(abs: string): string {
  return relative(ROOT, abs).replace(/\\/g, "/");
}

function load(abs: string, expectedName: string): Definition {
  const source = readFileSync(abs, "utf8");
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) {
    throw new Error(`${toRepoPath(abs)} has no YAML frontmatter block`);
  }
  return {
    path: toRepoPath(abs),
    expectedName,
    frontmatter: match[1],
    lines: match[1].split(/\r?\n/),
  };
}

function collect(): Definition[] {
  const agents = readdirSync(AGENTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => load(join(AGENTS_DIR, f), f.replace(/\.md$/, "")));
  const skills = readdirSync(SKILLS_DIR).map((d) =>
    load(join(SKILLS_DIR, d, "SKILL.md"), d),
  );
  return [...agents, ...skills];
}

/** Top-level `key: value` pairs only — nested mapping lines are indented. */
function topLevelScalars(def: Definition): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const line of def.lines) {
    const m = line.match(/^([A-Za-z][\w-]*):[ \t]*(.*)$/);
    if (m && m[2] !== "") out.push([m[1], m[2]]);
  }
  return out;
}

function valueOf(def: Definition, key: string): string | undefined {
  return topLevelScalars(def).find(([k]) => k === key)?.[1];
}

describe("agent and skill definitions", () => {
  const definitions = collect();

  it("finds the definitions it is supposed to be checking", () => {
    const paths = definitions.map((d) => d.path).sort();
    expect(paths).toContain(".claude/agents/spike-runner.md");
    expect(paths).toContain(".claude/skills/midwife/SKILL.md");
    // Five agents and two skills as of 2026-08-31. A bare count would fail on
    // every legitimate addition, so this only guards against finding *none*.
    expect(definitions.length).toBeGreaterThanOrEqual(6);
  });

  it("names every definition after the file or directory that holds it", () => {
    const wrong = definitions
      .filter((d) => valueOf(d, "name") !== d.expectedName)
      .map((d) => `${d.path}: name is ${valueOf(d, "name")}, expected ${d.expectedName}`);
    expect(wrong).toEqual([]);
  });

  it("gives every definition a description, since that is what routing reads", () => {
    const missing = definitions
      .filter((d) => (valueOf(d, "description") ?? "").trim().length < 40)
      .map((d) => d.path);
    expect(missing).toEqual([]);
  });

  it("quotes any frontmatter value containing a colon-space", () => {
    // `key: value with: a colon` is a YAML parse error, and the file then
    // silently stops being a definition at all.
    const broken: string[] = [];
    for (const def of definitions) {
      for (const [key, raw] of topLevelScalars(def)) {
        const quoted = /^["'].*["']$/.test(raw);
        const flow = /^[[{]/.test(raw);
        if (!quoted && !flow && /:[ \t]/.test(raw)) {
          broken.push(`${def.path}: '${key}' has an unquoted ": " — ${raw.slice(0, 60)}…`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("declares only tool names Claude Code recognises", () => {
    const unknown: string[] = [];
    for (const def of definitions) {
      const tools = valueOf(def, "tools");
      if (!tools) continue;
      for (const name of tools.split(",").map((t) => t.trim()).filter(Boolean)) {
        if (!KNOWN_TOOLS.has(name) && !name.startsWith("mcp__")) {
          unknown.push(`${def.path}: unknown tool '${name}'`);
        }
      }
    }
    expect(unknown).toEqual([]);
  });

  it("points every hook at a script that exists", () => {
    // A hook whose command is missing fails open — the tool call proceeds and
    // the guard reports nothing, which looks exactly like a guard that passed.
    const dangling: string[] = [];
    for (const def of definitions) {
      for (const m of def.frontmatter.matchAll(/\$\{CLAUDE_PROJECT_DIR\}\/([^"'\s\]]+)/g)) {
        if (!existsSync(join(ROOT, m[1]))) {
          dangling.push(`${def.path}: hook script ${m[1]} does not exist`);
        }
      }
    }
    expect(dangling).toEqual([]);
  });

  it("keeps schema-auditor without a shell", () => {
    // The one agent whose contract is enforced rather than promised. Adding
    // Bash here restores a path from a read-only audit to a production write.
    // See tasks/decisions/2026-08-31-schema-auditor-has-no-shell.md.
    const auditor = definitions.find((d) => d.expectedName === "schema-auditor");
    expect(auditor).toBeDefined();
    const tools = (valueOf(auditor!, "tools") ?? "").split(",").map((t) => t.trim());
    expect(tools).not.toContain("Bash");
    expect(tools).not.toContain("PowerShell");
    expect(auditor!.frontmatter).toContain("agent-guard.mjs");
  });

  /**
   * `.gitignore` decides whether these definitions can be *added* at all, and
   * nothing else in the suite looks at it. On 2026-09-03 PR #25 widened
   * `.claude/settings.local.json` to `.claude/`, which left all 16 tracked
   * files here under a blanket ignore: every existing test stayed green,
   * because the tracked files were still checked out, while `git add` of any
   * *new* agent, skill, template or hook was silently refused. Git does not
   * descend into an excluded directory, so no `!` negation can undo it — the
   * pattern itself has to stay narrow.
   */
  describe("the directories holding these definitions stay committable", () => {
    /** `git check-ignore -q`: 0 = ignored, 1 = not ignored. */
    function isIgnored(repoPath: string): boolean {
      try {
        execFileSync("git", ["check-ignore", "--no-index", "-q", repoPath], {
          cwd: ROOT,
          stdio: "ignore",
        });
        return true;
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status !== 1) throw err;
        return false;
      }
    }

    it("lets a new definition be added under every .claude config directory", () => {
      const ignored = [
        ".claude/agents/__guard__.md",
        ".claude/skills/__guard__/SKILL.md",
        ".claude/templates/__guard__.md",
        ".claude/hooks/__guard__.mjs",
        ".claude/commands/__guard__.md",
      ].filter(isIgnored);
      expect(ignored).toEqual([]);
    });

    it("keeps ignoring the local settings and worktrees that must never be committed", () => {
      // The narrowing above must not overshoot: these two are why a `.claude`
      // rule exists at all.
      expect(isIgnored(".claude/settings.local.json")).toBe(true);
      expect(isIgnored(".claude/worktrees/session/src/app.ts")).toBe(true);
    });
  });
});
