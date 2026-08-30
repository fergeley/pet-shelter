# PS-114 S2 DIED: the "senior boundary is off by one year" claim

**Decided:** 2026-08-30

**Killed by its own registered condition** (`tasks/OPEN.md`, S2). The claim was that
`computeAgeCategory` promotes to senior at 96 months while the gallery advertises
`Senior (7+ yrs)`, leaving a 7.0–7.99y dead band.

The spike's extractor resolved the overlapping label `Adult (3 - 7 yrs)` / `Senior (7+ yrs)`
as `years <= 7 -> adult`. Under that reading age 7 satisfies the condition, so the kill
condition fired and the claim is dead. **No salvage, and the condition was not edited.**

**What the corpse shows instead:** the extractor could not assign age 7 *because two adjacent
filter options both claim it*. The band edges are written as free prose in three user-visible
places and overlap at every boundary — 3 is claimed by both "Young (1 - 3 yrs)" and
"Adult (3 - 7 yrs)"; 7 by both "Adult (3 - 7 yrs)" and "Senior (7+ yrs)". The executable
definition exists once, in `src/lib/domain/petAge.ts`. That is a different defect from the one
framed, and it re-entered Phase 0 rather than being patched into the old frame.

**Generalisable:** a kill condition written against ambiguous prose inherits the ambiguity. The
condition was sound; the *label* it referenced was not a specification.
