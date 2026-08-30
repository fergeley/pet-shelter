# RISK VETO — the one-way doors in this repo

Triage test 0 (`.claude/agents/midwife.md` §1). If a task touches anything on this list, it is
**GRAVE regardless of diff size**, and the door itself is the one place halting is correct
(invariant 7).

This is data, not doctrine. It is specific to this codebase and goes stale — every entry carries
the date it was last verified and the command that verifies it. **Re-verify an entry before
relying on it; do not cite this file as evidence.**

---

## 1. The dev database is production

`.env.local` sets `NEON_BRANCH=production` and points `DATABASE_URL` at the Neon production
branch. There is no local-by-default. **A mutating Server Action executed on `localhost` is a
production write.** Running the dev server is not itself the risk; exercising a mutation in the
browser is.

- Verify: `grep '^NEON_BRANCH' .env.local` → expect `production` *(verified 2026-08-30)*
- Local escape hatches that exist: `npm run db:push:local`, `npm run db:seed:local`,
  `npm run test:db` — all three pin `DATABASE_URL` to `localhost:5432` via `cross-env`.

## 2. `db:push` and `db:seed` have no undo

There is **no `prisma/migrations/` directory** — this repo uses `prisma db push`, which applies
schema drift directly with no migration history and no down path. Against the production branch,
a column rename is a column drop.

- Verify: `ls prisma/migrations` → expect "No such file" *(verified 2026-08-30)*
- `npm run db:push` / `npm run db:seed` inherit `.env.local` → **production**.
  The `:local` variants do not. The four characters are the whole safety margin.

## 3. Outbound email actually sends

`src/lib/email.ts` reaches Resend with `RESEND_API_KEY`, `EMAIL_FROM`, and
`SHELTER_NOTIFICATION_EMAIL` from `.env.local`. Mail that leaves is not recallable, and the
recipient may be a real shelter address.

- Verify: `grep -rln RESEND_API_KEY src` → `src/lib/email.ts`, `src/actions/settings.ts`
  *(verified 2026-08-30)*

## 4. Secrets in the working tree

`.env.local` holds `ADMIN_SECRET_KEY`, `SESSION_SECRET`, `RESEND_API_KEY`, and two database URLs
with credentials. `obsidian-api.http` holds the Obsidian API key. Both are gitignored — the veto is
on anything that could move a literal value out of them: a new committed file, a log line, a test
fixture, an error message, a paste into a report.

- Never print a secret's value to satisfy a check. Grep for the **key name**, not the line.

## 5. Git history and the shared index

Another Claude session works this branch concurrently and stages files. Consequences:

- `git add -A` / `git commit -a` **commits the other session's in-flight work under your message.**
  Stage explicit paths, always.
- Check `git diff --cached --name-only` in a *separate* call before committing — not chained after
  a `git add`, or you are reading your own writes.
- Never `git stash` (it pulls their work out from under a running process), never `reset --hard`,
  never force-push, never rewrite history on a shared branch.
- Do not break a guard "to prove it works" in this tree; the other session repairs the breakage
  into history. Use a scratch copy (`.claude/agents/midwife.md` §3, Phase 1).
- Commit with a pathspec — `git add -- <paths>` then `git commit -F <msg> -- <the same paths>` —
  so its staged work stays staged rather than riding along.

## 6. Anything outbound or published

Artifacts, PRs, comments, issue posts, the Obsidian vault at `Areas/Pet Shelter/`, any HTTP request
that leaves the machine. Publishing is a one-way door even when a delete button exists downstream:
it may already be cached, indexed, or read.

## 7. Deleting or overwriting what you have not read

Files, directories, database rows, ledger entries. Look at the target first. This includes
overwriting a doc whose current content you assumed rather than opened.

---

---

# Environment constraints

Not vetoes — facts about what this machine and tree can actually do. The mechanics file
(`.claude/agents/midwife.md`) states rules; the reasons they bind *here* live in this section.

## Falsification ladder: rung 1 is missing for persistence

`npm run test:db` needs a Postgres on `localhost:5432`, and **Docker cannot start on this machine**
— WSL is broken, so the Linux engine never comes up. Check `wsl --status` before waiting on it.

Consequence for Phase 2: for anything touching persistence there is **no pre-paid experiment** to
spend. Climb to the walking skeleton; do not let a missing rung 1 drop you silently to
reasoning-only. *(Verified 2026-08-30 — unit tiers are unaffected, they run in memory.)*

## The working tree is shared with a live writer

The rules are §5 above; this is the evidence for why they are not theoretical.

An intentionally broken guard, left in the tree across two tool calls, was diagnosed by the other
session as a genuine defect and "fixed" — landing a commit whose message describes repairing a
defect that never existed. Nothing broke, but the history now records a fiction. That is why
guards are proven in a scratch copy and never in this tree.

## Sub-runs need permission

Spawning sub-agents requires the human to ask for it in this setup. When Phase 2 calls for an
isolated sub-run and none is available, run the spike in-session and record
`Context-isolated: no` on the verdict rather than claiming isolation you did not have.

---

## What is *not* on this list

Reading anything. Running the test suites (`npm test`, `npm run test:all` — unit tiers are
in-memory). Typechecking, linting, building. `db:push:local`, `db:seed:local`, `test:db`. Writing
to `tasks/`, `docs/`, or the scratchpad. Creating a branch.

Padding this list makes it decorative. If everything is a one-way door, triage test 0 fires every
time and the lanes stop meaning anything.
