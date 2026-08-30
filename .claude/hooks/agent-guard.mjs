#!/usr/bin/env node
// PreToolUse guard for the sub-agents in `.claude/agents/`.
//
// Each agent declares a contract in prose ("read-only", "emits commands, does not run them").
// This turns three of those into denials. It is wired from each agent's own frontmatter, NOT from
// settings.json, so it binds only that agent — the concurrent session on this branch pays nothing,
// and nothing here changes how a human session behaves. Same reasoning as `.claude/hooks/pre-commit`
// being written but not installed: a check that binds every session is not a unilateral call.
//
// `jq` is not installed on this machine; node is, and this is a node project, so node it is.
//
// Liveness: every invocation appends to <tmp>/claude-agent-guard.log. Frontmatter hooks have an
// open bug report (anthropics/claude-code#18392) and a silent no-op would look exactly like a
// working guard. The log is how you tell the difference:
//     cat "$TMPDIR/claude-agent-guard.log"    (Windows: %TEMP%\claude-agent-guard.log)
// No line after an agent has run means the hook never fired and the contract is still prose.

import { readFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(fileURLToPath(import.meta.url), "..", "..", "..");
// `AGENT_GUARD_LOG` redirects this, so tests/unit/agentGuard.test.ts writes its own file
// instead of salting the shared one — otherwise a line here stops meaning "an agent ran".
const LOG = process.env.AGENT_GUARD_LOG || join(tmpdir(), "claude-agent-guard.log");

/** Read-only git subcommands. Anything not on this list is a write until proven otherwise. */
const GIT_READS = new Set([
  "status", "diff", "log", "show", "blame", "describe", "shortlog",
  "rev-parse", "rev-list", "merge-base", "cat-file", "ls-files", "ls-tree",
  "symbolic-ref", "for-each-ref", "check-ignore", "var", "help", "grep",
]);

function allow() { process.exit(0); }

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

function log(line) {
  try { appendFileSync(LOG, `${new Date().toISOString()} ${line}\n`); } catch { /* never block on logging */ }
}

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  allow(); // Unparseable input is a harness problem, not a policy violation. Fail open, loudly.
}

const agent = input.agent_type;
const tool = input.tool_name;
if (!agent) allow(); // main conversation — this guard has no opinion

log(`${agent} ${tool}`);

/**
 * Classify every `git ...` invocation in a shell command. Allowlist, and fail closed: a git call
 * whose subcommand cannot be identified counts as a write, because the alternative is a blocklist
 * and a blocklist is only as good as its author's imagination.
 */
function gitWrites(command) {
  // A git redirect points the command at another checkout. triage-rules.md section 5 already bans
  // these outright, so they never need parsing.
  if (/(?:^|\s)(?:-C\b|--git-dir\b|--work-tree\b)|GIT_DIR=|GIT_WORK_TREE=/.test(command)) {
    return ["<redirected into another checkout>"];
  }
  const writes = [];
  for (const m of command.matchAll(/(?:^|[;&|(`\n]|\$\()\s*git\s+([^;&|)`\n]*)/g)) {
    const sub = m[1].trim().split(/\s+/).find((t) => t && !t.startsWith("-"));
    if (!sub) writes.push("<unparseable>");
    else if (!GIT_READS.has(sub)) writes.push(sub);
  }
  return writes;
}

if (agent === "schema-auditor" && tool === "Bash") {
  deny(
    "schema-auditor declares no shell. prisma.config.ts resolves the Neon PRODUCTION url at load, " +
    "so every Prisma CLI call starts from a production connection string. Read the schema file and " +
    "grep the callers instead. See tasks/decisions/2026-08-31-schema-auditor-has-no-shell.md.",
  );
}

if (agent === "atomic-commit" && tool === "Bash") {
  const writes = gitWrites(String(input.tool_input?.command ?? ""));
  if (writes.length) {
    deny(
      `atomic-commit emits git commands, it does not run them — refusing 'git ${writes.join("', 'git ")}'. ` +
      "The index is shared with another session, so staging and committing belong to the caller. " +
      "Return the command block instead.",
    );
  }
}

if (agent === "test-writer" && (tool === "Edit" || tool === "Write" || tool === "NotebookEdit")) {
  const raw = String(input.tool_input?.file_path ?? "");
  if (raw) {
    const abs = isAbsolute(raw) ? raw : resolve(input.cwd || REPO, raw);
    const rel = relative(REPO, abs).replaceAll("\\", "/");
    const insideRepo = rel !== "" && !rel.startsWith("../");
    if (insideRepo && !rel.startsWith("tests/")) {
      deny(
        `test-writer may not write product code — '${rel}' is outside tests/. If the code cannot be ` +
        "tested without changing it, that is the finding: return it to the caller. Scratch files " +
        "belong in the session scratchpad, outside the repo.",
      );
    }
  }
}

allow();
