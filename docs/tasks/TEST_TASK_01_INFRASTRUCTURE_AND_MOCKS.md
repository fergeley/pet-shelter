# Task 01: Test Infrastructure, Global Mocks & Strict DB Harness

**Date**: 2026-08-26  
**Status**: Ready for Dispatch  
**Domain**: Backend Infrastructure & Quality Engineering  
**Dependencies**: None (Foundational Workstream)  
**Target Files**:
- `src/lib/serverStore.ts` (Modify error handlers to respect `STRICT_PERSISTENCE`)
- `tests/setup/nextMocks.ts` (New centralized Next.js 16 mock harness)
- `vitest.config.mts` (Update test projects/environments)
- `package.json` (Add partitioned test scripts)

---

## 🎯 1. Objective

Establish the infrastructure foundations for the 5-tier test architecture:
1. Stop `serverStore.ts` from masking database query and schema errors during integration tests.
2. Provide a single, centralized mock harness for Next.js 16 Server Component & Server Action utilities (`next/headers`, `next/navigation`, `next/cache`).
3. Partition test runs in `package.json` (`test:unit`, `test:components`, `test:integration`, `test:all`).

---

## 🔍 2. Detailed Technical Specification

### A. Strict Persistence Mode (`src/lib/serverStore.ts`)
Currently, `serverStore.ts` wraps Prisma queries in `try/catch` blocks and logs fallback warnings:
```ts
try {
  await prisma.pet.create({ ... });
} catch (error) {
  if (process.env.NODE_ENV === "development") {
    console.warn("[Database Store] Prisma pet creation fallback notice:", error);
  }
}
```
**Change**: When `process.env.STRICT_PERSISTENCE === "true"`, the catch block MUST rethrow the error immediately instead of swallowing it. This ensures integration tests fail loudly when Prisma queries fail or when schema mismatches occur.

### B. Global Next.js Mock Harness (`tests/setup/nextMocks.ts`)
Create a reusable mock suite providing:
- **`next/headers`**:
  - `cookies()` returning a mock cookie jar with `.get(name)`, `.set(name, value, options)`, `.delete(name)`, `.has(name)`, `.getAll()`.
  - `headers()` returning a `Headers` instance with authorization and IP headers.
- **`next/navigation`**:
  - `useRouter()`, `usePathname()`, `useSearchParams()`, `redirect(url)`, `notFound()`.
- **`next/cache`**:
  - `revalidatePath(path)`, `revalidateTag(tag)`.
- Export helper utilities:
  - `resetNextMocks()`: clears cookies, headers, and revalidation call records between tests.
  - `getMockCookie(name)`: easily inspect cookies in assertions.

### C. Vitest Configuration (`vitest.config.mts`)
- Setup path aliases `@/` pointing to `./src`.
- Setup global test setup files pointing to `tests/setup/nextMocks.ts`.
- Ensure environment defaults to `node` for unit & integration tests.

### D. Package Scripts (`package.json`)
```json
"scripts": {
  "test": "vitest run tests/unit",
  "test:unit": "vitest run tests/unit",
  "test:components": "vitest run tests/components",
  "test:integration": "cross-env STRICT_PERSISTENCE=true vitest run tests/integration",
  "test:all": "vitest run",
  "test:coverage": "vitest run --coverage"
}
```
*(Install `cross-env` as dev dependency for cross-platform support).*

---

## 🚦 3. Acceptance Criteria & Verification

1. [ ] `npm test` runs all unit tests in `tests/unit/` cleanly.
2. [ ] A verification test `tests/unit/setupMocks.test.ts` passes, asserting that:
   - `cookies().set(...)` updates the mock store.
   - `revalidatePath(...)` records calls correctly.
   - `serverStore.ts` with `STRICT_PERSISTENCE=true` throws on invalid Prisma invocations.
3. [ ] `npx tsc --noEmit` is clean outside `scratch/`.

---

## 🤖 4. Autonomous Agent Execution Prompt

```text
You are an expert Next.js and test infrastructure engineer. Execute Task 01 for the Hope for Strays pet shelter platform according to docs/tasks/TEST_TASK_01_INFRASTRUCTURE_AND_MOCKS.md.

Step 1: Install `cross-env` as devDependency if not present.
Step 2: Update `src/lib/serverStore.ts` catch blocks to check `if (process.env.STRICT_PERSISTENCE === "true") throw error;`.
Step 3: Create `tests/setup/nextMocks.ts` providing standard reset-able mocks for next/headers, next/navigation, and next/cache.
Step 4: Update `vitest.config.mts` to automatically load `tests/setup/nextMocks.ts`.
Step 5: Update `package.json` with scripts: test, test:unit, test:components, test:integration, test:all.
Step 6: Create `tests/unit/setupMocks.test.ts` to verify the mocks and STRICT_PERSISTENCE behavior.
Step 7: Run `npm test` and `npx tsc --noEmit` to verify all tests pass and types are clean.
```
