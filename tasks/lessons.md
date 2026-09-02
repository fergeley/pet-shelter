# Lessons

Patterns worth not repeating, captured after user corrections. Newest first.

## 2026-09-02 — A "fallback" that fabricates data is a defect, not resilience

**What happened.** The transparency feature shipped with an offline fallback that
substituted a bundled sample ledger whenever the database read failed *or*
returned nothing. The admin editor warned about it; the public page did not. A
production deploy against an unmigrated database would therefore have published
28 invented expenses — complete with realistic invoice references — on the one
page whose entire claim is that its figures are verified. `next build` had
already baked that state into the prerender.

**Rule for next time.** Before writing a fallback, ask what it *asserts* to the
reader. A cache or a retry asserts nothing. Substitute data asserts "these are
the numbers". On any surface that makes a truth claim — financial, legal,
medical, audit — the fallback is an honest empty state, never invented content.
Gate sample datasets to `NODE_ENV !== "production"` and label them in the UI.

**Related rule.** A `source`/provenance field is only worth having if every
surface that renders the data reads it. Adding it and wiring it to one consumer
produced false confidence: the field existed, so the risk felt handled.

## 2026-09-02 — De-duplicating shared data must not cost server rendering

**What happened.** Two pages held their own hard-coded copies of the same expense
split (45/30/20/5 vs the ledger's real figures). Collapsing them onto one derived
source was right, but the shared component fetched on mount from a client
component — so the donate page lost its server-rendered content, its first paint
and its crawlability. The fix traded a correctness bug for a performance and SEO
regression, and nothing in the test suite noticed.

**Rule for next time.** When a client component needs server data, move the fetch
up to a Server Component and pass props down; do not let a shared presentational
component fetch for itself. After any such refactor, diff the *server HTML* of
every affected page — `curl` the route and grep for the content that should be
in it. "The tests pass" does not prove the content is still server-rendered.

## 2026-09-02 — Mocking a dependency to reject makes its code path untested

**What happened.** The Prisma client was mocked to reject on every call so the
suite could not touch the production database. That was correct for safety, but
it meant 100% of the row-mapping, aggregation and write code never executed. The
least-tested code was the code most likely to break, and it is exactly where the
"reachable but empty database" hole hid.

**Rule for next time.** A safety mock must still be *configurable per test*. Use
`vi.hoisted` mock functions and set resolved values for the happy path, so the
real mapping runs, then override with rejections for the failure tests.

## 2026-09-02 — Self-review finds different bugs than building does

Asked to critique freshly written code, a systematic pass over it found one
integrity bug, three regressions and five correctness defects that the build,
the type checker, the linter and 46 passing tests had all accepted. Verify each
suspicion against the file rather than reasoning from memory of having written
it — several suspicions were wrong, and several that felt paranoid were real.
