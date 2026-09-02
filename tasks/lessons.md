# Lessons

Patterns worth not relearning. Newest first.

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
