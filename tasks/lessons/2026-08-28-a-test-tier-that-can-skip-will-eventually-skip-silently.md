# A test tier that can skip will eventually skip silently

**Learned:** 2026-08-28

`isLedgerPersistent()` reads `Boolean(process.env.DATABASE_URL)`, while `src/lib/server/prisma.ts`
invents a localhost URL when that variable is unset. A probe written to exercise Postgres therefore
takes the in-memory branch and passes — green, fast, having verified nothing. This is how "verified
against real Postgres" became a claim nobody had tested.

**Rule:** a tier whose whole purpose is to touch a real dependency must **fail** when the dependency
is absent, never skip. A skip renders as a pass in the summary line. Gate it out of the default test
command instead, so the everyday suite stays runnable without the dependency.
