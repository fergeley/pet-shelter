# Architecture & Engineering Task Roadmap: Non-Brittle Backend Hardening

This document outlines the actionable, prioritized task list to harden the web application architecture against common failure modes (concurrency race conditions, XSS token theft, unauthorized state transitions, dual-write failures, brute-force attacks) using zero-bloat, Free and Open Source (FOSS) tooling.

---

## 📋 Task Checklist Overview

- [x] **Phase 1: Security & Identity Layer (AuthN, AuthZ, RBAC, Sessions)**
- [x] **Phase 2: Data Integrity & Concurrency (Transactions, Locking, Idempotency)**
- [x] **Phase 3: Domain Rules & Finite State Machine (FSM)**
- [x] **Phase 4: Traffic Control & Defense (Rate Limiting & Input Validation)**
- [x] **Phase 5: Traceability & Resilience (Audit Logging & Async Background Jobs)**

---

## Phase 1: Security & Identity Layer

### Task 1.1: Cryptographic Primitives & Timing-Safe Helpers
- [x] **File**: `src/lib/security/crypto.ts`
- [x] **Objective**: Implement secure hashing, timing-safe equality checks, and symmetric field encryption using Node.js standard `node:crypto`.
- [x] **Specs**:
  - `hashPassword(password: string): Promise<string>` using `scrypt`.
  - `verifyPassword(password: string, hash: string): Promise<boolean>` using `crypto.timingSafeEqual` to prevent timing attacks.
  - `encryptField(text: string): string` and `decryptField(encrypted: string): string` using AES-256-GCM.
  - `signPayload(payload: string): string` and `verifySignature(...)` using HMAC-SHA256.
- [x] **Acceptance Criteria**:
  - Zero third-party crypto bloat.
  - Constant-time string comparisons to eliminate timing vulnerability.

### Task 1.2: Signed HTTP-Only Session Engine
- [x] **File**: `src/lib/security/session.ts`
- [x] **Objective**: Replace client-side `localStorage` authentication with signed, tamper-proof HTTP-Only cookies.
- [x] **Specs**:
  - HMAC-SHA256 signature utility for session payload (`userId`, `role`, `email`, `expiresAt`).
  - `sealSession(user: SessionUser): string`
  - `unsealSession(cookieValue: string): SessionUser | null`
  - `getCurrentSession()` helper for Server Components and Server Actions.
  - Cookie flags: `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`.
- [x] **Acceptance Criteria**:
  - Immunity to JavaScript XSS token theft (`document.cookie` cannot read session).
  - Session verified server-side on every request without requiring an external token store.

### Task 1.3: Role-Based Access Control (RBAC) Guard
- [x] **File**: `src/lib/security/rbac.ts`
- [x] **Objective**: Implement declarative, strongly-typed permission boundaries.
- [x] **Specs**:
  - Define roles: `ADMIN`, `COORDINATOR`, `STAFF`, `VOLUNTEER`.
  - Permission helper: `assertAuthorized(session: SessionUser | null, allowedRoles: Role[])`.
  - Custom typed domain errors: `UnauthorizedError` (401), `ForbiddenError` (403).
- [x] **Acceptance Criteria**:
  - Every administrative Server Action enforces `assertAuthorized` before performing any mutations.

---

## Phase 2: Data Integrity & Concurrency

### Task 2.1: Atomic Multi-Entity Database Transactions
- [x] **File**: `src/lib/serverStore.ts`, `src/actions/applications.ts`
- [x] **Objective**: Eliminate partial state corruption by wrapping multi-step workflows in atomic transactions.
- [x] **Specs**:
  - When an adoption application is approved:
    1. Verify current application is in valid status (`UNDER_REVIEW`).
    2. Atomically update application status to `APPROVED`.
    3. Atomically update pet status from `Available` or `Pending` to `Adopted`.
    4. Automatically mark conflicting applications for the same pet as `REJECTED` with auto-closing note.
    5. Write immutable audit log record.
  - If any step fails, roll back entire operation.
- [x] **Acceptance Criteria**:
  - Zero possibility of a pet being marked `Adopted` without an approved application, or vice versa.

### Task 2.2: Optimistic Concurrency & Race Condition Prevention
- [x] **File**: `src/lib/serverStore.ts`
- [x] **Objective**: Prevent "double-booking" when multiple users attempt to adopt the same animal simultaneously.
- [x] **Specs**:
  - State guards on status mutation preventing concurrent conflicting assignments.
- [x] **Acceptance Criteria**:
  - Handles concurrent adoption requests cleanly without double assignments.

### Task 2.3: Idempotency Key Guard
- [x] **File**: `src/lib/security/idempotency.ts`
- [x] **Objective**: Prevent duplicate submissions caused by double-clicks, network timeouts, or client retries.
- [x] **Specs**:
  - Accept optional `Idempotency-Key` header or payload UUID on public form submissions.
  - In-memory / cache key check with a 10-minute TTL.
  - If the key exists, return the cached result instead of executing duplicate database writes.
- [x] **Acceptance Criteria**:
  - Submitting the same form multiple times within TTL window creates exactly 1 record.

---

## Phase 3: Domain Rules & Finite State Machine (FSM)

### Task 3.1: Explicit Adoption Application & Pet FSM
- [x] **File**: `src/lib/domain/stateMachine.ts`
- [x] **Objective**: Disallow illegal status jumps (e.g., jumping from `REJECTED` straight to `APPROVED`).
- [x] **Specs**:
  - Defined state transition maps:
    - Application: `SUBMITTED` ➔ `UNDER_REVIEW`, `REJECTED` | `UNDER_REVIEW` ➔ `APPROVED`, `REJECTED`, `SUBMITTED` | `APPROVED` ➔ `UNDER_REVIEW` | `REJECTED` ➔ `UNDER_REVIEW`
    - Pet: `Available` ➔ `Pending`, `Adopted` | `Pending` ➔ `Available`, `Adopted` | `Adopted` ➔ `Available`
  - `validateApplicationTransition(current, next)` and `validatePetTransition(current, next)`
- [x] **Acceptance Criteria**:
  - Status updates reject illegal transitions with explicit `DomainValidationError`.

---

## Phase 4: Traffic Control & Defense

### Task 4.1: In-Memory Sliding Window Rate Limiter
- [x] **File**: `src/lib/security/rateLimit.ts`
- [x] **Objective**: Mitigate brute-force password guessing and spam submissions with zero external infrastructure.
- [x] **Specs**:
  - Sliding log rate limiter using Node.js timestamps with auto-pruning.
  - Auth policy: max 5 attempts per 60 seconds per email/key.
  - Public submission policy: max 10 submissions per 10 minutes per email.
- [x] **Acceptance Criteria**:
  - Consecutive login failure triggers rate limit response with `retryAfterSeconds`.

### Task 4.2: Strict Input Validation & Boundary Sanitization
- [x] **File**: `src/lib/validations/`
- [x] **Objective**: Ensure all server endpoints strictly parse inputs with Zod.
- [x] **Acceptance Criteria**:
  - Zero unvalidated data reaches domain services.

---

## Phase 5: Traceability & Resilience

### Task 5.1: Immutable Audit Trail & Inspector UI
- [x] **File**: `src/lib/domain/auditLog.ts`, `src/actions/audit.ts`, `src/app/admin/audit/page.tsx`, `src/components/admin/AuditLogViewer.tsx`
- [x] **Objective**: Record all sensitive staff operations with timestamp, actor identity, action type, and before/after state diff.
- [x] **Specs**:
  - `recordAuditLog(entry: Omit<AuditEntry, "id" | "createdAt">): AuditEntry`
  - `fetchAuditLogsAction()` server action guarded by RBAC.
  - Live inspection UI at `/admin/audit` with search and live refresh.
- [x] **Acceptance Criteria**:
  - Every status change, pet deletion, shelter settings update, and login attempt generates an immutable audit record visible in the Admin Audit Portal.

---

## 🛠️ Technology & FOSS Tooling Summary

| Layer | Selected Solution | Rationale / Non-Brittle Advantage | Status |
|---|---|---|---|
| **Auth** | Signed HTTP-Only Cookies (`node:crypto`) | No XSS risk; no external token server needed | ✅ Implemented |
| **RBAC** | Strongly Typed Enum Matrix + Server Action Guard | Direct, compile-time type-safety | ✅ Implemented |
| **Transactions** | Unified Server State / Atomic Multi-Entity Cascade | Atomicity across multi-entity updates | ✅ Implemented |
| **Concurrency** | State Machine Guard + Optimistic Validation | Zero race conditions without distributed locks | ✅ Implemented |
| **Rate Limiter** | Sliding Window Map with Auto-Sweep | Zero Redis dependency for single-instance scale | ✅ Implemented |
| **Idempotency** | In-Memory Key Check with TTL | Prevents double-clicks and duplicate records | ✅ Implemented |
| **Validation** | Zod Schemas | Runtime type safety & strict sanitization | ✅ Implemented |
| **Audit Log** | Append-only Audit Table + `/admin/audit` UI | Complete traceability of administrative actions | ✅ Implemented |
