# No test exercises the gallery re-rendering *after* it writes the URL

**Status:** open · opened 2026-09-10 · noticed while adding the controller suite

`usePetGalleryController` is now covered by 41 tests
(`tests/components/usePetGalleryController.test.ts`), validated by mutation — fifteen deliberate
regressions failed twenty of them. What none of them cover is the loop closing.

`routerMock.replace` is a spy. It records the href and returns. Nothing feeds that href back into
`useSearchParams`, so in every test the hook writes to the URL and then reads the *same*
`searchParams` snapshot it started with. The suite proves what the hook *writes*. It proves
nothing about what it reads next.

That matters because the hook's own comment claims something about exactly this:

    Taking a partial record rather than one key is what lets "switching track also clears the
    status" be a single history entry. With a setter per filter it would have been two
    `router.replace` calls in the same tick, the second built from a `searchParams` snapshot
    that predates the first — so one of the two changes would be dropped.

The single-`replace` half is pinned (the mutation run failed on `expected 1 times, but got 2`).
The reason it matters — that a second write in the same tick reads a stale snapshot — is
**reasoned, not observed**. Every test here would pass under a router that never updated at all.

Unexercised as a result:

- Back/forward navigation. A `popstate` changes `searchParams` without any handler running; the
  grid should follow. Nothing checks it does.
- Two interactions in the same tick, the hazard the comment names.
- `router.replace(..., { scroll: false })` actually preserving scroll position, as opposed to
  being passed the option.

This is not a defect report. The behaviour may well be correct — Next owns most of it. It is a
note that the confidence available from this suite stops at the URL write, and a comment in
`src/hooks/usePetGalleryController.ts` currently asserts past that line.

**Settles when:** either a Playwright spec drives `/pets` through a track switch, a back
navigation and a same-tick double interaction, asserting the grid and the address bar agree
afterwards — or someone establishes that Next's own guarantees cover it and rewrites the comment
to cite that instead of reasoning about snapshots.
