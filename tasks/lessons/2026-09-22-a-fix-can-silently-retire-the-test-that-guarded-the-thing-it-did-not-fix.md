# A fix can silently retire the test that guarded the thing it did not fix

**Learned:** 2026-09-22

`findServerPetByIdAsync` was changed to return `null` after a successful read that found no row,
instead of falling through to the `pets.json` mirror. Correct, tested, and it quietly removed the
only coverage of a *different* guard.

`getPetById` refuses any result whose id is not exactly the one requested. That guard was pinned
by `softDeleteFiltering.test.ts`, "does not serve an archived animal through a case-variant of its
id", which arranges `findUnique` to resolve `null` for `PET-001` and then asserts the request
404s. Against the *old* reader that null sent the lookup to the case-insensitive mirror, which
returned fixture `pet-001`, and the guard was what refused it. Against the *new* reader the same
arrangement returns `null` from the empty read, the mirror is never consulted, and the request
404s before the guard is reached.

The test still passed. It was simply no longer testing the guard. Measured, not reasoned: deleting
`pet.id !== requested` left **69 of 69 integration tests green**. The third review of the change
found it; the first two did not, and neither did I.

What makes this worth a file is the shape. Nothing failed, no coverage tool would flag it — the
line is still executed, just never decisive — and the same commit added a comment saying "do not
delete this guard", which is the weakest possible enforcement. The next `/simplify` pass deletes
an unreachable-looking condition, CI agrees, and `/pets/PET-001` serves an archived fixture again
on the two routes that still reach the mirror.

**Rule:** when a change makes an early return fire *before* an existing guard, that guard's test
is now suspect even though it passes. Delete the guard and re-run: if nothing fails, the coverage
is gone and the guard is one cleanup away from following it. Write the replacement test so it
reaches the guard by the route that still exists — here, stubbing `DATABASE_URL=""` or a rejecting
query with `STRICT_PERSISTENCE=false` — and give it a positive control, so a reader that refused
*everything* on that route could not pass it either. A comment saying "do not delete this" is a
note, not a test; the only thing that stops a later deletion is a red build.
Related: [[fixing-one-readers-policy-turns-its-neighbours-comments-into-the-spec]].
