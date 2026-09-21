# A closing keyword in a pull request can fake a sync that never ran

**Learned:** 2026-09-21

PR #82 deleted the ledger entry whose issue the mirror owned, and both its body and its commit
message said "this commit should close #79". GitHub read that as a closing keyword and closed #79
two seconds after the merge, crediting the person who merged. The check I had planned — "#79 is
closed, so the mirror closed it" — was answered by my own sentence.

The workflow had not run at all for that push: `check-suites` for the merge commit returned
`total_count: 0`
(`tasks/open/a-push-to-master-produced-no-workflow-run.md`). Because the keyword had already done
the one thing the sync owed, `npm run ledger:issues` reported `in sync, nothing to do`, and every
surface I would normally trust agreed with a conclusion that was wrong.

Two separate hazards:

- **The keyword competes with the mirror.** For an entry still in `tasks/open/`, a keyword close is
  undone at the next sync, because the file wins. For an entry being deleted, it quietly does the
  mirror's work and hides whether the mirror did anything.
- **State is not evidence of mechanism.** "The issue is closed" and "the workflow closed it" are
  different claims. Only the second one can be read out of a run log, and only the second one was
  the thing being tested.

**Rule:** never put a closing keyword — `close`, `closes`, `fixes`, `resolves` and their variants —
in front of an issue number that `scripts/ledger-issues.mjs` owns; write the bare `#NN` instead.
When the claim is that the mirror did something, cite the workflow run and the line in its log, not
the issue's state.
