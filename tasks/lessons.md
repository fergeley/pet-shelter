# Lessons

Patterns worth not relearning. Newest first.

## 2026-08-28 — An import guard that reads specifiers does not care about `import type`

`tests/unit/layerBoundaries.test.ts` builds its graph with a regex over import *specifiers*. It
never parses the statement, so `import type { X } from "@/lib/server/y"` is an edge exactly like a
value import — and the boundary fails on it. That is correct: the guard is about the layer you are
coupled to, not the bytes that survive compilation. But it means the obvious way to keep two shapes
in sync — `ReturnType<typeof getServerFaqCategories>` in the client component — is closed, and the
error arrives at test time rather than from `tsc`.

**Rule:** when a "use client" module needs the *shape* of something a server module returns, declare
it structurally in `src/lib/presentation/` and let both sides satisfy it. Do not reach for
`import type` as a loophole; there isn't one. And before claiming a guard covers a case, inject the
violation and watch it go red — the type-only form was verified this way, not assumed.

## 2026-08-28 — The trap a brief warns you about can be wrong in the brief

`/fix-category-tabs` spent a numbered trap on the "all" tab: do not drop it, losing it is the
quietest way to break this. The same paragraph then gave one literal tab for both components —
`"All Topics"` / `"Semua Topik"` — and `RehabNeedsSection` actually said `"All Wishlist Items"` /
`"Semua Barangan Keperluan"`. Following the warning literally would have committed the exact silent
relabel it was written to prevent. The brief also framed the defect as dead tabs when the category
sets were already right and 7 of 9 *labels* had drifted.

**Rule:** a brief's warnings are claims about the tree, with the same status as its file paths — read
the values out of the source before trusting either. Being told where the trap is does not mean the
sentence naming it is accurate.

## 2026-08-28 — On this branch, a target doc goes stale in hours

`TARGET_PERSISTENCE_TARGETING.md` P-2 asked which of two things Tier 3 should be. The concurrent
session answered it — with `tests/integration/support/prismaDouble.ts`, splitting Tier 3a from
Tier 3b — before the ink was dry, and better than the framing in the target. The document had to be
corrected before anyone acted on it, or the next reader would have chased a decision already made.

**Rule:** re-run a target's own §1 / §3 claims against the tree immediately before starting work
from it, and again before writing "this is the only file" or any other exhaustiveness claim. Prefer
a measurement (`ls`, `grep -c`) over the reading you did an hour ago. Writing the conclusion down is
not the end of the job; keeping it true is part of it.

## 2026-08-28 — Ask which database a command resolves, before running it

`npm run db:push && npm run db:seed` looked like one operation against one database. It was two
operations against two, because the two halves loaded different env files:

- `prisma.config.ts` → `dotenv` on `.env.local` → a Neon branch marked `NEON_BRANCH=production`
- `prisma/seed.ts` → `import "dotenv/config"` → `.env` only, which this repo does not have → the
  hardcoded `localhost:5432` fallback

Both exit 0. The pair reads as an end-to-end verification while the halves have never met, and the
push half was mutating shared infrastructure.

**Rule:** before running any command that writes to a database, trace the env resolution for *that
specific command* and print the host it will hit. Never infer it from a sibling command in the same
npm chain. `dotenv` never overrides an already-set variable, so a shell-set `DATABASE_URL` is the
safe lever — it beats every env file without editing one.

**Corollary:** a destructive script (`deleteMany`, `TRUNCATE`, `db push`) that takes its target from
ambient configuration should refuse a non-local host and make the override explicit
(`ALLOW_REMOTE_SEED=true`). Configuration is not consent.

## 2026-08-28 — A test tier that can skip will eventually skip silently

`isLedgerPersistent()` reads `Boolean(process.env.DATABASE_URL)`, while `src/lib/server/prisma.ts`
invents a localhost URL when that variable is unset. A probe written to exercise Postgres therefore
takes the in-memory branch and passes — green, fast, having verified nothing. This is how "verified
against real Postgres" became a claim nobody had tested.

**Rule:** a tier whose whole purpose is to touch a real dependency must **fail** when the dependency
is absent, never skip. A skip renders as a pass in the summary line. Gate it out of the default test
command instead, so the everyday suite stays runnable without the dependency.

## 2026-08-28 — Verify against git before reporting data loss

Mid-task I reported that the other session had reverted `prisma/seed.ts` and destroyed its rehab and
history seeding. It had not. Its `npm install` was rewriting `package.json` in place, and file reads
during that window returned partial or stale content — including one snapshot with git conflict
markers that never existed on disk a second later.

**Rule:** before reporting that work was lost, confirm with `git diff HEAD -- <path>` and
`git show HEAD:<path> | grep -c <marker>`. A single read of a file in a repo with a concurrent writer
is a sample, not a fact. State the correction plainly and move on — see also
`docs/tasks/TARGET_PERSISTENCE_TARGETING.md` §8.

## 2026-08-28 — Critique the plan before executing it, even an approved one

The brief for this stream specified three things that did not exist or were unsafe: a
`recordDonationReceipt()` function (the export is `issueDonationReceipt()`), a §2 reference for
content living in §3 P-E, and a `db:push` step that would have written to production. Reading the
four named files first cost ten minutes and changed what the task *was*.

**Rule:** when handed a plan citing specific files, functions, and sections, verify each citation
against the tree before starting. Stale references are the normal case in a repo with an active
concurrent writer, not the exception.
