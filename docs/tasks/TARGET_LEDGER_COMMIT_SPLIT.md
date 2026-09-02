# Target — Split the Ledger out of `6c6d6d5`

**Date**: 2026-08-27
**Branch**: `feat/tnrm-rehabilitation`
**Status**: optional cleanup, **not** a correctness fix — read §5 before doing it
**Predecessor commit at authoring**: `cddcec4 docs: record the design-system guard as the next target`

> **Scope**: commit `6c6d6d5` mixes an entire donation-ledger subsystem into a commit whose message
> describes only UI work. Nothing is lost or broken; the ledger simply cannot be found from
> `git log`. This document records how to split it, and the reasons not to bother.

---

## 1. What went wrong

`6c6d6d5 feat(pets,donations): implement tabbed animal profiles and personalized sponsorship with
pet chooser carousel` contains, in addition to the UI work its message describes:

- `src/lib/donationLedger.ts` (358 lines) — the receipt ledger
- `src/lib/domain/money.ts` (147) — exact integer-sen money
- `src/lib/domain/shelterIdentity.ts` (81) — statutory identifiers
- `prisma/schema.prisma` — the `Donation` and `ReceiptSequence` models
- `prisma/sql/donation_append_only.sql`
- `src/actions/donations.ts` — rewritten onto the ledger
- `src/lib/exportCsv.ts`, `tests/setup/nextMocks.ts`, `docs/architecture/LAYERS.md`
- four test files, ~539 lines of tests

This happened because a concurrent session committed the working tree with `git add -A` while the
ledger work sat uncommitted. See the standing warning in §4.

## 2. Verify before touching anything

Every fact below drifts. **Re-check, do not trust:**

```bash
git log --oneline origin/feat/tnrm-rehabilitation..HEAD   # all should be UNPUSHED
git show --stat 6c6d6d5                                   # derive the real file list
git log --oneline 6c6d6d5..HEAD                           # commits that must survive
```

At authoring time: origin was at `592c6b0`, with **11 unpushed local commits**; `6c6d6d5` sat
**seven** commits deep; the rebase base was `4c9d3f2`. **If anything is pushed, STOP** — this
rewrites history, and that is only safe while the commits are local.

## 3. The split

`6c6d6d5` becomes two commits, ledger first.

**Commit A** — `feat(donations): add the LHDN receipt ledger with gapless numbering`

Derive the exact file list from `git show --stat 6c6d6d5`; it is the set in §1. Take
`prisma/schema.prisma` **whole** — `npx prisma format` reflowed the entire file when the models were
added, so the formatting churn and the ledger models cannot be cleanly separated, and trying is how
this task turns into an afternoon.

The message body should record the reasoning that is otherwise invisible in a diff:

- `Donation` + `ReceiptSequence` models.
- Gapless numbering via a counter row incremented **inside the insert's transaction**, so a number
  is consumed if and only if the receipt exists. A Postgres `SEQUENCE` is not gapless — a
  rolled-back transaction burns its value permanently, and a hole in a statutory receipt series
  reads to an auditor as a destroyed receipt.
- Money as exact **integer sen**, not `Float` (inexact) and not Prisma `Decimal` (does not survive
  the `"use server"` boundary as a class instance).
- Donation writes deliberately do **not** use the dual-layer fallback: there is no committed fixture
  for an event that has not happened, so a failed write must fail the request rather than mint an
  unbacked tax receipt.
- The ledger has **never been run against real Postgres**.

**Commit B** — everything else in `6c6d6d5`, original message verbatim.

## 4. ⚠️ Another session is writing this branch

At authoring time **21 uncommitted paths** in the tree were *not* mine — `src/app/**`,
`src/components/**`, `src/lib/petStatusPresentation.ts`, `src/app/globals.css`,
`tests/unit/medicalTimeline.test.ts`. A rebase needs a clean tree.

- Do **not** commit, discard, or `git stash` that work. Stashing this repo has already caused a
  CRLF conversion across ~19 files mid-session.
- Ask the user how to park it. If you cannot proceed without touching it, **stop and report**.

## 5. 🛑 Reasons not to do this

This is cosmetic. The ledger works, is fully tested, and is documented in `CLAUDE.md`
("The ledger exception"), `docs/architecture/LAYERS.md` L-B2, and
[`TARGET_SCHEMA_TYPE_INTEGRITY.md`](TARGET_SCHEMA_TYPE_INTEGRITY.md) §2 — so it is *discoverable*,
just not from `git log`.

Against that: rewriting seven commits of history while another session holds 21 dirty files is the
riskiest operation on the current backlog, for the least benefit.

**If there is bandwidth for only one thing, do the Postgres verification instead** —
`docker compose up -d && npm run db:push && npm run db:seed`, then issue a donation and confirm the
row and receipt serial. That closes a real unverified assumption; this closes a tidiness complaint.

**Lower-risk alternative**: `git notes add -m "Contains the donation ledger — see
docs/tasks/TARGET_SCHEMA_TYPE_INTEGRITY.md §2" 6c6d6d5`. Annotates the commit without rewriting
anything. Does not show in `git log --oneline`, but costs nothing and cannot break.

## 6. Mechanics

Claude Code's Bash tool does **not** support `git rebase -i`. Drive it non-interactively:

```bash
git branch backup/pre-ledger-split
GIT_SEQUENCE_EDITOR="sed -i '1s/^pick/edit/'" git rebase -i 4c9d3f2
# at the stop:
git reset HEAD^
#   ...stage and commit group A, then group B...
git rebase --continue
```

## 7. Acceptance criteria

```bash
git diff backup/pre-ledger-split..HEAD   # MUST be empty — identical trees
git log --oneline -10                    # every later commit still present
npx tsc --noEmit                         # clean
npm run test:all                         # 40 files / 517+ tests green
```

Report the before/after log. **Do not push.**
