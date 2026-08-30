# PS-114: the age computation is authoritative, and band labels are derived

**Decided:** 2026-08-30

Ticket PS-114 said only "something's off with how pet ages show up". Two defects were found and
measured; both are the same shape — **one fact written twice, then drifted**.

**1. Stale ages on the fallback path.** `mapDbPetToPet` preferred a stored value:
`p.age || formatAgeString(birthDate).en`. `src/data/pets.json` carries frozen `age`/`ageCategory`
prose, and `petRepository.freshPets()` served it via `structuredClone` **without going through the
mapper at all** — as did `petStore.ts` and `DonationWidget.tsx`. Measured: Oliver read
"4 months" at five months old, 1 of 10 pets already divergent. The same pet therefore rendered a
different age depending on whether the database answered.

*Fence sign (§3):* the `||` was a **migration shim**. `git show 6108d82` moved age from columns to
computation and flipped `DbPetRecord.age` required→optional in one diff. No `age`/`ageCategory`
column has existed since; `prismaDouble.ts` has none either. So the shim was unreachable on the DB
path and harmful on the fallback path. It is removed, and `withDerivedAge()` is applied at all
three JSON entry points. **What it protected — reading back an operator-authored age string — is
no longer a live threat, because there is no column for one to be stored in.**

**2. Band labels overlapped the maths.** The gallery and the admin form each hand-wrote the year
ranges. Ages 3 and 7 were claimed by *two* adjacent filter options at once, so a boundary-aged pet
was advertised under a filter that would not return it.

**Decision: fix the labels, not the maths.** Both were candidates. The maths carries 13 passing
tests and is the documented intent; the labels carried none. Changing 96→84 months would silently
re-file every pet aged 7–8 across matching and filters — a behaviour change to fix a wording bug.
Labels are now derived from `AGE_BAND_MIN_MONTHS`, the single boundary definition, and render
`< 1 yr` / `1 – 2 yrs` / `3 – 7 yrs` / `8+ yrs`. **Reversible:** flip the constants, labels follow.

**Guard:** `tests/unit/petAge.test.ts` now asserts every whole-year age 0–30 is claimed by exactly
one band in both languages, and that the advertised band equals `computeAgeCategory`. Verified to
**fail** against the old labels (2 ambiguous ages) and pass against the derived ones — checked in a
scratch copy, never by breaking the guard in this tree.

**Deviation, logged:** no branch was cut for this GRAVE task. The worktree is shared with a
concurrent session that stages with `git add -A`; switching its branch would have carried its work
onto mine. Explicit-path staging on `feat/tnrm-rehabilitation` was the lower-risk trade.
