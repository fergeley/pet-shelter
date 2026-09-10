# A shared node_modules makes every local test result provisional

**Learned:** 2026-09-02

Worktrees here share one `node_modules` with the main checkout. Two observed consequences in a
single session, neither of which touched any source file:

- The generated Prisma client went stale repeatedly. Symptom is 11 failures across `petHistory`,
  `rehabilitation`, `petStatusPresentation` and `setupMocks`, all `Cannot read properties of
  undefined (reading 'Available')`. `prisma generate` fixes it; something else un-fixes it minutes
  later. The same suite went green, red, then green with no edit in between.
- `jsdom` **disappeared** from `node_modules` mid-session while still declared in `package.json`.
  The whole `components` project stopped running — `Test Files no tests`, `Errors 4` — and in a
  combined run this reads as a *smaller total* (56 files / 775 tests instead of 60 / 830), not as a
  failure.

A test count that drops is easy to miss; a tier that reports "no tests" is not a red X.

**Rule:** never quote a local test count as a baseline without the command that reproduces it *and*
a note that CI is the authority. Compare the **file count** against what is on disk, not just the
pass count — `60` on disk versus `56` discovered is a whole tier missing. Wire `pre<script>` hooks
so the generate step cannot be forgotten, and accept that a concurrent session can still invalidate
the environment underneath a run in progress.
