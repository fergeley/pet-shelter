# Three edge cases where the gallery's URL state and its screen can disagree

**Status:** open · opened 2026-09-16 · from the fourth review of PR #38, judged below its merge bar

Each was weighed against PR #38's rule for its later review rounds — block only on a correctness
defect the PR introduces, a security gap, or a false claim — and recorded instead. None hides data
or misreports it; each is a state a visitor can reach that reads worse than it should.

1. **Tab counts versus the grid.** Track counts are computed before the status filter. With a status
   kept across a track switch — PR #38 keeps "Pending" when widening to All — "All (20)" can sit
   highlighted over a grid of five. The count is accurate for the track and the status select shows
   what narrows it, and the same was true *within* a track before PR #38. Making counts
   status-aware is a design choice.
2. **A stale link can pair a track with a status outside it.** `?track=rehabilitation&status=Pending`
   resolves both values individually, so it lands on an empty grid. The select shows
   "Pending (0)", so the cause is on screen. `resolveFilters` could apply the same "does this status
   live in this track" rule `setSelectedTrack` already applies.
3. **Unrecognised values are never removed from the URL.** `?species=Dog` resolves to "all", so
   nothing is filtering and Reset is hidden — and every later filter change rebuilds its query from
   the raw params, carrying `species=Dog` along into every URL the visitor shares until that
   filter is touched.

**Settles when:** each is either fixed with a test in `tests/components/usePetGalleryController.test.ts`,
or decided as intended and moved to `tasks/decisions/`.
