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
// **Two wirings, deliberately different (2026-09-05).**
//   - Agent frontmatter (`schema-auditor`, `atomic-commit`): binds only those two agents.
//   - `.claude/settings.json`: binds EVERY session, including the concurrent one, for the
//     irreversible-command rules and the drift log. That was previously refused as a
//     unilateral call; it was authorised by the human on 2026-09-05. See
//     `tasks/decisions/2026-09-05-guard-binds-the-main-conversation.md`.
//
// Consequence for the liveness protocol: the log now fills with `main Bash` lines from
// ordinary work, so "a line exists" no longer means "an agent ran". Grep for the agent
// name — `grep -E ' (schema-auditor|atomic-commit) ' <log>` — which is what
// `tasks/open/matcherless-hook-wiring-unverified.md` needs.
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

import { readFileSync, writeFileSync, appendFileSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// `AGENT_GUARD_LOG` redirects this, so tests/unit/agentGuard.test.ts writes its own file
// instead of salting the shared one — otherwise a line here stops meaning "an agent ran".
const LOG = process.env.AGENT_GUARD_LOG || join(tmpdir(), "claude-agent-guard.log");

/**
 * Write-path drift log. Non-blocking by design: it records every file write so that
 * "while I'm here" edits are visible at review time, and it never denies, so it cannot
 * train reflex approval. A log nobody reads is furniture — its consumer is session close
 * (CLAUDE.md invariant 9):
 *     cat "$TEMP/claude-agent-drift.log"     (Windows; $TMPDIR elsewhere)
 */
const DRIFT = process.env.AGENT_DRIFT_LOG || join(tmpdir(), "claude-agent-drift.log");



/**
 * The override, and the reason it is an environment variable rather than a repo file:
 * the party being fenced writes repo files. Shell state does not persist between tool
 * calls in this harness, so an agent cannot set this mid-session; the hook inherits it
 * from whatever launched Claude Code. Every honoured override is logged, because a
 * variable set persistently (`setx`) would otherwise disable the fence silently — which
 * is this repo's recurring failure shape, not a hypothetical.
 */
// An ALLOWLIST. Listing the falsy words meant any unrecognised value — `disabled`,
// a typo, a stray path — switched the whole fence off. The failure had to be the
// default, not the exception.
const OVERRIDE = ["1", "true", "yes", "on"].includes(
  String(process.env.MIDWIFE_ALLOW_IRREVERSIBLE ?? "").trim().toLowerCase(),
);

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

// The harness sends the working directory in the payload. Deriving it from this
// process's cwd instead worked only because cwd happened to be the repo root — the
// same "it was luck, not evidence" shape this repo keeps rediscovering. Both the
// checkout-path discriminator and the drift log resolve against it.
const ROOT = input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();

/**
 * Previous `git status --porcelain` snapshot, so the log records deltas and not the tree.
 * **Keyed by session**, which stops concurrent sessions clobbering each other's baseline
 * and re-establishes the "first call attributes nothing" protection per session.
 *
 * It does NOT stop cross-attribution: `git status` observes one shared working tree, so a
 * write by the other session lands in this session's log against whatever tool ran last.
 * Only a worktree per session fixes that
 * (`tasks/decisions/2026-08-31-worktrees-are-free-and-the-guard-was-the-wrong-layer.md`).
 */
const DRIFT_STATE =
  process.env.AGENT_DRIFT_STATE ||
  join(tmpdir(), `claude-agent-drift.${input.session_id || "nosession"}.state`);

const agent = input.agent_type ?? "main";
const tool = input.tool_name;
log(`${agent} ${tool}`);

// ================= PostToolUse: the drift log, which never denies =================
// Writes are recorded, not judged. Path-based fences were built and deleted here
// (tasks/decisions/2026-08-31-step-rule-deleted-nothing-replaces-it.md); a log is what
// survives that finding, because it costs nothing at the step and cannot block correct
// work that merely looks out of scope.
//
// **It observes the TREE, not the tool input.** Reading `tool_input.file_path` recorded
// 1 of 6 files actually written in the session that built this, because auto mode steers
// file changes to `cat >`, `sed -i` and short node scripts — the identical blind spot
// that got the step-level path rule deleted. A matcher on tool names cannot see a
// heredoc. `git status` can.
//
// Measured cost: ~120ms per call. Paid deliberately, because a log with 1-in-6 recall is
// worse than no log: it produces confidence without coverage.
if (input.hook_event_name === "PostToolUse") {
  try {
    const porcelain = execFileSync("git", ["status", "--porcelain", "-uall"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 10000,
      // The index is shared with a live writer. `git status` would otherwise take
      // index.lock on every tool call just to refresh a cache nobody here reads.
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    });
    // Status code alone is not a delta: a file already ` M` that is edited again keeps
    // the same code, so six patch passes over one file logged nothing. mtime moves.
    const lines = porcelain
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        let mtime = 0;
        try {
          mtime = statSync(join(ROOT, l.slice(3))).mtimeMs;
        } catch {
          /* deleted, renamed, or a git-quoted path */
        }
        return `${l}\t${mtime}`;
      });
    const first = !existsSync(DRIFT_STATE);
    const before = new Map(
      (first ? "" : readFileSync(DRIFT_STATE, "utf8"))
        .split("\n")
        .filter(Boolean)
        .map((l) => [l.slice(3).split("\t")[0], l]),
    );
    writeFileSync(DRIFT_STATE, lines.join("\n"));
    // The first call establishes the baseline and attributes nothing. Logging a tree
    // that was already dirty would credit this tool with another session's work.
    if (!first) {
      const paths = new Set(lines.map((l) => l.slice(3).split("\t")[0]));
      const changed = lines.filter((l) => before.get(l.slice(3).split("\t")[0]) !== l);
      // A path that LEAVES porcelain is a change too: an untracked file deleted, or a
      // modification reverted. Without this the log misrepresents the tree it tracks.
      for (const [path, record] of before) {
        if (!paths.has(path)) changed.push(`${record.slice(0, 2)} ${path}\tgone`);
      }
      if (changed.length) {
        appendFileSync(
          DRIFT,
          changed
            .map(
              (l) =>
                `${new Date().toISOString()} ${agent} ${tool} ${l.slice(0, 2).trim()} ${l
                  .slice(3)
                  .split("\t")[0]}`,
            )
            .join("\n") + "\n",
        );
      }
    }
  } catch { /* never block on logging */ }
  allow();
}

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

/**
 * A `-C`/`--git-dir`/`--work-tree` redirect, or `GIT_DIR=`, pointing INSIDE this repo's
 * own `.claude/worktrees/` is ordinary work, not an escape.
 *
 * `triage-rules.md` §5 bans redirects outright, and that entry predates the 2026-08-31
 * decision that a worktree per session is this repo's answer to shared-tree hazards.
 * Measured: 21 of 151 corpus denials were `git -C .claude/worktrees/<name> status`.
 * Banning the mechanism the repo recommends is how a guard gets overridden by reflex.
 */
function redirectsOutsideWorktrees(target) {
  if (!target) return true;
  const clean = target.replace(/^['"]|['"]$/g, "");
  const worktrees = resolve(ROOT, ".claude", "worktrees");
  return !resolve(ROOT, clean).startsWith(worktrees);
}

/**
 * Git global options that consume the NEXT token, so the subcommand is not the first
 * non-flag token. `git -c core.pager=cat reset --hard` resolved sub to "core.pager=cat",
 * fell through to `default:` and was ALLOWED. Found by review, not by any test here.
 */
const GIT_VALUE_OPTS = new Set(["-c", "--namespace", "--exec-path", "--config-env"]);

/** Options of `checkout` that consume the next token as a NAME, never a path. */
const CHECKOUT_CREATES = new Set(["-b", "-B", "--orphan", "-t", "--track"]);

/**
 * Git operations with no undo, or banned outright by `triage-rules.md` §5.
 *
 * This is a **targeted blocklist, not an allowlist**, and the asymmetry with `gitWrites()`
 * is deliberate. `atomic-commit` may run no git write at all, so an allowlist is right
 * there. The main conversation must keep doing ordinary git work; applying the same
 * orientation would deny `git commit` on every call and train the human to set the
 * override permanently, which is the failure this guard exists to avoid.
 *
 * Fail-closed is preserved where it actually bites: a git call that cannot be parsed, or
 * that is redirected into another checkout, counts as destructive.
 */
/**
 * Does this path currently carry uncommitted changes?
 *
 * `git checkout -- <path>` on a CLEAN path restores it to itself: a no-op with nothing to
 * destroy. Measured: 12 of 151 corpus denials were checkout forms, and most were
 * `git checkout <ref> -- <paths>` used to port files between branches, where the target
 * was clean. Asking the tree turns a rule about a command's SHAPE into a rule about its
 * EFFECT, which is the distinction this guard keeps getting wrong.
 *
 * The residue is real and recorded: reverting a file you deliberately mutated — the
 * mutation-testing pattern this repo calls its best practice — leaves the path dirty and
 * is still denied. See tasks/open/checkout-revert-blocks-mutation-testing.md.
 */
function hasUncommittedChanges(paths) {
  if (!paths.length) return true; // cannot tell: fail closed
  try {
    const out = execFileSync("git", ["status", "--porcelain", "-uall", "--", ...paths], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 10000,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    });
    return out.trim().length > 0;
  } catch {
    return true; // git could not answer: fail closed
  }
}

function irreversibleGit(command) {
  const hits = [];
  // Per segment, and mentions are skipped: matching `git` anywhere in the command
  // denied `cat note.md | grep 'git reset --hard'`.
  const scannable = segments(command)
    .filter((seg) => !isMention(seg))
    .join("\n");
  for (const m of scannable.matchAll(/(?<![\w./-])git\s+([^;&|)`\n]*)/g)) {
    const args = m[1];
    const redirect = args.match(
      /(?:^|\s)(?:-C|--git-dir|--work-tree)(?:=|\s+)("[^"]*"|'[^']*'|\S+)/,
    );
    if (redirect && redirectsOutsideWorktrees(redirect[1])) {
      hits.push("git <redirected into another checkout>");
      continue;
    }
    // Strip surrounding quotes: in `sh -c "git push --force"` the closing quote attaches
    // to the flag, and `--force"` matches nothing.
    const tokens = args
      .trim()
      .split(/\s+/)
      .map((t) => t.replace(/^['"]+|['"]+$/g, ""))
      .filter(Boolean);

    let i = 0;
    while (i < tokens.length && tokens[i].startsWith("-")) {
      if (GIT_VALUE_OPTS.has(tokens[i])) i++;
      i++;
    }
    const sub = tokens[i];
    if (!sub) {
      hits.push("git <unparseable>");
      continue;
    }
    const operands = tokens.slice(i + 1);
    const flags = operands.filter((t) => t.startsWith("-"));
    const has = (...names) => flags.some((f) => names.includes(f));
    const hasPrefix = (p) => flags.some((f) => f.startsWith(p));
    // A short cluster like -xdf or -fu carries the flag without equalling it.
    const cluster = (ch) => flags.some((f) => /^-[a-zA-Z]+$/.test(f) && f.slice(1).includes(ch));

    switch (sub) {
      case "reset":
        // --merge and --keep discard working-tree changes too; --soft and the default
        // --mixed leave the tree alone. Uncommitted work has no reflog.
        if (has("--hard", "--merge", "--keep")) hits.push("git reset --hard/--merge/--keep");
        break;
      case "checkout": {
        const dashDash = operands.indexOf("--");
        if (dashDash !== -1) {
          const targets = operands.slice(dashDash + 1).filter((t) => t && !t.startsWith("-"));
          if (hasUncommittedChanges(targets)) hits.push("git checkout -- <modified path>");
          break;
        }
        if (args.trim().endsWith(" --")) {
          hits.push("git checkout --");
          break;
        }
        // `checkout -f <branch>` discards every modified tracked file. The switch case
        // denied the identical flags; this one did not.
        if (has("-f", "--force")) {
          hits.push("git checkout --force");
          break;
        }
        // `git checkout <branch>` and `git checkout <path>` are syntactically identical;
        // the discriminator is the filesystem. But -b/-B/--orphan/-t take a NAME, and
        // `git checkout -b docs` was denied because `docs/` exists.
        const candidates = [];
        for (let k = 0; k < operands.length; k++) {
          if (CHECKOUT_CREATES.has(operands[k])) {
            k++;
            continue;
          }
          if (!operands[k].startsWith("-")) candidates.push(operands[k]);
        }
        const existing = candidates.filter((t) => existsSync(t) || existsSync(join(ROOT, t)));
        if (existing.length && hasUncommittedChanges(existing)) {
          hits.push("git checkout <modified path>");
        }
        break;
      }
      case "switch":
        // Same discard as checkout, different spelling. It had no case at all.
        if (has("--discard-changes", "-f", "--force")) hits.push("git switch --discard-changes");
        break;
      case "restore":
        // `--staged` alone only unstages, which `git reset HEAD <path>` is explicitly
        // allowed to do. Denying the newer spelling of an allowed act is incoherent.
        if (!has("--staged") || has("-W", "--worktree")) hits.push("git restore");
        break;
      case "clean":
        // -n/--dry-run deletes nothing, and `-nfd` is a dry run despite carrying f.
        if ((has("--force") || cluster("f")) && !(has("--dry-run") || cluster("n"))) {
          hits.push("git clean --force");
        }
        break;
      case "stash":
        // §5: never stash — it pulls the concurrent session's work out from under a
        // running process. Only the read forms are allowed, and the read form is the
        // token after the subcommand, not tokens[1] — `git --no-pager stash list` was
        // denied by that off-by-one.
        if (!["list", "show"].includes(operands[0])) hits.push("git stash");
        break;
      case "commit":
        if (has("--amend")) hits.push("git commit --amend");
        break;
      case "rebase":
        // Starting a rewrite is denied; finishing or abandoning one already in flight is
        // not. Only a human can start it, and blocking --continue strands the repo
        // mid-rebase, which is worse than the rewrite it was preventing.
        if (!has("--abort", "--quit", "--continue", "--skip")) hits.push("git rebase");
        break;
      case "push":
        if (
          has("--force", "-f", "--delete", "-d", "--mirror") ||
          hasPrefix("--force-with-lease") ||
          cluster("f")
        ) {
          hits.push("git push --force/--delete/--mirror");
        } else if (operands.some((t) => t.startsWith(":") || t.startsWith("+"))) {
          // A LEADING colon deletes the remote ref; a leading + forces that refspec.
          // `master:master` is an ordinary push and denying it was a false positive.
          hits.push("git push <deleting or forced refspec>");
        }
        break;
      case "filter-branch":
      case "filter-repo":
        hits.push(`git ${sub}`);
        break;
      case "branch":
        // -D discards an unmerged branch; its commits survive only in a reflog that
        // expires. -d refuses when it would lose work, so it stays open.
        if (has("-D") || (has("--delete") && has("--force"))) hits.push("git branch -D");
        break;
      case "worktree":
        // `worktree remove --force` deletes a checkout with uncommitted work in it.
        // Removing a worktree under .claude/worktrees/ is routine cleanup of the very
        // mechanism this repo recommends; 6 corpus denials were exactly that. A worktree
        // carries committed state only, so uncommitted work there never travelled anyway.
        if (
          operands[0] === "remove" &&
          has("-f", "--force") &&
          operands.slice(1).some((t) => !t.startsWith("-") && redirectsOutsideWorktrees(t))
        ) {
          hits.push("git worktree remove --force");
        }
        break;
      case "update-ref":
        if (has("-d")) hits.push("git update-ref -d");
        break;
      case "reflog":
        // The reflog is the undo of last resort for several forms above.
        if (["expire", "delete"].includes(operands[0])) hits.push(`git reflog ${operands[0]}`);
        break;
      default:
        break;
    }
  }
  // Same trailing check gitWrites() applies: an env-prefix redirect points git at a
  // different checkout, which triage-rules.md §5 bans outright.
  const envRedirect = scannable.match(/GIT_DIR=|GIT_WORK_TREE=/)
    ? scannable.match(/GIT_(?:DIR|WORK_TREE)=("[^"]*"|'[^']*'|\S+)/)
    : null;
  if (envRedirect && redirectsOutsideWorktrees(envRedirect[1])) {
    hits.push("git <redirected into another checkout>");
  }
  return hits;
}

/**
 * The three invocations that pin `DATABASE_URL` to `localhost:5432` via `cross-env`,
 * named as the only local escape hatches in `triage-rules.md` §1. Everything else
 * inherits `.env.local`, which sets `NEON_BRANCH=production`.
 */
const LOCAL_DB_SCRIPTS = ["db:push:local", "db:seed:local", "test:db"];

/**
 * Commands that read. A segment whose command word is one of these is a MENTION of a
 * dangerous string, not an invocation of it — `grep -rn "db:seed" package.json` was
 * denied, and the denial fired against a reviewer's own grep. That is the
 * false-positive trainer this design is built to avoid, so the skip is part of the rule
 * rather than an exception to it.
 *
 * Command substitution voids the skip: `grep "$(git reset --hard)"` reads nothing and
 * runs everything.
 */
const READERS = new Set([
  "grep", "rg", "cat", "head", "tail", "less", "more", "echo", "printf", "awk",
  "find", "ls", "wc", "jq", "diff", "file", "stat", "which", "type", "sort", "uniq",
]);

/**
 * Commands that execute a script or a CLI. A database hazard only exists if one of these
 * is running it.
 *
 * Measured: 46 of 151 corpus denials — the single largest class — were the file PATH
 * `prisma/seed.ts` appearing in `git diff -- prisma/seed.ts`, `git add prisma/seed.ts`
 * and `sed -n '60,120p' prisma/seed.ts`. Reading or staging a file is not running it,
 * and `isMention()` could not catch these because `git` and `sed` are not readers.
 */
const RUNNERS = new Set([
  "npm", "pnpm", "yarn", "node", "tsx", "ts-node", "prisma", "bun", "deno", "dotenv",
]);

/** Wrappers to look past when deciding what a segment actually runs. */
const WRAPPERS = new Set(["env", "time", "sudo", "nice", "cross-env", "npx", "command", "exec"]);

function commandWord(seg) {
  for (const token of seg.trim().split(/\s+/)) {
    if (!token || /^[A-Za-z_][A-Za-z0-9_]*=/.test(token)) continue; // env assignment
    if (WRAPPERS.has(token)) continue;
    return token.replace(/^['"]+/, "").split("/").pop();
  }
  return "";
}

/** A reader segment with no command substitution only ever mentions a command. */
function isMention(seg) {
  return READERS.has(commandWord(seg)) && !/\$\(|`/.test(seg);
}

/**
 * Schema and data writes, keyed on **where the connection points**, not on the verb.
 *
 * The verb is the wrong discriminator: `db:push:local` contains "db:push" and is safe,
 * while `db:push:unsafe` is the bare production call. Blocking on the verb would deny the
 * safe variants — a false-positive trainer, and the exact pathology this design is meant
 * to avoid. So the test is inverted: an invocation is denied unless it can be **proven**
 * to target localhost. Absence of proof is production. There is no `prisma/migrations/`
 * directory here, so `db push` against production applies drift with no down path
 * (`triage-rules.md` §2).
 *
 * The command string is inspected; no env file is read and no URL is ever logged
 * (RISK VETO §4 — grep the key name, never the value).
 */
function irreversibleDb(command) {
  const hits = [];
  // Per segment, not per command: a localhost proof in one segment says nothing about
  // the next one. See segments() for the bypass this closes.
  for (const seg of segments(command)) {
    if (isMention(seg)) continue;
    if (!RUNNERS.has(commandWord(seg))) continue; // a mention of a path, not an invocation
    const provenLocal =
      // The escape hatch is "you invoked the local script", not "the string appears".
      // A substring match exempted any segment containing the name; a whole-token match
      // still exempted `npm run db:seed -- --note test:db`. It must be the run TARGET.
      LOCAL_DB_SCRIPTS.some((name) =>
        new RegExp(
          `(?:^|\\s)(?:npm|pnpm|yarn)(?:\\s+run)?\\s+${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$)`,
        ).test(seg),
      ) ||
      // The host, not "anywhere after DATABASE_URL=". Matching loosely allowed
      // `postgresql://u:p@ep-cool.neon.tech/localhost` — a production URL with a
      // database named localhost.
      /DATABASE_URL=['"]?[a-z+]+:\/\/(?:[^@'"\s]*@)?(?:localhost|127\.0\.0\.1)(?::\d+)?(?:[/?'"\s]|$)/i.test(
        seg,
      );
    if (provenLocal) continue;

    if (/prisma\s+migrate\s+reset/.test(seg)) hits.push("prisma migrate reset");
    else if (/prisma\s+migrate/.test(seg)) hits.push("prisma migrate");
    if (/prisma\s+db\s+push/.test(seg) || /\bdb:push\b/.test(seg)) hits.push("prisma db push");
    if (/prisma\s+db\s+execute/.test(seg)) hits.push("prisma db execute");
    if (/\bdb:seed\b/.test(seg) || /prisma[\/\\]seed\.ts/.test(seg)) hits.push("db:seed");
    // scripts/migrate-faqs.ts applies manual DDL and rewrites the faqs table; against
    // .env.local that is the Neon production branch. It is a migration in everything but
    // name, and it was reachable through both spellings.
    if (/\bdb:migrate:faqs\b/.test(seg) || /scripts[\/\\]migrate-faqs\.ts/.test(seg)) {
      hits.push("db:migrate:faqs");
    }
  }
  return [...new Set(hits)];
}

/**
 * Strip heredoc bodies before scanning. A heredoc body is data that is written to a
 * file, never a command that runs — and this repo writes its ledger with
 * `cat > entry.md <<'EOF' ... EOF`, so prose quoting a destructive command is routine
 * rather than exotic.
 *
 * Found the hard way: the guard denied the ledger write that documented the guard,
 * because the text "git checkout package.json" appeared inside the heredoc. A rule that
 * fires on documentation gets overridden by reflex and then uninstalled, which is the
 * exact failure this whole mechanism exists to avoid
 * (tasks/decisions/2026-09-05-guard-binds-the-main-conversation.md).
 *
 * Note the deliberate difference from `gitWrites()`, which denies the word "git" even
 * inside a quoted string. That trade is right for `atomic-commit`, whose whole job is
 * emitting command text it must not run. It is wrong here.
 */
/**
 * Split a command line into independently-evaluated segments.
 *
 * Without this, a proof found anywhere in the string exempted the whole string, so
 * `npm run db:seed:local && npm run db:seed` ran a production seed with the guard's
 * blessing. That is the same defect shape as a scope check evaluated over the union of
 * a tree instead of the node that asked: the check was right, its scope was wrong.
 */
function segments(command) {
  // **Quote-aware, because a regex split cannot know it is inside a string.**
  //
  // `command.split(/[;\n|&]/)` fragmented `grep -n 'git checkout a\\|git reset --hard' f`
  // at the escaped pipe INSIDE the quotes, producing a segment whose command word was
  // `git`, and a grep for this guard's own test file was denied twice during the session
  // that wrote it. Skipping the whole command when it starts with a reader fixed that
  // and opened a fail-open hole instead, because `echo "<<EOF"` followed by a real
  // command also starts with a reader. Only respecting quotes fixes both.
  //
  // A single `&` separates like `;`; missing it left `db:seed:local & db:seed` allowing
  // a production seed.
  const out = [];
  let current = "";
  let quote = null;
  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (quote) {
      current += ch;
      if (ch === quote && command[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === ";" || ch === "\n" || ch === "&" || ch === "|") {
      if ((ch === "&" || ch === "|") && command[i + 1] === ch) i++; // && and ||
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out.map((seg) => seg.trim()).filter(Boolean);
}

/**
 * Herestring payloads (`cmd <<<"text"`) are data like heredoc bodies, and are stripped
 * for the same reason. Kept separate because `<<<` must NOT be read as a heredoc opener.
 */
function stripHerestrings(command) {
  return command.replace(/<<<\s*(['"])[\s\S]*?\1/g, "<<<''");
}

function stripHeredocBodies(command) {
  const lines = command.split("\n");
  const kept = [];
  let delimiter = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (delimiter !== null) {
      if (line.trim() === delimiter) delimiter = null;
      continue; // inside a body: data, not a command
    }
    kept.push(line); // the opening line IS a command, so it stays
    // The lookbehind keeps `<<<` (a herestring) from reading as a heredoc opener.
    const open = line.match(/(?<!<)<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/);
    // A heredoc only exists if its terminator actually appears on a later line.
    // Without this check, `echo "<<EOF"` opened a body that swallowed every command
    // after it — so the false-positive fix had introduced a fail-OPEN bypass, which is
    // strictly worse than the false positive it removed.
    // `bash <<EOF ... EOF` and `sh -s <<'EOF'` EXECUTE their body. Stripping it there
    // hid the commands entirely. Only a body being written to a file is data.
    const feedsInterpreter =
      // A leading path still runs it: `/bin/bash <<EOF` executed its body while
      // `env bash <<EOF` was correctly denied.
      /(?:^|[\s;&|(])(?:[\w./-]*\/)?(?:sh|bash|zsh|ksh|dash|node|python3?|perl|ruby|tsx|ts-node|npx)\b/.test(
        line.split("<<")[0],
      );
    if (open && !feedsInterpreter && lines.slice(i + 1).some((l) => l.trim() === open[2])) {
      delimiter = open[2];
    }
  }
  return kept.join("\n");
}

/**
 * Recursive force-deletion of a path inside the repo.
 *
 * This was left off the list on the argument that no incident supported it and that
 * padding a veto list makes it decorative. Review pointed out the incoherence: `git clean
 * -fd` is denied and deletes strictly LESS than `rm -rf src`, which was allowed. The
 * consistency argument is better than the padding argument.
 *
 * Build output and scratch directories stay open, because deleting them is routine and a
 * guard that fires on `rm -rf node_modules` is a guard that gets overridden by reflex.
 */
const DELETABLE = /^(?:node_modules|\.next|dist|build|coverage|\.turbo|\.cache|out|tmp|temp|\.claude\/worktrees)(?:[/\\]|$)/;

function recursiveDeletes(command) {
  const hits = [];
  for (const seg of segments(command)) {
    if (isMention(seg)) continue;
    const tokens = seg.trim().split(/\s+/).map((t) => t.replace(/^['"]+|['"]+$/g, ""));
    const cmd = commandWord(seg);
    const flags = tokens.filter((t) => t.startsWith("-"));
    const cluster = (ch) => flags.some((f) => /^-[a-zA-Z]+$/.test(f) && f.slice(1).includes(ch));
    const recursive =
      cmd === "rm"
        ? cluster("r") || flags.some((f) => /^--recursive$/.test(f))
        : cmd === "Remove-Item" || cmd === "ri" || cmd === "rd"
          ? flags.some((f) => /^-Recurse$/i.test(f))
          : false;
    if (!recursive) continue;
    const forced =
      flags.some((f) => /^-Force$/i.test(f) || /^--force$/.test(f)) || (cmd === "rm" && cluster("f"));
    if (!forced) continue;
    const targets = tokens
      .slice(1)
      .filter((t) => t && !t.startsWith("-") && !/^[A-Za-z_][A-Za-z0-9_]*=/.test(t));
    // A target outside the repo (an absolute path, or one reached with ..) is not this
    // guard's business; a scratchpad under TEMP is where throwaway scripts live.
    const inRepo = targets.filter(
      (t) => !/^([A-Za-z]:|\/|\\|\$|%|~)/.test(t) && !t.startsWith(".."),
    );
    if (inRepo.some((t) => !DELETABLE.test(t.replace(/^\.\//, "")))) {
      hits.push(`${cmd} recursive force-delete inside the repo`);
    }
  }
  return hits;
}

// ================= irreversible commands, for every actor =================
// Not keyed on who asked. The verdict is about the act: a `reset --hard` from a
// sub-agent destroys the same uncommitted work as one from the main conversation.
// Same reasoning that binds SHELL_TOOLS rather than the tool named "Bash".
{
  if (SHELL_TOOLS.has(tool)) {
    const command = stripHeredocBodies(stripHerestrings(String(input.tool_input?.command ?? "")));
    const hits = [
      ...irreversibleGit(command),
      ...irreversibleDb(command),
      ...recursiveDeletes(command),
    ];
    if (hits.length) {
      if (OVERRIDE) {
        // Logged on every use. A silently-disabled fence is worse than none.
        log(`OVERRIDE HONOURED main ${tool} rules=${hits.join(",")}`);
      } else {
        log(`DENY main ${tool} rules=${hits.join(",")}`);
        deny(
          `IRREVERSIBLE — refusing '${hits.join("', '")}'. This cannot be undone: ` +
            "uncommitted work has no reflog, this repo has no Prisma-managed migration history " +
            "(prisma/migrations/manual/ is hand-written, so db push has no down path), " +
            "and .env.local points DATABASE_URL at the Neon PRODUCTION branch. " +
            "Local escape hatches that are allowed: npm run db:push:local, db:seed:local, test:db. " +
            "To proceed anyway, the HUMAN relaunches Claude Code with " +
            "MIDWIFE_ALLOW_IRREVERSIBLE=1 — you cannot set it yourself, and every use is logged. " +
            "See tasks/decisions/2026-09-05-guard-binds-the-main-conversation.md.",
        );
      }
    }
  }
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
