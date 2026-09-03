# Deleting an adoption application from the admin table does not remove the row

**Status:** resolved · resolved 2026-09-04 · measured and verified

`e2e/specs/04_admin_application_review.spec.ts:93` — "clears applications left behind by the
public adoption spec" — clicks the archive/delete control, confirms "Yes, remove record", and
asserts the row count drops. It failed previously with `Expected: 0, Received: 1`.

## Resolution: Two Interlocking Defects

The failure was traced to two interlocking issues across the server and client layers:

1. **Server Layer (`src/lib/server/applicationRepository.ts`)**:
   - `insertServerApplication` inserted dynamically created applications (such as those submitted
     by public E2E journeys) into Prisma, but neglected to update the in-memory `serverApplications`
     store.
   - `deleteServerApplication` looked up records strictly through `serverApplications.findIndex`.
     When an application was created in Postgres, it did not exist in `serverApplications`, causing
     `deleteServerApplication` to return `false` immediately without executing `prisma.adoptionApplication.delete`.
   - Repaired by: (a) keeping `serverApplications` synchronized unconditionally in `insertServerApplication`
     and `getServerApplicationsAsync`, and (b) checking Prisma directly in `deleteServerApplication` and
     `atomicUpdateApplicationStatus` if a record is not found in memory.

2. **Client Presentation Layer (`src/hooks/useApplicationTableController.ts`)**:
   - The admin application page passes `initialApplications` into `ApplicationDataTable`.
   - In `useApplicationTableController`, `applications` was computed as `initialApplications || storeApplications`.
   - Calling `deleteApplication(id)` only deleted from the client localStorage store; `initialApplications`
     remained static, so the row was never removed from the visible DOM without an optimistic state array.
   - Repaired by adding `localApplications` optimistic state with rollback on server failure, matching
     the established pattern in `usePetTableController.ts`.

3. **Adjacent Hydration & SSR Defects**:
   - `LanguageProvider.tsx`: `useState` initializer read `localStorage` during initial hydration render,
     causing a mismatch between SSR English and client Malay. Fixed with React 19-safe `useSyncExternalStore`.
   - `layout.tsx`: `<Script strategy="beforeInteractive">` with inline script in `<body>` triggered
     React 19 script warning. Moved to native `<script id="theme-init">` inside `<head>`.
   - `Navbar.tsx`: Added `style={{ width: "auto", height: "auto" }}` to shelter logo `<Image>` tags.
