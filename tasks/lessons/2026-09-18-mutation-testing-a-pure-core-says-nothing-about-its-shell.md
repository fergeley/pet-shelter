# Mutation-testing a pure core says nothing about the shell around it, which is where the dangerous bugs were

**Learned:** 2026-09-18

`scripts/ledger-issues.mjs` was built the way this repo recommends: a pure planner, `planSync`, inside
a thin shell of `git` and `gh` calls, so the whole policy could be tested without publishing. The
planner had 17 tests, and 9 of 9 deliberate mutations failed them. Then four review rounds and one
probe found real defects, and not one could have failed those tests. Each lived in the shell, or in
what the shell trusted:

- `git ls-tree` without `--full-tree` resolved `tasks/open/` against the caller's directory. Run from
  `tasks/`, it read zero entries and planned to close every mirrored issue.
- In a depth-1, single-branch clone — the shape CI checks out — `git fetch origin master` moved only
  `FETCH_HEAD`, and the run died on `unknown revision 'origin/master'`. Found by cloning the branch
  that way and running the script, not by any test or review.
- The issues it read came from a public repository. Anyone could open one carrying a copied marker,
  and beside a real mirror it stopped every sync; alone, it was adopted as the mirror.
- The fix for that, `gh issue list --label`, quietly moved the read onto the search index, which lags
  writes, so back-to-back CI runs would duplicate a freshly created issue. `GH_DEBUG=api` showed
  `IssueSearch` where the unfiltered call sent `IssueList`. A flag that looked like a filter changed
  the data source.
- Unfiltered, one page of 1000 issues could be pushed out by spam; `ls-tree` quoted non-ASCII names;
  the marker could not hold a space, `-->`, or U+2028.

What held was moving consequences into the core. A planner that refuses to close every issue when
handed no entries, and that trusts only labelled issues, turns the next broken or hostile read into a
stopped run instead of a mass close or a hijack — and those rules sit where a test can hold them.

Every fix round also produced defects of its own: round two's label fix introduced the search-index
race that round four found. Reviewing each fix round, as `CLAUDE.md` step 6 requires, is what caught
it.

**Rule:** before trusting a tool whose shell touches git, the network, or public input, run the real
CLI once from a subdirectory and once in the environment it will run in (a depth-1 clone for CI), and
look at what a CLI flag actually sends (`GH_DEBUG=api`) before assuming it only filters. Then ask what
the planner does when the shell hands it an empty list or a hostile one, and make the destructive
answer impossible in the core.
