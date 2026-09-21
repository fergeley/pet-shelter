# The issue mirror is consistent at the next matching push, not eventually

**Decided:** 2026-09-21

`.github/workflows/ledger-issues.yml` runs only on a push to `master` that touches `tasks/open/`,
the script or the workflow, and on manual dispatch. Nothing polls. So the promise the mirror makes
is narrower than "the issues track the ledger": **the issues track the ledger as of the last push
that both matched the trigger and produced a run.**

That second clause is not theoretical. On 2026-09-21, push `b544188` matched the trigger and
produced no run at all — `check-suites` returned `total_count: 0`, with Actions enabled, nothing
queued, no skip token in the message and no incident reported. It was opened as
`tasks/open/a-push-to-master-produced-no-workflow-run.md`, whose settle condition was three
subsequent matching pushes each producing a run. All three did, within ten minutes:

| Push | Run | What it did |
|---|---|---|
| `9a50c8c` (#72 merged) | 35611516542 | closed #74 and #81 |
| `a8847d5` (#73 merged) | 35611529886 | in sync, nothing to do |
| `b44f857` (#83 merged) | 35611655318 | created #84 |

So the miss is written off as a one-off, and the entry is deleted with this record in its place.

**What follows from the guarantee, and is worth keeping:**

- **A dropped push is silent.** There is no run, so there is no red run to notice. The ledger and
  the issues simply disagree until the next matching push reconciles them, and every run reconciles
  the whole ledger rather than the commit that triggered it.
- **The recovery is one command:** `gh workflow run "Ledger issues" --ref master`, proven by run
  35611053240 on the miss above. `npm run ledger:issues` shows what a run would do, from anywhere.
- **A run reads the tip, not its own commit.** Run 35611516542 was triggered by `9a50c8c` and
  reported reading `a8847d5`, because the script fetches `origin/master` when it starts. Queued runs
  therefore collapse harmlessly: the later one finds the work already done.

*Rejected — polling on a schedule.* It would close the gap at the cost of a run every few minutes
against a ledger that changes a few times a week, and it would hide exactly the fault above by
papering over it within one interval. A missed push is better fixed by noticing it than by sweeping
it up.

The mirror's own rules are `tasks/decisions/2026-09-18-ledger-issues-are-a-one-way-mirror.md`.
