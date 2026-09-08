# Editing a home impact figure does not revalidate `/`

**Status:** open · opened 2026-09-08

`src/actions/transparency.ts:63` sets `LEDGER_PATHS = ["/transparency", "/donate"]`, and
`revalidateLedger()` iterates only those. Since 2026-09-08 the home page also reads `ImpactStat`
(`readHomeImpactStats`, see
`tasks/decisions/2026-09-08-home-metrics-reuse-the-impact-stat-table.md`), but `"/"` is not in that
list.

Consequence: staff correct "520+" to "640+", the editor reports success, /transparency and /donate
update at once — and the home page, the surface they were actually fixing, keeps showing the old
figure for up to the `export const revalidate = 300` window in `src/app/page.tsx`, with nothing
indicating the write landed. Every other mutation path in the repo already does the on-demand
invalidation: `src/actions/pets.ts:188` and `src/actions/applications.ts:158` both call
`revalidatePath("/")`.

The fix is one entry in that array. It was not made here because `src/actions/**` was read-only for
the task that introduced the home read, so the change would have been unreviewed by whoever owns
that module.

**Settles when:** `LEDGER_PATHS` includes `"/"`, with a test asserting the home path is among the
revalidated paths after `saveImpactStatAction`.
