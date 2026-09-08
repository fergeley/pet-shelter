# A safety mock must stay configurable, or it deletes the coverage

**Learned:** 2026-09-03

`DATABASE_URL` points at a production branch, so the Prisma client was mocked to
reject on every call. Correct for safety, and it meant 100% of the row-mapping,
aggregation and write code never executed. The least-tested code was the code most
likely to break, and it is exactly where a "database reachable but empty" hole hid
until a review found it.

**Rule:** mock a dangerous dependency per-test, not globally. Use `vi.hoisted`
mock functions and give them resolved values for the happy path so the real
mapping runs, then override with rejections for the failure cases.
