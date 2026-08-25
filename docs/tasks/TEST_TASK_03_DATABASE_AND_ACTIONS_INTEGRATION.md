# Task 03: Strict Database & Server Actions Integration Suite

**Date**: 2026-08-26  
**Status**: Ready for Dispatch  
**Domain**: Backend Integration, Server Actions & Data Integrity  
**Dependencies**: Task 01 (`STRICT_PERSISTENCE` toggle & `tests/setup/nextMocks.ts`)  
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

### A. Environment Configuration
All integration tests must run with:
```ts
process.env.STRICT_PERSISTENCE = "true";
```
This forces all database operations in `src/lib/serverStore.ts` to execute without falling back to in-memory JSON data.

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

1. [ ] All integration tests run with `process.env.STRICT_PERSISTENCE = "true"`.
2. [ ] Zero database exceptions are swallowed; any Prisma query error fails the test suite.
3. [ ] All 4 integration test files pass via `npm run test:integration`.
4. [ ] `npx tsc --noEmit` is clean outside `scratch/`.

---

## 🤖 4. Autonomous Agent Execution Prompt

```text
You are a senior Backend Test Engineer specializing in Prisma, PostgreSQL, and Next.js Server Actions. Execute Task 03 for the Hope for Strays pet shelter platform according to docs/tasks/TEST_TASK_03_DATABASE_AND_ACTIONS_INTEGRATION.md.

Step 1: Create `tests/integration/petActions.test.ts` verifying CRUD, Zod validation, rehab fields, and soft-delete filtering under STRICT_PERSISTENCE=true.
Step 2: Create `tests/integration/applicationActions.test.ts` verifying adoption submission, reference ID generation, and public tracking lookup.
Step 3: Create `tests/integration/atomicTransitions.test.ts` verifying atomic multi-entity application approval, pet status synchronization, and immutable audit logs.
Step 4: Create `tests/integration/authActions.test.ts` verifying scrypt authentication, session cookies, RBAC enforcement, and rate limiting.
Step 5: Run `npm run test:integration` and `npx tsc --noEmit` to verify all tests pass with zero TypeScript errors.
```
