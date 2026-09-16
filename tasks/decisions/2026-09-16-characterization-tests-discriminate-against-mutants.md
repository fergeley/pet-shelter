# Characterization tests discriminate against mutants, not correct master

**Decided:** 2026-09-16 · branch `codex/sponsorship-boundary-followup`

The first sponsorship-boundary design registered this immutable kill condition:

> If a proposed regression test passes on the untouched base, it does not cover the claimed gap.

That was correct for the missing cancellation guard and wrong for two coverage gaps. Live
authorization already refused a suspended administrator, and same-actor receipt recovery already
re-threw uncertainty. Tests added to preserve those contracts must pass on untouched master; making
them fail there would require asserting the wrong behavior.

K2 therefore fired and killed the combined design when the characterization tests passed on
master. Their later mutant failures proved that the tests were discriminating, but did not make the
original condition un-fire. The claim records the original gate and failure unchanged.

The replacement design distinguishes two test obligations:

- A test for **new behavior** must fail on untouched code and pass after the change. The malformed
  pledge-filter test did exactly that.
- A test for an **existing contract** must pass on untouched code, fail when a targeted mutation
  removes that contract, and pass again after the mutation is restored. Cookie-only export auth,
  same-actor auto-classification, and invented recovery receipts were the three mutations used.

This is not permission to use arbitrary mutants to decorate a test with a red run. The mutation
must be the exact regression the test claims to prevent, and the worktree must prove no mutant
remains before product implementation or verification continues.

The corrected build gate is explicitly retroactive because the category error was found during
independent review after the tests existed. Pretending it preceded the build would repeat the same
process defect in a more polished form.

Related: [[2026-09-16-sponsorship-boundaries-fail-closed-under-uncertainty]].
