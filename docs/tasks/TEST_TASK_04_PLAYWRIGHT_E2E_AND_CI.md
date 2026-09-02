# Task 04: Playwright E2E Golden Path Suite & GitHub Actions CI

**Date**: 2026-08-26  
**Status**: Ready for Dispatch  
**Domain**: Quality Assurance, End-to-End Automation & DevOps  
**Dependencies**: Task 01, Task 02, Task 03  
**Target Files**:
- `playwright.config.ts` (Playwright configuration & webServer definition)
- `e2e/fixtures/authFixture.ts` (Pre-authenticated session cookie injector)
- `e2e/pages/AdoptionPage.ts` (Page Object Model for public adoption flow)
- `e2e/pages/TrackingPage.ts` (Page Object Model for application tracking)
- `e2e/pages/AdminPetsPage.ts` (Page Object Model for admin pet management)
- `e2e/pages/AdminApplicationsPage.ts` (Page Object Model for application review)
- `e2e/specs/01_public_adoption_flow.spec.ts` (E2E Adoption flow)
- `e2e/specs/02_application_tracking.spec.ts` (E2E Tracking flow)
- `e2e/specs/03_admin_pet_lifecycle.spec.ts` (E2E Admin pet lifecycle & rehab)
- `e2e/specs/04_admin_application_review.spec.ts` (E2E Admin review & audit log)
- `e2e/specs/05_bilingual_navigation.spec.ts` (E2E Bilingual EN/MS switching)
- `.github/workflows/ci.yml` (GitHub Actions CI pipeline)

---

## 🎯 1. Objective

Deliver an end-to-end (E2E) testing suite across 5 critical user journeys using Playwright with Page Object Models (POM), and establish a continuous integration (CI) pipeline via GitHub Actions.

---

## 🔍 2. Detailed Technical Specification

### A. Playwright Setup (`playwright.config.ts`)
- Install `@playwright/test`.
- Base URL: `http://localhost:3000`.
- Browser: Chromium (desktop).
- Test directory: `./e2e/specs`.
- `webServer` command: `npm run dev` (or `npm run build && npm start`).
- Artifacts: Screenshots, videos, and trace retained on failure only.

### B. Authenticated Test Fixture (`e2e/fixtures/authFixture.ts`)
Instead of logging in through the UI form before every admin test, create a custom fixture `test.extend<{ authedAdminPage: Page }>`:
- Pre-generate a signed `hope_shelter_session` cookie using `sealSession(...)` with admin payload.
- Inject the cookie directly into the Playwright browser context.
- Reduces admin E2E test execution time by ~80% and eliminates login form flakiness.

### C. Page Object Models (`e2e/pages/`)
1. **`AdoptionPage.ts`**:
   - `goto()`, `filterBySpecies(species)`, `filterByStatus(status)`, `selectPet(name)`, `fillAdoptionForm(data)`, `submitForm()`, `getReferenceId()`.
2. **`TrackingPage.ts`**:
   - `goto()`, `searchApplication(refId, email)`, `assertStatus(status)`, `assertTimelineVisible()`.
3. **`AdminPetsPage.ts`**:
   - `goto()`, `clickAddPet()`, `fillPetForm(petData)`, `savePet()`, `archivePet(petName)`, `assertPetStatus(petName, status)`.
4. **`AdminApplicationsPage.ts`**:
   - `goto()`, `filterByStatus(status)`, `openApplication(applicantName)`, `advanceStatus(newStatus, notes)`, `assertApplicationApproved()`.

### D. 5 Golden Path Specs (`e2e/specs/`)
1. **`01_public_adoption_flow.spec.ts`**: Navigate catalog → Filter available pets → Open adoption modal → Complete valid form → Submit → Assert confirmation & reference ID displayed.
2. **`02_application_tracking.spec.ts`**: Open `/applications/track` → Enter valid reference ID and email → Assert status timeline renders matching state.
3. **`03_admin_pet_lifecycle.spec.ts`**: Using `authedAdminPage` → Navigate to `/admin/pets` → Create unique test pet → Verify in catalog → Update status to `In Rehabilitation` → Verify status pill updates.
4. **`04_admin_application_review.spec.ts`**: Using `authedAdminPage` → Navigate to `/admin/applications` → Move application from `SUBMITTED` to `UNDER_REVIEW` → Approve application → Verify pet marked `Adopted` → Verify entry logged in `/admin/audit`.
5. **`05_bilingual_navigation.spec.ts`**: Toggle language dropdown from `English` to `Bahasa Malaysia` → Verify navigation links, hero headings, and catalog text switch to Bahasa Malaysia.

### E. GitHub Actions CI Pipeline (`.github/workflows/ci.yml`)
Create a parallelized workflow triggered on `push` to `main` and all `pull_request`s:
- **Job 1: Static & Architecture Analysis** (`npm ci`, `prisma generate`, `npm run lint`, `npx tsc --noEmit`).
- **Job 2: Unit & Component Tests** (`npm ci`, `prisma generate`, `npm test`, `npm run test:components`).
- **Job 3: Integration & E2E Tests** (`npm ci`, `prisma generate`, `npx playwright install --with-deps chromium`, `npm run test:integration`, `npx playwright test`, upload artifacts on failure).

---

## 🚦 3. Acceptance Criteria & Verification

1. [ ] Accessible, web-first locators (`page.getByRole`, `page.getByLabel`) used in all POMs.
2. [ ] All 5 E2E specs pass cleanly via `npx playwright test`.
3. [ ] GitHub Actions workflow syntax is valid and passes all jobs.
4. [ ] `npx tsc --noEmit` is clean outside `scratch/`.

---

## 🤖 4. Autonomous Agent Execution Prompt

```text
You are a senior Quality & DevOps Engineer specializing in Playwright, Next.js, and GitHub Actions. Execute Task 04 for the Hope for Strays pet shelter platform according to docs/tasks/TEST_TASK_04_PLAYWRIGHT_E2E_AND_CI.md.

Step 1: Install `@playwright/test` and required dependencies.
Step 2: Create `playwright.config.ts` configured for Next.js App Router.
Step 3: Implement `e2e/fixtures/authFixture.ts` to provide fast pre-authenticated admin sessions.
Step 4: Implement Page Object Models in `e2e/pages/` (AdoptionPage, TrackingPage, AdminPetsPage, AdminApplicationsPage).
Step 5: Implement the 5 Golden Path test specs in `e2e/specs/`.
Step 6: Create `.github/workflows/ci.yml` defining the parallelized CI pipeline.
Step 7: Run `npx playwright test` and `npx tsc --noEmit` to verify all specs pass and types are clean.
```
