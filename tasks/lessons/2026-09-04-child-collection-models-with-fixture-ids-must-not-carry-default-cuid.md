# Child collection models with fixture IDs must not carry @default(cuid())

**Learned:** 2026-09-04

Prompt specifications often recommend adding `@default(cuid())` to child relations (`PetUpdate`, `MedicalTimelineEvent`) to make IDs optional. However, existing test suites (`tests/unit/petHistory.test.ts`) may explicitly forbid `@default(cuid())` via regex assertions to guarantee that deterministic, fixture-supplied IDs (`up-009-1`, `tl-001-1`) round-trip cleanly through `db:seed` without surrogate key collisions.

**Rule:** Check existing schema contract tests before applying ID generator defaults to Prisma models. If a unit test explicitly asserts `expect(body).not.toMatch(/@default\(cuid\(\)\)/)`, do not add the default.
