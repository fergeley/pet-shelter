# Lessons

Patterns worth not relearning. Newest first.

## 2026-09-04 — Hybrid Promises returned from synchronous signatures break caller truthiness

In an attempt to bridge asynchronous database queries (`PrismaClient`) into functions called synchronously across the action layer (`findServerPetById`), returning a hybrid Thenable object (`Pet & Promise<Pet | null>`) introduces severe runtime regressions. In JavaScript, all `Promise` objects are truthy (`Boolean(new Promise(...)) === true`). When a record exists neither in memory nor in the database, a returned unsettled Promise causes synchronous guards (`if (!pet) return { error: "Pet not found" }`) to evaluate to false. Callers treat non-existent entities as valid, and subsequent synchronous field access (`pet.name`, `pet.status`) evaluates to `undefined`, silently corrupting downstream payloads.

**Rule:** Never return a Promise (or Thenable object) from a function whose public contract is synchronous (`T | null`). Keep synchronous mirror access (`findServerPetById`) and asynchronous database queries (`findServerPetByIdAsync`) as distinct, strictly typed methods.

## 2026-09-04 — Transactional status mutations must capture the committed row before updating the mirror

In dual-layer stores where PostgreSQL is authoritative and an in-memory array acts as a cache mirror, atomic mutations (`atomicUpdateApplicationStatus`) must never assume the target entity was cached in memory prior to the transaction. If an entity was seeded directly into the database or created by a concurrent process, the in-memory array index was `-1`. Executing the Prisma transaction committed the update to PostgreSQL, but checking `appIndex === -1` post-transaction falsely aborted with `"Application not found"`, leaving the caller with an error and the mirror out of sync.

**Rule:** Capture the authoritative entity from inside `prisma.$transaction`. Post-commit, if the entity was absent from the in-memory mirror (`appIndex === -1`), map the committed database row via the domain mapper and prepend it to the mirror array so the in-memory state reflects the committed transaction.

## 2026-09-04 — Child collection models with fixture IDs must not carry @default(cuid())

Prompt specifications often recommend adding `@default(cuid())` to child relations (`PetUpdate`, `MedicalTimelineEvent`) to make IDs optional. However, existing test suites (`tests/unit/petHistory.test.ts`) may explicitly forbid `@default(cuid())` via regex assertions to guarantee that deterministic, fixture-supplied IDs (`up-009-1`, `tl-001-1`) round-trip cleanly through `db:seed` without surrogate key collisions.

**Rule:** Check existing schema contract tests before applying ID generator defaults to Prisma models. If a unit test explicitly asserts `expect(body).not.toMatch(/@default\(cuid\(\)\)/)`, do not add the default.

## 2026-09-04 — A dual-layer fallback must never let a swallowed database error fail the mutation

The repository layer (`src/lib/server/`) follows a dual-layer store pattern (docs/architecture/LAYERS.md, L-B2):
writes are database-first with an in-memory mirror and audit log. When no database is configured (dev,
offline, unit tests), Prisma queries throw. In non-strict mode, `handlePersistenceError` deliberately swallows
those errors, reports a console warning, and falls through to the in-memory fixtures.

A rewrite of `atomicUpdateApplicationStatus` broke that contract by wrapping the transaction in:
```ts
try {
  await prisma.$transaction(...);
} catch (err) {
  handlePersistenceError("Prisma application status transaction", err, "write");
  return { success: false, error: "Persistence failure; the update was not applied" };
}
```
In strict mode (`STRICT_PERSISTENCE=true`) or on unique-constraint violations, `handlePersistenceError`
rethrows loudly as designed. But in non-strict mode, returning `{ success: false }` transformed the expected
fallback into a hard mutation failure. Every unit test calling status transitions failed because there was no
local Postgres to answer the query.

**Rule:** In a dual-layer store, the database write must be guarded, not gatekeeping. If `isDatabasePersistent()`
is false or the caught error was swallowed by `handlePersistenceError`, the operation must fall through to update
the in-memory mirror and record the audit trail. A database failure in fallback mode is a warning, never an
aborted transaction.

## 2026-09-04 — Linter configs without worktree exclusions will drown in duplicate errors

Git worktrees created under `.claude/worktrees/` hold complete checkout trees that duplicate source files
without isolated or fully installed `node_modules`. Because Next.js and ESLint 9's flat config (`eslint.config.mjs`)
only ignored default build outputs (`.next/**`, `build/**`, `out/**`), `eslint` traversed into `.claude/`,
reporting 8,542 problems (322 fatal parsing/type errors). The noise completely buried the real syntax and type
errors in `src/`.

**Rule:** In repos that support agent worktrees or nested branch workspaces, add the worktree container
(e.g. `.claude/**`, `.worktrees/**`) to `globalIgnores` in the root linter config, not just `.gitignore`.
Linters inspect the working tree directly and do not always inherit gitignore rules.

## 2026-09-04 — A pull request can say "Merged" and ship nothing

PR #2 merged `feat/tnrm-rehabilitation` into master on 2026-09-01 00:59. PRs #3 and #7
then merged **into that same branch** a day later, after it had already landed and
would never merge again. Both show green in the UI. Neither merge commit is an
ancestor of master, and none of `scripts/commit-msg.mjs`,
`docs/reference/COMMIT_MESSAGES.md` or `tests/unit/commitMessage.test.ts` existed on
master. A whole commit standard was silently unshipped for three days.

Nothing looked wrong. The badge is green, the base branch still exists, the feature
"merged". It surfaced only while pruning branches, when three separate branches turned
out to carry the *same* unmerged commits — which is the shape of work that never
reached the trunk.

**Rule:** with this many parallel branches, a PR's *base* is as important as its state.
`gh pr list --state all --json number,headRefName,baseRefName` — anything based on a
feature branch rather than `master` either has to be re-targeted or needs its base to
merge again afterwards. The authoritative test is ancestry, never the badge:
`git merge-base --is-ancestor <merge-sha> origin/master`.

## 2026-09-04 — `git branch --merged` cannot see a squash-merge

A squash commit is not a descendant of the branch it squashed, so `--merged` omits
branches whose work is entirely on master, and `--no-merged` lists them as if they
held unshipped work. Of 21 branches here, that test found 3 finished; the real number
was 7. `worktree-sponsorship-checkout` alone had 9 commits, every one already upstream.

`git cherry origin/master <branch>` is the test that works: it marks each commit `-`
when its patch is already upstream and `+` when it is not. Zero `+` lines means the
branch adds nothing, however the ancestry looks.

The tempting shortcut is worse than useless. Comparing a branch to master across
`src/ prisma/ tests/` called two branches identical while they carried 181 and **3,644**
unmerged insertions in `.gitignore`, `skills-lock.json` and `tasks/lessons.md`. A
path-scoped diff is not a merge test, and it fails in the direction that deletes work.

**Rule:** to decide whether a branch is done, ask `git cherry`. To decide whether a
file is present, ask `git ls-tree`. Never a diff you scoped by hand.

## 2026-09-04 — Consent has to fail closed, and a docstring is not a guarantee

`partitionByConsent` decided who receives a mailing. Its module docstring said the
design "keeps a database outage from silently turning into email everyone anyway". The
code did exactly that: the query was wrapped in `try/catch`, and on failure every
address fell through to the permissive default and was mailed — including donors who
had explicitly unsubscribed.

Two things went wrong together. Reading and sending answer different questions —
rendering a preference page may assume consent, deciding to send may never — and they
had been collapsed into one function. And the comment describing the safety property
was written at the same time as the code that violated it, so it read as verification
when it was only intention.

The fix separates the two and reports a third outcome: `allowed`, `blocked`, and
`unresolved` for addresses whose consent could not be established. Unresolved is never
mailed. An unsent notification costs nothing; one sent to somebody who opted out is the
failure the feature exists to prevent.

**Rule:** when a comment claims a safety property, go and check the branch that
implements it. And where a default has asymmetric costs, name the third state rather
than folding "we could not tell" into "yes".

## 2026-09-04 — A stored string that something compares against is an interface

An audit row for the donation-receipt email was filed under entity
`"AdoptionApplication"`, which looked like a mislabel. Refiling it as
`"DonationReceipt"` looked like pure tidying, and the justification seemed solid: the
audit viewer already branches on that exact value.

That branch was the problem. `exportCsv.ts` and `useAuditLogController.ts` both classify
an audit row as a donation when `entity === "DonationReceipt"`, and the email row
carries no `receiptNumber` — so the change injected a phantom RM 0.00 line into the
LHDN Section 44(6) receipts export, one per donation, with the real receipt number and
donor "Anonymous Donor". The reasoning was backwards: that branch existed *because*
only real donation records carried the value.

The same trap fired again two commits later, filing sponsor mail under entity `"Pet"` —
which is how the audit viewer's Adoptions tab is built, so it would have buried the
adoption trail under up to 250 bulk-mail rows per upload.

**Rule:** before changing a stored string, grep for it. If anything compares against
the literal, it is an interface and not a label. Related: the entries below on making
existing data load-bearing — same shape, different direction.

## 2026-09-04 — Green tests do not prove the feature is reachable

A notification feature shipped with a schema, a validator, a server action, an email
template, a dispatcher and 251 passing tests. Nothing anywhere set `targetPetId`, so
the audience query always returned empty and not one email could ever have been sent
to a real donor. Every test seeded the sponsor directory directly and so never
exercised the one path that fills it in production.

Worse, the fix was applied to one of the two entry points. The per-pet modal was
corrected; the general donate widget was missed and kept sending no ID at all. The
lesson was written down between those two commits and did not prevent the second.

**Rule:** for a new feature, trace the data from the real UI entry point to the consumer
at least once. The question is "what writes this row in production?", not "does my test
write it?". Then enumerate *every* entry point — a fix applied to one caller of two is
not a fix.

## 2026-09-04 — Overtaken by 160 commits is a rebuild, not a merge

A feature branch built against a 7-day-old base met a master that had grown its own
`PetSponsorship` model on the same table, its own `src/actions/sponsorships.ts`, and a
repository layer replacing the `serverStore.ts` the branch still imported. Ten files
conflicted. Resolving them would have resurrected a deleted module, clobbered the
sponsorship ledger and reverted schema work.

Rebuilding on current master took less time than the merge would have, and produced a
better result: master's two-mode persistence contract replaced a `try/catch` fallback,
an existing `flushAuditLogWrites()` replaced a duplicate that was about to be written,
and a coordinator-reconciled `ACTIVE` status made a whole double-opt-in subsystem
unnecessary — it is a stronger guarantee than an email click, because a human confirmed
the money arrived.

**Rule:** when a branch is far enough behind that the trunk has independently solved the
same problem, the conflict list is the wrong thing to read. Ask what master would make
unnecessary, and delete rather than merge it. Related: "When a branch is overtaken,
shrink it" below — this is the same rule one order of magnitude further along.

## 2026-09-04 — A fan-out without a bound manufactures its own failures

Mailing a list with `Promise.allSettled` over the whole audience starts every request
at once. Against a rate-limited provider that earns 429s, which arrive as delivery
failures indistinguishable from bad addresses — so the code invents errors and then
reports them as the provider's. A bounded worker pool fixes it; the sends are off the
request path and have no reason to be simultaneous.

The deadline is real, though, and is the reason not to simply lower the bound: `after()`
work runs inside the route's `maxDuration`, so a full recipient list at low concurrency
can be killed mid-send. The audit row is written *before* the fan-out for that reason —
otherwise a killed invocation leaves no evidence the mailing happened at all.

**Rule:** any loop that talks to a rate-limited service needs a concurrency bound and a
deadline that has been multiplied out, not assumed.

## 2026-09-04 — "It responds" is not "it is in use"

Eight abandoned `next start` servers were pinning worktree directories on Windows,
holding `next-swc.win32-x64-msvc.node` open so the directories would not delete. The
obvious liveness test — does the port answer HTTP — said all eight were alive. Seven
were returning 500.

Measuring instead of probing settled it: zero CPU consumed across a 25-second sampling
interval, and zero established TCP connections. All eight were idle and safe to kill,
which the HTTP check could never have shown.

**Rule:** an HTTP *error* still proves something is listening, so a response is evidence
of a process, not of a user. When the question is "is anyone using this", measure
activity over an interval — CPU delta, open connections — and scope any kill to
command lines you have actually read.

## 2026-09-03 — A green deploy proves one variable was set, and nothing else

A Vercel production build failed with `SecretConfigurationError` collecting page data for
`/api/upload`. The cause was correct and deliberate: `crypto.ts` resolves `getSessionSecret()` at
module load, `next build` imports every route module, and `TARGET_SECRET_HARDENING.md` §5 names
that exact failure as a gate. Setting the secret cleared it.

What the green build then hid was worse than what the red one showed. `DATABASE_URL`,
`RESEND_API_KEY`, `EMAIL_FROM`, `SHELTER_NOTIFICATION_EMAIL` and `NEXT_PUBLIC_APP_URL` all degrade
into something shaped like success: the pet repository serves `src/data/pets.json` fixtures, and
the mailer returns `{success: true, simulated: true}` and writes an audit row saying the mail was
sent. Exactly one of eight variables fails loudly, and it is the one that had just been fixed.

**Rule:** when a deploy's only failure mode is loud, enumerate the silent ones before calling it
done. Grep `process.env.` across `src/`, and for each name ask what the code does when it is
absent. Every `|| "default"` is a silent failure waiting for production.

**Corollary — identity does not distinguish a fallback; count does.** The build prerendered
`/pets/pet-001`…, which looked like fixture data, but `prisma/seed.ts` seeds *from that same JSON*,
so a correctly-seeded database holds identical ids. The ids were unusable as evidence and an early
call based on them was overstated. What settled it was arithmetic: 10 prerendered paths against 8
rows in `pets`, and 10 entries in the fixture file. `getServerPetsAsync` returns fixtures both when
the query throws *and* when it returns zero rows, so the two causes are also indistinguishable —
only the count separates fixture from database at all.

## 2026-09-03 — A guard cannot recognise a placeholder it has never been shown

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

## 2026-09-03 — A probe that can report "missing" must be allowed to report "broken"

`git rev-parse <ref>:<path>` and `git cat-file -e <ref>:<path>` are silently rewritten by MSYS path
conversion in this Git Bash — `origin/master:.env.example` reaches git as `origin\master;.env.example`
and fails. It fires on some ref/path shapes and not others, so a loop over several branches returns
a believable mix of hits and misses rather than an obvious failure.

Wrapped in `2>/dev/null || echo MISSING`, the `fatal:` line vanished and the output read as data. It
produced a confident, wrong claim to the user — that a file was tracked only on two local branches
and any fix would be stranded — which a peer session caught. `git ls-tree` is the authority, and it
takes the ref as its own argument.

**Rule:** any probe whose negative result is itself a finding must let stderr through on at least
one run before the finding is reported. "Not found" and "the command never ran" are the same string
once stderr is discarded, and only one of them is evidence.
## 2026-09-03 — On a busy trunk, a branch is only as merged as its last sync

The QR branch needed four syncs with `origin/master` in one sitting. Between
them, the RBAC work, the FAQ CMS, sponsor photo notifications and the sponsor
portal all landed, and three of the four touched the same files. Each sync was
real work, not a formality: `serverStore.ts` was deleted mid-flight, a parallel
session shipped `settingsRepository.ts` doing the same job as this branch's
`domain/shelterSettings.ts`, and `SUPER_ADMIN` / `ANIMAL_MANAGER` — reported as
non-existent when the feature began — were added by the RBAC branch.

**Rules that came out of it:**

- **A `modify/delete` conflict on a file your branch depends on is the signal to
  stop merging and start porting.** Rebuild on the current trunk and re-apply
  each change; merging would have resurrected deleted files and shipped two
  settings layers.
- **Resolve in favour of what already landed.** Where a parallel session had
  fixed the same hole differently — `getAdminPets`, secret redaction — take
  theirs and delete your version, even when yours is arguably tidier. One
  approach on trunk beats two competing ones.
- **When both sides added, resolve as a union, not a side.** Two of the later
  conflicts were purely additive; picking either side would have silently
  dropped the other feature.
- **Read the other sessions' notes before assuming yours is the version to
  keep.** `tasks/open/` held a note predicting this branch's guard would flag
  the FAQ reads, and warning that "fixing" them with `assertAuthorized` would
  break the public category tabs. Following it saved a real regression.
- **Do not merge a long-lived branch into your local `master` while trunk is
  moving.** It forked a copy that served no purpose and had to be abandoned;
  the branch itself was the only thing that mattered. Leave `master` alone and
  let the PR land it.

## 2026-09-03 — CI tests the merge result, so it sees commits your branch does not

The unit suite passed locally at 1088 tests and failed in CI at 1168. Nothing
was flaky: GitHub runs the checks against your branch merged with the current
trunk, so it had a whole `src/actions/sponsors.ts` that the local tree had never
seen. A repo-wide guard — the kind that scans every file in a directory — will
find things locally green runs cannot.

**Check the count.** "1168 in CI, 1088 here" is the tell, and it is faster than
reading the diff. Sync, re-run, and expect the numbers to match before trusting
a local pass.

**And read the output, not the exit code.** `gh pr checks --watch` exits 0 even
when checks have failed. Taking the exit code at face value would have reported
a green build twice.

## 2026-09-03 — Attribute a red check before claiming it is not yours

`Playwright golden paths` failed on the QR PR. Rather than assert it was
pre-existing, it was checked against master's own latest run: same job, same
assertion, same line 101, already failing there, with master's previous five
merges all landed red. That turns "probably not mine" into a fact worth acting
on, and it takes two commands.

The inverse also held in the same run: the unit failure alongside it *was* ours,
and the same check proved it — master was green on that job.

## 2026-09-03 — A fallback that fabricates data is a defect, not resilience

Shipped a transparency page whose offline fallback substituted a bundled sample
ledger whenever the database read failed or returned nothing. The admin editor
warned about it; the public page did not. A production deploy against an
unmigrated database would have published 28 invented expenses, complete with
realistic invoice references, on the one page whose entire claim is that its
figures are verified — and `next build` had already baked that state into the
prerender. A later review found a second door onto the identical bug: the seed
script inserted the same rows as *published*, which made the read succeed and the
provenance notice suppress itself.

The tell was that the fallback made an assertion. A cache or a retry asserts
nothing; substitute data asserts "these are the numbers".

**Rule:** before writing a fallback, ask what it *claims* to the reader. On any
surface that makes a truth claim — financial, legal, medical, audit — the fallback
is an honest empty state, never invented content. Gate sample datasets to
non-production and label them wherever they render. And a provenance field is
worth nothing until *every* surface that renders the data reads it: adding the
field and wiring it to one consumer made the risk feel handled, which is worse
than not having it. Related: [[anything-written-twice-diverges]].

## 2026-09-03 — De-duplicating shared data must not cost server rendering

Two pages held their own hard-coded copies of the same expense split. Collapsing
them onto one derived source was right, but the shared component fetched on mount
from a client component, so the donate page lost its server-rendered content, its
first paint and its crawlability. A correctness fix had been traded for a
performance and SEO regression, and the whole test suite stayed green through it.

**Rule:** when a client component needs server data, move the fetch up to a Server
Component and pass props down; never let a shared presentational component fetch
for itself. After any such refactor, `curl` the affected routes and grep the
server HTML for the content that should be in it. "The tests pass" does not prove
the content is still server-rendered.

## 2026-09-03 — A safety mock must stay configurable, or it deletes the coverage

`DATABASE_URL` points at a production branch, so the Prisma client was mocked to
reject on every call. Correct for safety, and it meant 100% of the row-mapping,
aggregation and write code never executed. The least-tested code was the code most
likely to break, and it is exactly where a "database reachable but empty" hole hid
until a review found it.

**Rule:** mock a dangerous dependency per-test, not globally. Use `vi.hoisted`
mock functions and give them resolved values for the happy path so the real
mapping runs, then override with rejections for the failure cases.
## 2026-09-03 — Schema changes ship as additive SQL here, never as `db push`

**What happened:** the sponsor portal was ready to merge with two schema changes (a
`sponsors` table, a `displayOnWall` column) and no migration. The repo has no migration
history, and `npm run db:push` resolves its target from `.env.local`, which holds
`NEON_BRANCH=production`, with no local-only guard — unlike `db:seed`, which has one.

A read-only `prisma migrate diff` against production returned 265 lines, **12 of them
destructive**: `DROP TABLE faqs`, `DROP COLUMN "status"` on both `pets` and
`adoption_applications`, and the four `shelter_settings` QR columns. Those belong to other
branches' drift, not to this feature. `db push` would have taken them all — and a
`DROP COLUMN status` followed by `ADD COLUMN ... DEFAULT 'Available'` does not migrate
values, it resets them. Every adopted animal becomes Available.

Had the branch merged without a migration, the outcome is quieter but still bad: production
has no `sponsors` table, the repository declares the database authoritative rather than
falling back, and `/sponsors` and `/sponsor/login` return 500s.

**How to apply:** any branch here that touches `prisma/schema.prisma` ships a hand-written
additive file in `prisma/sql/`, idempotent (`IF NOT EXISTS`, a `pg_constraint` guard for
foreign keys), applied with `psql -f`. Follow
`prisma/sql/2026-09-03_pet_sponsorships_additive.sql`. Never run `db push` against anything
resolved from `.env.local`. Background:
`tasks/open/production-schema-has-drifted-ahead-of-master.md`.

---

## 2026-09-03 — When a branch is overtaken, shrink it; do not integrate faster

**What happened:** the sponsor portal had its storage layer overtaken by `master` twice in
one day. First `Donation` + `ReceiptSequence` superseded its `SponsorContribution`. The
merge resolving that was still being written when `d301e74` landed `PetSponsorship`, which
superseded the annotation table that merge had just built. Nine commits arrived between one
`git fetch` and the next.

The instinct both times was to re-integrate — rewrite the storage layer against whatever
`master` now had. That is a race you lose: a third rewrite would have collided a third time.

**What worked instead:** reduce the branch to the part nobody else is building. Here that
was the supporter *account* — sessions, tier derivation, gating, the portal UI — and
`PetSponsorship.userId`, a column whose comment already read *"Reserved for a future
supporter account."* The other session had left the slot open. The branch went from
carrying its own ledger to adding one table and one foreign key, and merged.

**How to apply:** when a merge conflict is a whole subsystem rather than a few files, stop
resolving and ask *which half of this branch is uncontested?* Ship that half. Read the
other side's model comments before designing against them — they frequently describe the
seam you are about to build, and occasionally they describe your branch by name.

**Corollary on adopting the other implementation wholesale.** `PENDING_PAYMENT → ACTIVE`
replaced this branch's `PENDING`/`CONFIRMED`, and is better: it says *why* an unreconciled
pledge grants nothing. `countsTowardFunding()` replaced a restatement of the same rule.
Taking their vocabulary rather than mapping onto it removed code and a class of drift.

---

## 2026-09-03 — Self-review is blindest where it is most confident

**What happened:** I self-critiqued the sponsor portal and produced twelve findings,
including one I graded critical. An external code review then found, as its *first*
finding, a full account takeover in the account-claim challenge — the single mechanism I
had written the most defensive prose about, in code comments, a commit message and a
design guide.

**Why I missed it.** I had reasoned "a receipt number is delivered only in the donor's own
e-Receipt, so possession proves identity", written that down three times, and never
re-derived it. Reviewing my own work, I checked the parts I was unsure about and skimmed
the part I had already argued for. The care I put into justifying it is exactly what
stopped me re-examining it.

**How to apply:** when self-reviewing, treat your own confident explanations as the *first*
place to look, not the last. Specifically: for every security property you have written
prose about, re-derive it from the attacker's side once, ignoring what you wrote. And do
not let a self-critique substitute for an independent one — mine was thorough and still
missed the worst bug on the branch.

**Related:** [[stress-test-all-the-way]].

---

## 2026-09-03 — A public endpoint that returns an identifier destroys it as a credential

**What happened:** the sponsor account-claim challenge required a donation receipt number
matching the claimed email. But `/donate` is a public, unauthenticated form that mints a
receipt for *whatever email the caller types* and returns the number in its own response.
So an attacker could pledge RM 5 as `victim@example.com`, read the receipt out of the
response, and claim the victim's entire giving history, standing and gated content.

The credential and its issuer were the same anonymous endpoint. My mental model was "the
donor receives this by email", which is true and irrelevant — the question is who *else*
can cause the value to exist and observe it.

**How to apply:** before treating any value as proof of possession, answer two questions.
*Who can cause this value to come into existence?* and *does the act of creating it reveal
it to the creator?* If the answer to the first is "anyone", it is not a credential no
matter how it is normally delivered.

The fix generalises too: the value only became safe once it required a state transition
the claimant could not perform (a staff member confirming the payment).

---

## 2026-09-03 — Recording an intention is not recording a fact

**What happened:** the donation ledger stored pledges submitted through a public form with
no payment gateway behind it. That was harmless while a pledge only produced a receipt and
an email. It became an authorization bug the moment I derived *privileges* from it: anyone
could assert an RM 1,200 pledge, or an RM 100 monthly one annualised on the spot, and hold
Gold on the next request.

Nothing about the donation flow changed. What changed is that I attached security weight to
data that had never carried any.

**How to apply:** this is the same shape as the `@unique` lesson below, and it has now bitten
twice on one branch — so treat it as the recurring one. **When you make existing data
load-bearing, its requirements change retroactively.** Before deriving authorization,
uniqueness or money from a field, go and read what actually writes it, and ask what the
value asserts rather than what you wish it asserted. "Someone typed this into a form" and
"the money arrived" are different facts that look identical in a database column.

---

## 2026-09-03 — A test that is green because infrastructure is absent is not green

**What happened:** four sponsor suites exercised the in-memory fallback path and passed.
They reached that path by accident: `src/lib/prisma.ts` defaults `DATABASE_URL` to
localhost, nothing was listening, so every call threw. On a machine where `DATABASE_URL`
*is* exported — and this repo's `.env.local` points it at a Neon **production** branch —
the registration cases would have run `prisma.sponsor.create` and
`prisma.sponsorContribution.updateMany` against it.

Separately, `isActive: false` was asserted in tests that constructed the record directly,
while no code path in `src/` ever wrote it. The tests proved the derivation worked; they
could not show the state was reachable, so a documented behaviour ("cancelling drops the
standing") had no implementation for weeks.

**How to apply:** two habits.
- If a suite's green depends on the *absence* of something, mock the boundary explicitly.
  Ask "what would this test do on a machine that has a database?" before trusting it.
- Before documenting behaviour that depends on a field's value, grep for what *writes*
  that value. Constructing a state in a fixture is not evidence that anything can produce
  it.

---

## 2026-09-03 — Fold a deprecated role onto its nearest identity and you transfer its authority

`normalizeRole` mapped the retired VOLUNTEER onto STAFF, which is the closest
canonical *identity*. But STAFF can read adoption applications and a volunteer
never could — that is applicant PII under PDPA 2010. Because the session was
normalised on *read*, the rewrite happened before any permission check saw it,
so every volunteer account would have gained the grant on deploy.

Two separate ideas were being conflated. Identity ("what should we call this
role now?") is a display concern. Authority ("what may it do?") is not, and must
fail closed. The fix: `permissionsForRole` grants nothing to an unrecognised or
retired role, and sessions are normalised where they are *minted*, never where
they are read.

**Rule:** an alias table is a migration tool, not an authorization one. Before
mapping A onto B, diff their permission sets — if B has anything A lacked, the
mapping is a grant.

## 2026-09-03 — Run every test project locally, not the one you remember

Three careful review passes ran `vitest --project unit` and reported green. CI
runs `unit`, `integration` and `components`, and the integration project is
where the VOLUNTEER escalation above surfaced. The local suite had no opinion
about it at all.

Related: `gh pr checks --watch` exits 0 when it finishes watching, not when the
checks pass. Reading the exit code produced a confident "CI is green" while two
jobs were red. Read the job states.

## 2026-09-03 — A backfill is a deploy-ordered step, not a migration detail

The RBAC migration split cleanly into additive DDL (safe against the running
release, which never reads the new columns) and a role backfill (not safe at
all). Rewriting an administrator's row to SUPER_ADMIN while the previous release
is serving still lets them sign in — the login action does not gate on role —
and then denies every admin route, because that code compares
`session.role === ROLES.ADMIN` literally.

**Rule:** for any enum widening, ask which half can run before the deploy and
which cannot, and put the answer in the SQL file rather than in the head of
whoever is running it. Additive schema first, deploy, backfill last.

## 2026-09-03 — `injected env (0)` is the tell for a worktree database command

`prisma.config.ts` resolves `.env.local` against the current directory, and
`.env.local` is gitignored so it exists only in the main checkout. Run a Prisma
command from a worktree and `resolveDatabaseUrl()` silently falls back to
`localhost:5432`, producing `P1001 Can't reach database server` — which names
the wrong problem entirely. The database is fine; Prisma never learned its
address. The `injected env (0)` line above the error is the actual diagnosis.

Fix without moving anything: run from the main checkout and point `--file` at
the worktree path.

## 2026-09-03 — Collapsing role lists into permissions silently widens access

Rewriting `assertAuthorized(session, [ROLES.X])` into
`assertHasPermission(session, PERMISSIONS.Y)` looks like a refactor and is not one. Two settings
guards sat at *different* levels — `updateShelterSettings` was `[ADMIN]`, `sendTestEmailAction` was
`[ADMIN, COORDINATOR]` — and mapping both onto one permission handed the coordinator the shelter's
Resend and storage credentials. Before replacing a role list with a permission, diff the old
allow-list against the new permission's holder set, per call site. `git show <base>:<file>` is the
source of truth for what the guard used to be, not memory.

## 2026-09-03 — A client `useState` copy of server data is a duplicated source of truth

The members table seeded `useState` from an `initialMembers` prop, so the server and the client each
believed they owned the roster. Every symptom — an extra round-trip, reconciliation code, a
staleness window — came from that one decision. `revalidatePath` in a Server Action already
re-renders the route and ships new props in the same response, but client state is *preserved*
across that re-render, so the copy silently shadowed them. Deleting the copy deleted all of it.
Server owns data, client owns view state.

## 2026-09-03 — A client-side layout gate says nothing about what the payload contains

`/admin/pets` is a Server Component calling an unguarded `getAdminPets()`. The admin layout renders
a spinner until its session effect resolves, so the table never appeared — but server-component
output is serialised into the RSC flight payload regardless, and an anonymous request received the
whole inventory: 75,453 bytes with `applicationCount`, `rescueStory` and pet names. When adding
authorization anywhere, enumerate every sibling entry point. "The UI does not render it" is not a
boundary.

## 2026-09-03 — Mutation-test the fix, not just the feature

Removing a raw-error leak felt obviously right, so it shipped without a test. Reintroducing the
defect proved it: the suite stayed green. Any security fix that a reintroduced defect does not break
is undefended. Six defects were re-injected on this branch; five failed loudly, one did not, and
that one was the bug in the test suite.

## 2026-09-03 — Read the bundled Next docs before proposing a framework fix

Three conclusions from a careful self-review were wrong, and `node_modules/next/dist/docs/`
overturned all three: the post-mutation refetch fix was backwards; branching on the `RSC` header in
`proxy` is impossible because Next strips those headers on purpose; and
`NextResponse.rewrite(url, { status })` silently drops the status. This is a modified Next.js —
general knowledge of Next is not evidence about it.
## 2026-09-03 — A server action is a public POST endpoint, and reads leak too

Three actions in the donation QR work shipped reachable without a session.
`loadShelterSettings` and `getShelterSettings` each returned the whole settings
object — `resendApiKey` included — in a module that already redacted that same
key before it reached `audit_logs`. `getAdminPets` returned archived animals and
per-pet application counts. All three were framed as read helpers, which is why
the authorization reflex never fired: it fires on mutations.

Fixing one and missing its identical twin beside it is the argument for a guard
rather than a patch. `tests/unit/serverActionAuth.test.ts` now requires every
exported action to authorize or sit in an allowlist with a stated reason.

**Gating is not always the fix.** Two of the three were better deleted than
gated: one had no production caller, and `getAdminPets` only needed to stop
being an action — its caller is a prerendered server component, so an
authorization throw would have broken the build. Check who calls it first.

## 2026-09-03 — "It rendered" is not correctness when the artifact looks valid

`qrcode-generator`'s default byte mode is `charCodeAt(i) & 0xff`. An em dash
encodes as byte `0x14`. It does not throw — it emits a perfectly scannable QR
carrying a corrupted payment string, so a donor scans a valid code and the money
goes nowhere.

Test encoders with non-ASCII input specifically, and cap payload length in
encoded bytes rather than UTF-16 units: QR capacity is a byte budget.

## 2026-09-03 — Making a field persist can turn a harmless bug destructive

The admin settings form seeds from a `localStorage`-backed store. That was
survivable while `updateShelterSettings` wrote to a module-level variable —
nothing persisted, so nothing could be lost. The moment the QR fields reached
real columns, a second admin on a browser that had never uploaded them would
open the page with empty inputs and blank the saved codes on save.

When you make a field persist, audit every path that *seeds* the form. A
previously write-only field has no loading path, and the absence is invisible
until it deletes something.

## 2026-09-03 — Persisted-but-unrendered data is a promise you have not kept

`tngQrUrl` and `bankQrUrl` shipped with a column, a validator, provider context
and a working upload control, and nothing that displayed them. The admin field
said "not yet shown to donors", but the upload succeeded and the image landed in
Postgres, so the interface still said "this works".

A field the user can fill in is a claim that filling it does something. Either
wire it end to end or do not ship the input; a caveat in help text does not
cancel a working button.

## 2026-09-03 — Tailwind cannot build a class name from a variable

The QR panel needed a per-channel accent colour. `` border-[${accent}] `` compiles,
renders, and produces no style at all — the JIT only sees class names that appear
literally in the source. Use an inline `style` for a colour that varies at
runtime, and point it at a CSS custom property so `globals.css` stays the single
source of truth rather than growing a second copy of the hex.

## 2026-09-03 — A long-lived branch stops being a merge and becomes a port

The QR branch was cut before `src/lib` was reorganised into `client/`, `server/`
and `presentation/`. By the time it was ready, `serverStore.ts` had been deleted
and split into repositories, and a second session had built
`server/settingsRepository.ts` doing the same job as its `domain/shelterSettings.ts`.
Merging would have resurrected deleted files and shipped two settings layers.

Rebuilding the feature on top of `origin/master` and re-applying each change was
the cheaper and safer path. The signal to stop merging and start porting is a
`modify/delete` conflict on a file the branch depends on. Read the other
session's notes before assuming your version is the one to keep — the guidance
here had already moved on from "keep master's".


## 2026-08-30 — Check the platform before hand-rolling a mechanism that sounds generic

Spent a long session building a multi-session coordination protocol for the Midwife agent: claim
files, path-overlap detection, a staleness rule, a takeover rule. Hardened it three separate times
in one evening as testing exposed defects in each version. Then searched for prior art, only
because the human said to, and found that Claude Code ships worktree isolation the harness
*enforces* with four blocking checks, agent teams whose shared task list uses real file locking for
claims, Stop hooks that block a turn until a script passes, and `/goal` conditions re-evaluated
every turn. Every one is stronger than what was built, because they are enforced rather than
remembered.

The tell was there the whole time: the problem had a generic name. "Two workers must not edit the
same file" is not a property of this repo, and problems that aren't yours usually aren't yours to
solve.

**Rule:** before building any mechanism whose description contains a generic noun — locking,
isolation, gating, scheduling, review, retry, coordination — spend one search on whether the
platform or ecosystem already has it. Do it *before* the first design, not after the third
hardening pass. The cost is one search; the cost of skipping it was hours of well-engineered
answer to a question that was already answered. Related: [[measure-fallout-before-writing-task-docs]].

## 2026-08-30 — A "this always wins" precedence clause can void the layer beneath it

The agent spec split into an always-loaded constitution of absolute invariants plus a mechanics
file whose entire job was carving exceptions to them. The mechanics file opened with what read as
good hygiene: *"if this file and an invariant disagree, the invariant wins."*

That single line made every exception illegal. "TRIVIAL: no ledger" lost to "write the ledger
before close." Incident mode's one question lost to "halting is for one-way doors only." The whole
principle the mechanics existed to express — ceremony priced to decision gravity — was formally
void, and nothing in the file was self-evidently broken.

It had already caused real drift: the invariant said "three failed hypotheses", the mechanics said
"three **distinct** failed hypotheses", precedence resolved toward the invariant, and the single
word carrying the entire anti-gaming mechanism was silently non-binding.

**Rule:** when a document says another document always wins, check what the losing document is
*for*. If its purpose is to qualify the winner, the clause is not hygiene, it is a deletion. Write
"X states the default; Y narrows it only where Y says so explicitly and names it," and require
every narrowing to be marked so an unmarked conflict reads as a bug rather than as silent defeat.

## 2026-08-30 — Rules are lossy compression of the failures that produced them

Reconstructed an agent spec from its nine stated rules when the original prose was unavailable. The
rules came back intact. The *mechanisms they were derived from* did not — and they came back
specifically in their **pre-fix** form, because a fix leaves no trace in the rule it produced. The
fence-sweep step was reinvented at build time, which is exactly where it had been before someone
moved it to analysis time to stop post-gate redesigns.

The sharpest instance: "three failed hypotheses kill the design" does not say the hypotheses must
be *distinct*. That missing word was the whole anti-reward-hacking mechanism, and nothing in the
rule's text could have revealed it was gone.

**Rule:** a rule is a compressed artifact of a failure. Rebuilding from rules alone reproduces the
policy and loses the reason, so the rebuild silently reverts every fix that was folded into
wording. When reconstructing anything from its summary, treat the middle details as *drafts that
have not been reviewed*, say so explicitly, and get them diffed against the source before relying
on them. Keep the failure next to the rule — see the `**Why:**` shape used throughout this file.

## 2026-08-30 — Report length is priced to the decision, exactly like ceremony

Building the Midwife agent, the same correction landed twice: "i dont understand, explain it
simply", then "why is it so long. just tell me if the midwife works or not". Both times the work
was sound and the report was the defect. Four litmus tests had run; the answer the human needed
was one word and one open decision, and it was buried under a results table, a verification
excerpt and three sub-findings.

This is the spec's own rule applied to its own output. `midwife.md` §2 says ceremony is priced to
the decision and that GRAVE ceremony on a FAST task "teaches the human to route around you." A
GRAVE-sized *report* on a question with a yes/no answer does the identical damage, and the spec's
report format (Open → Settled → Shipped) actively invites it, because Open-first reads as
permission to enumerate.

**Rule:** lead with the verdict in one line, then the decision the human actually has to make.
Everything else is available on request and belongs in the ledger, which is where a reader who
wants it will look. The report is not the work; a long report about verified work is an unpriced
tax on the person who asked. When the question was "does it work", "yes" is the whole first line.

## 2026-08-30 — Sandbox any agent test whose lane can reach a build

Litmus-testing the Midwife spec, four tests were dispatched. Three ran in throwaway directories.
The fourth — a deliberately fuzzy ticket — was classified "read-mostly" and pointed at the live
repo, on the reasoning that investigating a vague complaint is exploration.

It triaged GRAVE, ran the full lane, and Phase 4 *is a build*. It made two real commits to a
shared branch. The work was good and was kept, but nobody had asked for it.

**Rule:** the blast radius of an agent test is the blast radius of the widest lane its prompt can
trigger, not the narrowest. A prompt that can be triaged GRAVE ends in a commit by design. Copy
the agent config into a scratch directory and point the run there, or accept that the test is a
change to the repository.

## 2026-08-28 — ISO date-only parsing in JavaScript requires timezone-invariant extraction

`new Date("YYYY-MM-DD")` is parsed by ECMAScript engines as UTC midnight (`00:00:00Z`). In timezones located west of UTC (negative offsets like UTC-1 to UTC-12), calling `.getDate()` or `.getMonth()` rolls the date backward by 1 day to the previous evening, causing silent 1-month or 1-day threshold calculation bugs on exact boundaries.

**Rule:** never pass date-only strings (`YYYY-MM-DD`) directly to `new Date()` for calendar math. Extract the year, month, and day integers directly from string parts (`parseDateParts`) before doing month/year difference math to ensure 100% deterministic results across all server and client locales.

## 2026-08-28 — Dual-layer persistence requires Chesterton's Fence analysis before refactoring fallbacks

Dual-layer stores (`Prisma` with in-memory JSON fallback) seem like redundant code duplication and maintenance burden at first glance. However, ripping them out completely would either break sub-second, zero-dependency unit tests or silently break test doubles (`prismaDouble.ts`) that rely on query fallback behaviors.

**Rule:** before simplifying fallback stores, discover their load-bearing invariants through test runs. Ensure that:
1. Pure unit tests run without local DB timeouts via clean in-memory state.
2. Tier 3 strict persistence integration tests (`STRICT_PERSISTENCE=true`) rethrow real database failures rather than masking them.
3. Repositories maintain single-source-of-truth invariants without creating race conditions or phantom data resurrection.

## 2026-08-28 — Domain lifecycle derivation beats static prose storage for temporal entities

Rescues rarely have birth certificates; intake forms routinely capture estimates like `"2 years"` or `"4 months"`. Storing that prose string directly in database columns (`Pet.age`, `Pet.ageCategory`) creates silent data rot: an animal admitted as `"young"` at `"2 years"` remains frozen in time years later, compromising adoption matching engines, medical alerts, and gallery filters.

**Rule:** decouple intake approximation from storage. Store canonical temporal anchors (`birthDate: String` (`YYYY-MM-DD`) and `birthDateIsEstimate: Boolean`) at the persistence boundary. Derive human-readable strings (`"2 years"`, `"4 bulan"`) and lifecycle stages (`"puppy_kitten"`, `"young"`, `"adult"`, `"senior"`) dynamically in a pure domain calculation module (`src/lib/domain/petAge.ts`) at read time. Projection layers (`petMappers.ts`) can supply computed properties seamlessly without breaking client components.


## 2026-08-28 — Never break the shared tree on purpose; the other session repairs it into history

This repo's own rule is to break a guard once and watch it fail — a guard never seen red is not
known to work. Applied to the newly union-keyed `FAQ_CATEGORY_LABELS`, that meant adding an eighth
member to `FaqCategory` to prove an unlisted category becomes a compile error. It does: TS2741, at
the single declaration. The property was real and the check was worth making.

But the injection lived in the working tree for about two minutes, and the parallel session read
the error as a genuine missing case. It added the label entry *and* an `adoption_events` member to
`FAQ_CATEGORIES` in the Zod validator, then committed both. Reverting the union afterwards did not
restore the status quo — it inverted the error (TS2353) and left a category nobody asked for in
history, out of sync with the type in one direction and the fixtures in the other. HEAD did not
typecheck until `4b06451`.

**Rule:** run deliberate breakage where the other session cannot see it. A detached worktree costs
one command — `git worktree add --detach <tmp> HEAD`, copy the files under test in, junction
`node_modules`, run `vitest` there — and the same technique already proved this session's tab work
green in isolation. Reserve in-tree injection for moments when the tree is provably yours, and
revert within the same tool call that injects. A transient error in a shared tree is not transient:
it is an open invitation to a concurrent agent that has no way to know it was staged.

Corollary for the reader on the other side: an error that appears in a file you are not working on,
for a symbol you have never heard of, is more likely someone else's experiment than a real gap.
Check `git diff` before filling it in.
## 2026-08-28 — Email clients cannot parse `oklch()` or `var()`, but the mirror must be mathematically provable

HTML email cannot consume CSS custom properties or modern color spaces (`oklch()`). The design system must provide a `#rrggbb` hex mirror for email templates and server settings (`src/lib/presentation/emailTokens.ts`). However, hand-written tables rot into divergent palettes.

**Rule:** compute the color conversion (OKLCH → OKLab → LMS → linear sRGB → gamma-corrected sRGB) inside static guard tests (`tests/unit/designSystemGuards.test.ts`) and assert that every token mirror entry matches `globals.css` `:root` computed hex values. Pin the mathematical converter against external ground truths (e.g. published sRGB primaries).

## 2026-08-28 — Environment-keyed dev bypasses in security gatekeepers create silent production holes

`getAdminActorOrThrow()` previously bypassed authentication when `NODE_ENV !== "production"`. Because Next.js Server Actions are public, network-reachable endpoints regardless of UI exposure, this allowed unauthenticated mutations on all dev, preview, staging, and CI deployments.

**Rule:** security gatekeepers must be invariant across all environments. Tests requiring administrative privileges must authenticate explicitly (e.g. via `signInAsAdmin()` setting test session cookies) rather than having production bypass branches embedded in runtime security code.

## 2026-08-28 — Accessible button states must match visual selection across dynamic routers

Interactive carousels and filter toggles (such as `PetChooserCarousel`) that allow users to select items or general funds must programmatically expose their active state to screen readers via boolean `aria-pressed` or `aria-selected` attributes, especially when preselected via URL search parameters.

**Rule:** visual active classes (`ring-2`, `bg-primary`, etc.) are invisible to assistive tech; component unit tests must assert `aria-pressed="true"` on the selected option and `aria-pressed="false"` on unselected options.

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

## 2026-08-31 — A config file whose parse failure is silent needs a test that parses it

`test-writer.md`'s description was tightened to read "…what is being asked for: covering an
existing behaviour…". A bare `: ` inside an unquoted YAML scalar is a parse error, so the agent
definition stopped being a definition. Nothing reported it: `tsc` does not read markdown, ESLint
does not read frontmatter, and Claude Code parses these files silently — the symptom of a broken
agent is an agent that is simply never picked, which is indistinguishable from a router that chose
otherwise. It was found only because a *different* task needed a YAML parser.

**Rule:** when a file is consumed by a parser you do not control and its failure mode is silent
absence rather than an error, that file needs a test. `tests/unit/agentDefinitions.test.ts` is that
test here. The class is wider than YAML: any config read by the harness rather than by the build.

## 2026-08-31 — Moving a rule "from prose into a mechanism" requires naming who enforces it

`2026-08-31-schema-auditor-has-no-shell.md` claimed that omitting `Bash` from an agent's `tools:`
list made "never connects to a database" something the agent "cannot do". That is only true if the
runtime enforces the allowlist — a component of Claude Code, not of this repo — and there are open
bug reports saying it sometimes does not (`#60237`, `#63762`, `#52055`). The declaration lives in a
file this repo controls; the enforcement does not. The same trap caught the replacement: the
`PreToolUse` guard written to compensate has its own open report (`#18392`) that frontmatter hooks
never fire, and a hook that does not fire is worse than the prose it replaced, because prose does
not produce confidence.

**Rule:** when converting a rule into a mechanism, name the component that enforces it and state
how you would *see* it fire. If the answer is "the harness, and I would not see it", the rule is
still prose — record it as ASSERTED and give it an agent-checkable trigger. A guard that logs every
invocation costs one line and converts an unfalsifiable claim into a `cat`.

## 2026-08-31 — You cannot test an agent change in the session that makes it

A `Stop` hook was wired into `.claude/agents/spike-runner.md`, the agent was run three times, and
the liveness log gained nothing. The obvious reading — "frontmatter `Stop` hooks do not fire on this
version" — was wrong, and would have killed a sound design. Two further probes found the real cause:
a marker appended to the agent's *body* was also ignored, and a brand-new agent file returned
`Agent type not found`. Definitions are snapshotted at session start
(`tasks/decisions/2026-08-31-agent-definitions-are-session-start-snapshots.md`), so all three runs
executed the pre-edit definition while reporting success.

The trap is that the failure is **silent and looks like a verdict**. An empty log is exactly what a
broken mechanism produces, so the measurement appears to have worked.

**Rule:** before concluding that a mechanism does not fire, prove the run actually loaded the version
you wrote. Change something *observable in the output* — a marker line in the body — and check for it
in the same run. If the marker is missing, the instrument is stale and the measurement is void, not
negative. And for anything the harness loads rather than the build: ship it in an observe mode that
logs what it would have done, and flip it to enforcing only after a *later* session's log proves it
fires.

## 2026-08-31 — A blocker measured in one context is not a blocker until you re-run it in yours

Worktrees were rejected for a year's worth of reasoning on one number: `node_modules` is 987 MB and
a worktree carries no gitignored files, so no test can run inside one. Both halves are true. The
conclusion is false, because `.claude/worktrees/` sits inside the repo and Node resolves
`node_modules` by walking up — `npm test` runs 664 tests green in a worktree that has no
`node_modules` of its own. The command took 0.68s to disprove and was never run, and in the meantime
a 335-line hook was built to mitigate the hazard worktrees would have dissolved.

The tell was there: the entry rejecting worktrees quoted `du -sh` and `git rev-list --count`, but no
command that actually *tried* the thing. Measured inputs, reasoned conclusion, recorded as if the
conclusion were measured too.

**Rule:** before building a mitigation, run the alternative you rejected — once, for real. An
inference from two measured facts is still an inference, and it inherits the evidence class of the
weakest link, not the strongest. If a rejected option would make the work unnecessary, the cost of
testing it is the cheapest thing on the table.

---

## Read the branch you are merging into before you build on the one you left

**2026-09-03.** A sponsorship feature was built against `9799dfe`. By the time it was ready,
`feature/frontend` had merged: 343 files, +40,606 lines. The branch had independently grown its own
`money.ts`, its own receipt-number generator, its own donation ledger and its own copy of the LHDN
constants — all four of which already existed on master, better. Its receipt numbers were random
4-digit draws against master's gapless `ReceiptSequence`, so merging would have put two allocators
on one series.

A `git rebase` would have merged the duplication in and reported success. What caught it was
reading master's `tasks/decisions/` and its schema *before* resolving a single conflict.

**Rule:** when a branch has been open long enough that master moved, the first step is not `rebase`,
it is `git log --stat base..origin/master` and reading the decision records. Rebase resolves text;
it has no opinion about whether your module is now the second copy of something. Ask "what exists on
master now that I would not write today?" and delete rather than merge it.

**Corollary — check the baseline is green before you claim a regression is yours or isn't.**
`npm test` on that clean master failed 4 tests, from a `chore(ui):` commit that moved one colour
token and pushed text contrast under WCAG AA. Without that measurement, any failure after the rebase
would have been attributed to the feature.

## 2026-09-01 — A named external standard outranks the repo's habit, and the corpus is not the spec

Asked for commit guidelines from Chris Beams' seven rules, the first move was to measure this
repo's 203 commits against them and let the measurements soften the rules: 92% of subjects exceed
50 characters, 94% write a lowercase summary, and the body wrap in `atomic-commit.md` had already
drifted to 80. Reporting that as "here is what the repo actually does" turns a standard into a
description, which is the one thing a standard is not. The correction was one line: *defer to
Beams*.

Measuring was still right — it produced the honest baseline (0 of 203 pass), found five commits
whose subject is a bare `@` from a PowerShell here-string, and forced the two genuine conflicts to
be *settled and written down* rather than averaged away: rule 3 binds on the summary after the
colon because `Feat(ui):` would break every parser, and rule 2 is two-tier because Beams himself
asks for 50 and notes GitHub truncates at 72.

**Rule:** when the human names an external standard, implement it faithfully and let existing habit
be the thing that changes; grandfather the history instead of diluting the rule. Measure the corpus
to find the *conflicts* and to size the cost of adopting — never to lower the bar to what the
corpus already does. Where the standard and the codebase genuinely cannot both hold, decide, say
which one moved, and put the number on it.

**And:** a guard that passes on its first run has proved nothing. This one's 62 tests were all green
immediately; a 12-mutant run then showed 11 real kills and one test that passed whether or not the
code worked. Mutate before believing — it costs one throwaway script.

## 2026-09-01 — "Installed" is not "enforcing": check the mechanism can reach what it needs

The commit-msg hook was installed at the human's request and verified three ways — executable,
LF-only, exit 1 on a bad message, and a real `git commit` that git actually rejected. All true, and
all measured inside the worktree that carries the linter. In the **main checkout** the same
installed hook does nothing: it resolves `$(git rev-parse --show-toplevel)/scripts/commit-msg.mjs`
and exits 0 when that file is absent, and the file exists only on the unmerged branch that
introduced it. The enforcement mechanism shipped on the same branch as the thing it enforces, so it
is inert exactly while you believe you are covered.

Two adjacent traps found the same day. Git resolves hooks against the **common** git directory, so
a worktree does not isolate them — installing from `.claude/worktrees/` arms the main checkout and
every other worktree at once. And `core.autocrlf=true` checks shell hooks out with CRLF, making the
shebang `#!/bin/sh\r`, which is a bad interpreter on any POSIX host; that one was invisible on this
machine and would have surfaced only in CI or on someone else's laptop.

**Rule:** this extends *"moving a rule into a mechanism requires naming who enforces it"* by one
step — having named the enforcer and installed it, verify it can **reach its dependencies from
every checkout that will run it**, not just from the one you built it in. The check is one line
(`test -f <the dependency> && echo enforcing || echo inert`) and it belongs in the ledger entry
next to the install. Prefer failing open when the dependency is missing, or a partial checkout
turns into a hook that blocks every commit for a reason nobody can read — but then say out loud,
in writing, that fail-open means unenforced.

## 2026-09-01 — Diverged copies drift in different directions, so reconciling needs a decision

The commit convention lived in three files and all three disagreed: `CONTRIBUTING.md` gave
scopeless examples (`feat: add …`), `WHERE_CODE_GOES.md` required a scope, and
`.claude/agents/atomic-commit.md` specified a body wrap of 80 that nothing else mentioned. This is
the repo's known "anything written twice diverges" shape, with a wrinkle worth naming: they had not
drifted *together* away from an original, they had drifted **three different ways**. There was no
majority to trust and no most-recent copy to promote.

**Rule:** when consolidating duplicated knowledge, do not diff the copies and take the common
denominator — that silently picks a winner per disagreement and records none of the reasoning. Each
divergence is a decision that was never made. Enumerate them, decide each one explicitly, write the
decision down with its cost, and only then collapse to one copy and leave pointers. Here that
produced two settled conflicts (rule 3 binds on the summary; rule 2 is two-tier) whose rationale is
now the most useful part of the standard.

## 2026-09-02 — A pull request with a merge conflict runs no CI at all

PR #3 opened with every job missing. Only Vercel's checks appeared, and the workflow trigger was an
unfiltered `pull_request:`, so the filter was not the cause. GitHub runs `pull_request` workflows
against a *computed merge commit*, and a conflicted PR does not have one:

```
$ git ls-remote origin 'refs/pull/3/*'
9165c23...  refs/pull/3/head        # head only, while conflicted
$ git ls-remote origin 'refs/pull/2/*'
00cc411...  refs/pull/2/head
b4f82b5...  refs/pull/2/merge       # the mergeable PR has both
```

The conflict was two sessions appending to the tail of `tasks/lessons.md` — a prose file, nothing
disagreeing, both sides wanted. That trivial collision silently disabled the entire verification
pipeline for the branch whose whole purpose was to add a verification gate. The gate could not run
until the conflict cleared.

**Rule:** a conflicted PR is not "green pending resolution", it is **unverified**. The moment a PR
opens, confirm CI actually started — `git ls-remote origin 'refs/pull/<n>/*'` must show a `merge`
ref, not just `head`. A check list showing only third-party checks means the workflows never ran,
which looks nothing like failure and is worse.

## 2026-09-02 — A shared node_modules makes every local test result provisional

Worktrees here share one `node_modules` with the main checkout. Two observed consequences in a
single session, neither of which touched any source file:

- The generated Prisma client went stale repeatedly. Symptom is 11 failures across `petHistory`,
  `rehabilitation`, `petStatusPresentation` and `setupMocks`, all `Cannot read properties of
  undefined (reading 'Available')`. `prisma generate` fixes it; something else un-fixes it minutes
  later. The same suite went green, red, then green with no edit in between.
- `jsdom` **disappeared** from `node_modules` mid-session while still declared in `package.json`.
  The whole `components` project stopped running — `Test Files no tests`, `Errors 4` — and in a
  combined run this reads as a *smaller total* (56 files / 775 tests instead of 60 / 830), not as a
  failure.

A test count that drops is easy to miss; a tier that reports "no tests" is not a red X.

**Rule:** never quote a local test count as a baseline without the command that reproduces it *and*
a note that CI is the authority. Compare the **file count** against what is on disk, not just the
pass count — `60` on disk versus `56` discovered is a whole tier missing. Wire `pre<script>` hooks
so the generate step cannot be forgotten, and accept that a concurrent session can still invalidate
the environment underneath a run in progress.

## 2026-09-02 — A critique written from an unverified environment is confidently wrong

Asked to self-critique, I reported that a target doc's baseline of "60 test files / 829 tests green"
was badly stale, citing 11 local failures. Measured properly afterwards: the file count was right,
the test count was off by one, and *green was true*. The 11 failures were my own broken environment.
In the same critique I called the audit range a trap where "the doc pins one form and CI uses
another" — but the doc pins a **rev** (`28159f3`), whose ancestor set is fixed and immune to later
merges. Only my own ad-hoc `28159f3..HEAD` was affected.

Two confident, specific, wrong indictments of my own work, produced by the same failure the critique
was complaining about, one level up. The doc did have a real defect — it never named the
`prisma generate` precondition — but that is not what I accused it of.

**Rule:** a critique is a set of assertions and gets no exemption from verification. Before naming
something a defect, reproduce it from a known-good environment; "I ran it and it failed" is a claim
about the environment until proven to be a claim about the code. Self-criticism feels rigorous,
which is exactly why an unverified one passes review unchallenged.

## 2026-09-02 — Never grep your own verification output for the lines you expect

To confirm a new `pretest` hook fired, I ran `npm run test:all | grep -E 'pretest|Test Files|Tests
|FAIL'` and read back "pretest fires, 775 tests pass". The run had in fact exited **1** with
`Errors 4`: an entire test tier failed to start. My pattern matched `FAIL` but not `Errors`, so the
one line that said the run was broken was the one line filtered out. I reported a green that did not
exist.

The tooling was honest. The filter was mine, and it was built from what I expected to see.

**Rule:** capture the whole output to a file and check the **exit code separately** — `cmd > out
2>&1; echo $?` — then grep the file. Never `cmd | grep …; echo $?`, which reports *grep's* status,
nor a pattern list assembled from the outcomes you anticipated. A filter written before the result
is a hypothesis, and grepping with it tests nothing.

## 2026-09-02 — This repo's source-scanning guards sit on the edge of Vitest's 5s default

`shelterIdentity.test.ts` walks the whole `src/` tree synchronously to prove statutory literals are
confined to one module. It takes ~6s under full-suite parallel load on Windows and fails as
`Test timed out in 5000ms`, while passing in isolation in 2.7s. It surfaced only after unrelated
failures were fixed: those had been dying fast and leaving it headroom, so repairing one problem
appeared to create another. `agentGuard.test.ts` then failed the same way at 5507ms.

Two instances in one session. These guards are the tests that assert properties of the source tree
no behavioural test can see, which makes them the ones worth keeping and the ones most likely to be
deleted when they flake.

**Rule:** when a test fails only in a full run and passes alone, read the failure before theorising
— `Test timed out in 5000ms` is not an assertion failure and has nothing to do with the thing under
test. Give whole-tree scans an explicit timeout, and prove the timeout is wired by mutating it to
`{ timeout: 1 }` and watching it fail; an ignored option is indistinguishable from a generous one.

## 2026-09-02 — Verify what a checker reads, not only what it decides

The commit-msg linter enforced its seven rules correctly and was still wrong, because it was not
reading the bytes git commits. Two instances, found by review after it had merged and been armed:

- It stripped every line starting with `#`. `git commit -F` — the path this repo mandates — uses
  `cleanup=whitespace`, which **keeps** comment lines; only an editor session uses `cleanup=strip`.
  So a body made of `#` lines reported "no body", and a 90-column `#` line escaped the wrap check.
- It tested rule 4 against the untrimmed subject, so `"Add the button. "` passed while
  `"Add the button."` failed. Git trims the line, then commits the period the rule forbids.

Both are the same defect: the checker's input was not the artifact's input. Every rule test in the
suite was correct, and every one of them was asked about the wrong string.

**Rule:** when a gate protects a downstream artifact, prove the gate reads what the artifact will
contain, and prove it by producing the artifact — a scratch `git init`, one `commit -F`, and
`git log -1 --format=%B` settled this in under a minute. Reading the tool's documentation about
cleanup modes would not have; the default differs by invocation path.

## 2026-09-02 — Tests and mutants both only check the rules you thought of

Four holes in that linter survived 62 tests and 12 killed mutants. That is not a failure of either
technique, it is their shape: unit tests assert the rules the author imagined, and mutation testing
asks whether those tests discriminate against the code the author wrote. Neither can produce an
input nobody considered — a subject with a trailing space, a body of comment lines, an unclosed
fence, a summary opening on a backtick.

An adversarial read of the *inputs* found all four in one pass.

**Rule:** a green suite plus killed mutants means "the rules I wrote are enforced and my tests can
tell". It does not mean the rule set is complete. Before trusting a guard, enumerate the input
shapes rather than the rules: empty, whitespace-only, leading and trailing padding, the comment
character, an unterminated delimiter, a non-letter first character. Then check the new tests fail
against the old code — 9 of the 14 written here did, and the other 5 were controls that must pass
both ways.

## 2026-09-02 — An exemption that cannot be turned off is a hole

Rule 6 exempted fenced code blocks by toggling a boolean on each ``` line. An unbalanced fence —
one stray line in prose — latched it on and silently excused every remaining line, trailers
included, from the wrap check. Nothing reset it and nothing reported it. The exemption was not
wrong; its inability to recover was.

**Rule:** any state machine that suppresses a check needs a defined end, and a report when it does
not reach one. Count the delimiters first and refuse to trust unpaired ones, rather than toggling
optimistically and hoping the input closes. The same shape appears wherever a guard has an "unless"
— a skip flag, an ignore comment, a fixture that disables an assertion.

## 2026-09-02 — A destructive helper in a shared location must prove provenance

`install-git-hooks.mjs` wrote `.git/hooks/commit-msg` unconditionally and `--uninstall` removed
whatever carried that name. Hooks live in the **common** git directory — the fact the script's own
docstring stressed — so the file it clobbers may belong to the main checkout, another worktree, or
husky. Its stated goal, not installing a hook the human did not ask for, was enforced by nothing but
the argument the caller typed. Naming no hook with `--uninstall` printed the roster and exited 0,
which reads exactly like a successful removal.

**Rule:** before overwriting or deleting a file in a location you share, prove you wrote it —
compare against the source you would install — and refuse otherwise, with `--force` as the
deliberate way through. A no-op that exits 0 is worse than an error, because the caller believes it
worked. Test this in a throwaway repo, never against the live artifact.

## 2026-09-02 — `.gitignore` does not untrack a tracked file

A concurrent session reported that `.env.example` was force-added on two local worktree branches
only, absent from master and every pushed branch, and asked which branch should carry a fix. It is
tracked on all of them, and has been since 2026-08-26. `.gitignore:34` (`.env*`) matches the path,
so `git status` and `git check-ignore` both call it ignored — while it is tracked, committed, and
present in every tree.

The wrong conclusion was about to send a correct fix to the wrong branch.

**Rule:** ignore rules apply to *untracked* files only. To answer "is this file in this branch",
ask the tree — `git ls-tree -r --name-only <ref> | grep -x '<path>'` — never the ignore machinery
and never `git status`. When a peer reports a repository fact, re-derive it before acting: this one
was three commands, and two of the three claims did not survive.

