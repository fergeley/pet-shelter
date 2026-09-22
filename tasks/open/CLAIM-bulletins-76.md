# CLAIM — bulletins get a server-side store (#76)

session: bulletins-76 worktree, branch `worktree-bulletins-76`, based on `origin/master` 8d36ace
phase: 2 (falsification)
paths:
  prisma/schema.prisma
  prisma/migrations/manual/
  prisma/seed.ts
  src/types/bulletin.ts
  src/actions/bulletins.ts
  src/lib/server/bulletinRepository.ts
  src/lib/server/fallbackState.ts
  src/lib/client/bulletinStore.ts            (delete)
  src/components/features/bulletins/         (rewrite; AdminBulletinModal delete)
  src/components/admin/BulletinDataTable.tsx
  src/components/admin/BulletinFormDialog.tsx
  src/app/admin/bulletins/page.tsx
  src/app/admin/layout.tsx
  src/app/page.tsx  src/app/pets/page.tsx  src/app/bulletins/page.tsx
  src/data/bulletins.json
  docs/architecture/LAYERS.md
  scripts/migrate-bulletins.ts
  tests/unit/bulletins.test.ts

## Decision taken before building

P-D for `Bulletin` answered by the owner on 2026-09-22: **option (a)** — a real Prisma model,
writes only through a `MANAGE_CONTENT`-guarded server action, and a staff editor under `/admin`.
Options (b) "take the feed off the public pages" and (c) "server-render the fixture read-only"
were offered with costed diffs and declined.

## Kill conditions — registered before the spike, immutable

**K1.** If `embedded-postgres` cannot boot a Postgres on `localhost:5432` on this machine, or
`npm run db:push:local` cannot apply a schema against it, then the migration SQL cannot be
rehearsed. The design does not die, but the deliverable changes: the owner receives DDL marked
**ASSERTED, not rehearsed**, and that limitation is stated in the PR body and the handover file,
not buried. No SQL is run against production either way.

**K2.** If `BulletinFeed` still requires client state after the "Staff Admin Access" toggle and
`AdminBulletinModal` are removed, the "delete the client store" half of the design is wrong and
returns to Phase 0. Evaluated by: the component compiles and renders with no `"use client"`
directive and no React hook import.

**K3.** If the public read path cannot distinguish "staff unpublished everything" from "the
database is unreachable", the repository is wrong. Evaluated by: a test that returns `[]` from a
successful query and asserts the fixture is **not** substituted, mirroring
`tests/integration/faqEmptyPublishSet.test.ts`.

**K4.** If an anonymous caller can reach any bulletin mutation, the change has not settled #76.
Evaluated by: a denial test per `tests/unit/transparency.test.ts:1080-1131` asserting
`{ success: false, error: /sign in|Authentication/ }` with no session, and `/not authorized/` for
STAFF, VOLUNTEER and COORDINATOR.

**K5.** If a `CONTENT_EDITOR` can store a `videoEmbedUrl` or `mediaUrl` on an arbitrary host, F5
and F6 are not closed. Evaluated by: a write-time rejection test **and** a render-time test
proving a row that bypassed the action (a seeded row, a direct SQL insert) still cannot emit a
non-allowlisted iframe.

## Settles

`tasks/open/bulletins-are-a-per-browser-demo-anyone-can-edit.md` (issue #76), by its own clause.
