# Checking the spec is not checking the page object behind it

**Learned:** 2026-09-09

Before disabling the donation form's tax-ID input, I grepped `02_rescue_sponsorship_receipt.spec.ts`
for tax-ID use, found it only in a data literal, and concluded e2e was unaffected. The break was in
`e2e/pages/DonatePage.ts`, one call deeper, where `fillDonor` fills that input.

And it would not have failed. Playwright's `fill()` waits for an *enabled* element, so a newly
`disabled` input makes the run **hang until timeout** — `TimeoutError: locator.fill: Timeout 15000ms
exceeded … element is not enabled` — which reads like slowness rather than breakage. `/code-review`
found it by reading; no local check could have.

**Rule:** a change to an input's enabled, visible or required state is a change to every page object
that drives it. Grep `e2e/pages/` for the element's selector or placeholder, not only `e2e/specs/`.
