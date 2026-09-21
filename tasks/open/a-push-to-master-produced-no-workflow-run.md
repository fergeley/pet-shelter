# A push to master produced no workflow run at all

**Status:** open · opened 2026-09-21 · observed once, cause unknown

`b544188` ("Settle the ledger workflow entry (#82)", pushed 2026-09-21T14:12:51Z) changed
`tasks/open/`, which the `Ledger issues` trigger covers and which `CI` does not filter on at all.
**Neither workflow ran.** `gh api repos/fergeley/pet-shelter/commits/b544188/check-suites` returned
`total_count: 0`, and the newest entry in `actions/runs` was four minutes older than the push. The
only suite that commit has now came from a manual dispatch.

Ruled out, each by a command rather than by reasoning:

- Actions off or restricted — `actions/permissions` gives `{"enabled":true,"allowed_actions":"all"}`,
  and both workflows report `state=active`.
- A queue — `actions/runs?status=queued` gives `0`.
- A skip token (`[skip ci]` and its variants) in the commit message — read in full, not present.
- A platform incident — githubstatus.com reported all twelve components operational, and the two
  pushes minutes either side (`102763d` at 14:01:16Z, `a6d1007` at 14:04:03Z) each created both a
  `CI` and a `Ledger issues` run.

**What it costs.** The mirror is not eventually consistent; it is consistent at the next push that
matches its trigger. A dropped push leaves `tasks/open/` and the issues disagreeing, with nothing
to announce it — no red run, because there is no run. Here the disagreement was invisible for a
different reason: the issue the sync would have closed had already been closed by a closing keyword
in the pull request body (`tasks/lessons/2026-09-21-a-closing-keyword-can-fake-a-sync-that-never-ran.md`),
so `in sync` was true by accident.

**Recovery, proven:** `gh workflow run "Ledger issues" --ref master` — run 35611053240 reported
`29 entries on origin/master (b544188), 31 issues` and `in sync, nothing to do`.

**Settles when:** the next three pushes to `master` touching `tasks/open/`, the script or the
workflow each produce a run (`gh run list --workflow "Ledger issues" --limit 5` lists their SHAs),
and this is written off as a one-off — or a second miss is observed, and both SHAs go to GitHub
support with the check-suite evidence above.
