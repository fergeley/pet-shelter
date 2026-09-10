# A pull request with a merge conflict runs no CI at all

**Learned:** 2026-09-02

PR #3 opened with every job missing. Only Vercel's checks appeared, and the workflow trigger was an
unfiltered `pull_request:`, so the filter was not the cause. GitHub runs `pull_request` workflows
against a *computed merge commit*, and a conflicted PR does not have one:

```
$ git ls-remote origin 'refs/pull/3/*'
9165c23...  refs/pull/3/head        # head only, while conflicted
$ git ls-remote origin 'refs/pull/2/*'
00cc411...  refs/pull/2/head
b4f82b5...  refs/pull/2/merge       # the mergeable PR has both
```

The conflict was two sessions appending to the tail of `tasks/lessons.md` — a prose file, nothing
disagreeing, both sides wanted. That trivial collision silently disabled the entire verification
pipeline for the branch whose whole purpose was to add a verification gate. The gate could not run
until the conflict cleared.

**Rule:** a conflicted PR is not "green pending resolution", it is **unverified**. The moment a PR
opens, confirm CI actually started — `git ls-remote origin 'refs/pull/<n>/*'` must show a `merge`
ref, not just `head`. A check list showing only third-party checks means the workflows never ran,
which looks nothing like failure and is worse.
