# Claim: close the remaining sponsorship boundary gaps

**Status:** open - opened 2026-09-16

- **session:** `/root`
- **lane:** GRAVE
- **branch:** `codex/sponsorship-boundary-followup`, cut from `origin/master` at `5b2672a`
- **phase:** 4 - original design killed by K2; corrected retroactive gate under review
- **paths:** `src/lib/server/sponsorshipLedger.ts`, `src/app/admin/donations/page.tsx`,
  `tests/unit/sponsorAuth.test.ts`, `tests/integration/donationReceiptExport.test.ts`, one focused
  sponsorship-ledger unit suite, and a new `tasks/decisions/2026-09-16-*.md` entry

## Phase 0 - frame

```
Problem: The merged sponsorship contract leaves one latent ledger filter boundary, lacks direct
         regression coverage for two security/failure classifications, and declares a 30-second
         action budget below the receipt helper's possible 40-second retry ceiling.
Claim:   Add one runtime guard, discriminating tests, a 60-second page budget, and a new decision
         entry, because read-only audits found these are the only non-obsolete fragments left from
         the superseded reconciliation worktree.
frame-confidence: high - three independent audits against origin/master at 5b2672a agree on the
                  current code paths, callers, and missing tests.
```

## Phase 1 - assumption stack

1. **MEASURED** - `cancelRecurringPledgeAction` validates through `pledgeRefSchema`, but
   `cancelSponsorshipForUser` passes its nominal string directly to Prisma; current exposure is
   contained to the one validated product caller.
2. **MEASURED** - one receipt attempt is bounded by 5 seconds of acquisition plus 15 seconds in
   the transaction, while the one permitted retry makes the helper's theoretical transaction
   ceiling 40 seconds before live authorization, recovery reads, or `after()` work; the page
   declares only 30 seconds.
3. **UNKNOWN** - the live `port privacy fix to master` session may change the same ledger and test
   paths; implementation is invalid while that ownership remains active.
4. **ASSERTED** - existing fakes can make malformed cancellation and lost-ack classification tests
   fail on the base without requiring a product refactor.
5. **MEASURED** - same-actor settlement after a receipt failure must remain uncertain without an
   operation ID; only a different actor's receipt is safe to classify as an ordinary lost race.

## Fence sweep

- Do not replay or copy the superseded dirty worktree wholesale.
- Do not edit any overlapping ledger/test path while the privacy session is active.
- Preserve the current same-actor uncertainty behavior; this task adds coverage, not automatic
  recovery.
- Do not reduce Prisma's transaction limits without latency evidence.
- Do not describe `after()` as durable delivery or make an outbox change ride along.
- Do not read or mutate production data, send email, deploy, or change migrations.
- Do not rewrite the 2026-09-14 or 2026-09-15 decision entries; add a new dated entry.

## Immutable kill conditions

1. **K1 - live path collision.** If `port privacy fix to master` is still active or its unmerged
   diff owns `sponsorshipLedger.ts` or its tests, do not build. Wait for a stable commit/merge,
   refresh the base, and re-evaluate the planned diff.
2. **K2 - non-discriminating test.** If a proposed regression test passes on the untouched base,
   it does not cover the claimed gap. Redesign that test before product code changes.
3. **K3 - broad guard required.** If closing the cancellation boundary requires redesigning
   transition ownership or changing valid caller outcomes, kill that design and keep the local
   runtime assertion only.
4. **K4 - unsupported route budget.** If bundled Next documentation or current official Vercel
   limits do not support a page-level 60-second `maxDuration`, do not change the value; record the
   transaction budget mismatch as open instead.
5. **K5 - broken base.** If any named relevant test is red on the refreshed untouched base,
   attribute it against current master before implementation; do not claim the follow-up caused or
   fixed it.

**Settles when:** the overlapping session is reconciled, every new test is observed red then green,
the minimal implementation and new decision entry pass relevant and repository verification, an
independent review finds no correctness blocker, and the resulting commit is ready for separately
authorized publication.

## Phase 2 observation - K1 fired

The live `port privacy fix to master` session committed and pushed changes that included
`src/lib/server/sponsorshipLedger.ts` and its PostgreSQL suite. Build paused exactly as K1 required;
no overlapping product or test path was edited on this branch while that ownership was active.

The owner then finished at `a14525c`. PR #44 passed all seven exact-head checks, an independent
read-only review found no merge blocker, and it merged to `origin/master` as `446f3d6`. This branch
fast-forwarded to that merge without carrying over the superseded worktree's dirty tail. K1 is
resolved; the refreshed code still lacks the cancellation boundary guard and the named regression
coverage, while the queue projection change does not alter those planned seams.

## Build Gate - sponsorship boundary follow-up  ·  lane: GRAVE  ·  branch: codex/sponsorship-boundary-followup

### Phase 0 - frame

- [x] `Problem:` The merged sponsorship contract leaves one latent ledger filter boundary, lacks
  direct regression coverage for two security/failure classifications, and declares a 30-second
  action budget below the receipt helper's possible 40-second retry ceiling.
- [x] `Claim:` Add one local runtime guard, discriminating tests, a 60-second page budget, and a
  new decision entry, because three read-only audits plus direct inspection of refreshed master
  found these are the only non-obsolete fragments left from the superseded worktree.
- [x] `frame-confidence:` high - the frame comes from independent audits against `5b2672a`, the
  merged privacy projection at `446f3d6`, and the focused 40-test refreshed-master baseline below.

### Phase 1 - stack + fences

- [x] Assumption stack, ordered by invalidation cost:
  1. **MEASURED** - the product action validates a pledge reference, but the exported ledger
     cancellation function has no runtime assertion before constructing its Prisma filter.
  2. **MEASURED** - two allowed receipt attempts can spend up to 40 seconds in acquisition plus
     transaction execution, while the page declares 30 seconds.
  3. **MEASURED (was UNKNOWN)** - the privacy owner is finished and its overlapping change is now
     merged into this branch at `446f3d6`.
  4. **ASSERTED** - the existing test doubles can make malformed cancellation and lost-ACK
     classification tests fail on the base without a product refactor.
  5. **MEASURED** - a same-actor receipt after an uncertain failure does not identify which
     request committed, so the current code must rethrow rather than claim success.
- [x] Memory searched before listing - searched `tasks/decisions/` and `tasks/open/` for
  cancellation, same-actor/lost-ack recovery, live authorization, route duration, and receipt
  transactions. The existing entries preserve atomic receipt issuance and live queue
  authorization but do not settle these follow-up boundaries.
- [x] **Fence sweep complete.** Preserve the atomic receipt transaction and same-actor
  uncertainty from the 2026-09-14 decisions; preserve PR #44's queue projection; add rather than
  rewrite dated decisions; do not claim `after()` is durable work.

### Phase 2 - falsification

- [x] **RAW EVIDENCE for the highest-ranked entry that was NOT MEASURED:** the overlapping owner
  is no longer live, and its exact head is merged.

  Command:

  ```powershell
  claude agents --json --all
  gh pr view 44 --json state,isDraft,mergedAt,mergeCommit,headRefOid
  ```

  Output:

  ```text
  {"sessionId":"d6591cd1-8549-44bf-b4d1-8ffb5fee633e","name":"port privacy fix to master","state":"done","status":"idle"}
  {"headRefOid":"a14525ca9bf78f8e301273a9e0fea8db64a75619","isDraft":false,"mergeCommit":{"oid":"446f3d67cbee18396653a6c0c6c51cfdb12e12b2"},"mergedAt":"2026-09-16T12:14:08Z","state":"MERGED"}
  ```

  **Would have shown instead, if false:** the session in `working`/`busy` state or PR #44 still
  open with its ledger diff absent from `origin/master`.
- [x] Every other invalidating assumption:
  - A1 is measured at `sponsorshipLedger.ts`: `transitionPending` asserts a string at line 252,
    while `cancelSponsorshipForUser` starts at line 768 with no equivalent assertion.
  - A2 is measured by `RECEIPT_TRANSACTION = { maxWait: 5_000, timeout: 15_000 }`, its one scoped
    retry, and `maxDuration = 30`. Bundled Next 16.3.1 documentation confirms page-level
    `maxDuration` governs Server Actions and `after()` uses the route budget.
  - A4 remains ASSERTED and is tested first in Phase 4: each proposed regression must be red on
    untouched product code or K2 kills that test design.
  - A5 is measured by the `now?.reconciledBy !== reconciledBy` classification in
    `settleSponsorship`; same actor, no receipt, and reread failure all rethrow the original
    `ReceiptIssuanceError`.
- [x] Kill conditions were written before falsification and were not edited. Outcome: K1 fired
  and resolved by waiting for/reviewing/merging PR #44; K4 and K5 did not fire; K2 and K3 did not
  fire pre-build and remain active during the test-first implementation loop.
- [x] **Failure Truth** - without these boundaries, a malformed direct ledger call can broaden a
  cancellation filter, an export regression can read donor PII for suspended staff, and a valid
  retry can outlive the declared route budget.
- [x] **Reversibility** - one commit reverts the guard, tests, route constant, and decision entry;
  no schema, migration, production data, or deployment state changes.

### Hygiene

- [x] **No ride-alongs.** The planned diff is limited to the named sponsorship boundary, coverage,
  route budget, and its decision/claim records.
- [x] **Ledger** - this gate is appended here; the settled rationale will be a new dated decision,
  and unsupported conclusions will remain in `tasks/open/`.

**Not verified at gate time:** A4, "the existing test doubles can make malformed cancellation and
lost-ACK classification tests fail on the base without a product refactor." Phase 4 below records
the later measurements; this line remains the original gate's honest state when it was emitted.

## Phase 4 verification log

- A4 is now measured. The malformed cancellation test failed on untouched product code; the
  existing-behavior tests each failed under a targeted temporary mutant and passed after it was
  restored. No mutant remains in the diff.
- Focused result after implementation: 3 files, 46 tests passed.
- `npm run check`: exit 0; TypeScript and docs checks clean, ESLint 0 errors and 14 pre-existing
  warnings.
- `npm run test:all`: 103 files, 1623 tests passed.
- `npm run build`: failed before compilation because Turbopack rejects this worktree's external
  `node_modules` junction: `Symlink [project]/node_modules is invalid, it points out of the
  filesystem root`.

**Hypothesis:** the build failure is caused by the isolated worktree's dependency junction rather
than source code; Next's supported webpack builder should compile the same source without
Turbopack's filesystem-root restriction. The normal Turbopack command must still run in PR CI from
a native checkout before merge.

**Observed:** `npx --no-install next build --webpack` compiled the production application, passed
its TypeScript phase, generated all 38 static pages, and collected build traces with exit 0. The
hypothesis survived. Normal Turbopack remains an explicit PR-CI gate.

## Design obituary - K2 fired

K2 fired during independent review. The suspended-export test and four lost-ACK tests passed on
untouched master because the behavior they preserve was already correct. Targeted mutants later
made them red, which proves discrimination but does not change the condition's literal outcome.

**DIED - design changes:** the original design treated every new test as proof of missing product
behavior. It is replaced, not amended, by a design that separates a base-red test for new behavior
from mutant-red characterization tests for existing contracts. The immutable K2 text above remains
unchanged. Its obituary and replacement rule are recorded in
`tasks/decisions/2026-09-16-characterization-tests-discriminate-against-mutants.md`.

## Corrected Phase 0 - frame, with the corpse in view

```
Problem: One product boundary lacks a runtime guard, while two already-correct security/recovery
         contracts lack tests; applying one red-on-base rule to both categories killed the first
         design.
Claim:   Add the local guard with a base-red test, preserve the existing contracts with tests that
         fail under their exact regressions, and raise the route budget with bounded wording.
frame-confidence: high - the base failure, three mutant failures, restored green runs, and
                  independent review directly distinguish the two categories.
```

## Corrected Phase 1 - stack + fences

1. **MEASURED** - malformed cancellation is new behavior: the untouched implementation resolved
   `null`, reached `updateMany`, and failed the guard test.
2. **MEASURED** - suspended-export refusal is existing behavior: it passed on master and failed
   when `getVerifiedSession` was replaced by cookie-only `getCurrentSession`.
3. **MEASURED** - lost-ACK classifications are existing behavior: they passed on master and failed
   when the actor distinction or failed-read result was corrupted.
4. **MEASURED** - 60 seconds is supported and provides 20 seconds beyond the two-attempt,
   40-second transaction ceiling; it does not bound the remaining operations.
5. **MEASURED** - PR #44 is merged, the owner is done, and no targeted mutant remains in the diff.

Fences remain: no stale-tail replay, no change to same-actor outcomes, no shorter Prisma limits, no
durable-email claim, no production access, and no rewrite of prior decisions.

## Corrected Phase 2 - falsification

**SURVIVED - verified:**

- New behavior, untouched base:

  ```text
  AssertionError: promise resolved "null" instead of rejecting
  Tests  1 failed | 6 skipped
  ```

- Existing same-actor contract, exact actor-guard mutant:

  ```text
  AssertionError: promise resolved "{ status: 'already_reconciled', ... }" instead of rejecting
  Tests  1 failed | 6 skipped
  ```

- Existing no-receipt/read-failure contract, exact recovery mutant:

  ```text
  Tests  2 failed | 5 skipped
  ```

- Existing live-authorization contract, cookie-only mutant:

  ```text
  expected "vi.fn()" to not be called at all, but actually been called 1 times
  1st vi.fn() call: Array [ 1001 ]
  ```

Each mutant was restored before implementation continued. `git diff --exit-code` over the mutated
product paths was empty immediately afterwards; the final diff changes no export or lost-ACK
outcome.

## Build Gate - corrected sponsorship boundary design  ·  lane: GRAVE  ·  branch: codex/sponsorship-boundary-followup
## retroactive: tests and product diff existed before independent review found K2's category error

### Phase 0 - frame

- [x] `Problem:` One missing runtime guard and two missing characterization suites require different
  falsification standards.
- [x] `Claim:` Base-red/implementation-green for new behavior; mutant-red/base-green for existing
  contracts; bounded route-budget wording.
- [x] `frame-confidence:` high - supported by the raw failures above and restored green runs.

### Phase 1 - stack + fences

- [x] The corrected five-entry MEASURED stack is pasted above.
- [x] Memory was already searched before the original stack; the design obituary adds no new
  repository question.
- [x] **Fence sweep complete.** Atomic receipt issuance, live authorization, same-actor
  uncertainty, the privacy projection, and best-effort email semantics remain intact.

### Phase 2 - falsification

- [x] **RAW EVIDENCE** is pasted above for the base failure and all three exact regression mutants.
  **Would have shown instead, if false:** the cancellation test green on untouched code, or a
  characterization test staying green when its named contract was removed.
- [x] Every invalidating assumption in the corrected stack is MEASURED.
- [ ] Corrected kill conditions were written before the experiments - no. This gate is explicitly
  retroactive because independent review found the category error after build. The original kill
  conditions remain immutable; K2 is recorded as fired, and its design is dead rather than edited.
- [x] **Failure Truth** - a broad Prisma filter could cancel more than the named pledge, while
  regressions in live authorization or uncertainty classification could expose donor PII or report
  an unconfirmed statutory receipt as settled.
- [x] **Reversibility** - one commit reverts the guard, tests, route value, and new decisions; no
  schema, production data, or deploy state changes.

### Hygiene

- [x] **No ride-alongs.** The diff is limited to the guard, route budget, focused tests, and the
  decision/claim records demanded by this task.
- [x] **Ledger** - K2's obituary and the replacement rule are in a new dated decision; this
  corrected gate remains in the claim until close.

**Not verified:** the repository's default Turbopack build cannot run in this worktree because its
dependency junction points outside Turbopack's filesystem root. The supported webpack production
build passed; exact Turbopack verification is required from PR CI before merge.
