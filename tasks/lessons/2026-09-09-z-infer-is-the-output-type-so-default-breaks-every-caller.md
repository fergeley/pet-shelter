# `z.infer` is the output type, so `.default()` breaks every caller

**Learned:** 2026-09-09

Added `wantsTaxReceipt: z.boolean().default(false)` to `donationPledgeSchema` and broke eleven call
sites, including `useSponsorshipController`, which has no opinion about the field.
`DonationPledgeInput` is `z.infer<typeof schema>` — the schema's **output** type — and in the output
a defaulted field is *required*, because by then the default has been applied. `.optional()` was
both simpler and more honest at an action boundary.

Only `tsc` caught it. Vitest was green throughout, because a test that passes an object literal to a
Server Action never typechecks it at runtime.

**Rule:** at a Server Action boundary typed with `z.infer`, prefer `.optional()` to `.default()`
unless every caller is updated in the same change. And run `npm run typecheck` before believing a
green Vitest run — the two check disjoint things, and the suite cannot see a contract break.
