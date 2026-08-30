import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { fileURLToPath } from "url";

/**
 * `.claude/hooks/agent-guard.mjs` is the only enforcement any sub-agent has.
 * Three of them declare contracts in prose — `schema-auditor` "never connects
 * to a database", `atomic-commit` "emits commands, does not run them",
 * `test-writer` "never edits product code" — and this script is what turns
 * those into denials.
 *
 * It is invoked by Claude Code, not by this repo, so nothing else here
 * exercises it. A regression in the git allowlist or the path check would be
 * invisible until an agent quietly did the thing it promised not to.
 *
 * What this file does NOT establish: that Claude Code actually runs the hook.
 * That is `tasks/open/agent-guard-never-observed-firing.md`, and it needs an
 * agent run, not a test.
 *
 * Background: tasks/decisions/2026-08-31-declared-tools-are-not-a-mechanism.md
 */

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const GUARD = join(ROOT, ".claude", "hooks", "agent-guard.mjs");

type ToolInput = { command?: string; file_path?: string };

function ask(agent: string | null, tool: string, toolInput: ToolInput): "ALLOW" | "DENY" {
  const payload: Record<string, unknown> = {
    hook_event_name: "PreToolUse",
    cwd: ROOT,
    tool_name: tool,
    tool_input: toolInput,
  };
  if (agent) {
    payload.agent_type = agent;
    payload.agent_id = "test";
  }
  const out = execFileSync("node", [GUARD], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    // Redirect the liveness log. Without this, running the suite writes lines
    // indistinguishable from a real agent invocation, and the trigger in
    // tasks/open/agent-guard-never-observed-firing.md stops meaning anything.
    env: { ...process.env, AGENT_GUARD_LOG: join(tmpdir(), "agent-guard-test.log") },
  });
  if (!out.trim()) return "ALLOW";
  const decision = JSON.parse(out).hookSpecificOutput?.permissionDecision;
  return decision === "deny" ? "DENY" : "ALLOW";
}

const repoFile = (p: string) => join(ROOT, p);

describe("agent guard", () => {
  it("has no opinion about the main conversation", () => {
    // Every rule below is keyed on agent_type. Without one, a human session
    // must be able to do anything it could do before this file existed.
    expect(ask(null, "Bash", { command: "git commit -m x" })).toBe("ALLOW");
    expect(ask(null, "Write", { file_path: repoFile("src/lib/email.ts") })).toBe("ALLOW");
  });

  describe("schema-auditor has no shell", () => {
    it("denies every Bash command, not a list of dangerous ones", () => {
      // prisma.config.ts resolves the production URL at load, so "which
      // subcommand connects" is not a margin worth reasoning about.
      expect(ask("schema-auditor", "Bash", { command: "npx prisma validate" })).toBe("DENY");
      expect(ask("schema-auditor", "Bash", { command: "ls" })).toBe("DENY");
    });

    it("leaves reading alone", () => {
      expect(ask("schema-auditor", "Read", { file_path: repoFile("prisma/schema.prisma") })).toBe("ALLOW");
      expect(ask("schema-auditor", "Grep", {})).toBe("ALLOW");
    });
  });

  describe("atomic-commit emits git commands rather than running them", () => {
    it("allows the reads it needs to do its job", () => {
      expect(ask("atomic-commit", "Bash", { command: "git status --short" })).toBe("ALLOW");
      expect(ask("atomic-commit", "Bash", { command: "git diff --cached --name-only" })).toBe("ALLOW");
      expect(ask("atomic-commit", "Bash", { command: "git log --format=%h | head -3" })).toBe("ALLOW");
      expect(ask("atomic-commit", "Bash", { command: "ls -la" })).toBe("ALLOW");
    });

    it("denies every write, including chained and sub-shelled ones", () => {
      expect(ask("atomic-commit", "Bash", { command: "git add -- a.ts" })).toBe("DENY");
      expect(ask("atomic-commit", "Bash", { command: "git status; git commit -F msg" })).toBe("DENY");
      expect(ask("atomic-commit", "Bash", { command: "(cd x && git commit -F m)" })).toBe("DENY");
      expect(ask("atomic-commit", "Bash", { command: "git push --force origin HEAD" })).toBe("DENY");
      expect(ask("atomic-commit", "Bash", { command: "git stash" })).toBe("DENY");
    });

    it("denies redirects into another checkout", () => {
      // triage-rules.md section 5 bans these outright; the guard does not try
      // to parse them.
      expect(ask("atomic-commit", "Bash", { command: "git -C /other status" })).toBe("DENY");
      expect(ask("atomic-commit", "Bash", { command: "GIT_DIR=/x git status" })).toBe("DENY");
    });

    it("is an allowlist, so an unrecognised subcommand is a write", () => {
      expect(ask("atomic-commit", "Bash", { command: "git some-new-plumbing-verb" })).toBe("DENY");
    });

    it("does not fire on the word git inside a string", () => {
      expect(ask("atomic-commit", "Bash", { command: 'echo "remember to git add"' })).toBe("ALLOW");
    });
  });

  describe("test-writer may not write product code", () => {
    it("allows writes under tests/, absolute or relative", () => {
      expect(ask("test-writer", "Write", { file_path: repoFile("tests/unit/x.test.ts") })).toBe("ALLOW");
      expect(ask("test-writer", "Write", { file_path: repoFile("tests/setup/nextMocks.ts") })).toBe("ALLOW");
      expect(ask("test-writer", "Edit", { file_path: "tests/unit/y.test.ts" })).toBe("ALLOW");
    });

    it("denies writes anywhere else in the repo", () => {
      expect(ask("test-writer", "Write", { file_path: repoFile("src/lib/server/prisma.ts") })).toBe("DENY");
      expect(ask("test-writer", "Edit", { file_path: repoFile("src/app/page.tsx") })).toBe("DENY");
      expect(ask("test-writer", "Edit", { file_path: "src/lib/email.ts" })).toBe("DENY");
      expect(ask("test-writer", "Write", { file_path: repoFile("prisma/schema.prisma") })).toBe("DENY");
    });

    it("allows scratch files outside the repo", () => {
      expect(ask("test-writer", "Write", { file_path: "C:/Temp/scratch/probe.mjs" })).toBe("ALLOW");
    });

    it("does not restrict its shell, which it needs to run the suite", () => {
      expect(ask("test-writer", "Bash", { command: "npm test" })).toBe("ALLOW");
    });
  });

  it("says nothing about agents it has no rule for", () => {
    expect(ask("ui-critic", "Bash", { command: "npx vitest run" })).toBe("ALLOW");
    expect(ask("spike-runner", "Bash", { command: "npm test" })).toBe("ALLOW");
  });
});
