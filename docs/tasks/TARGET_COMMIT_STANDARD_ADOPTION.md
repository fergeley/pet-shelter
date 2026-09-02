# Target — Commit Standard Adoption

**Date**: 2026-09-01
**Branch**: `feat/commit-message-standard` (branched from `feat/tnrm-rehabilitation` at `28159f3`)
**Baseline** *(re-measured 2026-09-02 at `78609a1`)*: 60 test files / **830** tests green across the
`unit`, `integration` and `components` projects · `npx tsc --noEmit` clean · `npm run lint` 0 errors
(5 warnings)

> **Reproduce it with the npm script, not bare `vitest`:**
>
> ```bash
> npm run test:all      # pretest:all runs `prisma generate` for you
> ```
>
> Every vitest entry point now has a `pre*` hook that runs `npm run db:generate` first
> (`pretest`, `pretest:watch`, `pretest:components`, `pretest:integration`, `pretest:all`,
> `pretest:coverage`). **`npx vitest run …` bypasses all of them** — npm only runs a `pre` hook for
> its own script — so run `npx prisma generate` yourself if you invoke vitest directly.
>
> Skip the generate step and this repo reports **11 failures** across `petHistory`,
> `rehabilitation`, `petStatusPresentation` and `setupMocks`, all of the shape
> `TypeError: Cannot read properties of undefined (reading 'Available')` — `PrismaPetStatus` comes
> back `undefined`. That is a stale generated client, not a regression, and CI never sees it
> because every CI job runs `npx prisma generate` first.
>
> The `pre*` hooks close the forgetting case, not the racing one. **`node_modules` is shared with
> the main checkout and every worktree**, so a concurrent session installing against another branch
> invalidates the environment underneath a run already in progress. Observed twice: the same suite
> went green, then red, then green again with no source change.
>
> Worse, and observed in the same session: **`jsdom` vanished from `node_modules`** while still
> declared in `package.json`. The entire `components` project stopped running — `Test Files no
> tests`, `Errors 4` — and in a combined run that presents as a *smaller total* (56 files / 775
> tests instead of 60 / 830) rather than as a failure. **Compare the file count against what is on
> disk**, not just the pass count; `npm run test:all` does exit 1, but the number that changes first
> is the denominator. **Treat CI, not a local run, as the authority on green.**
>
> `integration-db` is excluded deliberately: `DATABASE_URL` resolves to the **production** Neon
> branch, so that tier is not safe to run locally at all.
**Predecessor commit**: `c7d5db2 docs(ledger): Record the commit-msg hook install`

> **Scope**: this records the follow-on to adopting Chris Beams' seven rules as the commit standard
> (`2c67d77` the linter, `4ae458c` the standard, `a394a63` the lesson, `c7d5db2` the hook install).
>
> The standard is written, the linter is proven, and the hook is installed. **It currently enforces
> nothing outside this branch.** This document is the list of what turns that on and what is still
> genuinely undecided.

---

## 1. 🔴 Why this is the next target

Every number below is the **pre-standard** baseline, reproducible with:

```bash
npm run commit:audit -- 28159f3     # the branch point: exactly the 203 commits that predate this
```

Pinned to `28159f3` on purpose. A bare `npm run commit:audit` walks `HEAD` and now includes this
branch's own compliant commits, so it reports a larger denominator and slightly lower percentages —
that is adoption working, not the table rotting. **Re-run the pinned command before building on this
section anyway**; this repo has shipped target docs whose baseline had already gone stale.

**A single rev and a range are not interchangeable, and the difference is easy to misread.**
`28159f3` audits every commit *reachable from* that rev — a fixed set of 203, immune to whatever
lands later. `28159f3..HEAD` audits everything on this branch *since* that point, which after a
merge also sweeps in the base branch's grandfathered commits and reports a much worse ratio
(`7/12` at the time of writing) for a branch whose own commits are all clean. Both numbers are
correct; they answer different questions. The gate in CI deliberately uses
`origin/<base>..HEAD`, which excludes anything already reachable from the base branch, so merging
the base in never dilutes it — that range reported `7/7` in run `33644884010`.

**Zero of the 203 commits that predate the standard pass it.**

| Rule | Commits violating | Share |
|---|---|---|
| 3 · capitalize the summary | 190 | 94% |
| 2 · subject over 72 (error) | 97 | 48% |
| 6 · body wrap at 72 | 97 | 48% |
| 7 · no body at all (warning) | 87 | 43% |
| 2 · subject over 50 (warning) | 86 | 42% |
| — · not Conventional Commits | 13 | 6% |
| 1 · no blank line after subject | 5 | 2% |
| — · stray shell delimiter | 5 | 2% |
| — · scope not kebab-case | 3 | 1% |
| — · type outside the set | 1 | 0% |

Mean subject length is 72.7 characters against a target of 50. That gap is the whole adoption cost,
and it is paid one commit at a time going forward — the history is grandfathered deliberately
(§3.3).

### 1.1 The hook is installed and inert

`.git/hooks/commit-msg` exists and is armed for the main checkout and every worktree at once
(hooks live in the **common** git directory — a worktree does not isolate them). But it resolves
its linter as `$(git rev-parse --show-toplevel)/scripts/commit-msg.mjs` and **exits 0 when that
file is absent**. The file exists only on this branch. The main checkout is on
`feat/tnrm-rehabilitation`, whose `scripts/` holds `secrets.mjs` alone.

**So the enforcement mechanism ships on the same branch as the thing it enforces, and is inert
exactly until that branch lands.** Verify before assuming otherwise:

```bash
test -f scripts/commit-msg.mjs && echo enforcing || echo inert
```

### 1.2 What nothing protects

- **Rule 7 — "what and why" — has no machine check and never will.** The linter warns on a missing
  body and stops. 43% of history has no body at all. If the standard is going to fail anywhere, it
  fails here first, silently, and only a human reading a diff will notice.
- **The imperative blocklist is explicit and incomplete by design.** It catches `Added`/`Adds`/
  `Adding` and about 40 more; it cannot catch every wrong mood, because `seed`, `embed`, `feed`,
  `proceed` and `needs` are imperatives a naive `-ed`/`-s` rule would reject. Green from the linter
  is not proof of rule 5.
- **A subject can satisfy every rule and still be useless.** `fix(ui): Fix the bug` passes clean.

---

## 2. What already landed

| Artifact | What it is |
|---|---|
| `docs/reference/COMMIT_MESSAGES.md` | The standard. The **only** copy. |
| `scripts/commit-msg.mjs` | Dependency-free linter: hook interface, `--stdin`, `--audit`. |
| `tests/unit/commitMessage.test.ts` | 62 tests; every rule asserted red **and** green. |
| `.claude/hooks/commit-msg` | The hook. Fails open when the linter is absent. |
| `scripts/install-git-hooks.mjs` | Installs one named hook; normalizes CRLF→LF. |
| `.gitattributes` | Pins `.claude/hooks/*` to LF. Narrow on purpose. |
| CI job `commits` | Lints only the commits a pull request adds. |

Three diverged copies of the convention were collapsed into one: `CONTRIBUTING.md` gave scopeless
examples, `WHERE_CODE_GOES.md` required a scope, and `atomic-commit.md` specified a body wrap of 80
that nothing else mentioned. All three now point at the standard and state nothing themselves.

---

## 3. The open decisions

### 3.1 Merge, which is what actually switches enforcement on

Base the pull request on **`feat/tnrm-rehabilitation`**, not `master` — this branch sits on that
tip, and a PR to `master` would drag the whole TNRM series in. Nothing else in this document
matters until this happens.

**Settles when:** the branch merges and `test -f scripts/commit-msg.mjs` is true in the main
checkout.

### 3.2 Whether `pre-commit` joins it

`.claude/hooks/pre-commit` blocks staged secret-bearing files and secret-shaped literals. It is
still not installed, deliberately: it can reject another session's in-flight commit over a *staged
file*, and nobody asked for it. One command: `node scripts/install-git-hooks.mjs pre-commit`.

**Settles when:** the human installs it or says to drop it —
`tasks/open/pre-commit-hook-not-installed.md`.

### 3.3 The five `@` commits stay broken

`a95ba33`, `4251a4c`, `2e23bb1`, `ec094f4`, `edffe74` render as `@` in `git log --oneline`. Fixing
them means rewriting a shared branch, which is a one-way door with a concurrent session committing
to it. They are recorded, not repaired. **Do not reopen this without a reason better than tidiness.**

### 3.4 Rule 3 is the one place the standard broke with habit

Capitalizing the summary invalidates 190 of 203 existing subjects. It was chosen because
`Feat(ui):` would break every parser reading this history, so Beams' rule has to land on the part a
human reads as a title. If it proves more friction than it is worth, it is one branch in
`lintCommitMessage` to flip — but flip it deliberately and record the reversal as a new dated
decision, never by editing
`tasks/decisions/2026-09-01-commit-standard-is-beams-over-conventional-commits.md`.

---

## 4. The measurement that says whether this worked

The baseline is 0/203. The only honest test of adoption is the commits written *after* the standard
lands:

```bash
npm run commit:audit -- <merge-commit>..HEAD
```

**Target: 100% clean, and it should stay there without effort once the hook is live.** If it drifts
below, the interesting question is not "who broke it" but which rule is generating friction — a
rule that everyone bypasses with `--no-verify` is a rule to renegotiate, not to enforce harder.

Warnings are expected and are not drift: rule 2's soft limit fires on any subject over 50, and
`c7d5db2`'s own predecessor `a394a63` carries one at 59 characters.

---

## 5. Step plan

1. Open the PR against `feat/tnrm-rehabilitation`. The `commits` CI job proves itself on its own
   branch — 4/4 clean at the time of writing.
2. Merge. Confirm enforcement flipped: `test -f scripts/commit-msg.mjs` in the main checkout.
3. Tell the other session the standard exists. `AGENTS.md` carries the pointer, which is what it
   reads at its next start; until then its first rejection will arrive unannounced, with the
   standard's path and `--no-verify` in the message.
4. Decide §3.2.
5. After ~20 new commits, run §4. Renegotiate any rule that is being bypassed rather than followed.
