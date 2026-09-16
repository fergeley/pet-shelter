# The drift log credits every file a merge brings in to the session that ran the merge

**Status:** open · opened 2026-09-11 · measured closing out `worktree-agent-4-animals`

`tasks/decisions/2026-09-09-drift-log-carries-the-session-id.md` made the log filterable, so a
session can isolate its own writes at close. It does not consider what a *merge* looks like to the
hook, and a session that merges master is precisely the one that most needs the filter to work.

The hook stamps whatever changed after a tool call with the id of the session that made the call.
`git merge origin/master` is one tool call that changes every file master touched. Measured on
2026-09-11, after merging an 11-commit master into this branch:

    logged under this session's id:             201 distinct paths
    changed on the branch since its base:       167 of them
    differing from master after the merge:       28   (git diff --name-only origin/master HEAD)
    written, then deleted before commit:         34   (absent from disk; see below)

So of 201 paths the filter attributes to this session, 28 are what it actually contributes and
34 are its own scratch that never shipped. The other 139 arrived with the merge.

Among the paths credited to this session were `src/actions/auth.ts`, `src/lib/security/dal.ts`,
`src/lib/security/clientAddress.ts`, `.claude/hooks/agent-guard.mjs` and six
`tasks/decisions/2026-09-08-*` entries — security code and ledger records this session never
opened. The filtered log is therefore *correct about what changed in this checkout* and *wrong
about who wrote it*, and after a merge it reads as a session that edited the security layer.

Two failure modes follow. A careful reader sees two hundred paths, cannot account for them, and
stops trusting the log. A hurried one learns that "the merge explains it" and waves through the
next genuine stray edit buried among them — which is the edit the log exists to catch.

What *did* work: diffing the logged set against `git diff --name-only <merge-base> HEAD`. Every
path left over is one this session wrote and then restored or deleted; here that was 34 paths,
all of them this session's own deliberately removed duplicates, and nothing else. That check is
mechanical and it separates authorship from importation without the hook's help.

**Settles when:** either the hook skips — or labels — changes introduced by a `merge`, `pull`,
`rebase` or `checkout` command, and a close after a merge shows only the session's own writes; or
`AGENTS.md`'s drift-log bullet documents the merge-base diff above as the way to read the log
after a merge, so the limitation is known rather than rediscovered.
