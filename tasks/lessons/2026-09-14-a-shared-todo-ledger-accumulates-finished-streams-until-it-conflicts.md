# A shared todo ledger accumulates finished streams until it conflicts

**Learned:** 2026-09-14

`tasks/todo.md` retained 500+ lines of finished work-streams that had landed weeks earlier. When a branch rebases or merges against `origin/master`, any concurrent edit to the top of `todo.md` collides immediately at line 0 — blocking a PR's entire CI workflow because GitHub does not run merge actions on a conflicted pull request.

Splitting completed historical work streams out into `tasks/archive/todo-historical-streams.md` restores a clean active working ledger without destroying the provenance of finished streams.

**Rule:** Finished work streams belong in the archive ledger once merged; active ledgers must only track open, multi-step concurrent work.
