# 🔴 URGENT — `npm run dev` reads and writes the production database

**Date**: 2026-08-28
**Branch**: `feat/tnrm-rehabilitation`
**Found at**: `4952eb1`, while proving the fix in
[`URGENT_NONPRODUCTION_ADMIN_BYPASS.md`](./URGENT_NONPRODUCTION_ADMIN_BYPASS.md) §4 against a running
dev server
**Files**: `.env.local` (untracked, local-only), `src/lib/server/prisma.ts`

> This is not the admin-bypass work — that closed at `4952eb1`. It is what proving that fix
> uncovered, and it is filed separately because it is a different failure: the bypass was an
> authentication hole, and this is a *blast radius* multiplier that made the bypass far worse than
> its own report claimed.

---

## 1. What is wrong

`.env.local` sets (host and credential redacted here on purpose -- read the real values from your
own `.env.local`; this file is committed and must not carry either):

```
DATABASE_URL="postgresql://neondb_owner:<redacted>@<redacted>-pooler.<region>.aws.neon.tech/neondb?..."
NEON_BRANCH=production
```

`next dev` loads `.env.local` — it announces `Environments: .env.local` on boot — and
`src/lib/server/prisma.ts` builds its pool straight from `DATABASE_URL`. There is no local Postgres
on this machine to fall back to; WSL2 is broken, so Docker cannot start a Linux engine.

**Therefore `npm run dev` is a production client.** Every Server Action, every page render, every
admin mutation performed while "just running it locally" reads and writes the production Neon
branch.

### 1.1 This is verified, not inferred

While proving the admin-bypass fix, an authenticated admin Server Action was POSTed to
`http://127.0.0.1:3111`:

```
toggleArchivePet("pet-001", true)  ->  {"success": true}
```

A direct read of the Neon branch immediately afterwards:

```json
{"id":"pet-001","name":"Bella","isArchived":true,"deletedAt":"2026-08-28T15:24:05.052Z", ...}
```

A live animal was soft-deleted from the production catalogue by a request to `localhost`. It was
restored the same way (`toggleArchivePet("pet-001", false)`), and the row now reads
`isArchived: false, deletedAt: null`, with `archived count: 0` across the table. Only `updatedAt`
retains the churn.

### 1.2 It reframes the bypass that was just closed

`URGENT_NONPRODUCTION_ADMIN_BYPASS.md` §1.3 was careful not to overstate itself:

> The exposure is not "an attacker on the internet". It is "anyone who can reach a non-production
> instance can rewrite the pet catalogue, and the audit row will say nobody was signed in".

On this machine the pet catalogue **was the production database**. So the true exposure, before
`4952eb1`, was:

> anyone who could reach a `next dev` instance — a LAN, a forwarded port, a tunnelled preview —
> could rewrite **production** data, unauthenticated, and the audit row would name nobody.

The finding was understated, not overstated. That is worth recording, because §1.3's precision was
explicitly intended to stop the fix being deprioritised.

### 1.3 What is still exposed after the bypass fix

Authentication now holds, so this is no longer an anonymous-write path. What remains:

- **Any local development mistake is a production mistake.** A half-finished mutation, a seed
  script, a debugging click through the admin UI, a test fixture written by hand — all land in
  production. There is no undo beyond Neon's branch history.
- **Reads are production reads.** Applicant records carry PII under PDPA 2010; they are being pulled
  onto a development machine as a side effect of `npm run dev`.
- **The seeded demo credentials work against it.** `admin@hopeforstrays.org` / `admin123` is
  hard-coded in `src/lib/server/userStore.ts`. Whether those users exist in the Neon branch is
  **not established** and should be the first thing checked — if they do, the production database
  accepts a password that is published in the repository.

---

## 2. Why it is like this

Not carelessness. There is nowhere else to point:

- WSL2 returns `Wsl/CallMsi/Install/REGDB_E_CLASSNOTREG` on every call, so Docker Desktop's only
  context (`desktop-linux`) cannot start. Windows 11 Home rules out the Hyper-V backend.
- There is no native Postgres on the host.
- `tasks/todo.md` records the previous work stream hitting exactly this: `npm run db:seed` was
  targeting Neon production because `prisma.config.ts` loads `.env.local` first. That stream added a
  refusal guard to **the seed**, and pinned `npm run test:db` to localhost.

The guard was applied where the danger was noticed — the seed script — and not to the thing that
runs far more often. `next dev` was never fenced.

---

## 3. Do this

Ordered by how much safety each buys per unit of work.

1. **Establish the actual risk first, before changing anything.** Read-only:
   - Does the Neon branch contain the seeded demo users, and do their password hashes match the
     published `admin123` / `coord123` / `staff123` / `vol123`? If yes, that is a live credential
     incident and takes priority over everything else in this document.
   - How much real data is in there — is this the shelter's actual catalogue and real applicant PII,
     or a copy that happens to be labelled `production`?
2. **Stop `next dev` from silently using a production URL.** The seed's refusal is the pattern to
   copy: `prisma/env.ts` already knows how to reject a non-local target. The equivalent for the app
   is a boot-time check in `src/lib/server/prisma.ts` — if `NODE_ENV !== "production"` and the
   resolved `DATABASE_URL` is not local, refuse to construct the client unless an explicit
   `ALLOW_REMOTE_DB=true` is set. Loud and opt-in, exactly like `ALLOW_REMOTE_SEED`.
3. **Give local development somewhere to point.** This is the real fix, and it is blocked: see §4.
   Until it is unblocked, the app is designed to run with no database at all and fall back to
   fixtures — so `DATABASE_URL` simply being *unset* for local dev is a working configuration and a
   safe default.
4. **Rotate `DATABASE_URL` if §3.1 finds published credentials work.** Rotation is already the shape
   of `TARGET_ENCRYPTED_ENV_COMMIT_DECISION.md`; this would be another entry in it.

## 4. Blocker

Item 3 needs a local Postgres, which needs Docker, which needs WSL2, which is broken on this machine
(`wsl --update` from an elevated shell, then a Docker Desktop restart). This is the same blocker
recorded in `tasks/todo.md` for the Tier-3b database suites, and it is now blocking a second thing.

Item 2 does **not** depend on it and can land immediately.

## 5. Explicitly not in this task

- **Do not commit `.env.local`, or any part of it, anywhere.** It is untracked, `.gitignore`d, and
  holds live credentials. Nothing in this document needs its contents reproduced beyond the host and
  branch name already quoted.
- **Do not "fix" this by deleting `.env.local`.** Something put a production URL there deliberately;
  find out what depends on it (`prisma.config.ts`, the Neon CLI, deployment tooling) before removing
  it.

## 6. ⚠️ Coordination

This branch has concurrent sessions committing to it, one of which commits with `git add -A`. If you
act on §3.2, `src/lib/server/prisma.ts` is the file to watch — check `git log --oneline -5` before
composing a commit, not just `git diff --cached`, because your work may already be in history under
someone else's message.

## 7. How to verify anything here yourself

The dev server's Server Action ids are in `.next/dev/server/server-reference-manifest.json`, but it
does not name the exports; identify them by probing argument shapes. Two traps worth inheriting:

- **`deletePet(id)` ignores a second argument**, so `["pet-001", false]` on it archives rather than
  restores. The real `toggleArchivePet(id, archive)` is a different id.
- **Do not verify a write by reading the rendered page.** `/admin/pets` was byte-identical before and
  after an archive that had genuinely landed in Neon — the read path served fixtures. Query the
  database directly, and build the client the way `src/lib/server/prisma.ts` does
  (`new PrismaClient({ adapter: new PrismaPg(pool) })`); a bare constructor throws on this version.

---

## 8. Dispatch prompt

```
In C:\Users\User\pet-shelter, stop the dev server from using the production database.

Read docs/tasks/URGENT_DEV_SERVER_WRITES_PRODUCTION_DB.md first.

.env.local carries a Neon DATABASE_URL with NEON_BRANCH=production. `next dev` loads .env.local
and src/lib/server/prisma.ts builds its pool straight from DATABASE_URL, so `npm run dev` on this
machine reads and writes production. This is verified, not theoretical -- see §1.1.

DO §3.1 FIRST, AND IT IS READ-ONLY. Before changing any code, establish whether the seeded demo
users in src/lib/server/userStore.ts (admin@hopeforstrays.org / admin123, and the coordinator,
staff and volunteer equivalents) exist in that Neon branch with matching password hashes. Those
passwords are published in the repository. If they work against production, stop and report it --
that is a live credential incident and it outranks everything else in the document. Report what
you actually found either way.

Then implement §3.2, which does not depend on the WSL blocker: make src/lib/server/prisma.ts
refuse to construct a client when NODE_ENV !== "production" and the resolved DATABASE_URL is not
local, unless ALLOW_REMOTE_DB=true is set.

Do not invent the local check. prisma/env.ts already exports isLocalDatabaseUrl(), a deliberate
allow-list of localhost / 127.0.0.1 / ::1 / host.docker.internal, and assertSeedTargetIsLocal()
is the refusal it feeds. Reuse them, and read the comment above LOCAL_HOSTS explaining why it is
an allow-list and not a deny-list before changing it. The refusal must name the host it rejected,
because a silent fallback to fixtures is how this went unnoticed for so long.

Note that prisma/ is outside the src/ path alias, so check how the app is expected to import from
it -- if it cannot, move the shared predicate rather than copying it. A second copy of this rule
is the exact defect shape this repo keeps producing.

The app is designed to run with no database at all, so an unset DATABASE_URL is a working and safe
local configuration. Do not add a hardcoded localhost fallback that papers over the refusal --
src/lib/server/prisma.ts:13 already has one, and it is part of why this was invisible.

Do NOT commit .env.local or any part of it, and do not put the Neon host or credential into any
tracked file -- the endpoint id currently appears in no committed file and must not start now.
Do NOT delete .env.local; find out what depends on it (prisma.config.ts, the Neon CLI, deployment)
before touching it.

Verify: npx tsc --noEmit, then npm run test:all. Re-establish the baseline count first, other work
streams are active on this branch and it moves. Then prove the guard by running `npm run dev` with
the real .env.local and showing it refuses, and again with DATABASE_URL unset and showing the app
boots on fixtures. Report what you saw.

This branch has concurrent sessions committing with `git add -A`. Run `git log --oneline -5` as
well as `git diff --cached` before composing a commit, and commit by pathspec
(`git add -- <paths>` then `git commit --only -F <msg> -- <the same paths>`); your work may already
be in history under someone else's message.
```
