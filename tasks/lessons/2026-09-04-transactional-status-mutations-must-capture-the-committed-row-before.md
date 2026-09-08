# Transactional status mutations must capture the committed row before updating the mirror

**Learned:** 2026-09-04

In dual-layer stores where PostgreSQL is authoritative and an in-memory array acts as a cache mirror, atomic mutations (`atomicUpdateApplicationStatus`) must never assume the target entity was cached in memory prior to the transaction. If an entity was seeded directly into the database or created by a concurrent process, the in-memory array index was `-1`. Executing the Prisma transaction committed the update to PostgreSQL, but checking `appIndex === -1` post-transaction falsely aborted with `"Application not found"`, leaving the caller with an error and the mirror out of sync.

**Rule:** Capture the authoritative entity from inside `prisma.$transaction`. Post-commit, if the entity was absent from the in-memory mirror (`appIndex === -1`), map the committed database row via the domain mapper and prepend it to the mirror array so the in-memory state reflects the committed transaction.
