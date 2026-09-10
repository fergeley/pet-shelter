# CI tests the merge result, so it sees commits your branch does not

**Learned:** 2026-09-03

The unit suite passed locally at 1088 tests and failed in CI at 1168. Nothing
was flaky: GitHub runs the checks against your branch merged with the current
trunk, so it had a whole `src/actions/sponsors.ts` that the local tree had never
seen. A repo-wide guard — the kind that scans every file in a directory — will
find things locally green runs cannot.

**Check the count.** "1168 in CI, 1088 here" is the tell, and it is faster than
reading the diff. Sync, re-run, and expect the numbers to match before trusting
a local pass.

**And read the output, not the exit code.** `gh pr checks --watch` exits 0 even
when checks have failed. Taking the exit code at face value would have reported
a green build twice.
