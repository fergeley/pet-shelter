# A predicate is only as true as the read underneath it

**Learned:** 2026-09-10

I closed a real leak — `/pets/[id]` served soft-deleted animals — by adding `if (pet.isArchived)
return null` to `getPetById`, wrote a passing test, and reported it fixed. It was not fixed. The
action read `findServerPetById`, the *synchronous* mirror lookup, and the mirror is initialised
from `src/data/pets.json` by every cold process. So the guard was asking a bundled fixture whether
a database row had been archived. An archive performed in another instance stayed invisible; the
page kept serving the animal. The converse failed too — a pet that existed only in the database
returned 404 until something else happened to warm the mirror.

The guard was correct. The read was wrong. Reviewing my own diff, I checked the predicate against
the requirement and never checked what `findServerPetById` actually queried — the name says "find
pet by id" and reads like the obvious primitive, and the async sibling six lines below is the one
that reaches Postgres. This repo already knew that pair was a hazard: [[Hybrid Promises returned
from synchronous signatures break caller truthiness]] is the same two functions, from the other
direction.

**Rule:** when you add a filter, a guard, or an authorization check, open the function it reads
from and confirm what that function's *source of truth* is before claiming the composite works. A
predicate over a stale mirror is not a weaker version of the fix — it is no fix at all, wearing
the diff of one. The tell is a name that describes the *shape* of a read ("find by id") rather
than its *source*; where a codebase carries a sync/async pair over the same entity, assume the
plain-named one is the fallback until proven otherwise.
