# The home page's impact counters reuse `ImpactStat` under keys it owns

**Decided:** 2026-09-08

The five "Our Impact So Far" counters were string literals in `Hero.tsx`. Making them editable
without a deploy had three candidate homes, and this records why the shared table won.

**Rejected — count them from the pet table.** The obvious reading of "dynamic impact statistics",
and wrong. `docs/tasks/SPRINT_PLAN_BACKEND_AND_FRONTEND.md` (FE-02) specifies organisation-lifetime
figures, and no query can produce them: TNRM animals are returned to their colony and never become
`Pet` rows; `Pet.spayedNeutered` is `@default(true)`, so counting it counts every unset row;
`User` is staff-only and cannot stand in for volunteers; and there is no corporate-partner model.
`.claude/templates/triage-rules.md` §1 was re-verified the same day — `NEON_BRANCH=production`, so
the app's live database is production — meaning an aggregate would have published a smaller, wrong
number about a real charity on its own front page.

**Rejected — a table of its own.** Cleanest in isolation, but this repo has no Prisma migration
history and `db:push` applies straight to the production branch with no down path
(`.claude/templates/triage-rules.md` §2). A new model is a one-way door for five rows.

**Chosen — `ImpactStat`, namespaced by key.** It already carries a free-form `metricValue`
(so "520+" and "100%" are both expressible), bilingual `label`/`labelMs`, `isPublished`,
`displayOrder`, and a working admin editor. `src/lib/domain/metrics.ts` owns the `home_*` keys and
overlays published rows onto the curated baseline; an absent, unpublished, blank, or foreign-keyed
row leaves its slot at the curated figure, so the grid never collapses and never shows a
database-shaped zero.

**The sharing had a bite, and it is closed.** Reviewed the same day: `TransparencyEditor` creates a
counter at `displayOrder: 0` while the seeded ledger rows are 1/2/3, and `AllocationSummary`
renders `sortImpactStats(...).slice(0, 3)`. The first home counter staff published would therefore
have evicted a donation figure from /donate, and /transparency — which does not slice — would have
listed all five among the ledger's own. The namespace is now subtracted at both ledger reads in
`src/lib/server/transparencyRepository.ts` (the two Prisma `where` clauses and the in-memory
`project()` path), and `readHomeImpactStats()` reads the five rows by key without the whole-ledger
expense aggregate that `readAllocationSummary` runs. Covered in
`tests/unit/components/home.test.tsx`, including a guard that no seeded ledger key collides with a
home key.

**Two consequences of sharing, both now closed in the same branch.** `LEDGER_PATHS` in
`src/actions/transparency.ts` gained `"/"`, so saving a counter purges the home page on demand
instead of leaving a corrected figure stale for the length of its `revalidate` window while the
other two surfaces updated immediately. And because the home page reads its five keys by exact
match, a mistyped key was silent — the counter kept its built-in figure and nothing reported a
problem — so the admin editor's key field now offers the five as a `datalist`. A datalist rather
than a select: ledger keys remain free-form, so the control must suggest without constraining.

Nothing about this reuse is left open. The remaining ceiling is stated rather than tracked: a
table of its own would be cleaner, and becomes the better answer the moment this repo gains a
migration path.
