# `triage-rules.md` §2 claims a directory that now exists

**Status:** open · opened 2026-09-05 · MEASURED

§2 reads:

> There is **no `prisma/migrations/` directory** — this repo uses `prisma db push` ...
> - Verify: `ls prisma/migrations` → expect "No such file" *(verified 2026-08-30)*

Running its own verification command today:

    $ ls -la prisma/migrations/
    drwxr-xr-x  manual/

**The directory exists.** Found while building the irreversible-command guard, whose denial
message repeated the claim verbatim; the message has been corrected to say there is no
*Prisma-managed* migration history and that `prisma/migrations/manual/` is hand-written.

**The §2 conclusion still holds** — `db push` still has no down path, because a hand-written
`manual/` directory is not a migration history Prisma can roll back. Only the stated fact and its
verification command are wrong, which is worse than it sounds: §2 is a RISK VETO entry, and the
file's own instruction is *"Re-verify an entry before relying on it; do not cite this file as
evidence."* An entry whose verification command now returns the opposite of what it says trains the
reader to skip the re-verification.

**Not fixed here** — correcting a RISK VETO entry is its own change, and this one arrived as a
by-product of unrelated work. Whoever takes it should also check whether the other seven entries'
dated verifications still pass.

**Settles when:** §2 states what `prisma/migrations/manual/` is, carries a verification command
that passes, and the remaining entries have been re-dated.
