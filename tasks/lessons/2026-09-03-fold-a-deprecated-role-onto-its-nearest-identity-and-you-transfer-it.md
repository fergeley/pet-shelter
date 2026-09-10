# Fold a deprecated role onto its nearest identity and you transfer its authority

**Learned:** 2026-09-03

`normalizeRole` mapped the retired VOLUNTEER onto STAFF, which is the closest
canonical *identity*. But STAFF can read adoption applications and a volunteer
never could — that is applicant PII under PDPA 2010. Because the session was
normalised on *read*, the rewrite happened before any permission check saw it,
so every volunteer account would have gained the grant on deploy.

Two separate ideas were being conflated. Identity ("what should we call this
role now?") is a display concern. Authority ("what may it do?") is not, and must
fail closed. The fix: `permissionsForRole` grants nothing to an unrecognised or
retired role, and sessions are normalised where they are *minted*, never where
they are read.

**Rule:** an alias table is a migration tool, not an authorization one. Before
mapping A onto B, diff their permission sets — if B has anything A lacked, the
mapping is a grant.
