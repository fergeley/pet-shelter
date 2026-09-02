# Session worktrees cost nothing here. The end-state guard is deleted; T2 is the fix.

**Decided:** 2026-08-31 · MEASURED

Kill conditions KC-A/KC-B/KC-C were registered in `tasks/open/CLAIM-t2-worktree-viability.md` before
any measurement and are quoted below with their outcomes; the CLAIM was deleted at close per
`tasks/README.md`. **None of the three fired.** KC-A named the condition under which T2 would be
unavailable — a worktree that cannot run the suite at a cost a session would pay — and the probe
showed the opposite. T2 SURVIVED; what died is the premise that had been blocking it.

**Companion to `2026-08-31-step-rule-deleted-nothing-replaces-it.md`**, which carries the half of
this work that shipped. Neither entry was ever committed describing the `SubagentStop` mechanism —
it was built and removed inside one session, so there is no superseded entry to leave standing, and
this is the only record that it existed. **Falsifies reason 3 of `2026-08-31-worktree-isolation-for-spike-runner-died.md`.**

## The premise that was never measured

That entry killed worktrees on this:

> A worktree is a fresh checkout and carries no gitignored files. `node_modules` is gitignored and
> is **987 MB**. So `npm test`, `npx vitest` and every existing verification are unavailable inside
> it — rungs 1 and 2 of the falsification ladder, which is most of what a spike does.

**Measured false.** The reasoning is sound and the conclusion does not follow, because
`.claude/worktrees/` sits **inside** the repository, and Node resolves `node_modules` by walking
*up* the directory tree.

    $ git worktree add .claude/worktrees/t2-probe --detach
    real    0m0.684s

    $ cd .claude/worktrees/t2-probe && ls node_modules
    (absent)

    $ node -e "console.log(require.resolve('vitest/package.json'))"
    C:\Users\User\pet-shelter\node_modules\vitest\package.json

    $ npm test
    Test Files  50 passed (50)
         Tests  664 passed (664)
      Duration  10.40s

**Would have shown instead, if false:** `Cannot find module 'vitest'`, or an `npm test` that exits
before running a file. The 987 MB figure was never wrong; the inference from it was. Nobody ran the
command.

## The other two kill conditions

**KC-B — secrets did not follow.** `.env`, `.env.local`, `.env.production` and `obsidian-api.http`
are all **absent** in the worktree. `TARGET_MIDWIFE_ADOPTION.md` T3 calls that a feature and it
holds: a worktree cannot reach the Neon production branch, so RISK VETO §1 is structurally
unreachable there. `node_modules` being shared does not leak them — dotenv resolves from cwd.

**KC-C — the main checkout was not perturbed.** Fingerprinted before and after; `HEAD`, the branch,
`git status --porcelain -uall` and `.git/index` all hash identically:

    5aa58d8d9d95dd10217160c2cb152f1e   status, before and after
    b18928a64e3799d45c6a8c3244aab46e   .git/index, before and after

Creating and destroying a worktree is safe to do while the concurrent session is live, which is
exactly when T2 is supposed to help.

## What follows, and what was deleted

The `SubagentStop` guard existed to mitigate one hazard: an agent dirties the working tree, and the
*other* session sweeps it into history with `git add -A`. **A worktree per session removes the other
session from the tree.** There is nothing left to mitigate — the agent's mess lands in an isolated
checkout its own human can see with `git status`, and no one else commits it.

So the mechanism was the wrong layer, and this repo had already said so about the identical
mistake one layer down:

> The incident `triage-rules.md` records … was caused by a **session**, not by an agent. The fix for
> it is T2, session-level worktrees. Applying per-agent isolation to it was solving the right
> problem at the wrong layer.
> — `2026-08-31-worktree-isolation-for-spike-runner-died.md`

That paragraph was quoted while building agent-level enforcement for the same session-level hazard.

**Deleted:** the `SubagentStop` branch, the baseline/snapshot machinery, `WRITE_SCOPE`, the
`SENSITIVE` list, the `Stop:` wiring on five agents, and 16 end-state tests. The guard goes from 335
lines back to 134, and `agentGuard.test.ts` from 430 to 176. The unit suite drops from 13.6s to
10.9s — that one file was 8.5s of it, for a mechanism that shipped switched off.

**Kept, because they are live defects in code that is enforcing right now** — all three found by
`/code-review high`, all three inherited from the guard committed at `289be86`, none of them
introduced by the deleted work:

1. `gitWrites` matched `git` only after a command separator, so `for f in a b; do git add -- $f;
   done`, `env git commit`, `sh -c "git commit"`, `xargs git add` and `time git push` all returned
   ALLOW — against an index another session is using. Now matched at any word boundary.
2. `schema-auditor`'s fence named `Bash`, and this environment also exposes **PowerShell** — an
   unguarded path to the production connection string. Replaced with an allowlist of the three
   tools it declares.
3. The redirect regex denied `ls -C`, `sort -C file` and `grep -C 3 foo` as checkout redirects. The
   flag is now read only inside a git invocation.

Each was checked against the committed guard to confirm the new test discriminates: ALLOW→DENY for
1 and 2, DENY→ALLOW for 3.

**Also changed:** hooks are now wired to `schema-auditor` and `atomic-commit` only. The other three
agents have no rule, so they get no hook rather than a hook that always allows — a wiring that
enforces nothing still produces confidence, which is the failure this repo keeps rediscovering.
The two that remain are matcherless on purpose: which tools matter is decided in the guard, and
repeating that list as a frontmatter matcher regex is the same list in two files.

**Closed and deleted from `tasks/open/`**, per the `tasks/README.md` contract that a settled
item is removed rather than annotated: `agent-guard-has-no-bash-write-path.md` — the blind spot was
real, and the answer is that the guard no longer claims to cover it; and
`subagent-stop-hook-never-observed.md`, whose subject no longer exists. The `CLAIM-` files for both
this task and the guard are deleted at close, their outcomes recorded here and in
`2026-08-31-agent-definitions-are-session-start-snapshots.md`.

## What T2 now needs, and the one operational catch

Nothing is blocking it. `.claude/worktrees/` is gitignored (2026-08-30), `worktree.baseRef: "head"`
is set in `.claude/settings.json`, creation takes 0.68s and costs no disk.

**The catch, measured:** a worktree carries **committed state only**. The probe ran 664 tests, not
the 682 in this working tree, because today's work is uncommitted. A session that starts in a
worktree does not see another session's in-flight edits — which is the entire point, and also means
work must be committed to travel between them.

## Reverse this if

`claude --worktree` turns out to place worktrees somewhere **outside** the repository. Every
measurement above depends on upward `node_modules` resolution, and a worktree in a temp directory
resolves nothing. The 2026-08-30 gitignore entry exists because worktree contents appeared as
untracked files in the main checkout, which is evidence the harness does put them inside — but that
is inference from a symptom, not a reading of the flag's behaviour, and it is the first thing to
check in the next session.
