# Handoff: the guardrail stream is closed — what to pick up next

- **Written**: 2026-09-05, at session close
- **Branch**: `master`, tree clean. This session's 11 commits are `dbf4979..24b40c9`, and
  `origin/master` is **already at `24b40c9`** — someone else pushed them mid-session (see §1d).
- **Gates at close**: `npm run check` 0 (typecheck, lint, docs:check) · `arch:check` 0 ·
  `npm run test:all` **1,387 / 1,387 across 88 files**
- **Read first**: `docs/tasks/TARGET_AGENT_GUARDRAILS.md` — what was settled and measured. This
  file is only the leftovers and the recommendation.
- **Standing rule**: nothing below is waived by having been written down. Re-run before trusting.

---

## 1. Do these first — small, and two are self-inflicted

### 1a. Re-run `claude auto-mode critique`

The `autoMode.allow` rules in `~/.claude/settings.json` are at **v2 and have never been reviewed**.
v1 was reviewed and had two real holes: it blessed `npm run` generically while `soft_deny` blocked
`npm run db:push` (allow overrides soft_deny, and the classifier does not read `package.json`), and
it cleared a content grep of `.env.local`. Both are fixed in v2. Given that two of three drafts were
wrong and neither was visible on re-reading, **v2 gets the same scrutiny, not the benefit of the
doubt.**

Watch the Overall paragraph for a **(c)** about false-positive pressure. If it is gone, the allow
rules did their job. Expect the output to truncate around issue 2–3 — six runs across two terminals
all cut in the same place; that is the command, not you.

### 1b. `tasks/lessons.md` — stop appending to it, and fix it

`tasks/open/lessons-md-collides-like-the-old-ledger.md` is **open and escalated**: a conflicted PR
gets *no GitHub Actions run at all*, because `pull_request` workflows run against a computed merge
commit and a conflicted PR has none. The ledger was restructured to one-file-per-entry to kill
exactly this; `lessons.md` never was, and every session appends to the same region of it by rule.

**This session appended to it four times.** That was the wrong call each time — the defect was
already filed. The entries are worth keeping; the file shape is not. Whoever picks this up should
split `lessons.md` the way `tasks/` was split, then delete that open note.

### 1c. Two "open" entries are already resolved

`tasks/README.md` says *"`open` means genuinely unresolved."* These two say otherwise in their own
header and should be deleted:

- `tasks/open/admin-application-delete-leaves-the-row.md` — *"Status: resolved 2026-09-04"*
- `tasks/open/server-action-auth-guard-has-not-seen-the-faq-reads.md` — *"Status: resolved 2026-09-03"*

Same defect shape as everything else this session: a record that says one thing while the world says
another. Cheap to fix, and it makes the remaining 13 trustworthy.

### 1d. Nothing to push — someone else already did, mid-session

This session pushed nothing. Twenty minutes before close, `git log origin/master..master` reported
**3** commits ahead; at close it reported **0**, with `origin/master` at `24b40c9`, identical to
local `master`. Another actor — the concurrent session or the human — pushed all eleven while this
one was still working.

Two things follow. **The `Direct Push To Master` rule written this session has therefore never been
exercised**; the push that would have tested it happened elsewhere. And this is a live instance of
the standing trap: `origin/master` moves under you, so a count taken at the start of a task is not
valid at the end of it. Re-measure `git rev-list --left-right --count origin/master...master`
immediately before acting on it, never from memory.

The repository is PUBLIC. Those eleven commits are world-readable now; they were reviewed and carry
no secrets, but the window between committing and someone else pushing is not yours to control.

---

## 2. Recommended next target: reconcile the production schema

`tasks/open/production-schema-has-drifted-ahead-of-master.md` — **open, measured against the live
production branch on 2026-09-03, not inferred.**

This is the right next target because it closes the loop this session opened. The whole guardrail
stream existed to stop one command. The command is still loaded:

- `npm run db:push` resolves through `prisma.config.ts` → `resolveDatabaseUrl()` → `.env.local`,
  which holds `NEON_BRANCH=production`.
- `prisma/env.ts` guards `db:seed` with `assertSeedTargetIsLocal`. **Nothing guards push.**
- A read-only `prisma migrate diff` returned **265 lines, 12 of them destructive** — enum
  conversions on `ApplicationStatus` / `PetStatus`, drops of `pets.age` and `ageCategory`, and
  `DROP TABLE "faqs"`, `DROP TABLE "notification_preferences"`, `DROP TYPE "FaqCategory"`.

Running it today destroys the FAQ feature and notification preferences. Five of the original twelve
lines are already gone because the QR branch declared columns it had applied — so **re-measure with
`migrate diff` first; do not trust the list above.** That is the note's own instruction.

The defence built this session is real but it is all interception: `permissions.deny` blocks the
npm scripts, and the classifier's `Production Database Write` rule blocks the underlying commands.
Interception is not the same as the gun being unloaded. The target is to make `master` declare what
production actually has, so `db push` stops being destructive by construction.

**Start by reading** `docs/tasks/URGENT_DB_PUSH_DESTROYS_PRODUCTION.md` and
`tasks/open/production-schema-has-drifted-ahead-of-master.md` together, then re-run the diff. Schema
changes here ship as **additive SQL under `prisma/migrations/manual/`** — three such migrations
already exist — never as `db push`.

---

## 3. Traps that carried through this session

- **Neither settings file is agent-editable.** `~/.claude/settings.json` refuses every agent edit;
  `.claude/settings.json` accepted an Edit in the morning and refused one in the afternoon with the
  custom rule that caused the earlier refusal already removed. Treat any change to either as a
  human step, and put the exact replacement lines **in the reply body** — not in an attached file.
- **A malformed `settings.json` silently disables every setting in it.** After any hand-edit:
  `node -e "JSON.parse(require('fs').readFileSync(require('os').homedir()+'/.claude/settings.json','utf8'));console.log('valid JSON')"`.
  This caught a real breakage mid-session.
- **`allow` is the dangerous direction.** A too-broad `deny` costs a prompt; a too-broad `allow`
  removes a guard silently, in exactly the case someone wrote a rule about. Write `deny` in terms
  of effect, `allow` as literal commands and path globs — never intent. Verify an allow rule by
  asserting what it must **not** match.
- **A guard cannot be tested against the tree it observes.** Three assertions in
  `tests/unit/agentGuard.test.ts` were coupled to this working tree and were found one at a time.
  Any assertion about a tool that reads `git status` needs a repo the test creates.
- **`claude auto-mode critique` is the independent reader.** It caught every defect in the rules
  this session, including three of mine that I could not see on re-reading. Self-review structurally
  cannot do that job. Run it whenever the classifier config changes.
