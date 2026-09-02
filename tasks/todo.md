# Transparency page — remediation of self-review findings

Branch: `worktree-transparency`. Fixes the regressions and bugs found reviewing the
initial implementation. Approved by the user before starting.

## Integrity (must not ship without)

- [x] Public page must never present the bundled sample ledger as verified data.
      In production a failed/empty read yields an honest "unavailable" state; the
      sample dataset is a development convenience only, and is labelled when shown.
      → `TransparencySource` is now `database | sample | unavailable`;
      `readTransparencySnapshot` refuses to substitute sample rows when
      `NODE_ENV === "production"`, and `LedgerSourceNotice` states the provenance
      above the fold whenever it is not `database`.
- [x] Seeded report rows must say in the UI that their PDFs are placeholders.
      → Every sample report summary now begins "SAMPLE DOCUMENT — replace with the
      statement filed with ROS before publishing.", asserted by a test.

## Regressions introduced by the first pass

- [x] `/donate` server-renders the allocation again. `app/donate/page.tsx` is a
      Server Component; the page body moved to
      `components/features/donations/DonatePageView.tsx`; `AllocationSummary` is
      presentational and no longer fetches on mount.
- [x] `revalidatePath("/donate")` now invalidates real rendered content.
- [x] Ledger payload bounded: `PUBLIC_FEED_LIMIT = 120` rows for the feed, while
      allocation comes from a `groupBy` aggregate over the entire published
      ledger, so the chart stays exact. The feed says when it is showing a window.

## Correctness

- [x] Admin projection reuses `sortExpensesNewestFirst` (a consistent comparator).
- [x] Report dates use `formatTimestampDate`, which formats the UTC calendar date
      rather than `toLocaleDateString`.
- [x] `<dt>` precedes `<dd>`; `flex-col-reverse` keeps the figure on top visually.
- [x] `<figcaption>` is the last child of `<figure>`.
- [x] `isDatabaseUnavailable` distinguishes connection-class failures (P1001,
      P2021, ECONNREFUSED, …) from a rejected write. Only the former falls back to
      memory, and never in production.

## Accessibility

- [x] The five no-op `<button>` segments are now plain `aria-hidden` marks; the
      ranked cards and table carry the data accessibly.

## Optimisation / quality

- [x] All eight `as unknown as Db*Row` casts removed; the generated Prisma types
      are used directly, so schema drift becomes a compile error.
- [x] Palette CSS is a module-scope constant.
- [x] Duplicate financial reports rejected (same year + month + title).
- [x] Admin writes rate limited (60/min per editor), with a typed error so the
      editor is told to wait rather than shown a generic failure.
- [x] `formatMYR` no longer depends on the runtime's `Intl`/ICU data, removing a
      server/client hydration hazard on a page full of amounts.

## Test coverage

- [x] The Prisma path now executes: row mapping, `Date → ISO` conversion,
      aggregate-driven allocation, query bounds, reachable-but-empty, unknown
      category, production-never-samples, rejected-write-propagates, duplicate
      report, error-message redaction and rate limiting. 25 → 71 transparency tests.

## Verification

- [x] `tsc --noEmit` clean; `eslint` 0 errors (3 pre-existing warnings elsewhere);
      254 tests pass; `next build` succeeds.
- [x] Production build served with an unreachable database: `/transparency`
      contains **zero** sample expense rows and shows the unavailable notice.
- [x] Dev server: `/donate` server HTML contains the category labels, all five
      percentages and the RM totals, with no loading spinner; all other donate
      sections (widget, wishlist, FAQ) still render.
- [x] `/transparency` in dev shows the "Development sample data" banner while
      still rendering the ledger.
- [x] Independent fresh-eyes review pass.

## Second round — fixes from the independent review

- [x] **The seed path was a second door onto the integrity bug.** `npm run db:seed`
      inserted all 28 sample expenses with `isPublished: true`, so the read
      succeeded, `source` became `database`, the provenance banner suppressed
      itself, and invented figures rendered as verified spending. The admin banner
      even instructed operators to run it. Sample-ledger seeding is now behind an
      explicit `SEED_SAMPLE_TRANSPARENCY=true` opt-in with a warning, and the
      admin banner no longer recommends `db:seed`.
- [x] **Feed and totals could state different amounts.** The aggregate dropped
      non-positive rows; the rendered feed filtered on `isPublished` only. A
      refund or zero-value row therefore appeared in the feed but not the chart —
      the exact "two answers" failure this page exists to avoid. Both now share
      `isCountableExpense`.
- [x] `formatMYR(1450.5)` returned `"RM 14.50.5"` and `formatMYR(NaN)` returned
      `"RM NaN.NaN"` — a regression from replacing `toLocaleString`, which had
      degraded gracefully. Now rounds to whole sen and guards non-finite input.
- [x] P2025 (row already gone) was rethrown, making the "no longer exists"
      message unreachable whenever the database was up; an ordinary double-clicked
      delete was logged as a server error.
- [x] `sortReportsNewestFirst` did the opposite of its comment (`month ?? 0` put
      the annual report last in its year), and the test that claimed to cover it
      compared different years so never exercised the claim.
- [x] `/donate` could not state provenance — it had no `source` prop, so in dev it
      showed the sample split with no warning while `/transparency` warned.
- [x] Admin role gate accepted lowercase `"admin"`, which the server rejects —
      handing that account an editor UI whose every action failed.
- [x] Feed truncation notice was hidden until all months were expanded, and
      reported whole-window counts while a category filter was active.
- [x] `orderBy: { date: "desc" }` with `take` cut same-day rows arbitrarily; now
      tie-broken by `id`.
- [x] Admin banner claimed "editing is disabled" when nothing disabled it.
- [x] `@@unique([year, month, title])` added as a backstop behind the non-atomic
      duplicate-report check (covers monthly; annual rows are NULL-distinct in
      Postgres and still rely on the code check, which is documented).
- [x] `isIsoDate` rejected years 0–99 because `Date.UTC` maps them to 1900+y.

Not fixed, deliberately: the reviewer flagged a `LanguageProvider` hydration
mismatch for returning Malay visitors. It is real but **pre-existing and
site-wide** — a `"use client"` page is still server-rendered, so `/donate` had
exactly this behaviour before the split. Fixing it means changing how the
provider seeds its language for every page, which is outside this task.

## Review

The most valuable thing the work produced was a bug the *new* tests caught rather
than the code review: the rate-limit guard threw a plain `Error`, which the
error-redaction helper replaced with "Failed to record expense" — so a throttled
editor would have been told nothing useful. Fixed with a typed `RateLimitedError`.

Two fixes were made beyond the approved list, both for consistency with fixes
already being made rather than as new scope: `hasMoreExpenses` was being computed
before the admin list was widened (so it could misreport for drafts), and
`formatMYR` still used `toLocaleString` after `formatTimestampDate` had been moved
off `Intl` for hydration safety.

Deliberately not done, and why:
- No `unstable_cache` layer. Server-rendering both pages under ISR (`revalidate =
  300`) already collapses the per-visit database reads that motivated it; adding a
  second cache would be complexity without a measured benefit.
- No expense-level idempotency key. Two identical purchases on one day are
  legitimate, so a uniqueness rule would reject real data; duplicate *reports* are
  not legitimate and are rejected.
- Still unverified against a real PostgreSQL — the only reachable database is the
  Neon production branch. The DB code path is now covered by mocks that resolve
  with realistic rows, which is a large improvement but not the same thing.
