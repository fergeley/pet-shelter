# A claim in a worktree is invisible to every other worktree

**Learned:** 2026-09-11

On 2026-09-08 two sessions built the same feature — the coordinator screen that makes
`reconcilePetSponsorshipAction` reachable — and committed it **three minutes apart**: `6fd1435` at
23:43:50 +08:00 on `worktree-donations-lhdn-reconciliation`, and `5fa9a40` at 23:47:01 on
`feature/agent-7-sponsorship`. Both added a ledger function named `listPendingSponsorships`.
Neither knew. The second found out three days later, at close-out, from a `git merge-tree` dry run
against `origin/master` — by which time PR #36 had merged the first.

Both sessions followed the protocol. `tasks/README.md` says a GRAVE task writes
`open/CLAIM-<task>.md`, and that "reading `open/` at session start therefore shows what every other
session is working on". This one read `open/`, found no claim, and wrote its own. But each session
was in its own worktree, and a claim lives in the tree that wrote it. `git log --all --
'tasks/open/CLAIM-*'` is empty on every branch: no claim in this repository has ever been pushed,
so none has ever been visible to another session. Worktree isolation — which the midwife skill
prefers, correctly, because it makes file collisions impossible — silently disables the one
mechanism meant to prevent *work* collisions.

The cost was not only the duplicate. Git reported `sponsorshipLedger.ts` as merging cleanly, and
the merged file declares `listPendingSponsorships` twice: a typecheck failure hiding behind a
textual "no conflict", in a pull request that would get no CI run anyway because two other files
do conflict.

**The check that looks like it would have caught this, and would not have.** The first draft of
this lesson prescribed `git grep -l "listPendingSponsorships" origin/master` before building, and
called it the check that would have caught the duplicate — because run on 2026-09-11 it lists three
files. It was verified only on the day it was written. `git log --merges --ancestry-path` shows
`6fd1435` reached `master` through PR #36 at 2026-09-11 00:41, **three days after** both commits.
On 2026-09-08 that grep returns nothing. A cross-branch grep could have found it only if the other
session had pushed within those three minutes, which nothing in the history can show.

**Rule:** no git command inside a session can see work another session has not pushed. So:

- **Overlap is the dispatcher's check, not the session's.** Two briefs in flight at once — here a
  numbered "Agent 7" sponsorship brief and a donations-reconciliation session — both named the
  same screen. Compare the *outcomes* each brief names before dispatching, not only the files each
  may write: a brief's file list says where a session may type, not what it will build.
- **Inside a session, search every pushed branch, not `master`, at start and before the first
  commit.** It catches what has been pushed and nothing else, and should be reported that way:
  `git fetch origin`, then `git grep -l "<name you are about to add>"` across the refs
  `git branch -r` lists.
- **Dry-run the merge before calling a branch done:** `git merge-tree --write-tree origin/master
  HEAD`. It is what found this, and it is the only one of these that works after the fact.

When two implementations do collide, see
`2026-09-03-when-a-branch-is-overtaken-shrink-it-do-not-integrate-faster` — take theirs, and ship
only the half nobody else built. Distinct from
`2026-09-14-a-worktree-cut-from-head-starts-behind-origin`, which is about work that had *already*
merged before a session began; this is about work that had not merged yet.
