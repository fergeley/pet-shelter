# After a merge, a type error in a file you never touched is usually a stale generated client

**Learned:** 2026-09-16

Merging a 20-commit master into this branch, `npm run typecheck` failed twice in
`src/lib/server/applicationRepository.ts`:

    'referenceCode' does not exist in type 'AdoptionApplicationWhereInput'

This branch had never opened that file, and nothing it changed could have broken it. The error
was real for the tree as compiled and meaningless for the code. Master's adoption-form work had
added `referenceCode` to `prisma/schema.prisma`; the merge brought in the schema change and the
code that uses it, but not the regenerated `@prisma/client`, which lives in `node_modules` and is
not tracked. The types were a snapshot of the schema from before the merge.

`npm run typecheck` is `tsc --noEmit` and nothing else. Only the `pre*` hooks on the test scripts
run `prisma generate`, so the test suites would have regenerated and passed while the typecheck
right before them failed — two gates disagreeing about one tree, and the disagreement looking like
a merge defect. `npm run db:generate` and a re-run cleared it with no code change.

**Rule:** after a merge, a pull or a rebase, if `git diff --stat <old-head> HEAD -- prisma/`
is non-empty, run `npm run db:generate` before any gate. And when a type error appears in a file
your branch never touched, check whether it names a generated type (`*WhereInput`,
`*CreateInput`, a model field) before reading it as a defect: the tell is that the error is about
the *shape* of a Prisma type, not about your code's use of it. `prisma generate` writes only local
generated code and touches no database, so it is always safe to try first.
