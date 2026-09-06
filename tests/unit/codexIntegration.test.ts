import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const temporaryDirectories: string[] = [];

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("Codex project integration", () => {
  it("keeps imported instructions on paths that exist", () => {
    const instructionFiles = [
      ...readdirSync(join(ROOT, ".codex", "agents")).map((name) =>
        join(".codex", "agents", name),
      ),
      ...readdirSync(join(ROOT, ".agents", "skills"), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(".agents", "skills", entry.name, "SKILL.md"))
        .filter((path) => existsSync(join(ROOT, path))),
    ];

    for (const path of instructionFiles) {
      expect(read(path), path).not.toMatch(/\.Codex[\\/]/);
    }

    for (const name of readdirSync(join(ROOT, ".codex", "agents"))) {
      expect(read(join(".codex", "agents", name)), name).not.toContain("\\r");
    }

    for (const path of [
      ".agents/skills/test-harness/SKILL.md",
      ".claude/templates/gate-checklist.md",
      ".claude/templates/spike-verdict.md",
      ".claude/templates/triage-rules.md",
    ]) {
      expect(existsSync(join(ROOT, path)), path).toBe(true);
    }

    for (const completedCommand of ["fix-admin-session", "fix-category-tabs"]) {
      expect(
        existsSync(
          join(ROOT, ".agents", "skills", `source-command-${completedCommand}`, "SKILL.md"),
        ),
        completedCommand,
      ).toBe(false);
    }
  });

  it("gives non-writing custom agents a read-only sandbox", () => {
    for (const name of ["atomic-commit.toml", "schema-auditor.toml", "ui-critic.toml"]) {
      expect(read(join(".codex", "agents", name)), name).toMatch(
        /^sandbox_mode = "read-only"$/m,
      );
    }
  });

  it("describes the manual migration directory accurately", () => {
    const auditor = read(".codex/agents/schema-auditor.toml");

    expect(existsSync(join(ROOT, "prisma", "migrations", "manual"))).toBe(true);
    expect(auditor).toContain("prisma/migrations/manual/");
    expect(auditor).not.toContain("There is **no `prisma/migrations/` directory**");
  });

  it("runs the lifecycle hook from a nested directory without a machine path", () => {
    const hooks = JSON.parse(read(".codex/hooks.json"));
    const handler = hooks.hooks.PostToolUse[0].hooks[0];
    const command = process.platform === "win32" ? handler.commandWindows : handler.command;
    const temporaryDirectory = mkdtempSync(join(tmpdir(), "codex-hook-test-"));
    temporaryDirectories.push(temporaryDirectory);
    const state = join(temporaryDirectory, "state");
    const drift = join(temporaryDirectory, "drift.log");
    const payload = JSON.stringify({
      session_id: "codex-integration-test",
      cwd: join(ROOT, "docs"),
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
      tool_input: { command: "git status --short" },
      tool_response: {},
    });
    const result =
      process.platform === "win32"
        ? spawnSync("powershell", ["-NoProfile", "-Command", command], {
            cwd: join(ROOT, "docs"),
            encoding: "utf8",
            env: { ...process.env, AGENT_DRIFT_LOG: drift, AGENT_DRIFT_STATE: state },
            input: payload,
          })
        : spawnSync(command, {
            cwd: join(ROOT, "docs"),
            encoding: "utf8",
            env: { ...process.env, AGENT_DRIFT_LOG: drift, AGENT_DRIFT_STATE: state },
            input: payload,
            shell: true,
          });

    expect(handler.command).toContain("git rev-parse --show-toplevel");
    expect(handler.command).not.toMatch(/[A-Z]:\\/);
    expect(result.status, result.stderr).toBe(0);
    expect(existsSync(state)).toBe(true);
  });

  it("detects edits to paths Git would otherwise quote", () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), "codex-drift-test-"));
    temporaryDirectories.push(temporaryDirectory);
    const repository = join(temporaryDirectory, "repository");
    const state = join(temporaryDirectory, "state.json");
    const drift = join(temporaryDirectory, "drift.log");
    const hook = join(ROOT, ".codex", "hooks", "drift-log.mjs");
    const file = join(repository, "café.txt");
    const payload = JSON.stringify({
      session_id: "codex-integration-test",
      cwd: repository,
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
      tool_input: {},
      tool_response: {},
    });

    expect(spawnSync("git", ["init", "--quiet", repository]).status).toBe(0);
    writeFileSync(file, "one");
    expect(
      spawnSync(process.execPath, [hook], {
        encoding: "utf8",
        env: { ...process.env, AGENT_DRIFT_LOG: drift, AGENT_DRIFT_STATE: state },
        input: payload,
      }).status,
    ).toBe(0);

    writeFileSync(file, "two-two");
    expect(
      spawnSync(process.execPath, [hook], {
        encoding: "utf8",
        env: { ...process.env, AGENT_DRIFT_LOG: drift, AGENT_DRIFT_STATE: state },
        input: payload,
      }).status,
    ).toBe(0);
    expect(readFileSync(drift, "utf8")).toContain(JSON.stringify("café.txt"));
  });
});
