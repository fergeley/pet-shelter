# A guard cannot recognise a placeholder it has never been shown

**Learned:** 2026-09-03

`resolveSecret` rejects a value equal to its own `DEV_SECRET_DEFAULTS` entry, and the module comment
explains why the default is published: it "lets `resolveSecret` recognise an unchanged copy-paste
deploy." But `.env.example` — the file an operator actually copies — carried a *different*
vocabulary of fake values, `"replace-me-with-a-random-32-plus-character-secret"` and friends. Those
are set, are not the dev default, and are 41 to 49 characters long, so they clear every rule. The
one file the check exists to catch was the one file it could not see.

The fix needed no new runtime branch. Publishing `DEV_SECRET_DEFAULTS` verbatim in `.env.example`
restores the single vocabulary the mechanism was designed around, and a test pins the two together.

**Rule:** when a check works by comparing against a list of known-bad values, there must be exactly
one such list. A second set of "obviously fake" strings maintained somewhere else is not redundancy,
it is the hole. This is [[anything-written-twice-diverges]] wearing a security hat.

**Addendum, same day.** The first fix pinned `.env.example` and its test read that one file. A
scan of every operator-facing doc then found two more copies, both of which booted green in
production: `docs/runbooks/OPERATIONAL_RUNBOOK.md` published `SESSION_SECRET` in a column headed
"Default / Example", and `docs/runbooks/RUNBOOK_PRODUCTION_MEDIA_STORAGE.md` published two more
inside an env block. So the rule above has a second half: a guard that enforces "exactly one list"
by reading exactly one file cannot see the copies that make the rule necessary. The guard now
discovers its inputs — `.env.example`, `docs/setup.md`, and every file in `docs/runbooks/` — so a
runbook added next week is covered without anyone remembering to add it.
