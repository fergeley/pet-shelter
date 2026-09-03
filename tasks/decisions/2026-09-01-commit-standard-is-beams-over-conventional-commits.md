# The commit standard is Beams' seven rules over the Conventional Commits grammar

**Decided:** 2026-09-01

The human asked for commit guidelines binding on themselves, Claude, and every sub-agent, and named
Chris Beams' seven rules as the standard. Two questions had to be settled to make that concrete
here, because the rules and this repo's existing grammar genuinely conflict.

**Where the convention lived.** It was written three times and had already diverged:
`.github/CONTRIBUTING.md` gave scopeless examples (`feat: add …`),
`docs/architecture/WHERE_CODE_GOES.md` required a scope, and
`.claude/agents/atomic-commit.md` specified a body wrap of 80 while nothing else specified one at
all. That is this repo's most frequent defect shape. `docs/reference/COMMIT_MESSAGES.md` is now the
only copy; the other three point at it and state nothing.

**Rule 3 versus the grammar.** "Capitalize the subject line" and `feat(ui):` cannot both hold at
column 1 — capitalizing the type would break every parser that reads this history. The rule binds
on the **summary after the colon**, which is the part a human reads as a title:
`feat(ui): Add the image uploader`. This is the one place the standard changes existing habit, and
it changes it for 190 of 203 commits (94%), so it was not adopted quietly.

**Rule 2 is two-tier, because Beams is.** He asks for 50 and observes that GitHub truncates past
72. So 50 warns and 72 fails. This repo's mean subject is 72.7 characters; 50 is a target it is now
aiming at rather than a description of it.

**History is grandfathered.** Measured with the linter's own `--audit`: **0 of 203 commits pass**.
Rewriting a shared branch is a one-way door (`.claude/templates/triage-rules.md` §5), and the
concurrent session is committing to it, so nothing is rewritten. CI lints only the commits a pull
request adds.

**What was found along the way.** Five commits (`a95ba33`, `4251a4c`, `2e23bb1`, `ec094f4`,
`edffe74`) have a literal `@` as their subject line, with the real subject stranded on line 2.
A PowerShell here-string (`@'…'@`) handed its own delimiter to `git commit -m`. `git log --oneline`
renders those five commits as `@`. The linter names that shape specifically rather than reporting a
vague grammar failure, and the standard now requires `git commit -F <file>` over `-m`.

**Rule 7 is not enforced and was not faked.** No machine can tell a good "why" from a bad one. The
linter warns on a missing body and stops there; the standard says plainly that the check is human.
The imperative-mood blocklist is likewise documented as incomplete — `seed`, `embed`, `feed`,
`proceed` and `needs` are imperatives a naive `-ed`/`-s` rule would reject, so the list is explicit
and green from the linter is not proof of rule 5.

**Verified, not asserted.** 62 unit tests, each rule asserted red and green; a 12-mutant run against the
linter killed 12/12 (the first pass killed 11 and exposed a comment-stripping test that passed
whether or not the code worked, which was then fixed); an end-to-end run in a throwaway repo
installed the hook and confirmed it rejects a bad message, warns-but-commits a marginal one,
accepts a compliant one, honours `--no-verify`, and uninstalls cleanly.

Related: [[pre-commit-hook-not-installed]] — the commit-msg hook is opt-in for the same reason.
