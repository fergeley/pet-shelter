# System Architecture Blueprint: Elegant, Resilient & Non-Brittle Backend Design

This document serves as the foundational architectural blueprint for building scalable, reliable, and low-maintenance web applications. It details the rationale, core patterns, and decision matrix to prevent brittleness while avoiding enterprise over-engineering.

---

## 1. Core Architectural Tenets

1. **Earn Its Place**: Every library, table, and network boundary must solve an immediate, tangible failure mode. Avoid premature infrastructure (Kafka, multi-cluster Redis, microservices) until traffic or operational boundaries necessitate it.
2. **PostgreSQL as the Anchor**: Maximize the built-in capabilities of PostgreSQL (ACID transactions, atomic row locks with `SKIP LOCKED`, JSONB columns, generated columns, and full-text search) before introducing auxiliary storage engines.
3. **Fail-Fast Boundaries**: Validate all external inputs at the absolute perimeter using strongly-typed schemas (Zod). Never allow untrusted or loosely-typed payloads into domain logic.
4. **Single Source of Truth**: Eliminate split-brain architectures where state is duplicated across localStorage, client memory, and databases.
5. **Deterministic State Transitions**: Never permit raw status mutations without verifying the transition through a strict Finite State Machine (FSM).

---

## 1.5 Brand & UI Direction

The visual identity should feel warm, approachable, and rescue-focused without drifting into generic SaaS minimalism. The design direction is intentionally anchored to the paw-icon asset and the emotional tone of a genuine animal welfare organization.

### Brand palette

Use a warm neutral foundation with restrained coral or rose tones as the key accent. The palette is intentionally softer than default industrial black/white because it signals care, trust, and non-clinical friendliness.

- Background: cream / warm ivory
- Foreground: deep espresso brown / warm charcoal
- Primary accent: muted coral / rose terracotta
- Secondary accent: blush / warm sand
- Borders: soft clay / warm neutral beige
- Dark mode: deep brown-black with lighter blush or peach highlighting rather than stark cold gray

### Design rationale

- The application should feel more like a community shelter than a fintech product.
- The icon and interface should share the same emotional language: caring, soft, welcoming, and sincere.
- High-contrast accessibility must still be preserved; warmth should come from hue and softness, not reduced legibility.
- The brand palette should stay stable across buttons, cards, modals, and nav surfaces to avoid a fragmented visual identity.

### Shape language

Prefer soft, semi-rounded shapes rather than harsh square corners. This is the “squircle” direction: rounded enough to feel approachable and friendly, but not so rounded that it becomes playful or unserious.

- Buttons: softly rounded, with subtle depth and restrained shadow
- Cards: rounded panels with gentle edges and light shadows
- Dialogs: broader rounded corners for calm, non-aggressive framing
- Navbar and app shell: soft corners and warm surfaces to maintain consistency with the icon and overall brand tone

### Practical implementation guidance

- Keep the palette defined centrally in the app theme tokens rather than scattered across components.
- Preserve a single primary accent for key calls to action.
- Avoid introducing cold blue or gray-heavy accents unless they are used intentionally as secondary neutral support tones.
- If a purely monochrome variant is required, prefer warm black, ivory, and clay neutrals over stark black and silver gray.

This visual system should remain stable through future design iterations unless a formal rebrand is approved.

---

## 2. Architectural Deep-Dive by Pillar

```
                           ┌──────────────────────────────────────────────┐
                           │               CLIENT BROWSER                 │
                           └──────────────────────┬───────────────────────┘
                                                  │ HTTPS + Signed Session Cookie
                                                  ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ NEXT.JS APPLICATION LAYER                                                              │
│                                                                                        │
│  ┌─────────────────────────┐   ┌──────────────────────────┐   ┌─────────────────────┐  │
│  │ Rate Limiter (In-Mem)   │──>│ Zod Validation Guard     │──>│ RBAC Auth Guard     │  │
│  └─────────────────────────┘   └──────────────────────────┘   └──────────┬──────────┘  │
│                                                                          │             │
│  ┌───────────────────────────────────────────────────────────────────────▼──────────┐  │
│  │ DOMAIN SERVICES LAYER                                                             │  │
│  │  • Finite State Machine (FSM) Transition Guards                                   │  │
│  │  • Idempotency Check & Atomic Execution                                           │  │
│  └───────────────────────────────────┬──────────────────────────────────────────────┘  │
└──────────────────────────────────────┼─────────────────────────────────────────────────┘
                                       │ Interactive Transaction ($transaction)
                                       ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ POSTGRESQL / PERSISTENCE LAYER                                                         │
│                                                                                        │
│  ┌──────────────────┐   ┌──────────────────────┐   ┌────────────────────────────────┐  │
│  │ Pets Table       │   │ Applications Table   │   │ AuditLog Table (Append-Only)   │  │
│  └──────────────────┘   └──────────────────────┘   └────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Pillar 1: Identity, Authentication & RBAC

#### The Brittleness Anti-Pattern
* Storing unencrypted JWTs or user objects in `localStorage`.
* XSS attacks can read `localStorage` effortlessly. Revoking a compromised JWT requires building an external token revocation blacklist, negating the statelessness of JWTs.

#### The Elegant Alternative
* **Encrypted / HMAC-Signed HTTP-Only Cookies**:
  * Attributes: `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`.
  * Cannot be read or modified by client-side JavaScript.
  * Verified server-side on every request in microseconds using `node:crypto`.

```typescript
// Declarative Permission Evaluation
export type Role = "ADMIN" | "COORDINATOR" | "STAFF" | "VOLUNTEER";

export function assertAuthorized(user: { role: Role } | null, requiredRoles: Role[]) {
  if (!user) throw new UnauthorizedError("Authentication required.");
  if (!requiredRoles.includes(user.role)) {
    throw new ForbiddenError("Insufficient permissions.");
  }
}
```

---

### Pillar 2: Concurrency, Transactions & Idempotency

#### The Brittleness Anti-Pattern
* **Read-Modify-Write Race Conditions**: Fetching a record, checking `if (status === 'AVAILABLE')` in JavaScript, and then executing `UPDATE`. Two parallel requests will both pass the check and double-assign the record.
* **Dual-Write Inconsistency**: Updating the database and sending an email without transactional isolation.

#### The Elegant Alternative
* **Atomic Conditional SQL Updates**:
  ```typescript
  // Evaluated atomically inside PostgreSQL engine
  const result = await prisma.pet.updateMany({
    where: { id: petId, status: "AVAILABLE" },
    data: { status: "PENDING" },
  });
  if (result.count === 0) {
    throw new ConflictError("Pet is no longer available.");
  }
  ```
* **Interactive Multi-Entity Transactions**:
  ```typescript
  await prisma.$transaction(async (tx) => {
    await tx.adoptionApplication.update({ where: { id: appId }, data: { status: "APPROVED" } });
    await tx.pet.update({ where: { id: petId }, data: { status: "ADOPTED" } });
    await tx.auditLog.create({ data: { action: "APPLICATION_APPROVED", entityId: appId, ... } });
  });
  ```
* **Idempotency Keys**:
  * Form submissions include an `Idempotency-Key` UUID.
  * If the key was processed within the TTL window, return the cached result immediately instead of re-executing writes.

---

### Pillar 3: Domain Rules & Finite State Machines (FSM)

#### The Brittleness Anti-Pattern
* Free-form status strings with manual `if/else` checks scattered across front-end buttons and backend controllers.

#### The Elegant Alternative
* **Declarative Transition Matrix**:
  ```typescript
  export type ApplicationStatus = "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "CANCELLED";

  export const APPLICATION_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
    SUBMITTED: ["UNDER_REVIEW", "CANCELLED"],
    UNDER_REVIEW: ["APPROVED", "REJECTED", "CANCELLED"],
    APPROVED: ["CANCELLED"],
    REJECTED: ["UNDER_REVIEW"], // Appeals only
    CANCELLED: [],
  };

  export function assertValidTransition(from: ApplicationStatus, to: ApplicationStatus) {
    const allowed = APPLICATION_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new ValidationError(`Illegal state transition from ${from} to ${to}`);
    }
  }
  ```

---

### Pillar 4: Rate Limiting & API Defense

#### The Brittleness Anti-Pattern
* Relying solely on client-side button disables to prevent brute force or spam submissions.

#### The Elegant Alternative
* **Sliding-Window Rate Limiter**:
  * Tracks request timestamps in memory (or Redis for multi-node deployments).
  * Auto-evicts expired windows to eliminate memory leaks.
  * Returns `HTTP 429 Too Many Requests` with a `Retry-After` header.

---

### Pillar 5: Audit Logging & Traceability

#### The Brittleness Anti-Pattern
* Relying on `updatedAt` timestamps. When data changes or is deleted, there is no historical record of *who* made the modification, *what* the previous values were, or *when* it occurred.

#### The Elegant Alternative
* **Immutable Append-Only Audit Table**:
  ```prisma
  model AuditLog {
    id        String   @id @default(cuid())
    actorId   String
    actorRole String
    action    String   // e.g., "PET_UPDATED", "APPLICATION_APPROVED"
    entity    String   // e.g., "Pet", "AdoptionApplication"
    entityId  String
    details   Json?    // Snapshot of previous vs updated state
    createdAt DateTime @default(now())
  }
  ```

---

## 3. Technology Evolution & Scaling Matrix

| Capability | Tier 1: Zero-Bloat Minimum (Current) | Tier 2: Scaling Trigger | Tier 3: High-Scale Upgrade |
|---|---|---|---|
| **Database** | Single Managed PostgreSQL | Read IOPS > 70% | Read Replicas + PgBouncer |
| **Authentication** | Signed HTTP-Only Cookie Session | Cross-domain API / Mobile App | OAuth2 / PKCE + Auth.js |
| **Job Queue** | In-Memory / Postgres `SKIP LOCKED` | > 100 concurrent jobs/sec | BullMQ on Redis |
| **Rate Limiter** | In-Memory Sliding Window | Multi-instance Horizontal Scale | Redis Token Bucket |
| **Audit Logs** | PostgreSQL `AuditLog` table | High write volume (> 10M rows) | Partitioned Table / Cold S3 |
