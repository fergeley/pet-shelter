# A dual-layer fallback must never let a swallowed database error fail the mutation

**Learned:** 2026-09-04

The repository layer (`src/lib/server/`) follows a dual-layer store pattern (docs/architecture/LAYERS.md, L-B2):
writes are database-first with an in-memory mirror and audit log. When no database is configured (dev,
offline, unit tests), Prisma queries throw. In non-strict mode, `handlePersistenceError` deliberately swallows
those errors, reports a console warning, and falls through to the in-memory fixtures.

A rewrite of `atomicUpdateApplicationStatus` broke that contract by wrapping the transaction in:
```ts
try {
  await prisma.$transaction(...);
} catch (err) {
  handlePersistenceError("Prisma application status transaction", err, "write");
  return { success: false, error: "Persistence failure; the update was not applied" };
}
```
In strict mode (`STRICT_PERSISTENCE=true`) or on unique-constraint violations, `handlePersistenceError`
rethrows loudly as designed. But in non-strict mode, returning `{ success: false }` transformed the expected
fallback into a hard mutation failure. Every unit test calling status transitions failed because there was no
local Postgres to answer the query.

**Rule:** In a dual-layer store, the database write must be guarded, not gatekeeping. If `isDatabasePersistent()`
is false or the caught error was swallowed by `handlePersistenceError`, the operation must fall through to update
the in-memory mirror and record the audit trail. A database failure in fallback mode is a warning, never an
aborted transaction.
