#!/usr/bin/env node

// This hook records working-tree drift after Codex shell commands and patches. It is
// observational, never an authorization boundary, and deliberately does not duplicate the
// agent-specific rules in `.claude/hooks/agent-guard.mjs`.

import { appendFileSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DRIFT = process.env.AGENT_DRIFT_LOG || join(tmpdir(), "codex-agent-drift.log");

function finish() {
  process.exit(0);
}

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  finish();
}

if (input.hook_event_name !== "PostToolUse") finish();

try {
  const sessionCwd = input.cwd || process.cwd();
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: sessionCwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 10000,
  }).trim();
  const state =
    process.env.AGENT_DRIFT_STATE ||
    join(
      tmpdir(),
      `codex-agent-drift.${String(input.session_id || "nosession").replace(/[^a-zA-Z0-9_.-]/g, "_")}.state`,
    );
  const porcelain = execFileSync(
    "git",
    ["status", "--porcelain=v1", "-z", "-uall", "--no-renames"],
    {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 10000,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    },
  );
  const snapshot = porcelain
    .split("\0")
    .filter(Boolean)
    .map((record) => {
      const path = record.slice(3);
      let mtime = 0;
      let size = 0;
      try {
        const stats = statSync(join(root, path));
        mtime = stats.mtimeMs;
        size = stats.size;
      } catch {
        // Deleted paths have no readable metadata.
      }
      return { path, status: record.slice(0, 2), mtime, size };
    });
  const first = !existsSync(state);
  let previous = [];
  if (!first) {
    try {
      previous = JSON.parse(readFileSync(state, "utf8"));
    } catch {
      // A corrupt best-effort snapshot is equivalent to having no baseline.
    }
  }
  const before = new Map(previous.map((record) => [record.path, record]));

  writeFileSync(state, JSON.stringify(snapshot));

  // ceiling: the first matching tool establishes the baseline and is not attributed; add a
  // SessionStart baseline if this log ever becomes an enforcement or audit mechanism.
  if (!first) {
    const paths = new Set(snapshot.map((record) => record.path));
    const changed = snapshot.filter((record) => {
      const prior = before.get(record.path);
      return (
        !prior ||
        prior.status !== record.status ||
        prior.mtime !== record.mtime ||
        prior.size !== record.size
      );
    });
    for (const record of previous) {
      if (!paths.has(record.path)) changed.push({ ...record, gone: true });
    }

    if (changed.length) {
      const agent = input.agent_type || "main";
      const tool = input.tool_name || "unknown";
      appendFileSync(
        DRIFT,
        changed
          .map((record) => {
            const disposition = record.gone ? " gone" : "";
            return `${new Date().toISOString()} ${agent} ${tool} ${record.status.trim()} ${JSON.stringify(record.path)}${disposition}`;
          })
          .join("\n") + "\n",
      );
    }
  }
} catch {
  // Logging is best-effort and must never block the tool that already completed.
}

finish();
