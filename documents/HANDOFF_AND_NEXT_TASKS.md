# Engineering Handoff & Next Prompt Tasks

- **Status as of**: 2026-08-15
- **Current Stack**: Next.js 16 (App Router / Turbopack), React 19, TypeScript 5, Tailwind CSS v4, Node.js `node:crypto`, Lucide React, Shadcn/UI.
- **Repository Location**: `c:\Users\User\pet-shelter`

---

## 1. Quick Onboarding Handoff

### Architecture State
- **Authentication**: Signed HTTP-Only session cookies (`hope_shelter_session`) using HMAC-SHA256 in [`src/lib/security/session.ts`](file:///c:/Users/User/pet-shelter/src/lib/security/session.ts).
- **Authorization**: Declarative RBAC (`assertAuthorized`) in [`src/lib/security/rbac.ts`](file:///c:/Users/User/pet-shelter/src/lib/security/rbac.ts).
- **Traffic Defense**: Sliding window rate limiter in [`src/lib/security/rateLimit.ts`](file:///c:/Users/User/pet-shelter/src/lib/security/rateLimit.ts) and idempotency keys in [`src/lib/security/idempotency.ts`](file:///c:/Users/User/pet-shelter/src/lib/security/idempotency.ts).
- **Business Logic**: Finite State Machine (FSM) in [`src/lib/domain/stateMachine.ts`](file:///c:/Users/User/pet-shelter/src/lib/domain/stateMachine.ts).
- **State & Transactions**: Unified server state with atomic adoption cascades and audit trail logging in [`src/lib/serverStore.ts`](file:///c:/Users/User/pet-shelter/src/lib/serverStore.ts).
- **Audit Viewer**: Live inspector at `/admin/audit`.

### Staff Demo Credentials
- Admin: `admin@hopeforstrays.org` / `admin123` (or PIN `1234`)
- Coordinator: `coordinator@hopeforstrays.org` / `coord123`
- Staff: `staff@hopeforstrays.org` / `staff123`

---

## 2. Next Tasks Backlog (Prioritized)

### [TASK-01] PostgreSQL Database Migration & Prisma Client Integration
- **Status**: ✅ COMPLETED (2026-08-15)
- **Implemented**:
  - Prisma 7 configuration with `@prisma/adapter-pg` in [`prisma.config.ts`](file:///c:/Users/User/pet-shelter/prisma.config.ts) and [`src/lib/prisma.ts`](file:///c:/Users/User/pet-shelter/src/lib/prisma.ts).
  - Models for `User` (with `Role` enum), `Pet`, `AdoptionApplication`, `AuditLog`, `ShelterSettings` in [`prisma/schema.prisma`](file:///c:/Users/User/pet-shelter/prisma/schema.prisma).
  - Multi-entity interactive transaction cascade (`prisma.$transaction`) in [`src/lib/serverStore.ts`](file:///c:/Users/User/pet-shelter/src/lib/serverStore.ts).
  - Automated seeding pipeline in [`prisma/seed.ts`](file:///c:/Users/User/pet-shelter/prisma/seed.ts) with `docker-compose.yml` for 1-command startup.
  - Automated integration test suite (`tests/unit/database.test.ts`).

---

### [TASK-02] Automated Test Suite (Unit + Integration + E2E)
- **Priority**: High
- **Goal**: Establish rock-solid automated testing using Vitest for domain logic and Playwright for admin workflows.
- **Key Files**: `vitest.config.ts`, `tests/unit/stateMachine.test.ts`, `tests/unit/crypto.test.ts`, `tests/e2e/auth.spec.ts`.
- **Acceptance Criteria**:
  - Unit tests verify state machine allows legal transitions and throws on illegal transitions.
  - Rate limiting tests confirm 6th request within window returns `429` / `retryAfterSeconds`.
  - Timing-safe password verification tests confirm proper hash comparisons.

---

### [TASK-03] Server-Sent Events (SSE) Live Application Alerts
- **Priority**: Medium
- **Goal**: Add real-time visual alerts for shelter staff when a public user submits a new adoption questionnaire.
- **Key Files**: `src/app/api/admin/sse/route.ts`, `src/components/admin/LiveApplicationNotifier.tsx`.
- **Acceptance Criteria**:
  - Zero third-party cloud WebSocket dependencies (native HTTP SSE route).
  - Submitting an application triggers an immediate desktop notification toast on active coordinator dashboards.

---

## 3. Ready-to-Use Next Prompts for AI Agents

You can copy and paste any of the following prompts directly to initiate the next engineering phase:

### Prompt Option 1: Execute Database Migration (TASK-01)
```markdown
Please implement TASK-01: Connect the unified server store and server actions to a live PostgreSQL database using Prisma ORM.

Requirements:
1. Update prisma/schema.prisma to include models for User (Staff accounts with role enum), AuditLog, Pet, and AdoptionApplication.
2. Create src/lib/prisma.ts for the singleton PrismaClient instance.
3. Migrate src/lib/serverStore.ts and src/actions/ to execute multi-entity updates using interactive interactive transactions (prisma.$transaction).
4. Maintain all existing FSM validations, RBAC guards, and audit logging.
5. Run typecheck and verify with npm run build.
```

### Prompt Option 2: Build Automated Test Suite (TASK-02)
```markdown
Please implement TASK-02: Setup an automated unit and integration test suite using Vitest.

Requirements:
1. Install and configure Vitest with TypeScript support.
2. Write unit tests for:
   - src/lib/domain/stateMachine.ts (all valid and invalid transition permutations).
   - src/lib/security/crypto.ts (scrypt hashing, timingSafeEqual verification, HMAC signing).
   - src/lib/security/rateLimit.ts (sliding window eviction and limit enforcement).
   - src/lib/security/idempotency.ts (TTL caching and duplicate request prevention).
3. Add a test script in package.json and run the test suite to verify 100% pass rate.
```

### Prompt Option 3: Add Live SSE Notifications (TASK-03)
```markdown
Please implement TASK-03: Implement a zero-bloat Server-Sent Events (SSE) live alert stream for shelter staff.

Requirements:
1. Create a GET /api/admin/sse route in Next.js App Router guarded by session authentication.
2. Broadcast an SSE event whenever submitApplication or atomicUpdateApplicationStatus is executed.
3. Build a client component in AdminLayout that listens to the SSE stream and shows animated toast notifications for new adoption applications.
4. Ensure graceful reconnection handling and unsubscription on unmount.
5. Verify build with npm run build.
```
