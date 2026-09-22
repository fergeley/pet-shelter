# An approval marks the id it asks for, and the mirror's order stops deciding

**Decided:** 2026-09-22

Closes `tasks/open/a-public-post-can-reorder-the-pet-mirror.md`, filed by the session that landed
the adoption submission guards after it reviewed PR #89.

**This entry also corrects `2026-09-22-a-pet-the-database-lacks-is-a-missing-pet.md`**, which is
not rewritten — the ledger contract forbids that — but was wrong on one point. See the last
section.

## What was wrong

`markCachedPetAdopted` took the first entry matching *either* identifier:

    serverPets.find((p) => p.id === petId || p.name.toLowerCase() === petName.toLowerCase())

`find` walks the array in order, so a **name** match on an earlier entry beat the exact **id**
match on a later one. Two shelter animals sharing a name was the whole precondition, and
`pets.json` ships common ones.

The order is publicly influenceable. `findServerPetByIdAsync` moves every animal it reads to the
head of the mirror, and that read sits behind an anonymous profile GET — and, since the adoption
submission guards landed, an unauthenticated POST, which reaches the read *before* the guard that
would reject the submission. So a visitor picks which of two same-named animals sits first.

`atomicUpdateApplicationStatus` then calls this on approval and writes the returned id into a
`PET_STATUS_TRANSITION_ADOPTED` audit row. The consequence is therefore not a stale cache entry
that the next hydrate repairs: **the wrong animal is recorded as adopted, permanently, in the
audit trail.**

Reproduced before fixing, not reasoned about: with two `Bella`s in the mirror and the decoy read
once through the public path, `markCachedPetAdopted("itest-bella-asked-for", "Bella")` returned
`itest-bella-decoy`.

## The fix

Try the id against the whole array first; fall back to the name only when it yields nothing.

    const target =
      (petId ? serverPets.find((p) => p.id === petId) : undefined) ??
      serverPets.find((p) => p.name.toLowerCase() === petName.toLowerCase());

Three lines. The name comparison itself is untouched — no trim added — because widening *how*
names match is a different question from which identifier wins, and only the latter was broken.

**The name fallback stays.** Applications predating the `petId` column arrive with an empty
string, and the name is the only identifier they carry; `atomicUpdateApplicationStatus` passes
`currentApp.petId ?? ""` precisely for them. The change makes the name what it always read as — a
fallback — rather than a competing match.

Pinned by `tests/integration/approvalMarksTheAnimalItAsksFor.test.ts`, five tests, including the
public reorder performed the way a visitor would and an arrangement assertion proving the reorder
actually happened, so the test cannot pass because the attack silently failed to set up.

## Considered and not done: stopping the read from reordering

The open entry offered either repair. Reordering was left alone because it is load-bearing in a
way the id fix is not: during an outage `getServerPetsAsync` serves this array as the catalogue,
so recency-first is the behaviour that lets a recently viewed animal survive a database failure.
Removing it is a product decision about outage ordering, and it would not have fixed the defect
anyway — two same-named animals with no id match are still resolved by position.

**What therefore remains open:** with an empty or unmatched `petId` *and* two animals sharing a
name, order still decides which is marked. That is inherent — nothing distinguishes them — and it
is no longer attacker-*directed* at a specific victim, because an attacker cannot make the wrong
animal win when the right id is present. Recorded here rather than filed again, because there is
no action that closes it short of refusing ambiguous name matches outright, which would break the
legacy applications the fallback exists for.

## Correcting the earlier entry

`2026-09-22-a-pet-the-database-lacks-is-a-missing-pet.md`, under "Not closed by this", says of the
mirror rewrite: *"Carried over from the closed entry's second bullet, unchanged and still cosmetic:
an anonymous GET mutating module state is worth knowing about."*

**"Cosmetic" was wrong.** It was written from the reordering's effect on catalogue *display* order
during an outage, without checking what else read that order — and one thing did, in a path that
writes an audit row. The claim reached a public GitHub issue and the `petRepository.ts` docstring
before anyone checked it, and the session that found it was reviewing a different change.

The error is the same one this stream already has a lesson about — prose asserting a property of
code the writer had not read. What is new, and why the lesson gained a paragraph rather than a
second file: the assertion was not about a *named* function, so "open the symbol you name" would
not have caught it. It was a claim about which code paths read a piece of shared state, and the
check that answers it is a grep for the state, not a read of a symbol.
