# The ledger issues workflow has never run on GitHub

**Status:** ASSERTED · opened 2026-09-18

`.github/workflows/ledger-issues.yml` can only run once it is on `master`: it triggers on a push
there, and `workflow_dispatch` is only offered for workflows on the default branch. So everything
about it is reasoned, apart from two things checked locally:

- The YAML parses with the intended shape (js-yaml): push to `master` on `tasks/open/**`, the
  script or the workflow; `workflow_dispatch`; a non-cancelling concurrency group;
  `issues: write`; the token passed as `GH_TOKEN` through the environment, never interpolated.
- The script works in a depth-1 clone like the one `actions/checkout` makes. That probe found a real
  bug first: in a single-branch clone, `git fetch origin master` moved only `FETCH_HEAD`, and the
  run died on `unknown revision 'origin/master'`. The script now fetches with an explicit refspec.

Not observed: that `github.token` with `issues: write` can create the `ledger` label and issues and
close them; that `gh repo view` resolves the repository from the checkout's remote; and that the
first run after this entry merges creates exactly the entries `master` gained with it.

**Settles when:** `gh run list --workflow "Ledger issues" --limit 1` shows a successful run on
`master`, its log shows the plan it applied, and a local `npm run ledger:issues` then prints
`in sync, nothing to do`.
