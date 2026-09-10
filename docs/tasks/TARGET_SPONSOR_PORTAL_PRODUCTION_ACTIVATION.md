# TARGET — Make the reconciliation queue and sponsor portal work on production

**Written:** 2026-09-11, at the close of PR #36 · **Lane:** GRAVE (production schema is a one-way door)

PR #36 built `/admin/donations`, the screen that confirms a supporter's transfer and issues their
receipt. It is verified in memory mode, in CI, and in 23/23 e2e specs. **None of that proves it
works on production**, and there is a specific reason to believe part of it does not.

---

## Why this is the next task, and not one of the others

The whole point of PR #36 is a chain: *pledge → coordinator confirms → receipt number issued →
supporter claims a portal account*. Every link after the first depends on production tables that
nobody has recorded as present:

| Link | Needs on production | Recorded state |
|---|---|---|
| Confirm a pledge | `pet_sponsorships` | **Applied** 2026-09-03 — `production-schema-has-drifted-ahead-of-master.md` |
| Issue the receipt | `donations`, `receipt_sequences` | **Never observed.** `2026-09-03-donation-ledger-verified-on-postgres.md` says it "does not establish anything about the Neon production branch" |
| Claim an account | `sponsors` | **Not applied** — §2 of `sponsor-portal-is-inert-until-reconciliation-is-reachable.md`: a 500 on `/sponsors` and `/sponsor/login` |

If `donations` is missing, the consequence is wider than the portal: `issueDonationReceipt` runs in
persistent mode whenever `DATABASE_URL` is set, and throws rather than falling back — so **every
donation on `/donate` would fail**, not only reconciliation. That is a belief, not a measurement.
Establishing which it is comes first.

Candidates considered and deliberately ranked lower:

- The four loose ends in `tasks/open/donation-form-and-admin-denials-have-loose-ends.md` — real,
  small, and none of them stops a donor or a coordinator.
- Sponsor portal §3 (signed media URLs) and §4 (verified-email claims) — both assume the portal can
  be reached at all, which is what this task establishes.
- The 12 destructive drift lines — explicitly *not* this task; see "Out of scope".

---

## Before you start — what the last session learned the hard way

These are `tasks/lessons/2026-09-09-*` in one line each. Read the files if one bites.

- **Check what exists before building.** The brief for PR #36 asked for a ledger that had shipped
  months earlier. Assume this brief is wrong about something too, and diff it against the tree.
- **"Must not" is not "cannot".** A production hazard can often be switched off rather than
  avoided — but prove the switch holds with a read-only probe before relying on it.
- **A fresh worktree has no `node_modules`.** Run `npm ci` in it before anything that boots the app.
- **Never copy `.env.local` into a worktree.** It sets `NEON_BRANCH=production`.

---

## Scope

**Write:** `tasks/open/*.md`, `tasks/decisions/*.md`, `tasks/lessons/*.md`, this file. `prisma/sql/`
**only** if step 2 finds a missing object with no additive file — and then a new file, never an
edit to an applied one.

**Read-only:** `src/**`, `prisma/schema.prisma`, every existing `prisma/sql/*.sql`.

**Never run:** `npm run db:push` or `db:seed` against the default target — they resolve
`.env.local` → production. `db:push` is now gated by the drift check, but the additive files are
the only safe path here.

---

## Steps

### 0. Claim it and read the fences

```bash
ls tasks/open/CLAIM-*.md          # someone else on this already?
cat tasks/open/production-schema-has-drifted-ahead-of-master.md
cat tasks/open/sponsor-portal-is-inert-until-reconciliation-is-reachable.md
```

Write `tasks/open/CLAIM-sponsor-portal-production.md`. Register kill conditions **in it before step
1 runs** — at minimum K1 and K2 below. They are immutable once written.

### 1. Read-only inventory of production

From a checkout that has `.env.local` — not a copy of it:

```bash
npm run db:check-drift
```

It runs `prisma migrate diff --from-config-datasource` and classifies the SQL Prisma *would* run.
**It writes nothing.** Paste the raw output into the claim file. From it, record for each of
`sponsors`, `donations`, `receipt_sequences`, `pet_sponsorships`: present, or missing.

Exit 1 (destructive drift) is expected — the 12 lines in the drift entry. Exit 2 means it could not
connect; stop and say so rather than guessing.

**K1.** If `donations` or `receipt_sequences` is missing, `/donate` is failing on production *now*.
That is incident mode (`midwife` §4), not this task: revert-sized, and tell the human immediately.

### 2. Build the apply list from files that already exist

Map each missing object to the additive file that creates it — expected:

- `sponsors` → `prisma/sql/2026-09-03_sponsor_accounts_additive.sql`
- `donations`, `receipt_sequences` → `prisma/sql/2026-09-04_donations_ledger_additive.sql`

Read every file on the list in full. Each claims to be idempotent (`IF NOT EXISTS`); confirm that
is true of every statement, not only the first.

**K2.** If any file on the list contains a `DROP`, a `DROP COLUMN`, or an `ALTER ... TYPE`, stop.
The list must be purely additive, or it is not this task.

### 3. Rehearse on a Neon branch cut from production

The procedure `production-schema-has-drifted-ahead-of-master.md` records from 2026-09-03.

> **Every command in this step must carry the rehearsal branch's URL inline.** Both
> `db:check-drift` and `prisma db execute` resolve their target through `resolveDatabaseUrl()`,
> which loads `.env.local` — and `.env.local` is **production**. A bare
> `npx prisma db execute --file …` here does not rehearse anything: it applies to production and
> silently skips the halt in step 4. A shell-exported `DATABASE_URL` beats both env files
> (`prisma/env.ts`, `loadDatabaseEnv`), so prefix every command:

```bash
export REHEARSAL_URL="<the Neon branch's connection string>"

DATABASE_URL="$REHEARSAL_URL" npm run db:check-drift
DATABASE_URL="$REHEARSAL_URL" npx prisma db execute --file prisma/sql/<file>.sql
```

**Check the first line of every `db:check-drift` run.** It prints
`Target: postgresql://<user>:***@<host>/… (remote)` with the password masked. The host must be the
rehearsal branch's. If it names production, stop — that is the one line standing between this step
and an unreviewed production write.

1. Cut a Neon branch from production.
2. `db:check-drift` against it. The output must match step 1's **byte for byte**, apart from the
   `Target:` line — otherwise the rehearsal is not a faithful copy (**K3**).
3. Apply each file on the list with `prisma db execute`, prefixed as above.
4. Re-run `db:check-drift`: the missing objects should have left the additive list, and the
   destructive list must be **unchanged**.
5. Apply every file a second time. Nothing should change — that is the idempotence proof.

### 4. HALT — the one-way door

Applying to production is irreversible and belongs to the human. Hand back one decision, priced
both ways:

> Apply `<files>` to production? Rehearsal on branch `<name>`: `<before/after drift output>`,
> idempotent on second apply. If no: `/sponsors` stays a 500 and reconciliation `<works | fails>`.

Do not apply without an explicit yes **in the current prompt**.

### 5. Verify production after the apply — GET-only first

```bash
npm run db:check-drift            # the applied objects are gone from the additive list
```

Then, in a browser against production, **read-only**: `/sponsors` and `/sponsor/login` return 200
rather than 500; `/admin/donations` loads the queue for a Volunteer Coordinator account.

### 6. End to end — a second human decision

The only real proof is one pledge travelling the whole chain: pledge → confirm in
`/admin/donations` → a real `HFS-DON-…` number → a portal account claimed with it. On production
that **writes an append-only receipt and sends real email**, so it needs its own yes: a small real
pet sponsorship from a staff member, or skip it and record the chain as unproven. The floor is
**RM 10** — `MIN_SPONSORSHIP_SEN` in `src/lib/domain/petSponsorship.ts` — not the RM 5 minimum on
`/donate`, because this chain starts from a pet's sponsorship checkout rather than the donation
form. Do not fake it with a test row — a receipt is a statutory document.

### 7. Close the ledger

- §2 of `sponsor-portal-is-inert-until-reconciliation-is-reachable.md` → resolved, with the raw
  drift output as evidence.
- Update the "Still outstanding" block of `production-schema-has-drifted-ahead-of-master.md`.
- A `tasks/decisions/` entry for what was applied, when, and on whose yes.
- Delete the claim file.

---

## Verification & commit

- `npm run check` and `npm run test:all` green — this task should change no product code, so if
  either moves, something rode along.
- Commit per `docs/reference/COMMIT_MESSAGES.md`, message via `-F`, checked with
  `node scripts/commit-msg.mjs`. **The PR title is linted too** — PR #36 failed CI on an unprefixed
  title while all six of its commits passed.
- Never a docs-only PR (`AGENTS.md`). If this task ends with only ledger changes, attach them to the
  next branch that carries code rather than opening one.

## Not verified by whoever wrote this

Everything in the "Recorded state" column is quoted from ledger entries dated 2026-09-03 and
2026-09-04. **None of it was re-checked against production on 2026-09-11** — doing that is step 1.
The claim that `/donate` fails if `donations` is missing is reasoned from `donationLedger.ts`
declaring the database authoritative, not observed.

## Out of scope

- The 12 destructive drift lines — `ApplicationStatus`/`PetStatus` enum conversions, the
  `pets.age`/`ageCategory` drops, `notification_preferences`. They need data-preserving casts and a
  decision about each object's owner.
- Sponsor portal §3 and §4, and the loose ends in
  `tasks/open/donation-form-and-admin-denials-have-loose-ends.md`.
- Adopting `prisma migrate`. It is the real fix for drift, and it is a project, not a step.
