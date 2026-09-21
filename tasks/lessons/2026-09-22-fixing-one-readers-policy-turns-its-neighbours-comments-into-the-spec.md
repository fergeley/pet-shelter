# Fixing one reader's policy turns its neighbours' comments into a spec for the wrong behaviour

**Learned:** 2026-09-22

`getServerPetsAsync` used to gate its fixture fallback on `rows.length > 0`. When that was fixed
to treat an empty table as an answer, three comments elsewhere kept describing the old shape:

- `tests/integration/support/prismaDouble.ts` justified its empty-by-default reads with
  "`getServerPetsAsync` only trusts the database when it returns at least one row" — the reason a
  test author was told to arrange rows;
- `tests/integration/faqEmptyPublishSet.test.ts` warned that "the wrong shape is next door in
  `petRepository.getServerPetsAsync`" and that anyone reconciling the readers had "two nearby
  precedents pointing the wrong way";
- `tasks/open/pets-json-fallback-empty-means-outage.md` quoted the `length > 0` code as live.

All three were stale for weeks, and `findServerPetByIdAsync` — the reader beside it, which really
did still fall through after a successful empty read — looked like a deliberate house style
rather than the last instance of a bug that had already been fixed twice. The comments were not
merely out of date; they were the argument for leaving it alone, and they outlived the thing they
described because nothing fails when prose goes wrong.

The tell: a comment in file A asserting a fact about file B. Nothing recompiles it, no test
covers it, and the next reader treats it as more authoritative than the code because it reads
like intent.

**Rule:** when you change a policy that another file's comment, doc or ledger entry cites as
precedent, `grep` the function's name across `src/`, `tests/` and `tasks/` and fix every prose
copy in the same commit — the same "once two copies have diverged, fix both" that `AGENTS.md`
applies to code. And when a nearby reader looks deliberately inconsistent with its siblings,
check the *code* of the precedent being cited before accepting it; a cross-file claim is
[[a-predicate-is-only-as-true-as-the-read-underneath-it]] applied to comments.
