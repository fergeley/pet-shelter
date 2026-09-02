# Task 01: Test Infrastructure, Global Mocks, Hermetic Reset & Strict DB Harness

**Date**: 2026-08-26 (Revised & Deepened)  
**Status**: ✅ Implemented — see §5 for corrections applied during execution  
**Domain**: Backend Infrastructure, Data Integrity & Quality Engineering  
**Dependencies**: None (Foundational Workstream)  
**Target Files**:
- `src/lib/serverStore.ts` (Implement `STRICT_PERSISTENCE` & export `resetServerStore()`)
- `src/lib/userStore.ts` (Implement `STRICT_PERSISTENCE` on user mutations/queries)
- `src/lib/domain/auditLog.ts` (Implement `STRICT_PERSISTENCE` & export `resetAuditLogs()`)
- `src/lib/security/rateLimit.ts` (Export `resetRateLimitStore()`)
- `src/lib/security/idempotency.ts` (Export `resetIdempotencyStore()`)
- `src/lib/prisma.ts` (Prisma connection teardown and fast-fail in unit tests)
- `tests/setup/nextMocks.ts` (New centralized Next.js 16 mock harness & test lifecycle resets)
- `vitest.config.mts` (Update test environments & `environmentMatchGlobs`)
- `package.json` (Add cross-platform partitioned test scripts)

---

## 🎯 1. Objective

Establish an enterprise-grade testing foundation for the 5-tier testing pyramid:
1. **Strict Persistence across the L-B2 Repository Trio** ([`serverStore.ts`](../../src/lib/serverStore.ts), [`userStore.ts`](../../src/lib/userStore.ts), [`auditLog.ts`](../../src/lib/domain/auditLog.ts)) so database query and schema mismatches fail loudly during integration tests instead of being masked by in-memory fallbacks.
2. **Hermetic State Isolation**: Eliminate cross-test state pollution by wiring deterministic reset functions for all module-level caches (`serverStore`, `userStore`, `auditLog`, `rateLimit`, `idempotency`) into automatic test setup.
3. **Overload-Aware Next.js 16 App Router Mocks**: Provide a centralized, type-safe mock suite for async `cookies()`, `headers()`, `revalidatePath()`, `revalidateTag()`, and `redirect()`.
4. **Prisma Pool Teardown & Fast-Timeout**: Prevent Vitest worker thread hangs by providing teardown hooks and preventing 10-second pool connection hangs when running offline unit tests.
5. **Architectural Guard Compliance**: Ensure all additions strictly preserve layer boundaries enforced by [`tests/unit/layerBoundaries.test.ts`](../../tests/unit/layerBoundaries.test.ts) (Prisma imports strictly confined to the 3 repository files).

---

## 🔍 2. Detailed Technical Specification & Findings

```
                              ┌────────────────────────────────────────────────────────┐
                              │            L-B2 Repository Trio (3 files)              │
                              │  serverStore.ts  │  userStore.ts  │  auditLog.ts       │
                              └─────────┬────────────────┬─────────────────┬───────────┘
                                        │                │                 │
                                        ▼                ▼                 ▼
                              ┌────────────────────────────────────────────────────────┐
                              │         Prisma Client (PostgreSQL / Neon)             │
                              └────────────────────────────────────────────────────────┘
                                        │
                          Error caught during Query / Mutation?
                                        │
                           ┌────────────┴────────────┐
                           ▼                         ▼
               STRICT_PERSISTENCE=true    STRICT_PERSISTENCE=false (Dev/Unit fallback)
               💥 THROW IMMEDIATELY        ⚠️ Log warning & use in-memory JSON cache
```

### A. Strict Persistence across the Entire Repository Trio
Per `docs/architecture/LAYERS.md`, three files constitute the repository layer. All three must respect `STRICT_PERSISTENCE`:
1. **`src/lib/serverStore.ts`**: All 9 query and mutation catch blocks (`getServerPetsAsync`, `getServerApplicationsAsync`, `insertServerPet`, `updateServerPet`, `archiveServerPet`, `insertServerApplication`, `atomicUpdateApplicationStatus`, `deleteServerApplication`).
2. **`src/lib/userStore.ts`**: All 4 catch blocks (`findUserByEmail`, `findUserById`, `listUsers`, `createUser`).
3. **`src/lib/domain/auditLog.ts`**: Both asynchronous audit logging catch handlers.

**Pattern to Apply**:
```ts
function handlePersistenceError(context: string, err: unknown): void {
  if (process.env.STRICT_PERSISTENCE === "true") {
    throw err;
  }
  if (process.env.NODE_ENV === "development") {
    console.warn(`[Database Store] ${context} fallback notice:`, err instanceof Error ? err.message : err);
  }
}
```

---

### B. Hermetic Test State Isolation (Module Cache Resets)
Currently, in-memory arrays and Maps mutate during test execution, causing test order dependencies.
Expose and wire the following reset hooks:
- `resetServerStore()` in `src/lib/serverStore.ts`: Resets `serverPets` and `serverApplications` back to fresh copies of initial JSON fixtures.
- `resetAuditLogs()` in `src/lib/domain/auditLog.ts`: Clears `auditLogsStore`.
- `resetRateLimitStore()` in `src/lib/security/rateLimit.ts`: Clears `rateLimitStore`.
- `resetIdempotencyStore()` in `src/lib/security/idempotency.ts`: Clears `idempotencyStore`.
- Combine with existing `resetUserStore()` in `src/lib/userStore.ts`.

---

### C. Global Next.js 16 Mock Harness (`tests/setup/nextMocks.ts`)
Create a standardized mock loaded by Vitest before every test file:

1. **`next/headers`**:
   - `cookies()`: Async function returning an object supporting both signatures:
     - `set(name, value, options?)` and `set({ name, value, ...options })`
     - `delete(name)` and `delete({ name, ...options })`
     - `get(name)` -> `{ name, value } | undefined`
     - `getAll(name?)` -> `Array<{ name, value }>`
     - `has(name)` -> `boolean`
   - `headers()`: Async function returning `Headers` instance.

2. **`next/cache`**:
   - `revalidatePath(path: string, type?: "page" | "layout")` (spies on path calls and records them).
   - `revalidateTag(tag: string)` (spies on tag calls).

3. **`next/navigation`**:
   - `redirect(url: string)`: Records redirect target and throws `NEXT_REDIRECT` error simulation.
   - `notFound()`: Throws `NEXT_NOT_FOUND` error simulation.
   - `useRouter()`, `usePathname()`, `useSearchParams()`.

4. **Lifecycle Hooks**:
   - `beforeEach()` automatically executes:
     - `resetNextMocks()`
     - `resetServerStore()`
     - `resetUserStore()`
     - `resetAuditLogs()`
     - `resetRateLimitStore()`
     - `resetIdempotencyStore()`

---

### D. Prisma Pool Teardown & Test Environment Handling
In `src/lib/prisma.ts`:
- Export `disconnectPrisma()` or handle `afterAll(async () => { await prisma.$disconnect(); })` in integration setup so connections do not hang Vitest processes.
- Ensure test connection timeout is snappy when running offline.

---

### E. Vitest Configuration & Partitioned Scripts
1. **`vitest.config.mts`**:
   ```ts
   import { defineConfig } from "vitest/config";
   import { fileURLToPath } from "node:url";

   export default defineConfig({
     test: {
       globals: true,
       environment: "node",
       setupFiles: ["./tests/setup/nextMocks.ts"],
       include: ["tests/**/*.test.{ts,tsx}"],
       environmentMatchGlobs: [
         ["tests/components/**", "jsdom"],
         ["tests/**", "node"],
       ],
     },
     resolve: {
       alias: {
         "@": fileURLToPath(new URL("./src", import.meta.url)),
       },
     },
   });
   ```

2. **`package.json`**:
   ```json
   "scripts": {
     "test": "vitest run tests/unit",
     "test:watch": "vitest",
     "test:unit": "vitest run tests/unit",
     "test:components": "vitest run tests/components",
     "test:integration": "cross-env STRICT_PERSISTENCE=true vitest run tests/integration",
     "test:all": "vitest run",
     "test:coverage": "vitest run --coverage"
   }
   ```

---

## 🚦 3. Acceptance Criteria & Verification

1. [ ] `npm test` runs all existing unit tests in < 3 seconds with zero state bleed.
2. [ ] Layer boundary rules ([`layerBoundaries.test.ts`](../../tests/unit/layerBoundaries.test.ts)) remain 100% passing (Prisma imports strictly confined to the 3 repository files; no `"use client"` reaching server modules).
3. [ ] A verification suite `tests/unit/setupMocks.test.ts` passes, asserting:
   - `cookies()` handles both multi-arg and object-arg overloads.
   - `revalidatePath()` records invalidation calls.
   - State reset functions (`resetServerStore`, `resetAuditLogs`, etc.) return isolated state between tests.
   - `STRICT_PERSISTENCE=true` throws on database failures across `serverStore`, `userStore`, and `auditLog`.
4. [ ] `npx tsc --noEmit` is clean outside `scratch/`.

---

## 🤖 4. Autonomous Agent Execution Prompt

```text
You are an expert Next.js, Prisma, and test infrastructure engineer. Execute Task 01 for the Hope for Strays pet shelter platform according to docs/tasks/TEST_TASK_01_INFRASTRUCTURE_AND_MOCKS.md.

Step 1: Install `cross-env` as devDependency.
Step 2: Update `src/lib/serverStore.ts`, `src/lib/userStore.ts`, and `src/lib/domain/auditLog.ts` to respect `STRICT_PERSISTENCE === "true"` on all Prisma operations.
Step 3: Export reset hooks: `resetServerStore()` in serverStore.ts, `resetAuditLogs()` in auditLog.ts, `resetRateLimitStore()` in rateLimit.ts, and `resetIdempotencyStore()` in idempotency.ts.
Step 4: Create `tests/setup/nextMocks.ts` providing overload-aware mocks for next/headers, next/navigation, and next/cache, with automatic beforeEach hermetic state reset.
Step 5: Update `vitest.config.mts` to register `tests/setup/nextMocks.ts` and configure `environmentMatchGlobs`.
Step 6: Update `package.json` with partitioned test scripts (test, test:unit, test:components, test:integration, test:all).
Step 7: Create `tests/unit/setupMocks.test.ts` verifying mocks, reset hermeticity, and strict persistence propagation.
Step 8: Run `npm test`, `npx tsc --noEmit`, and `npm test tests/unit/layerBoundaries.test.ts` to verify 100% green tests, clean types, and architectural compliance.
```

---

## ✅ 5. Execution Record & Corrections to This Spec

Implemented 2026-08-26. `npm test` 357 passed / 30 files · `npx tsc --noEmit` clean ·
`npm run lint` 0 errors · `layerBoundaries.test.ts` 3/3 green (Prisma still confined to the trio).

Five points in §2 above were wrong or incomplete and were **not** implemented literally:

| § | Spec said | Why it fails | Implemented instead |
|---|---|---|---|
| E.1 | `environmentMatchGlobs` in `vitest.config.mts` | Deprecated in Vitest 3, **removed in Vitest 4** (repo runs 4.1.10) — silently ignored, not reported | `test.projects` with three lanes: `unit`, `integration`, `components` |
| A.1 | serverStore has "all 9 catch blocks" | 9 exist, but the one in `atomicUpdateApplicationStatus` catches `validateApplicationTransition` — a **domain** error whose contract is `{ success: false, error }`. Throwing there breaks the caller | **8** persistence handlers; the FSM catch left alone |
| A.3 | auditLog: "both async catch handlers throw" | `recordAuditLog` is **synchronous** and fires a floating promise. Throwing inside its `.catch()` is an unhandled rejection → Vitest worker teardown, not a test failure | Error recorded; `flushAuditLogWrites()` is the assertion point. `getAuditLogsAsync` throws directly |
| A.2 | userStore `createUser` strict throw | Naive placement still runs `usersStore.set(...)`, leaving a phantom user from a failed write | Handler placed **before** the in-memory mutation |
| A (pattern) | One `handlePersistenceError` warning in development only | Would silence **production write-failure** warnings, which the write paths emit unconditionally today. §2 also required preserving non-strict behaviour | `kind: "read" \| "write"` — reads warn in dev, writes warn always |

Additions beyond the spec:

- **`resetServerStore()` seeds via `structuredClone`**, not the previous shallow `[...spread]`. The
  spread shared element identity with the imported JSON module, so one in-place edit corrupted the
  fixture process-wide and no reset could recover it. `setupMocks.test.ts` asserts this specifically,
  and the assertion has been mutation-tested against the old implementation.
- **`STRICT_PERSISTENCE` is declared on the `integration` project**, not only via `cross-env` in the
  npm script. Otherwise `npm run test:all` runs Tier 3 against the forgiving fallback and reports
  green — the exact failure this tier exists to catch. `tests/integration/strictHarness.test.ts`
  guards that the flag actually reaches the worker.
- **`passWithNoTests: true`** at root and per-project, so `test:components` / `test:integration`
  exit 0 before Tasks 02–03 land instead of red-lighting CI for unwritten work.
- **The `beforeEach` imports the stores dynamically.** A static import in the setup file instantiates
  `serverStore` → real `@/lib/prisma` before a test file's `vi.mock("@/lib/prisma")` registers; three
  `petHistory.test.ts` specs failed exactly this way before the fix.
- **Seed password hashes memoized** in `userStore`. `resetUserStore()` runs before all 357 tests and
  re-derived four scrypt hashes each time — a 6.7s → 17.7s regression. Now ~4.5s, faster than baseline.
- **`disconnectPrisma()`** exported (spec §D, dropped from the §4 step list) plus a 2s connect timeout
  under `NODE_ENV=test`.
- `jsdom` installed alongside `cross-env`, so the `components` lane is real config rather than aspirational.

### ⚠️ Task 03 will need to load `.env.local` itself

Verified 2026-08-26: **Vitest does not populate `process.env.DATABASE_URL` from `.env.local`.**
That is a Next.js behaviour, not a Vite one — Vite only exposes `VITE_`-prefixed vars, and only on
`import.meta.env`. A probe test in the `unit` project reports `DATABASE_URL set: false` even with a
populated `.env.local` on disk.

Consequences:
- The unit tier is genuinely hermetic and offline. `prisma.ts` falls back to its hardcoded
  `localhost:5432` string, the connection is refused instantly, and every read serves fixtures.
  A live Neon instance does **not** change unit results.
- Tier 3 cannot reach a real database until Task 03 wires the env in — e.g. `dotenv/config` as an
  extra `setupFiles` entry on the `integration` project, or an explicit `test.env` block. Until
  then a "strict persistence" integration test would be asserting against a refused localhost
  connection, which throws for the wrong reason and proves nothing about the real schema.
- Once that env IS wired, note the `prisma.ts` connect timeout: it drops to 2s **only** when
  `NODE_ENV=test` *and* `DATABASE_URL` is unset. With a real URL configured it stays at the
  production 10s, so a Neon cold start is not mistaken for an outage.

### Notes for Tasks 02 and 03
- Do **not** add `environmentMatchGlobs`. Add files under `tests/components/` and they get jsdom
  automatically; the lane already exists.
- Tier 3 specs get `STRICT_PERSISTENCE=true` from the project config — no per-file env setup needed.
- Five suites (`auth`, `applicationTracking`, `petHistory`, `rehabilitation`, `settings`,
  `softDeleteAndAuth`) declare their own `next/*` mocks, which override the harness for those files.
  Migrating them onto `tests/setup/nextMocks.ts` is optional cleanup, deliberately left out of scope
  here to avoid churning six green suites.
