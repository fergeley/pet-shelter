# Engineering Handoff & Next Steps Roadmap

- **Status as of**: 2026-08-15
- **Stack**: Next.js 16.3.1 (App Router + Turbopack), React 19.2.8, TypeScript 5, Tailwind CSS v4, Prisma 7.9.1, Neon PostgreSQL, Vitest 4, Resend SDK.
- **Repository Location**: `c:\Users\User\pet-shelter`
- **Primary Operational Guide**: [`documents/OPERATIONAL_RUNBOOK.md`](file:///c:/Users/User/pet-shelter/documents/OPERATIONAL_RUNBOOK.md)
- **Donation & Sponsorship Handoff**: [`documents/HANDOFF_DONATION_AND_SPONSORSHIP_SUBSYSTEM.md`](file:///c:/Users/User/pet-shelter/documents/HANDOFF_DONATION_AND_SPONSORSHIP_SUBSYSTEM.md)
- **Donation & LHDN Tax Runbook**: [`documents/RUNBOOK_DONATION_AND_LHDN_TAX_RECEIPTS.md`](file:///c:/Users/User/pet-shelter/documents/RUNBOOK_DONATION_AND_LHDN_TAX_RECEIPTS.md)
- **Feature Activation Guide**: [`documents/FEATURE_ACTIVATION_AND_HANDOFF.md`](file:///c:/Users/User/pet-shelter/documents/FEATURE_ACTIVATION_AND_HANDOFF.md)
- **Email Deliverability Guide**: [`documents/EMAIL_DELIVERABILITY_BEST_PRACTICES.md`](file:///c:/Users/User/pet-shelter/documents/EMAIL_DELIVERABILITY_BEST_PRACTICES.md)

---

## 1. System Architecture & Completed Milestones

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js App Router                       │
│  Public Views (/, /pets, /applications/track) │ Admin (/admin/*) │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    Server Actions Layer                     │
│  src/actions/{pets, applications, auth, audit, settings}.ts │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
┌──────────────▼──────────────┐ ┌─────────────▼───────────────┐
│     Security & Domain       │ │   Resilient Storage Engine  │
│  - HMAC-SHA256 Sessions     │ │   - PostgreSQL (Prisma 7)   │
│  - Declarative RBAC Guards  │ │   - Multi-Provider Storage  │
│  - Finite State Machine     │ │   - Resend Email & Auditing │
│  - Privacy-Safe Lookups     │ │   - Sliding-Window Rate Lim │
└─────────────────────────────┘ └─────────────────────────────┘
```

### Completed & Production-Hardened Components
* **Public Adoption Application Tracking Portal ([`src/app/applications/track/page.tsx`](file:///c:/Users/User/pet-shelter/src/app/applications/track/page.tsx))**:
  - Adopter self-service lookup by Reference ID + Email with URL deep-link auto-query (`?ref=...&email=...`).
  - 4-stage visual progress stepper (`Received` $\rightarrow$ `Under Review` $\rightarrow$ `Meet & Greet Scheduled` $\rightarrow$ `Approved & Ready`).
  - Dynamic interaction cards: "Join Video Meeting" for virtual sessions, "View Location on Google Maps" for in-person shelter visits in Petaling Jaya.
  - 100% Free Adoption badges and adoption day preparation checklists.
  - Rate-limited server action [`lookupApplicationStatusAction`](file:///c:/Users/User/pet-shelter/src/actions/applications.ts) with strict privacy filtering (internal coordinator notes stripped).
* **Coordinator & Admin Workflow Controls ([`src/components/admin/ApplicationDetailDialog.tsx`](file:///c:/Users/User/pet-shelter/src/components/admin/ApplicationDetailDialog.tsx))**:
  - 1-click status selection pills (`Submitted`, `Under Review`, `Approve`, `Reject`).
  - 1-click "Copy Public Tracking Link" button with copied toast confirmation.
  - Direct 1-click WhatsApp launcher pre-filling applicant phone, pet name, reference ID, and live tracking link.
* **Database & ORM**: PostgreSQL schema with valid referential actions (`onDelete: SetNull`), interactive transaction cascades (`$transaction`), seed script (`prisma/seed.ts`), and optimized connection pool caching in `src/lib/prisma.ts`.
* **Authentication & RBAC**: HMAC-SHA256 signed HTTP-only cookies, sliding-window rate limiting, cryptographic scrypt hashing, and role hierarchy (`ADMIN` $\rightarrow$ `COORDINATOR` $\rightarrow$ `STAFF` $\rightarrow$ `VOLUNTEER`).
* **Multi-Provider Cloud Storage (`src/lib/storage/index.ts`)**:
  - `StorageProvider` abstraction supporting `local` (`public/uploads`), `s3` (AWS S3, Cloudflare R2, MinIO, Supabase Storage), and `cloudinary`.
  - Client-side Canvas WebP converter (`src/lib/imageOptimization.ts`) automatically downscaling photos (max 1600px) and encoding to `.webp` at 85% quality (70–90% payload reduction).
  - Real-time `XMLHttpRequest` 0–100% progress tracking and image deletion in `src/components/admin/ImageUpload.tsx`.
* **Transactional Email Lifecycle & Deliverability (`src/lib/email.ts`)**:
  - Official `resend` integration with offline simulation fallback.
  - Multi-part emails (HTML + Plain text), anti-spam compliance (`reply_to`, category tags, suppression headers).
  - Deep links embedded across all email templates for 1-click application tracking.
  - Production HTML templates for: Application Received, Staff Alert, Status Changes (`APPROVED`, `UNDER_REVIEW`, `REJECTED`), and Meet & Greet scheduling.
  - Automatic immutable audit trail recording in `src/lib/domain/auditLog.ts` (`EMAIL_SENT`, `EMAIL_FAILED`, `INTERVIEW_SCHEDULED`, `TEST_EMAIL_SENT`).
* **Client-Side Admin Settings Menu (`src/app/admin/settings/page.tsx`)**:
  - Configurable tabs for Sanctuary Identity, Transactional Email (with live in-app test email dispatcher), and Media Storage Providers.
* **100% Free Adoption Model**: Enforced across all pet listings, JSON-LD structured schemas, and admin UI.
* **Test Suite**: **20 Vitest test suites (155 unit tests, 100% passing rate)**.
* **Quality Gates**: `npx tsc --noEmit` (0 errors), `npm run lint` (0 errors), `npm run build` (22/22 routes statically compiled).

---

## 2. Future Enhancements Backlog (Prioritized)

### [PHASE-01] Donations & Pet Sponsorships (Stripe Checkout & DuitNow QR)
* **Priority**: High (Recommended Next Step)
* **Goal**: Add a public donation and recurring pet sponsorship checkout to fund veterinary care, food supplies, and shelter operations.
* **Features**:
  * Preset contribution tiers (RM 30, RM 50, RM 100, custom) with monthly recurring vs one-time toggle.
  * Direct animal sponsorship ("Sponsor Bella's Medical Care").
  * Dual payment gateways: Stripe Checkout (international cards) and DuitNow QR / FPX instructions for local Malaysian supporters.
* **Files to create/modify**:
  * `src/components/DonationModal.tsx` & `src/components/SponsorshipModal.tsx`
  * `src/actions/donations.ts`: Server action generating checkout sessions.
  * `src/app/donate/page.tsx`: Dedicated donation and sponsorship page.

---

### [PHASE-02] Foster Parent & Volunteer Scheduling Portal
* **Priority**: Medium
* **Goal**: Provide a lightweight self-service form for foster volunteers to apply, log weekend shifts, and submit health updates for foster animals.
* **Features**:
  * Foster application form with housing checks.
  * Volunteer shift registration calendar.
  * Staff review and approval flow.

---

### [KIV - Paused] Shelter Analytics & Performance Metrics Dashboard
* **Status**: Keep In View (KIV) — Postponed / Not required since `@vercel/analytics` and `@vercel/speed-insights` handle general telemetry and web performance tracking.
* **Specification Document**: [`tasks/06_SHELTER_ANALYTICS_AND_REPORTING.md`](file:///c:/Users/User/pet-shelter/tasks/06_SHELTER_ANALYTICS_AND_REPORTING.md)

---

## 3. Ready-to-Use Copy-Paste Prompt for AI Agents

You can hand off the following prompt directly to your AI coding assistant:

```markdown
## Project Overview
You are continuing development on **Hope for Strays** (`c:\Users\User\pet-shelter`), a modern Pet Shelter & Adoption Platform built with:
- **Framework**: Next.js 16.3.1 (Turbopack, App Router) & React 19.2.8
- **Language**: TypeScript 5 (Strict Mode, 0 `any` escapes)
- **Database & ORM**: PostgreSQL with Prisma 7.9.1 (`@prisma/adapter-pg`, connection pooling) & dual-layer in-memory fallback
- **Styling**: Tailwind CSS v4 & Lucide React
- **Testing**: Vitest (20 test suites, 155 tests)
- **Telemetry**: `@vercel/analytics` and `@vercel/speed-insights`

---

## Current Status & Recent Accomplishments
All recent milestones are committed and verified:
1. **Hybrid Donation & Sponsorship Subsystem (`/donate` + Widened Modal)**: Dedicated high-conversion `/donate` page, `DonationWidget`, widened `SponsorshipModal`, custom amounts, DuitNow QR PayNet rails, Maybank transfers, and LHDN Section 44(6) tax-exempt receipt engine.
2. **Public Application Tracking Portal (`/applications/track`)**: Self-service lookup by Reference ID + Email with 4-stage stepper, Google Maps / Video Call action buttons, and direct WhatsApp support.
3. **Coordinator Management Enhancements**: 1-click status pills, copy tracking link, and direct WhatsApp chat generation in `ApplicationDetailDialog.tsx`.
4. **Transactional Email Deliverability**: Full multi-part HTML/plain-text templates, Resend integration, anti-spam headers, donation receipts, and deep links.
5. **Zero-Error Build Pipeline**: 23/23 routes statically compiled, 163/163 tests passing across 21 suites, 0 TypeScript/ESLint errors.

---

## Next Recommended Task: [PHASE-02] Foster Parent & Volunteer Portal
Build the Foster & Volunteer subsystem:
1. **Foster Application & Intake Workflow (`/foster`)**:
   - Multi-step interactive foster parent inquiry for temporary convalescence and medical recovery stays in Petaling Jaya / Klang Valley.
   - Housing verification, medication administration agreement, and pet compatibility screening.
   - Server Action `submitFosterApplicationAction` with Zod validation, audit logging, and automated Resend confirmation email.
2. **Volunteer Registration & Shift Calendar (`/volunteer`)**:
   - Volunteer shift selection for weekend kennel walking, shelter cleaning, adoption event coordination, and veterinary transport.
   - Server Action `submitVolunteerRegistrationAction`.
3. **Coordinator Admin Views (`/admin/fosters` & `/admin/volunteers`)**:
   - Management table for approving foster homes and assigning shelter animals.
4. **Automated Unit Tests (`tests/unit/foster.test.ts` & `tests/unit/volunteer.test.ts`)**:
   - Schema edge cases, rate limiting, and state transitions.

---

## Quality Gates Checklist Before Finishing Any Task
- `npm run test` (must pass 163+ tests across 21+ suites)
- `npx tsc --noEmit` (must pass with 0 errors)
- `npm run lint` (must pass with 0 errors)
- `npm run build` (must compile cleanly without errors)
```
