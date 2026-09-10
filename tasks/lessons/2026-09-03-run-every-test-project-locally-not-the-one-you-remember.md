# Run every test project locally, not the one you remember

**Learned:** 2026-09-03

Three careful review passes ran `vitest --project unit` and reported green. CI
runs `unit`, `integration` and `components`, and the integration project is
where the VOLUNTEER escalation above surfaced. The local suite had no opinion
about it at all.

Related: `gh pr checks --watch` exits 0 when it finishes watching, not when the
checks pass. Reading the exit code produced a confident "CI is green" while two
jobs were red. Read the job states.
