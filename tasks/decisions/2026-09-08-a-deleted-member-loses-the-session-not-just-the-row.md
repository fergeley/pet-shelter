# A deleted member loses the session, not just the row

**Decided:** 2026-09-08

`readVerifiedSession` in `src/lib/security/dal.ts` ended a missing member row with:

```ts
// No row: either a demo/in-memory account or a deleted user. Fall through
// to the cookie rather than locking out the seeded demo logins.
if (!member) return session;
```

The comment names the hole and ships it. A member deleted straight out of a **reachable** database
kept every capability their cookie claimed, for the cookie's full 24 hours — inverting the one
guarantee the module exists to provide, and doing it for the highest-privilege case, since a
`SUPER_ADMIN` cookie keeps asserting `SUPER_ADMIN`.

## What the task asked for, and why it could not be written

The instruction was to deny on `isDeleted: true` or `status: "INACTIVE"`. Neither exists:
`model User` in `prisma/schema.prisma` has no `isDeleted` column, and `UserStatus` is
`ACTIVE | INVITED | SUSPENDED`. Written literally it is a type error or a dead branch. The
status half of the instruction — deny when not `ACTIVE` — was already implemented and correct.

## Why the fall-through could not simply be deleted

It was load-bearing. The seeded demo logins in `userStore` (`usr-admin-01` and four others) have no
`users` row on a reachable-but-unseeded database, and `findUserByEmail` authenticates them from the
in-memory store. Removing the fall-through locks every local and offline session out of `/admin`.

## What was chosen

The question is narrowed from *"is the row missing?"* to *"does any store still vouch for this
id?"*. `readFallbackAuthState` asks `userStore.findUserById`, which is the same lookup that
authenticated them — Prisma first, then the in-memory seed — so an id it cannot produce is one
nothing can, and that session is refused. Its status is checked like any other.

The deliberate outage trade is untouched and now pinned by a test: `findMemberAuthStateById`
*throwing* still falls back to the cookie, because failing every admin request closed on a transient
Postgres blip is the worse trade. Only a reachable database that answers "no such member" denies.

## What it cost, and what that revealed

Three suites went red, all for the same reason: they signed in via `identityForRole()`, which mints
synthetic ids (`usr-super_admin`) that exist in no store, and doubled Prisma's `user.findUnique` to
`null`. `tests/unit/donationQrAudit.test.ts` said so in its own header — *"`user.findUnique`
resolving null is what makes the DAL fall through to the cookie's own claims"* — directly under a
paragraph claiming *"Authorization here is real, not stubbed"*. It was not; it was resting on the
vulnerability.

Fixed at the source rather than per suite: `memberRowForId()` in `tests/setup/authSession.ts`,
beside the `identityForRole` it reads backwards, consumed by `tests/integration/support/prismaDouble.ts`
and the one unit suite with its own double. It returns null for an id no helper mints, so the
deleted-member case stays denied inside the doubles too.

Baseline confirmed before blaming the change: the integration tier was 52/52 green on the stashed
tree and 42/52 with the fix applied. After: 1413/1413 across unit, integration and components.
