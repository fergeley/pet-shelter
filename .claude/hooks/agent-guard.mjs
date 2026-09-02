#!/usr/bin/env node
// PreToolUse guard for the sub-agents in `.claude/agents/`.
//
// It enforces exactly two rules, and both are **irreversible at the step**: once `schema-auditor`
// reaches a database or `atomic-commit` writes git history, no later check can undo it. That is the
// whole test for whether a rule belongs here.
//
// Rules about the *end state* — "this agent left product code modified" — are deliberately NOT
// here. Both shapes were built and removed. A step-level path rule blocked `test-writer` from
// mutating product code to watch a test fail, which is the only way to prove a test discriminates,
// while leaving the same write through Bash untouched. A `SubagentStop` end-state check fixed that
// but mitigated a hazard that only exists because two sessions share one working tree — and a
// worktree per session dissolves it instead, for free.
// See tasks/decisions/2026-08-31-worktrees-are-free-and-the-guard-was-the-wrong-layer.md.
//
// Wired from each agent's own frontmatter, NOT from settings.json, so it binds only the two agents
// that have a rule — the concurrent session on this branch pays nothing, and an agent with no rule
// gets no hook rather than a hook that always allows. Same reasoning as `.claude/hooks/pre-commit`
// being written but not installed: a check that binds every session is not a unilateral call.
//
// `jq` is not installed on this machine; node is, and this is a node project, so node it is.
//
// Liveness: every invocation appends to <tmp>/claude-agent-guard.log. Frontmatter hooks come from
// the agent definition as it stood when the SESSION started, so a hook wired mid-session never
// fires, and a silent no-op looks exactly like a working guard
// (tasks/decisions/2026-08-31-agent-definitions-are-session-start-snapshots.md). The log is how you
// tell the difference:
//     cat "$TMPDIR/claude-agent-guard.log"    (Windows: %TEMP%\claude-agent-guard.log)
// No line after `schema-auditor` or `atomic-commit` has run means the hook never fired and the
// contract is still prose.

import { readFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// `AGENT_GUARD_LOG` redirects this, so tests/unit/agentGuard.test.ts writes its own file
// instead of salting the shared one — otherwise a line here stops meaning "an agent ran".
const LOG = process.env.AGENT_GUARD_LOG || join(tmpdir(), "claude-agent-guard.log");

/** Read-only git subcommands. Anything not on this list is a write until proven otherwise. */
const GIT_READS = new Set([
  "status", "diff", "log", "show", "blame", "describe", "shortlog",
  "rev-parse", "rev-list", "merge-base", "cat-file", "ls-files", "ls-tree",
  "symbolic-ref", "for-each-ref", "check-ignore", "var", "help", "grep",
]);

/** Everything `schema-auditor` may touch. Anything else, including any shell, is denied. */
const SCHEMA_AUDITOR_TOOLS = new Set(["Read", "Grep", "Glob"]);

/**
 * Tools that run a command line. `Bash` is not the only one this environment offers.
 * **Duplicated as the `PreToolUse` matcher in `.claude/agents/{schema-auditor,atomic-commit}.md`.**
 * Adding a tool here without adding it there means the hook never fires for it. The duplication is
 * deliberate and temporary: a matcherless hook removes it, and
 * `tasks/open/matcherless-hook-wiring-unverified.md` carries the measurement that would allow it.
 */
const SHELL_TOOLS = new Set(["Bash", "PowerShell", "BashOutput", "KillShell"]);

function log(line) {
  try { appendFileSync(LOG, `${new Date().toISOString()} ${line}\n`); } catch { /* never block on logging */ }
}

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
  const writes = [];
  // `git` at a word boundary ANYWHERE, not only after a separator. Anchoring on separators missed
  // `for f in a b; do git add $f; done`, `env git commit`, `xargs git add`, `time git push` and
  // `sh -c "git commit"` — every one of which writes the shared index. The lookbehind keeps
  // `github`, `.git` and `foo-git` out.
  for (const m of command.matchAll(/(?<![\w./-])git\s+([^;&|)`\n]*)/g)) {
    const args = m[1];
    // A redirect points git at another checkout. triage-rules.md section 5 bans these outright, so
    // they never need parsing — but the flag only counts INSIDE a git call: `ls -C`, `sort -C f`
    // and `grep -C 3 foo` are not git redirects.
    if (/(?:^|\s)(?:-C\b|--git-dir\b|--work-tree\b)/.test(args)) {
      writes.push("<redirected into another checkout>");
      continue;
    }
    const sub = args.trim().split(/\s+/).find((t) => t && !t.startsWith("-"));
    if (!sub) writes.push("<unparseable>");
    else if (!GIT_READS.has(sub)) writes.push(sub);
  }
  if (/GIT_DIR=|GIT_WORK_TREE=/.test(command)) writes.push("<redirected into another checkout>");
  return writes;
}

if (agent === "schema-auditor" && !SCHEMA_AUDITOR_TOOLS.has(tool)) {
  // An allowlist, not `tool === "Bash"`. This environment also exposes a PowerShell tool, and the
  // premise of this whole guard is that the frontmatter `tools:` list may not be enforced — so
  // naming one shell leaves every other execution path open to the production connection string.
  deny(
    `schema-auditor declares no shell and no '${tool}'. prisma.config.ts resolves the Neon ` +
    "PRODUCTION url at load, so every Prisma CLI call starts from a production connection string. " +
    "Read the schema file and grep the callers instead. " +
    "See tasks/decisions/2026-08-31-schema-auditor-has-no-shell.md.",
  );
}

if (agent === "atomic-commit" && SHELL_TOOLS.has(tool)) {
  const writes = gitWrites(String(input.tool_input?.command ?? ""));
  if (writes.length) {
    deny(
      `atomic-commit emits git commands, it does not run them — refusing 'git ${writes.join("', 'git ")}'. ` +
      "The index is shared with another session, so staging and committing belong to the caller. " +
      "Return the command block instead.",
    );
  }
}

allow();
