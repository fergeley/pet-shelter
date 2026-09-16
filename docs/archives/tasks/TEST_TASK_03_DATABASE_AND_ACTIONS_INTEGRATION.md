# Task 03: Strict Database & Server Actions Integration Suite

**Date**: 2026-08-26  
**Status**: Ready for Dispatch  
**Domain**: Backend Integration, Server Actions & Data Integrity  
**Dependencies**: Task 01 — landed. §2.A is a hard prerequisite; read it before writing a test.  
**Target Files**:
- `tests/integration/petActions.test.ts` (Pet mutations, soft-delete, rehab persistence)
- `tests/integration/applicationActions.test.ts` (Application submission & public tracking)
- `tests/integration/atomicTransitions.test.ts` (Atomic multi-entity FSM status progression & audit logs)
- `tests/integration/authActions.test.ts` (RBAC authorization, session signing, rate limiting)

---

## 🎯 1. Objective

Build an integration test suite targeting the application's entire public Server Action surface under `STRICT_PERSISTENCE=true`. Ensure that database schema contracts, multi-entity transactions, soft-deletes, RBAC enforcement, and audit logs are rigorously verified without masking exceptions.

---

## 🔍 2. Detailed Technical Specification

### A. Environment Configuration — READ FIRST

**`STRICT_PERSISTENCE` is already set for you.** It is declared on the `integration` project in
`vitest.config.mts` (`env: { STRICT_PERSISTENCE: "true" }`), so it applies to
`tests/integration/**` however the suite is launched — `npm run test:integration`, `npm run
test:all`, a bare `vitest` watch, or an IDE run. `tests/integration/strictHarness.test.ts` guards
that it actually reaches the worker.

Do **not** write `process.env.STRICT_PERSISTENCE = "true"` in a test or setup file. In a shared
setup file it leaks strict mode into the unit lane and breaks all 357 unit tests; in an individual
test it is redundant.

#### ⚠️ The blocking prerequisite: the integration lane cannot reach a database yet

**Vitest does not populate `process.env` from `.env.local`.** That is a Next.js behaviour, not a
Vite one — Vite only exposes `VITE_`-prefixed variables, and only on `import.meta.env`. Verified:
a probe test in this repo reports `DATABASE_URL set: false` with a fully populated `.env.local` on
disk. `vitest.config.mts` contains no `dotenv`/`loadEnv` call.

So today, `src/lib/prisma.ts` falls back to its hardcoded `localhost:5432` string, the connection
is refused instantly, and **every strict-persistence assertion throws for the wrong reason**. The
test goes green and has proven nothing about the real schema. That is the same failure shape as
the in-memory fallback masking a missing migration: a green signal carrying no information.

**Task 03's first job is to prove the integration lane reaches Neon, explicitly, once** — not to
assume it from a passing run. Suggested order:

1. Wire the env in: add `dotenv/config` to `setupFiles` on the `integration` project (before
   `nextMocks.ts`), or an explicit `test.env` block. `npm run db:push` has already been run
   against the live Neon instance, so the tables and rehab columns exist there.
2. Write a connectivity assertion that fails loudly if the database is absent — query
   `SELECT 1` or count a known table — and let every other integration test depend on that
   passing. Without it, "all green" is indistinguishable from "never connected".
3. Only then write the behavioural suites below.

Note the connect timeout is deliberately environment-sensitive: `prisma.ts` drops to 2s only when
`NODE_ENV=test` **and** `DATABASE_URL` is unset. Once you wire a real URL it returns to the
production 10s, so a Neon cold start is not mistaken for an outage.

#### What Task 01 already gives you

- **Teardown**: `disconnectPrisma()` (exported from `src/lib/prisma.ts`) closes the client and the
  pg pool. Call it from an `afterAll` in the integration setup, or Vitest keeps a worker alive on
  the open handle and the run hangs. It is safe to call twice, and when no connection was made.
- **Fire-and-forget audit writes**: `recordAuditLog` is synchronous and its Prisma write is a
  floating promise, so a failed audit insert does **not** throw at the call site. `await
  flushAuditLogWrites()` before asserting on audit rows, or the assertion races the write.
- **Automatic per-test resets**: the global `beforeEach` in `tests/setup/nextMocks.ts` calls
  `resetServerStore()`, `resetUserStore()`, `resetAuditLogs()`, `resetRateLimitStore()` and
  `resetIdempotencyStore()`. **These reset in-memory state only — they do not touch the
  database.** A test that writes a row must clean it up itself, or the next run inherits it. This
  is the main way Tier 3 differs from Tier 2, and the easiest thing to get wrong.

#### A good first target

`PetUpdate` and `MedicalTimelineEvent` (landed in `f64e216`/`f358a8a`) keep fixture-supplied ids
as primary keys, so a genuine round-trip either preserves `up-009-1` / `tl-001-1` exactly or fails
loudly. `updateServerPet` writes them clear-then-create inside one transaction. That is the
assertion that would actually have caught the missing migration, and it exercises a real table
rather than the mappers a unit test already covers.

### B. Integration Test Suites to Implement

#### 1. `tests/integration/petActions.test.ts`
- **Target Actions**: `createPetAction`, `updatePetAction`, `archivePetAction`, `getPetsAction` (`src/actions/pets.ts`).
- **Test Cases**:
  1. Creating a valid pet persists the record and returns the created pet with generated ID.
  2. Creating a pet with invalid data fails schema validation and returns structured errors without modifying the database.
  3. Setting status to `In Rehabilitation` requires and persists `rehabStage`, `rehabStageMs`, and `rehabProgressPercent`.
  4. Updating status from `In Rehabilitation` back to `Available` automatically clears rehabilitation fields.
  5. Archiving a pet sets `isArchived: true` and `deletedAt`. Public catalog `getPetsAction()` excludes archived pets, while admin queries include them.

#### 2. `tests/integration/applicationActions.test.ts`
- **Target Actions**: `submitApplicationAction`, `trackApplicationAction` (`src/actions/applications.ts`).
- **Test Cases**:
  1. Submitting a valid application generates a unique reference ID (e.g. `APP-2026-XXXX`) and persists the application record.
  2. Submitting an application on an archived pet is rejected with an error.
  3. Public tracking lookup `trackApplicationAction({ referenceId, email })` returns the sanitized record when credentials match.
  4. Tracking lookup with mismatched email or non-existent reference ID returns an error without leaking applicant PII.

#### 3. `tests/integration/atomicTransitions.test.ts`
- **Target Logic**: `atomicUpdateApplicationStatus` in `src/lib/serverStore.ts` & `updateApplicationStatusAction`.
- **Test Cases**:
  1. Valid multi-entity transition: `SUBMITTED → UNDER_REVIEW → APPROVED`.
  2. Transitioning application to `APPROVED` atomically updates the associated pet's status to `Adopted`.
  3. Rejection transition: `UNDER_REVIEW → REJECTED`.
  4. An illegal transition (e.g. `SUBMITTED → APPROVED` directly) throws `DomainValidationError` and leaves the database state untouched.
  5. Every status mutation generates an immutable audit record in the `AuditLog` table containing actor ID, previous status, new status, and timestamp.

#### 4. `tests/integration/authActions.test.ts`
- **Target Actions**: `loginAction`, `registerAction`, `logoutAction`, `getCurrentUserAction` (`src/actions/auth.ts`).
- **Test Cases**:
  1. Login with valid credentials signs and sets the `hope_shelter_session` HTTP-only cookie.
  2. Login with incorrect password is rejected; repeated failures trigger rate limiting.
  3. Staff registration creates user with scrypt hashed password and valid role.
  4. Gated admin actions reject unauthenticated or under-privileged users (e.g., `VOLUNTEER` attempting to archive a pet).

---

## 🚦 3. Acceptance Criteria & Verification

1. [ ] All integration tests run under `STRICT_PERSISTENCE=true` (supplied by the `integration` project, not set in code), **and** against a real database — demonstrated by the suite going red when `DATABASE_URL` is pointed at a nonexistent database.
2. [ ] Zero database exceptions are swallowed; any Prisma query error fails the test suite.
3. [ ] All 4 integration test files pass via `npm run test:integration`.
4. [ ] `npx tsc --noEmit` is clean outside `scratch/`.

---

## 🤖 4. Autonomous Agent Execution Prompt

```text
You are a senior Backend Test Engineer specializing in Prisma, PostgreSQL, and Next.js Server Actions. Execute Task 03 for the Hope for Strays pet shelter platform according to docs/tasks/TEST_TASK_03_DATABASE_AND_ACTIONS_INTEGRATION.md.

Step 0: Read §2.A. STRICT_PERSISTENCE is already set by the `integration` project — do not set it in code. CRITICAL: Vitest does not read .env.local, so DATABASE_URL is absent and every strict-persistence test currently throws against a refused localhost connection, passes, and proves nothing. Before writing any behavioural test, wire the env into the integration project and add an explicit connectivity assertion that fails loudly when the database is absent. Also wire `disconnectPrisma()` into an afterAll, and remember the global beforeEach resets in-memory state only — a test that writes a row must clean it up itself.
Step 1: Create `tests/integration/petActions.test.ts` verifying CRUD, Zod validation, rehab fields, and soft-delete filtering under STRICT_PERSISTENCE=true.
Step 2: Create `tests/integration/applicationActions.test.ts` verifying adoption submission, reference ID generation, and public tracking lookup.
Step 3: Create `tests/integration/atomicTransitions.test.ts` verifying atomic multi-entity application approval, pet status synchronization, and immutable audit logs.
Step 4: Create `tests/integration/authActions.test.ts` verifying scrypt authentication, session cookies, RBAC enforcement, and rate limiting.
Step 5: Run `npm run test:integration` and `npx tsc --noEmit` to verify all tests pass with zero TypeScript errors. Then run `npm run test:all` to confirm the 357 unit tests are undisturbed, and prove the suite is really talking to Neon — point DATABASE_URL at a nonexistent database and confirm the suite goes RED. If it stays green, it was never connected and every result so far is worthless.
```
