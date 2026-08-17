# Task 05: Donations Section, E2E Testing, and GitHub Actions CI

## Objective
Add a donation CTA with Stripe Checkout support, set up Playwright E2E tests, and create a GitHub Actions CI pipeline.

## Requirements
1. **Donation Component (`src/components/DonationSection.tsx`):**
   - Create a donation card on the homepage with preset tiers ($10, $25, $50, custom amount).
   - Connect to Stripe Checkout Session Server Action or direct payment link.

2. **Playwright E2E Tests (`tests/adoption-flow.spec.ts`):**
   - Test 1: User navigates to `/pets`, filters by species, opens pet modal, and submits adoption application.
   - Test 2: Admin navigates to `/admin/pets`, creates a new pet, and verifies it appears in the table.

3. **GitHub Actions Workflow (`.github/workflows/ci.yml`):**
   - On push to `main` and all pull requests:
     - Install dependencies (`npm ci`).
     - Run linter (`npm run lint`).
     - Run type-check (`npx tsc --noEmit`).
     - Run build (`npm run build`).
