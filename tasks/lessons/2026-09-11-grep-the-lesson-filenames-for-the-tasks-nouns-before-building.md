# Grep the lesson filenames for the task's nouns before building

**Learned:** 2026-09-11

The sponsorship reconciliation dashboard (`feature/agent-7-sponsorship`) went through two review
rounds and a close-out that together raised 24 findings. Six of them were already written down
as lessons, dated days before the work began:

- `2026-09-03-mutation-test-the-fix-not-just-the-feature` — the DAL session hardening shipped
  with 18 green tests, and reverting it left all 18 green.
- `2026-09-03-a-test-that-is-green-because-infrastructure-is-absent-is-not-green` — why: the
  suite mocked the session module, so the new member-row read hit an absent database, `dal.ts`
  caught the rejection, and handed back the cookie's claims. Every authorization test exercised
  the path the fix replaced.
- `2026-09-03-a-safety-mock-must-stay-configurable-or-it-deletes-the-coverage` — the member double
  defaulted to `null` rather than the happy-path row, which routed every test through a fallback
  that master then changed. Probed on `origin/master` with an unseeded coordinator id: 10 of 21
  failed. The suite had been green there only because `usr-coord-01` happens to be a seeded id.
- `2026-09-03-run-every-test-project-locally-not-the-one-you-remember` — the gate recorded "the
  screen behaves" as belief because a browser would issue a real receipt, while
  `tests/components/` (jsdom) sat unused. Nine component tests later it was measured.
- `2026-09-03-a-server-action-is-a-public-post-endpoint-and-reads-leak-too` — a new action
  returning every pending supporter's contact details was guarded on the 24-hour cookie alone.
- `2026-09-08-a-security-fix-needs-an-adversarial-pass-of-its-own-and-its-tests-ar` — three of the
  second review's fifteen findings were in the fixes applied for the first.

The session read `tasks/open/` and `tasks/decisions/` at start, as `AGENTS.md` "Memory lives in
files" asks. It never read the lessons — on that branch still one 1,464-line file, which is the
kind of thing nobody reads end to end.

**Rule:** after `cat tasks/open/*.md`, grep the lesson *filenames* for the task's nouns, and read
the hits before building. Filenames are sentences, so this is one command and a few seconds of
reading. For this task,

```bash
ls tasks/lessons | grep -iE "server-action|mock|guard|-fix|mutation"
```

returns 15 one-line sentences, and four of the six above are among them. Pick the nouns from what
the change *touches* — the layer, the mechanism, the kind of test — not from the feature's name:
"sponsor" would have found none of them.
