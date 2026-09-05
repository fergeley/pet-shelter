# First-party permission rules replace the hand-rolled shell parser

**Decided:** 2026-09-05 · MEASURED

**Reverses the enforcement half of `2026-09-05-guard-binds-the-main-conversation.md`**, written
earlier the same day. That entry stays as written. Its *placement* argument still holds — the
irreversible commands in this repo's incident log should be fenced for every session. What is
reversed is the mechanism: a `PreToolUse` hook that parsed shell command strings with regexes.

Authorised by the human on 2026-09-05: *"deterministic inbuilt mechanisms are preferable to
hand rolled untested ones."*

## Why the hand-rolled fence was abandoned

It was hardened five times. Defects found per independent pass: **8, then 12, then 14** — plus two
more found by its own corpus run. The rate never fell.

Worse than the count, it obstructed real work six times in about forty minutes of being armed:

1. It **blocked its own disarm script** — a compound command, where one denied segment killed the
   whole tool call.
2. It blocked a `grep` for its own test file, because segmentation split inside a quoted pattern
   and turned `grep -n 'git checkout …'` into a fake `git checkout`.
3. It blocked the same `grep` again after the first fix.
4. The fix for (2) introduced a **fail-open hole**: a reader-prefixed compound
   (`echo "<<EOF"` newline `git reset --hard`) was skipped entirely.
5. A corpus run over every shell command this project has executed (4,917 distinct, 5,028
   invocations, extracted from 71 session transcripts) denied **151 — 3.02%**, of which ~85 were
   legitimate: `git add prisma/seed.ts` matched a *path*, and `git -C .claude/worktrees/<name>` is
   the isolation mechanism this repo recommends.
6. After four fix rounds the corpus fell to **79 — 1.57%**, mostly true positives. Better, and
   still the wrong shape.

Every one of those had a single root cause: **it parsed shell text without a shell parser.** That is
not a code-quality problem that more rounds fix; each fix opened a new seam.

## The lesson, stated plainly

`gitWrites()` in the same file already said it: *"a blocklist is only as good as its author's
imagination."* The deeper miss is that **Claude Code ships a permission system**, and this machine
used none of it — user settings held only `defaultMode`, and neither project settings file had a
`permissions` key. A shell parser was hand-rolled and hardened five times while the platform's own
gate sat unused. The same platform gate is what correctly refused to let this session edit
`.claude/settings.json`, which is the principle the hand-rolled override was reaching for.

## What replaces it

Three first-party mechanisms in `.claude/settings.json`, chosen because each fits a different shape
of the problem:

**1. `permissions.deny` — commands that are never right here.** Force-push, and every Prisma schema
or data write that is not one of the three `:local` escapes. Exact-match entries
(`Bash(npm run db:seed)`) rather than wildcards, so `db:seed:local` is not swept up — the
false-positive trainer the hand-rolled version spent four rounds learning to avoid.

**2. `permissions.ask` — the judgment calls.** `git reset --hard`, `checkout -- <path>`, `restore`,
`clean -f`, `stash`, `commit --amend`, `rebase`, `branch -D`, `rm -rf`. These prompt **in band**.
That is strictly better than the mechanism it replaces, whose override required relaunching Claude
Code with an environment variable — an override an agent could not request and a human had to
restart for.

**3. `autoMode.environment` + `autoMode.soft_deny` — the semantic layer.** The classifier was
already running and already correct; it was simply **blind to this repo's one-way doors**, because
no `autoMode` block existed anywhere (confirming `tasks/open/` — the auto-mode profile was generated
without knowledge of `origin`). It now knows that `.env.local` points at the Neon production branch,
that there is no Prisma-managed migration history, that the working tree is shared with a live
second session, and that `master` is a shared branch. `soft_deny` carries exactly the semantics the
env-var override was hand-built for: *destructive actions that user intent can clear.*

## What is honestly worse

`permissions` rules are **prefix-matched against the start of the command string**. `Bash(git reset
--hard*)` does not catch `cd x && git reset --hard`. The hand-rolled parser did catch that, and
this is a real loss of coverage on the deterministic layer.

It is covered by `autoMode.soft_deny`, which is semantic rather than positional — but that is a
classifier, not a deterministic rule, so the guarantee is weaker in kind. The trade accepted here:
**a smaller deterministic surface that is vendor-maintained and provably correct at what it covers,
plus a semantic layer for the rest**, in place of a large deterministic surface that was wrong in a
new way on every inspection.

## What was kept

The `PostToolUse` drift log. It never denies, so it has no false-positive cost, and it observes the
**tree** (`git status --porcelain`) rather than tool inputs — which is why it records the `cat >`
and `sed -i` writes that auto mode actually steers toward. Reading `tool_input.file_path` had
recorded 1 file of 6.

`tests/unit/agentGuard.test.ts` also stays: 66 cases. The hook they cover is no longer wired for
`PreToolUse`, so they now pin the drift log, the two agent rules, and the wiring itself. **They are
also the specification** — every rule in `permissions` above was derived from a case in that file
or from the corpus run.

## Verified

`.claude/settings.json` parses; `PreToolUse` removed, `PostToolUse` retained; 13 deny rules, 9 ask
rules, `$defaults` inherited in both `autoMode` sections. Live: a `Read` of `package-lock.json` was
refused by the new rule, and a `grep` that the hand-rolled parser denied twice now runs.

## Reverse this if

The prefix-matching gap proves to matter — i.e. a destructive command reaches the tree in a
compound form that `permissions` could not match and the classifier did not catch. The fix then is
**not** to revive the parser: it is a narrowly-scoped `PreToolUse` hook that checks one specific
shape, with a corpus run before it is armed.

## Correction, same day: the claim that no `autoMode` block existed was FALSE

This entry stated *"no `autoMode` block existed anywhere."* **Wrong.** `~/.claude/settings.json`
carries an `autoMode` profile with **23 `environment` entries and 3 `soft_deny` entries**, two of
which already blocked `prisma db push` and seeds against a production `DATABASE_URL`.

How the error was made: `j.permissions` was printed, found to contain only `defaultMode`, and
"the platform's mechanisms were entirely unused" was generalised from that. **The `autoMode` key was
never looked at.** It sits at the top level of the same file, one line away. An auto-memory note had
recorded the profile's existence since 2026-08-31; it is what caught this.

What survives: `permissions.allow/deny/ask` really were absent from all three settings files, and
the hand-rolled parser really was redundant against them. What does not: the claim that the
classifier knew nothing about this repo. It knew a great deal, including the Neon production
heuristic.

**A live regression introduced by this entry's own change.** Project settings define `autoMode`
now, and array-valued settings appear to be **replaced by the highest-precedence source rather than
merged** — the `$defaults` sentinel exists to re-inherit built-ins, and there is no `$user`
equivalent, which is the tell. If that reading is right, the project block **discarded all 23 user
environment entries for this repo**, including the public-repo warning and the PDPA data-location
entry. Marked **ASSERTED**: inferred from the sentinel design, not measured.

**Neither half can be repaired by this session.** The classifier refuses edits to
`~/.claude/settings.json` outright, and it now refuses edits to `.claude/settings.json` as well —
because a `soft_deny` entry added by this change reads *"Editing .claude/settings.json … should not
be changed casually by the party it constrains."* **That rule blocked the removal of itself.**
Second occurrence in one session of a guard fencing its own disarm; see `tasks/lessons.md`
2026-09-05. It does, however, prove the added `autoMode` entries are live and honored.

**Handed to the human:** remove the `autoMode` key from `.claude/settings.json` (restoring the user
profile for this repo), and separately correct the four false "no git remotes configured" entries in
`~/.claude/settings.json` — re-verified false on 2026-09-05: `origin` is
`git@github.com:fergeley/pet-shelter.git`, `master` tracks `origin/master`, and `origin/HEAD` is set
to `refs/remotes/origin/master`.
