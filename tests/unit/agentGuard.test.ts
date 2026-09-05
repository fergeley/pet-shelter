import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "fs";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { fileURLToPath } from "url";

/**
 * `.claude/hooks/agent-guard.mjs` is the only enforcement any sub-agent has,
 * and it enforces exactly two rules — both irreversible at the step:
 * `schema-auditor` "never connects to a database", `atomic-commit` "emits
 * commands, does not run them".
 *
 * There is deliberately no rule about an agent leaving product code modified.
 * That hazard exists only because two sessions share one working tree, and a
 * worktree per session dissolves it — measured free on this machine, since
 * `.claude/worktrees/` sits inside the repo and Node resolves `node_modules`
 * upward from there. See
 * tasks/decisions/2026-08-31-worktrees-are-free-and-the-guard-was-the-wrong-layer.md
 *
 * The guard is invoked by Claude Code, not by this repo, so nothing else here
 * exercises it. A regression in the git allowlist or the tool allowlist would
 * be invisible until an agent quietly did the thing it promised not to.
 *
 * What this file does NOT establish: that Claude Code runs the hook. Frontmatter
 * hooks load from the definition as it stood at SESSION START, so a hook wired
 * mid-session never fires —
 * tasks/decisions/2026-08-31-agent-definitions-are-session-start-snapshots.md.
 * The liveness log is the only way to tell a working guard from a silent one.
 *
 * Background: tasks/decisions/2026-08-31-declared-tools-are-not-a-mechanism.md
 */

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const GUARD = join(ROOT, ".claude", "hooks", "agent-guard.mjs");

type ToolInput = { command?: string; file_path?: string };

function ask(
  agent: string | null,
  tool: string,
  toolInput: ToolInput,
  extraEnv: Record<string, string> = {},
): "ALLOW" | "DENY" {
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
    // indistinguishable from a real agent invocation, and the liveness signal
    // stops meaning anything.
    env: {
      ...process.env,
      MIDWIFE_ALLOW_IRREVERSIBLE: "",
      AGENT_GUARD_LOG: join(tmpdir(), "agent-guard-test.log"),
      AGENT_DRIFT_LOG: join(tmpdir(), "agent-drift-test.log"),
      ...extraEnv,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (!out.trim()) return "ALLOW";
  const decision = JSON.parse(out).hookSpecificOutput?.permissionDecision;
  return decision === "deny" ? "DENY" : "ALLOW";
}

const repoFile = (p: string) => join(ROOT, p);

/** The deny reason, not just the verdict — the message carries the override procedure. */
function denyReason(command: string): string {
  const out = execFileSync("node", [GUARD], {
    input: JSON.stringify({
      hook_event_name: "PreToolUse",
      cwd: ROOT,
      tool_name: "Bash",
      tool_input: { command },
    }),
    encoding: "utf8",
    env: { ...process.env, MIDWIFE_ALLOW_IRREVERSIBLE: "", AGENT_GUARD_LOG: join(tmpdir(), "agent-guard-test.log") },
  });
  return JSON.parse(out).hookSpecificOutput?.permissionDecisionReason ?? "";
}

/**
 * Drive a PostToolUse event with isolated drift log + state, and return the log lines.
 *
 * `cwd` defaults to this repo but is a parameter because the drift log reads
 * `git status --porcelain`: a test that asserts it recorded something is really
 * asserting that this tree is dirty, which is a property of whoever committed
 * last, not of the guard. The callers that need a delta pass a scratch repo.
 */
function driftAfter(tool: string, seedState: string | null, cwd: string = ROOT): string[] {
  const log = join(tmpdir(), `drift-${randomUUID()}.log`);
  const state = join(tmpdir(), `drift-${randomUUID()}.state`);
  if (seedState !== null) writeFileSync(state, seedState);
  execFileSync("node", [GUARD], {
    input: JSON.stringify({
      hook_event_name: "PostToolUse",
      cwd,
      tool_name: tool,
      tool_input: { command: "irrelevant" },
    }),
    encoding: "utf8",
    env: {
      ...process.env,
      AGENT_GUARD_LOG: join(tmpdir(), "agent-guard-test.log"),
      AGENT_DRIFT_LOG: log,
      AGENT_DRIFT_STATE: state,
    },
  });
  return existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").filter(Boolean) : [];
}

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

    it("denies every other execution path, not just the one named Bash", () => {
      // The premise of this guard is that a declared `tools:` list may not be
      // enforced. Naming one shell leaves the rest open to the production URL,
      // and this environment also exposes PowerShell.
      expect(ask("schema-auditor", "PowerShell", { command: "ls" })).toBe("DENY");
      expect(ask("schema-auditor", "BashOutput", {})).toBe("DENY");
      expect(ask("schema-auditor", "Write", { file_path: repoFile("prisma/schema.prisma") })).toBe("DENY");
      expect(ask("schema-auditor", "WebFetch", {})).toBe("DENY");
    });

    it("leaves the three tools it declares alone", () => {
      expect(ask("schema-auditor", "Read", { file_path: repoFile("prisma/schema.prisma") })).toBe("ALLOW");
      expect(ask("schema-auditor", "Grep", {})).toBe("ALLOW");
      expect(ask("schema-auditor", "Glob", {})).toBe("ALLOW");
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

    it("finds git wherever it appears, not only after a separator", () => {
      // Anchoring on separators let every one of these through, and each writes
      // the index that another session is using.
      expect(ask("atomic-commit", "Bash", { command: "for f in a b; do git add -- $f; done" })).toBe("DENY");
      expect(ask("atomic-commit", "Bash", { command: "if true; then git commit -m x; fi" })).toBe("DENY");
      expect(ask("atomic-commit", "Bash", { command: "env git commit -m x" })).toBe("DENY");
      expect(ask("atomic-commit", "Bash", { command: 'sh -c "git commit -m x"' })).toBe("DENY");
      expect(ask("atomic-commit", "Bash", { command: "ls | xargs git add" })).toBe("DENY");
      expect(ask("atomic-commit", "Bash", { command: "time git push" })).toBe("DENY");
    });

    it("denies the word git inside a string too, because failing closed is the point", () => {
      // The cost of this false positive is one confusing denial with a message
      // that says what to do. The cost of the false negative it replaces is a
      // commit in shared history.
      expect(ask("atomic-commit", "Bash", { command: 'echo "remember to git add"' })).toBe("DENY");
    });

    it("denies redirects into another checkout", () => {
      // triage-rules.md section 5 bans these outright; the guard does not try
      // to parse them.
      expect(ask("atomic-commit", "Bash", { command: "git -C /other status" })).toBe("DENY");
      expect(ask("atomic-commit", "Bash", { command: "GIT_DIR=/x git status" })).toBe("DENY");
    });

    it("does not read -C on a non-git command as a checkout redirect", () => {
      expect(ask("atomic-commit", "Bash", { command: "ls -C" })).toBe("ALLOW");
      expect(ask("atomic-commit", "Bash", { command: "sort -C file.txt" })).toBe("ALLOW");
      expect(ask("atomic-commit", "Bash", { command: "git diff | grep -C 3 foo" })).toBe("ALLOW");
    });

    it("is an allowlist, so an unrecognised subcommand is a write", () => {
      expect(ask("atomic-commit", "Bash", { command: "git some-new-plumbing-verb" })).toBe("DENY");
    });

    it("covers the other shell tool this environment exposes", () => {
      expect(ask("atomic-commit", "PowerShell", { command: "git commit -m x" })).toBe("DENY");
      expect(ask("atomic-commit", "PowerShell", { command: "git status" })).toBe("ALLOW");
    });
  });

  describe("no agent is stopped from writing product code", () => {
    // Deliberate, and it is the whole shape of this guard. Mutating product
    // code to watch a test fail is the only way to prove a test discriminates
    // against code that already works, and a step-level path rule blocked that
    // through Edit while permitting it through Bash. The thing it was reaching
    // for — an agent dirtying a tree a second session commits with `git add -A`
    // — is dissolved by a worktree per session, not by a hook.
    it("lets any agent edit product code, through any tool", () => {
      expect(ask("test-writer", "Write", { file_path: repoFile("src/lib/server/prisma.ts") })).toBe("ALLOW");
      expect(ask("test-writer", "Edit", { file_path: repoFile("prisma/env.ts") })).toBe("ALLOW");
      expect(ask("test-writer", "Bash", { command: "sed -i s/a/b/ prisma/env.ts" })).toBe("ALLOW");
      expect(ask("spike-runner", "Bash", { command: "cat > src/probe.ts <<EOF" })).toBe("ALLOW");
    });

    it("does not restrict the shell an agent needs to run the suite", () => {
      expect(ask("test-writer", "Bash", { command: "npm test" })).toBe("ALLOW");
      expect(ask("ui-critic", "Bash", { command: "npx vitest run" })).toBe("ALLOW");
      expect(ask("spike-runner", "Bash", { command: "npm test" })).toBe("ALLOW");
    });
  });

  describe("irreversible commands are refused for every actor", () => {
    // Derived from this repo's own incident log, not from a generic list. Each
    // entry destroys something with no undo: uncommitted work has no reflog,
    // there is no prisma/migrations directory so db push has no down path, and
    // .env.local points DATABASE_URL at the Neon production branch.
    // tasks/decisions/2026-09-05-guard-binds-the-main-conversation.md

    it("refuses the git operations that cannot be undone", () => {
      expect(ask(null, "Bash", { command: "git reset --hard HEAD~1" })).toBe("DENY");
      // Effect, not shape: this path is unmodified, so the command restores it to
      // itself and destroys nothing. The DENY direction is pinned against a scratch
      // repo below, because an assertion that only holds while this tree happens to
      // be dirty is not a test. 12 of 151 corpus denials were clean-path checkouts.
      expect(ask(null, "Bash", { command: "git checkout -- src/lib/email.ts" })).toBe("ALLOW");
      expect(ask(null, "Bash", { command: "git restore src/lib/email.ts" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "git clean -fd" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "git stash" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "git commit --amend -m x" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "git push --force origin master" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "git push --force-with-lease" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "git rebase master" })).toBe("DENY");
    });

    it("leaves ordinary git work alone, which is what stops reflex overriding", () => {
      // A guard that fires on routine work teaches the human to disable it.
      expect(ask(null, "Bash", { command: "git commit -m x" })).toBe("ALLOW");
      expect(ask(null, "Bash", { command: "git status --short" })).toBe("ALLOW");
      expect(ask(null, "Bash", { command: "git reset HEAD src/x.ts" })).toBe("ALLOW");
      expect(ask(null, "Bash", { command: "git add -- src/x.ts" })).toBe("ALLOW");
      expect(ask(null, "Bash", { command: "git stash list" })).toBe("ALLOW");
      expect(ask(null, "Bash", { command: "git rebase --abort" })).toBe("ALLOW");
      // Starting a rewrite is denied; finishing one a human already started is not,
      // because blocking it strands the repo mid-rebase.
      expect(ask(null, "Bash", { command: "git rebase --continue" })).toBe("ALLOW");
      expect(ask(null, "Bash", { command: "git rebase --skip" })).toBe("ALLOW");
      expect(ask(null, "Bash", { command: "git push origin master" })).toBe("ALLOW");
      expect(ask(null, "Bash", { command: "git clean -n" })).toBe("ALLOW");
    });

    it("tells a branch switch from a working-tree discard by asking the filesystem", () => {
      // `git checkout <branch>` and `git checkout <path>` are syntactically
      // identical. The discriminator is whether the argument names a real file.
      // Effect, not shape: this path is unmodified, so the command restores it to
      // itself and destroys nothing. The DENY direction is pinned against a scratch
      // repo below, because an assertion that only holds while this tree happens to
      // be dirty is not a test. 12 of 151 corpus denials were clean-path checkouts.
      expect(ask(null, "Bash", { command: "git checkout package.json" })).toBe("ALLOW");
      expect(ask(null, "Bash", { command: "git checkout master" })).toBe("ALLOW");
      expect(ask(null, "Bash", { command: "git checkout -b feature/x" })).toBe("ALLOW");
    });

    it("keys database writes on the connection, not on the verb", () => {
      // db:push:local contains "db:push" and is safe; db:push:unsafe is the
      // bare production call. Blocking the verb would deny the safe variants,
      // which is the false-positive trainer this design exists to avoid.
      expect(ask(null, "Bash", { command: "npm run db:push" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "npm run db:push:unsafe" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "npx prisma db push" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "npm run db:seed" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "npx prisma migrate reset" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "npx tsx prisma/seed.ts" })).toBe("DENY");
    });

    it("allows the three local escape hatches triage-rules.md section 1 names", () => {
      expect(ask(null, "Bash", { command: "npm run db:push:local" })).toBe("ALLOW");
      expect(ask(null, "Bash", { command: "npm run db:seed:local" })).toBe("ALLOW");
      expect(ask(null, "Bash", { command: "npm run test:db" })).toBe("ALLOW");
      expect(
        ask(null, "Bash", {
          command:
            'cross-env DATABASE_URL="postgresql://postgres:pw@localhost:5432/pet_shelter" prisma db push',
        }),
      ).toBe("ALLOW");
    });

    it("binds sub-agents too, because the verdict is about the act", () => {
      expect(ask("test-writer", "Bash", { command: "git reset --hard" })).toBe("DENY");
      expect(ask("ui-critic", "Bash", { command: "npm run db:seed" })).toBe("DENY");
      // ...without disturbing what they legitimately do.
      expect(ask("test-writer", "Bash", { command: "sed -i s/a/b/ prisma/env.ts" })).toBe("ALLOW");
      expect(ask("test-writer", "Bash", { command: "npm test" })).toBe("ALLOW");
    });

    it("covers every tool that runs a command line, not the one named Bash", () => {
      expect(ask(null, "PowerShell", { command: "git reset --hard" })).toBe("DENY");
      expect(ask(null, "Write", { file_path: repoFile("src/lib/email.ts") })).toBe("ALLOW");
    });

    it("fails closed on a git call it cannot parse or that is redirected away", () => {
      expect(ask(null, "Bash", { command: "git -C ../other reset --soft HEAD" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "GIT_DIR=/x git status" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "for f in a b; do git reset --hard; done" })).toBe("DENY");
      expect(ask(null, "Bash", { command: 'sh -c "git push --force"' })).toBe("DENY");
    });

    it("honours the environment override and refuses a repo-file one", () => {
      // The fenced party writes repo files, so the override cannot be one.
      // Shell state does not persist between tool calls, so an agent cannot
      // set this mid-session; it comes from whatever launched Claude Code.
      expect(
        ask(null, "Bash", { command: "git reset --hard" }, { MIDWIFE_ALLOW_IRREVERSIBLE: "1" }),
      ).toBe("ALLOW");
    });

    it("does not fire on command text quoted inside a heredoc body", () => {
      // This repo writes its ledger with \`cat > entry.md <<'EOF' ... EOF\`, so prose
      // quoting a destructive command is routine. The guard denied its own ledger
      // write before this case existed. A rule that fires on documentation gets
      // overridden by reflex and then uninstalled.
      const heredoc = [
        "cat >> tasks/open/note.md <<'EOF'",
        "shakedown: \`git checkout package.json\` was refused, DENY logged",
        "and \`npm run db:seed\` is denied off localhost",
        "EOF",
        "git status --short",
      ].join("\n");
      expect(ask(null, "Bash", { command: heredoc })).toBe("ALLOW");
    });

    it("still judges the command that opens the heredoc, and anything after it", () => {
      expect(
        ask(null, "Bash", { command: ["git reset --hard <<'EOF'", "text", "EOF"].join("\n") }),
      ).toBe("DENY");
      expect(
        ask(null, "Bash", { command: ["cat > f <<'EOF'", "prose", "EOF", "git clean -fd"].join("\n") }),
      ).toBe("DENY");
    });
  });

  describe("holes an adversarial probe found after the suite was already green", () => {
    // Every case here passed review and 25 green tests before being probed. The tests
    // had been written from the same model of the problem as the code, so they covered
    // the cases the code was designed for and none of the cases it was wrong about.

    it("treats any short flag cluster containing f as a clean --force", () => {
      // Enumerating -f/-fd/-df/-fdx missed the rest of the combinations.
      expect(ask(null, "Bash", { command: "git clean -xdf" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "git clean -ffd" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "git clean -n" })).toBe("ALLOW");
    });

    it("denies reset --merge and --keep, which discard like --hard", () => {
      expect(ask(null, "Bash", { command: "git reset --merge" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "git reset --keep" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "git reset --soft HEAD~1" })).toBe("ALLOW");
    });

    it("tells a remote-ref delete from an ordinary refspec push", () => {
      // Matching any colon denied master:master, a normal push. A false positive
      // trains the override, and the override is how this guard gets uninstalled.
      expect(ask(null, "Bash", { command: "git push origin master:master" })).toBe("ALLOW");
      expect(ask(null, "Bash", { command: "git push origin :feature/x" })).toBe("DENY");
    });

    it("does not let a quoted heredoc marker swallow the commands after it", () => {
      // The heredoc-stripping fix for a FALSE POSITIVE had opened a fail-OPEN bypass:
      // \`echo "<<EOF"\` began a body that consumed every later line. A heredoc only
      // exists if its terminator actually appears.
      expect(
        ask(null, "Bash", { command: ['echo "<<EOF"', "git reset --hard"].join("\n") }),
      ).toBe("DENY");
      // ...and a real heredoc still shields its body.
      expect(
        ask(null, "Bash", { command: ["cat > f <<'EOF'", "git reset --hard", "EOF"].join("\n") }),
      ).toBe("ALLOW");
    });

    it("does not read a herestring as a heredoc opener, and shields its payload", () => {
      expect(ask(null, "Bash", { command: 'cat <<<"see git reset --hard"' })).toBe("ALLOW");
    });

    it("evaluates the localhost proof per segment, not per command line", () => {
      // The bypass: a proof anywhere in the string exempted the whole string, so a
      // production seed rode along behind a local one. Same defect shape as a scope
      // check evaluated over a union instead of the node that asked.
      expect(ask(null, "Bash", { command: "npm run db:seed:local && npm run db:seed" })).toBe("DENY");
      expect(
        ask(null, "Bash", {
          command:
            'DATABASE_URL="postgresql://x@localhost:5432/d" tsx a.ts && npx prisma db push',
        }),
      ).toBe("DENY");
      // A single segment that really is local still passes.
      expect(
        ask(null, "Bash", {
          command: 'cross-env DATABASE_URL="postgresql://x@localhost:5432/d" prisma db push',
        }),
      ).toBe("ALLOW");
    });

    it("names the override procedure in the denial, since that is the whole message", () => {
      const reason = denyReason("git reset --hard");
      expect(reason).toContain("MIDWIFE_ALLOW_IRREVERSIBLE");
      expect(reason).toContain("HUMAN");
      expect(reason).toContain("db:push:local");
    });

    it("does not treat 0/false/off as an override", () => {
      for (const value of ["0", "false", "off", ""]) {
        expect(
          ask(null, "Bash", { command: "git reset --hard" }, { MIDWIFE_ALLOW_IRREVERSIBLE: value }),
        ).toBe("DENY");
      }
      expect(
        ask(null, "Bash", { command: "git reset --hard" }, { MIDWIFE_ALLOW_IRREVERSIBLE: "1" }),
      ).toBe("ALLOW");
    });
  });

  describe("the drift log observes the tree, not the tool input", () => {
    // Reading tool_input.file_path recorded 1 of 6 files actually written in the session
    // that built this guard, because auto mode steers file changes to \`cat >\` and
    // \`sed -i\`. That is the identical blind spot that got the step-level path rule
    // deleted on 2026-08-31. A matcher on tool names cannot see a heredoc; git status can.

    // Both assertions below need a tree with uncommitted work, so they make one rather
    // than borrowing this one. Reading ROOT, they passed only until the working tree was
    // committed — the same live-tree coupling the checkout tests were moved out of, in
    // the opposite direction. A test whose verdict flips on `git commit` is not a test.
    let dirty: string;

    beforeAll(() => {
      dirty = mkdtempSync(join(tmpdir(), "guard-drift-"));
      const git = (...args: string[]) =>
        execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], {
          cwd: dirty,
          stdio: "ignore",
        });
      git("init", "-q");
      writeFileSync(join(dirty, "tracked.txt"), "committed\n");
      git("add", "-A");
      git("commit", "-qm", "base");
      // One modification and one untracked file: the two shapes `git status --porcelain`
      // reports and a tool-name matcher would miss if they arrived via `cat >`.
      writeFileSync(join(dirty, "tracked.txt"), "written through a heredoc\n");
      writeFileSync(join(dirty, "untracked.txt"), "written through a heredoc\n");
    });

    it("records files written through Bash, which no tool-name matcher can see", () => {
      // Seeded with an empty baseline, so every dirty path reads as a delta.
      const lines = driftAfter("Bash", "", dirty);
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.every((l) => l.includes(" main Bash "))).toBe(true);
      expect(lines.some((l) => l.endsWith("tracked.txt"))).toBe(true);
      expect(lines.some((l) => l.endsWith("untracked.txt"))).toBe(true);
    });

    it("attributes nothing on its first call, because the tree was already dirty", () => {
      // No state file: establish the baseline and credit this tool with nothing. Logging
      // a pre-existing diff would attribute another session's work to this tool call.
      // Run against the dirty scratch repo, so there is something it could have wrongly
      // attributed — against a clean tree this assertion would hold vacuously.
      expect(driftAfter("Bash", null, dirty)).toEqual([]);
    });

    it("never denies, whatever it sees", () => {
      expect(
        ask(null, "Write", { file_path: repoFile("src/lib/email.ts") }),
      ).toBe("ALLOW");
    });
  });

  describe("holes an independent review found after the probe suite was also green", () => {
    // Round two. The first adversarial probe was written by whoever wrote the code, so it
    // attacked the cases that author had thought about. These came from a reviewer given
    // the diff and not the reasoning — the information-asymmetry argument, applied.

    it("finds the subcommand past git's global options and their operands", () => {
      // \`git -c core.pager=cat reset --hard\` resolved sub to "core.pager=cat", fell
      // through to default:, and was ALLOWED. A blocklist that cannot find the verb is
      // not a blocklist.
      expect(ask(null, "Bash", { command: "git -c core.pager=cat reset --hard HEAD" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "git -c x=y clean -fd" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "git --no-pager log --oneline" })).toBe("ALLOW");
    });

    it("catches the force-push spellings that are not the word --force", () => {
      expect(ask(null, "Bash", { command: "git push origin +master:master" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "git push --force-with-lease=master" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "git push --mirror" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "git push -fu origin master" })).toBe("DENY");
    });

    it("denies git switch, which discards exactly like the checkout forms", () => {
      expect(ask(null, "Bash", { command: "git switch --discard-changes" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "git switch -f main" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "git switch main" })).toBe("ALLOW");
    });

    it("does not read a new branch name as a path to be discarded", () => {
      // \`-b docs\` was denied because docs/ exists. The operand of -b is a NAME.
      expect(ask(null, "Bash", { command: "git checkout -b docs" })).toBe("ALLOW");
      expect(ask(null, "Bash", { command: "git checkout -b tests" })).toBe("ALLOW");
      // ...but a bare existing path is still read as a path, not a branch name. That
      // direction is pinned in the scratch-repo block below ("allows a discard that
      // would lose nothing"), not here. It read `git checkout docs` against this tree,
      // whose verdict flips the moment anything untracked lands under docs/ — which is
      // what a shared tree does, and it did. An assertion that only holds while this
      // tree happens to be CLEAN is no more a test than one that needs it dirty.
    });

    it("reads the stash subform after the subcommand, not at a fixed index", () => {
      expect(ask(null, "Bash", { command: "git --no-pager stash list" })).toBe("ALLOW");
      expect(ask(null, "Bash", { command: "git stash list" })).toBe("ALLOW");
      expect(ask(null, "Bash", { command: "git stash push -m x" })).toBe("DENY");
    });

    it("treats a single & as a segment separator, like ; and &&", () => {
      expect(ask(null, "Bash", { command: "npm run db:seed:local & npm run db:seed" })).toBe("DENY");
    });

    it("does not shield a heredoc body that is piped into an interpreter", () => {
      // \`bash <<EOF ... EOF\` EXECUTES its body. Stripping it hid the commands entirely,
      // so the false-positive fix had become a general-purpose bypass.
      expect(
        ask(null, "Bash", { command: ["bash <<EOF", "git reset --hard", "EOF"].join("\n") }),
      ).toBe("DENY");
      expect(
        ask(null, "Bash", { command: ["sh -s <<'EOF'", "git clean -fd", "EOF"].join("\n") }),
      ).toBe("DENY");
      // ...while a body written to a file is still data.
      expect(
        ask(null, "Bash", { command: ["cat > f.md <<'EOF'", "git reset --hard", "EOF"].join("\n") }),
      ).toBe("ALLOW");
    });

    it("does not read False or NO as an instruction to disable the guard", () => {
      // Setting the variable to a falsey-looking word to turn the override OFF would
      // have turned the GUARD off instead, permanently and silently.
      for (const value of ["False", "NO", "Off", " 0 "]) {
        expect(
          ask(null, "Bash", { command: "git reset --hard" }, { MIDWIFE_ALLOW_IRREVERSIBLE: value }),
        ).toBe("DENY");
      }
    });

    it("exempts a local script only as a whole token", () => {
      // Substring matching exempted any segment merely containing the name.
      expect(ask(null, "Bash", { command: "npm run db:seed -- --note test:db" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "npm run test:db" })).toBe("ALLOW");
    });
  });


  describe("checkout is judged by what it would destroy, not by its shape", () => {
    // Runs against a scratch repo, not this one: the verdict now depends on the working
    // tree, and RISK VETO section 5 forbids dirtying a tree a second session shares.
    // It also exercises ROOT resolving from the payload's cwd rather than process.cwd().
    let repo: string;

    beforeAll(() => {
      repo = mkdtempSync(join(tmpdir(), "guard-scratch-"));
      const git = (...args: string[]) =>
        execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], {
          cwd: repo,
          stdio: "ignore",
        });
      git("init", "-q");
      writeFileSync(join(repo, "clean.txt"), "committed\n");
      writeFileSync(join(repo, "dirty.txt"), "committed\n");
      git("add", "-A");
      git("commit", "-qm", "base");
      writeFileSync(join(repo, "dirty.txt"), "uncommitted edit\n");
    });

    const askIn = (command: string) => {
      const out = execFileSync("node", [GUARD], {
        input: JSON.stringify({
          hook_event_name: "PreToolUse",
          cwd: repo,
          tool_name: "Bash",
          tool_input: { command },
        }),
        encoding: "utf8",
        env: {
          ...process.env,
          MIDWIFE_ALLOW_IRREVERSIBLE: "",
          AGENT_GUARD_LOG: join(tmpdir(), "agent-guard-test.log"),
        },
      });
      return out.trim() ? "DENY" : "ALLOW";
    };

    it("denies a discard that would lose uncommitted work", () => {
      expect(askIn("git checkout -- dirty.txt")).toBe("DENY");
      expect(askIn("git checkout dirty.txt")).toBe("DENY");
    });

    it("allows a discard that would lose nothing", () => {
      expect(askIn("git checkout -- clean.txt")).toBe("ALLOW");
      expect(askIn("git checkout HEAD -- clean.txt")).toBe("ALLOW");
      // The bare form, with no `--`: still resolved as a path rather than a branch
      // name, still allowed when that path is clean. Here rather than against the live
      // tree, whose cleanliness a second session controls.
      expect(askIn("git checkout clean.txt")).toBe("ALLOW");
    });

    it("fails closed when it cannot tell what would be lost", () => {
      expect(askIn("git checkout --")).toBe("DENY");
    });
  });

  describe("the mechanism this repo recommends is not treated as an escape", () => {
    // 21 of 151 corpus denials were git redirected into .claude/worktrees/, and 6 more
    // were removing one. triage-rules.md section 5 bans redirects outright and predates
    // the 2026-08-31 decision that a worktree per session is the answer to shared-tree
    // hazards. Banning the recommended mechanism is how a guard gets overridden.

    it("allows git redirected into this repo's own worktrees", () => {
      expect(ask(null, "Bash", { command: "git -C .claude/worktrees/wt status --porcelain" })).toBe(
        "ALLOW",
      );
    });

    it("still denies a redirect anywhere else", () => {
      expect(ask(null, "Bash", { command: "git -C /other status" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "git -C ../sibling status" })).toBe("DENY");
    });
  });

  describe("a database hazard requires something that runs it", () => {
    // The largest corpus class: 46 of 151 denials were the PATH prisma/seed.ts appearing
    // in a diff, an add, or a sed range. isMention() could not catch them because git and
    // sed are not readers; the missing test was "is anything executing this".

    it("does not deny naming a seed or migration file", () => {
      expect(ask(null, "Bash", { command: "git diff 9799dfe...HEAD -- prisma/seed.ts" })).toBe("ALLOW");
      expect(ask(null, "Bash", { command: "git add prisma/schema.prisma prisma/seed.ts" })).toBe("ALLOW");
      expect(ask(null, "Bash", { command: "sed -n '60,120p' prisma/seed.ts" })).toBe("ALLOW");
    });

    it("still denies actually running one", () => {
      expect(ask(null, "Bash", { command: "npx tsx prisma/seed.ts" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "npm run db:seed" })).toBe("DENY");
    });
  });

  describe("a reader cannot run anything, whatever its arguments look like", () => {
    // segments() splits on shell metacharacters without respecting quoting, so a grep
    // whose PATTERN contained an escaped pipe fragmented into a segment whose command
    // word was git — and a grep for this very file was denied, twice, during the session
    // that wrote it. The reader skip now applies to the whole command first.

    it("does not deny a grep whose pattern contains commands and an escaped pipe", () => {
      expect(
        ask(null, "Bash", {
          command: "grep -n 'git checkout package.json\\|git reset --hard' tests/unit/x.test.ts",
        }),
      ).toBe("ALLOW");
    });

    it("still denies command substitution inside a reader", () => {
      expect(ask(null, "Bash", { command: 'grep "$(git reset --hard)" f' })).toBe("DENY");
    });
  });

  describe("the wiring, which no unit test can exercise by invoking the hook", () => {
    // A hook that enforces nothing still produces confidence, so the capability is
    // asserted where it lives — the config — not in the module.
    //
    // The PreToolUse fence this file used to guard is GONE. It parsed shell command
    // strings with regexes, was hardened five times (8, then 12, then 14 defects per
    // independent pass, a rate that never fell), blocked its own disarm script, and
    // denied 151 of 5,028 real commands. It is replaced by first-party permission rules
    // and autoMode entries, which is what these tests now pin.
    // tasks/decisions/2026-09-05-first-party-permissions-replace-the-hand-rolled-fence.md
    const settings = JSON.parse(readFileSync(join(ROOT, ".claude", "settings.json"), "utf8"));
    const SHELLS = ["Bash", "PowerShell", "BashOutput", "KillShell"];

    it("no longer wires a PreToolUse shell parser", () => {
      expect(settings.hooks.PreToolUse).toBeUndefined();
    });

    it("denies the production database writes outright, and not their local variants", () => {
      const deny = settings.permissions.deny.join("\n");
      for (const rule of ["npm run db:seed", "npx prisma db push", "npx prisma migrate"]) {
        expect(deny).toContain(rule);
      }
      // Exact-match entries, so the three :local escapes in triage-rules.md section 1
      // are not swept up. A wildcard here would be the false-positive trainer the
      // hand-rolled version needed four rounds to stop being.
      expect(deny).not.toContain("npm run db:push:local");
      expect(deny).not.toContain("npm run db:seed:local");
      expect(deny).not.toContain("Bash(npm run db:push*)");
    });

    it("asks rather than denies for the judgment calls, so the override is in band", () => {
      // The mechanism this replaced could only be overridden by relaunching Claude Code
      // with an environment variable — which an agent cannot request and a human had to
      // restart for.
      const ask = settings.permissions.ask.join("\n");
      for (const rule of ["git reset --hard", "git stash", "git rebase", "rm -rf"]) {
        expect(ask).toContain(rule);
      }
    });

    it("leaves the auto-mode profile to the user settings, which own it", () => {
      // A project `autoMode` block was added here on the belief that no profile existed.
      // One does: ~/.claude/settings.json carries 23 `environment` and 3 `soft_deny`
      // entries, including this repo's visibility and a PDPA data-location entry.
      // Array-valued settings are replaced by the highest-precedence source rather than
      // merged — the `$defaults` sentinel re-inherits built-ins and there is no `$user`
      // equivalent, which is the tell — so a block here discards all 23 for this repo.
      // Removed by the human 2026-09-05; this pins it staying removed.
      // tasks/decisions/2026-09-05-first-party-permissions-replace-the-hand-rolled-fence.md
      expect(settings.autoMode).toBeUndefined();
    });

    // ================= what prefix matching does not reach =================
    // `permissions` rules match from the START of the command string, so every rule
    // here is defeated by putting something in front of the verb. That was recorded as
    // prose ("what is honestly worse now") and never enumerated, which is how a known
    // gap becomes a forgotten one.
    //
    // The corpus below is lifted from the evasion suite of ECC's GateGuard
    // (github.com/affaan-m/ecc, MIT, Copyright (c) 2026 Affaan Mustafa) — 174 adversarial
    // cases, six of them regression tests for GHSA-4v57-ph3x-gf55 — plus the three
    // bypasses its own 2,876-line test file does NOT cover, found by reading the source:
    // `sudo`, an env-var prefix, and `xargs`. Both projects anchor on the first token,
    // so both lose to the same trick; theirs took a CVE to find, ours is measured here
    // before it costs anything.
    //
    // This is a LEDGER, not a fence. Nothing here is enforced. If a shape becomes
    // covered, move it to COVERED and say what covers it — an entry silently changing
    // sides is the regression this exists to catch.
    const matchesRule = (rule: string, command: string): boolean => {
      const body = rule.replace(/^Bash\(/, "").replace(/\)$/, "");
      return body.endsWith("*") ? command.startsWith(body.slice(0, -1)) : command === body;
    };
    const covered = (command: string): boolean =>
      [...settings.permissions.deny, ...settings.permissions.ask]
        .filter(r => r.startsWith("Bash("))
        .some(r => matchesRule(r, command));

    it("catches the destructive commands only when they lead the string", () => {
      // The rules work. This is the control for the test below it.
      for (const command of [
        "git reset --hard HEAD~1",
        "git clean -fd",
        "git stash push -m x",
        "rm -rf build",
        "npx prisma db push",
      ]) {
        expect(covered(command), `expected covered: ${command}`).toBe(true);
      }
    });

    it("does not catch any of them behind a prefix, which is the whole gap", () => {
      const UNCOVERED = [
        // Segment separators: the rule never sees the second command.
        "cd src && git reset --hard",
        "true; git clean -fd",
        "true & rm -rf build",
        "echo x | xargs rm -rf",
        // Env-var and privilege prefixes. ECC misses these too — `sudo` and `xargs`
        // appear 0 times in its source AND 0 times in its 174-case suite.
        "FOO=1 rm -rf build",
        "sudo rm -rf build",
        "env rm -rf build",
        // Command substitution and shell wrappers (GHSA-4v57-ph3x-gf55 shapes).
        "sh -c 'git reset --hard'",
        "bash -c \"rm -rf build\"",
        "$(git reset --hard)",
        // Quoted command word, and a leading git option before the subcommand.
        "'rm' -rf build",
        "git -c core.pager=cat reset --hard",
      ];
      for (const command of UNCOVERED) {
        expect(covered(command), `newly covered, move it: ${command}`).toBe(false);
      }
    });

    it("logs drift after shell writes, not only after Edit and Write", () => {
      // auto mode steers file changes to \`cat >\` and \`sed -i\`; a matcher that omits
      // the shells records a fraction of what is written. Measured: 1 file of 6.
      const matcher = settings.hooks.PostToolUse[0].matcher;
      for (const tool of [...SHELLS, "Edit", "Write", "NotebookEdit"]) {
        expect(matcher).toContain(tool);
      }
      expect(settings.hooks.PostToolUse[0].hooks[0].command).toContain("agent-guard.mjs");
    });
  });

  describe("holes a third review pass found, after two probe suites were green", () => {
    // Round three. Rounds one and two each found roughly ten defects and each was blind
    // to the next ten. The rate did not fall, which is the finding that matters: a
    // blocklist over free-form shell text has an unbounded defect surface.
    // tasks/decisions/2026-09-05-guard-binds-the-main-conversation.md

    it("treats an unrecognised override value as OFF, because the allowlist is the point", () => {
      // It had been a blocklist of falsy words, so \`disabled\` — or a typo — switched the
      // whole fence off silently.
      for (const value of ["disabled", "please", "1 ", "TRUE"]) {
        const verdict = ask(null, "Bash", { command: "git reset --hard" }, { MIDWIFE_ALLOW_IRREVERSIBLE: value });
        expect(verdict).toBe(["1 ", "TRUE"].includes(value) ? "ALLOW" : "DENY");
      }
    });

    it("denies checkout --force, which the switch case already denied", () => {
      expect(ask(null, "Bash", { command: "git checkout -f main" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "git checkout --force main" })).toBe("DENY");
    });

    it("reads localhost at the host position, not anywhere in the URL", () => {
      // A production host with a database NAMED localhost was exempted.
      expect(
        ask(null, "Bash", {
          command: 'DATABASE_URL="postgresql://u:p@ep-cool.neon.tech/localhost" npx prisma db push',
        }),
      ).toBe("DENY");
      expect(
        ask(null, "Bash", {
          command: 'DATABASE_URL="postgresql://u:p@localhost:5432/pet_shelter" npx prisma db push',
        }),
      ).toBe("ALLOW");
    });

    it("sees an interpreter reached by path", () => {
      expect(
        ask(null, "Bash", { command: ["/bin/bash <<EOF", "git reset --hard", "EOF"].join("\n") }),
      ).toBe("DENY");
    });

    it("covers the faq migration script, which applies DDL under another name", () => {
      expect(ask(null, "Bash", { command: "npm run db:migrate:faqs" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "npx tsx scripts/migrate-faqs.ts" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "npm run db:studio" })).toBe("ALLOW");
    });

    it("does not deny a command that merely mentions a dangerous string", () => {
      // This fired against a reviewer's own grep — the false-positive trainer the design
      // exists to avoid, binding every session.
      expect(ask(null, "Bash", { command: 'grep -rn "db:seed" package.json' })).toBe("ALLOW");
      expect(ask(null, "Bash", { command: "cat note.md | grep 'git reset --hard'" })).toBe("ALLOW");
      // ...but command substitution reads nothing and runs everything.
      expect(ask(null, "Bash", { command: 'grep "$(git reset --hard)" f' })).toBe("DENY");
    });

    it("denies a recursive force-delete inside the repo, which clean -fd already covered", () => {
      // Left off the list for lack of an incident, and restored on the consistency
      // argument: git clean -fd deletes strictly less than rm -rf src and was denied.
      expect(ask(null, "Bash", { command: "rm -rf src" })).toBe("DENY");
      expect(ask(null, "PowerShell", { command: "Remove-Item -Recurse -Force src" })).toBe("DENY");
      // Build output stays open; denying this trains the override.
      expect(ask(null, "Bash", { command: "rm -rf node_modules" })).toBe("ALLOW");
      expect(ask(null, "Bash", { command: "rm -rf .next" })).toBe("ALLOW");
    });

    it("does not deny dry runs or unstaging", () => {
      expect(ask(null, "Bash", { command: "git clean -nfd" })).toBe("ALLOW");
      // Denying the modern spelling of an act the suite explicitly allows in its older
      // spelling (git reset HEAD <path>) is incoherent.
      expect(ask(null, "Bash", { command: "git restore --staged src/x.ts" })).toBe("ALLOW");
      expect(ask(null, "Bash", { command: "git restore src/x.ts" })).toBe("DENY");
    });

    it("covers the ref-destroying commands that are not reset or push", () => {
      expect(ask(null, "Bash", { command: "git branch -D feature/x" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "git worktree remove --force wt" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "git update-ref -d refs/heads/x" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "git reflog expire --expire=now --all" })).toBe("DENY");
      expect(ask(null, "Bash", { command: "git filter-repo --path x" })).toBe("DENY");
      // -d refuses when it would lose work, so it needs no rule.
      expect(ask(null, "Bash", { command: "git branch -d merged" })).toBe("ALLOW");
    });
  });
});
