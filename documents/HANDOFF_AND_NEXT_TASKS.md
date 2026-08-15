# Engineering Handoff & Next Steps Roadmap

- **Status as of**: 2026-08-15
- **Stack**: Next.js 16 (App Router + Turbopack), React 19, TypeScript 5, Tailwind CSS v4, Prisma 7, PostgreSQL, Vitest 4, Resend SDK.
- **Repository Location**: `c:\Users\User\pet-shelter`
- **Primary Operational Guide**: [`documents/OPERATIONAL_RUNBOOK.md`](file:///c:/Users/User/pet-shelter/documents/OPERATIONAL_RUNBOOK.md)

---

## 1. System Architecture & Completed Milestones

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js App Router                       │
│  Public Views (/, /pets, /pets/[id])  │ Admin (/admin/*)    │
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
│  - Declarative RBAC Guards  │ │   - Memory Cache Fallback   │
│  - Finite State Machine     │ │   - Resend Email Dispatch   │
└─────────────────────────────┘ └─────────────────────────────┘
```

### Completed & Production-Hardened Components
* **Database & ORM**: PostgreSQL schema with valid referential actions (`onDelete: SetNull`), interactive transaction cascades (`$transaction`), and seed script (`prisma/seed.ts`).
* **Authentication & RBAC**: HMAC-SHA256 signed HTTP-only cookies, sliding-window rate limiting, cryptographic scrypt hashing, and role hierarchy (`ADMIN` $\rightarrow$ `COORDINATOR` $\rightarrow$ `STAFF` $\rightarrow$ `VOLUNTEER`).
* **Staff Administration Dashboard**: TanStack tables at `/admin/pets` and `/admin/applications` with search, multi-badge filters, and CSV export.
* **Transactional Email Service**: Resend integration in [`src/lib/email.ts`](file:///c:/Users/User/pet-shelter/src/lib/email.ts) with development simulation mode.
* **Public SSR & Dynamic SEO**: Canonical `getPets()` SSR data fetching, Google JSON-LD structured schemas, and dynamic route resolution.
* **Test Suite**: 11 Vitest test suites (89 unit tests, 100% pass rate).
* **Operational Runbook**: Complete day-to-day operations guide in [`documents/OPERATIONAL_RUNBOOK.md`](file:///c:/Users/User/pet-shelter/documents/OPERATIONAL_RUNBOOK.md).

---

## 2. Future Enhancements Backlog (Prioritized)

### [FEATURE-01] Direct Media Drag-and-Drop Uploader
* **Priority**: High
* **Goal**: Replace manual external image URL inputs in pet dialogs with a multi-image drag-and-drop file uploader.
* **Files to create/modify**:
  * `src/components/admin/ImageUpload.tsx`: Drag-and-drop zone with preview grid, progress indicator, and delete buttons.
  * `src/app/api/upload/route.ts`: Storage integration endpoint (Uploadthing or Supabase Storage bucket).
  * `src/components/admin/PetFormDialog.tsx`: Integrate `ImageUpload` component.
* **Acceptance Criteria**:
  * Supports uploading up to 4 images per rescue animal (JPEG/PNG/WebP, max 5MB each).
  * Automatically sets primary thumbnail and populates `additionalImages` array.

---

### [FEATURE-02] Stripe Checkout Donations Component
* **Priority**: Medium
* **Goal**: Add a public donation CTA on the homepage with preset tiers ($10, $25, $50, custom amount) to fund shelter rescue operations.
* **Files to create/modify**:
  * `src/components/DonationSection.tsx`: Tier selector with monthly recurring vs one-time toggle.
  * `src/actions/donations.ts`: Server action creating a Stripe Checkout Session.
  * `src/app/page.tsx`: Embed donation section between Adoption Process and Testimonials.
* **Acceptance Criteria**:
  * Adopter selects tier or enters custom amount in MYR / USD.
  * Redirects securely to Stripe Checkout and returns to `/thank-you` page with payment confirmation.

---

### [FEATURE-03] Playwright Browser E2E Test Suite & GitHub Actions CI
* **Priority**: High
* **Goal**: Automate end-to-end browser tests across public adoption flows and admin management workflows in GitHub Actions.
* **Files to create/modify**:
  * `playwright.config.ts`: Browser test configuration.
  * `tests/e2e/adoption-flow.spec.ts`: Public user searches pet, opens modal, and submits adoption questionnaire.
  * `tests/e2e/admin-crud.spec.ts`: Staff logs in, creates a pet listing, updates status, and verifies table reflect.
  * `.github/workflows/ci.yml`: Automated CI pipeline on PR/push running lint, typecheck, unit tests, and build.
* **Acceptance Criteria**:
  * Playwright tests pass in headless Chromium and Firefox.
  * CI pipeline executes in < 3 minutes on pull requests.

---

### [FEATURE-04] Server-Sent Events (SSE) Live Coordinator Alerts
* **Priority**: Low / Nice-to-Have
* **Goal**: Provide real-time desktop visual toasts when a public user submits an adoption application.
* **Files to create/modify**:
  * `src/app/api/admin/sse/route.ts`: Streaming SSE route for authenticated staff sessions.
  * `src/components/admin/LiveApplicationNotifier.tsx`: Client toast listener in admin layout.
* **Acceptance Criteria**:
  * Zero third-party cloud WebSocket dependencies.
  * Submitting an application triggers an immediate desktop notification on active coordinator screens.

---

## 3. Ready-to-Use Copy-Paste Prompts for AI Agents

You can hand off any of the following prompts directly to your AI coding assistant (Antigravity, Claude Code, Cursor, or Copilot):

### 📋 Prompt 1: Implement Direct Media Drag-and-Drop Uploader (FEATURE-01)
```markdown
Please implement FEATURE-01: Direct Media Drag-and-Drop Uploader in pet-shelter.

Requirements:
1. Create a reusable client component `src/components/admin/ImageUpload.tsx` using HTML5 drag-and-drop or react-dropzone.
2. Support uploading up to 4 images per pet with image previews, upload progress indicator, and removal buttons.
3. Integrate an upload endpoint `src/app/api/upload/route.ts` with local buffer storage or Supabase Storage.
4. Update `src/components/admin/PetFormDialog.tsx` to replace raw URL text inputs with `ImageUpload`.
5. Verify that uploaded photos display properly in `PetCard.tsx` and `PetDetailDialog.tsx`.
6. Run `npx tsc --noEmit` and `npm run build` to confirm zero errors.
```

---

### 📋 Prompt 2: Implement Stripe Donations Section (FEATURE-02)
```markdown
Please implement FEATURE-02: Stripe Checkout Donations Component in pet-shelter.

Requirements:
1. Install stripe SDK (`npm install stripe @stripe/stripe-js`).
2. Create `src/actions/donations.ts` with Server Action `createCheckoutSession(amount: number, frequency: 'once' | 'monthly')`.
3. Create `src/components/DonationSection.tsx` with preset donation tiers (RM 25, RM 50, RM 100, custom) and payment frequency toggle.
4. Embed `DonationSection` in `src/app/page.tsx`.
5. Add fallback test simulation mode when `STRIPE_SECRET_KEY` is not present in `.env`.
6. Verify with `npm test` and `npm run build`.
```

---

### 📋 Prompt 3: Implement Playwright E2E & GitHub Actions CI (FEATURE-03)
```markdown
Please implement FEATURE-03: Playwright E2E Tests & GitHub Actions CI in pet-shelter.

Requirements:
1. Install Playwright (`npm install -D @playwright/test`) and create `playwright.config.ts`.
2. Write E2E test `tests/e2e/adoption-flow.spec.ts`:
   - Navigate to `/pets`.
   - Filter by dog / cat.
   - Open pet adoption modal and fill out questionnaire.
   - Assert application submission confirmation dialog appears.
3. Write E2E test `tests/e2e/admin-crud.spec.ts`:
   - Log in at `/admin/login` using `admin@hopeforstrays.org` / `admin123`.
   - Navigate to `/admin/pets` and add a new pet.
   - Assert new pet appears in the TanStack table.
4. Create `.github/workflows/ci.yml` running lint, typecheck, unit tests, and next build on push and pull requests.
5. Run tests locally with `npx playwright test`.
```
