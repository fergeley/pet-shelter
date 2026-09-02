# Target — Comprehensive Test Coverage Expansion (Tiers 3, 4 & 5)

**Date**: 2026-08-27  
**Branch**: `feat/tnrm-rehabilitation`  
**Baseline**: 40 unit test files / 515 tests green · `npx tsc --noEmit` clean · `npm run lint` clean · `npm run build` passes  
**Related Specs**:
- [Testing Strategy & Multi-Agent Plan](TESTING_STRATEGY_AND_MULTI_AGENT_PLAN.md)
- [Test Task 02: Client Component & UI Suite](TEST_TASK_02_COMPONENT_AND_UI_SUITE.md)
- [Test Task 03: Strict Database & Server Actions](TEST_TASK_03_DATABASE_AND_ACTIONS_INTEGRATION.md)
- [Test Task 04: Playwright E2E & GitHub Actions CI](TEST_TASK_04_PLAYWRIGHT_E2E_AND_CI.md)

---

## 1. 🎯 Objective & Scope

Expand test coverage beyond Tier 1 (AST layer guards) and Tier 2 (isolated domain unit tests) to establish full automated coverage across the upper tiers of the testing pyramid:
1. **Tier 3 — Strict Database & Server Actions Integration**: Real PostgreSQL / Neon database persistence and Server Action execution under `STRICT_PERSISTENCE=true` (zero in-memory fallback masking).
2. **Tier 4 — Client Component & DOM Interaction Testing**: `@testing-library/react` + `jsdom` testing for interactive client components (forms, modals, quizzes, tabs, bilingual toggle).
3. **Tier 5 — Playwright End-to-End (E2E) & CI Automation**: 5 golden path browser user journeys in Playwright with `.github/workflows/ci.yml` pipeline.

```
                                  ▲
                                 / \
               [ Tier 5: E2E ]  /   \    Playwright (5 Golden Paths: Adopt, Donate, Track, Admin)
                               /-----\
           [ Tier 4: UI/DOM ] /       \   Testing Library + jsdom (Client forms, quiz, modals, tables)
                             /---------\
     [ Tier 3: DB & Actions]/           \ Vitest + STRICT_PERSISTENCE (Server Actions, Transactions, RBAC)
                           /-------------\
    [ Tier 2: Domain Logic]               \ Vitest Node (FSM, Zod schemas, crypto, rate limits, i18n parity)
                          /-----------------\
  [ Tier 1: Static Guards]                   \ TypeScript strict + ESLint + AST Layer Boundary Tests
```

---

## 2. 📋 Detailed Work Breakdown

### Phase 1: Tier 3 Strict Database & Server Actions Integration Suite (`TEST_TASK_03`)

- **Environment & Neon Postgres Connectivity**:
  - Configure `vitest.config.mts` integration project to load `.env.local` / `DATABASE_URL` safely without leaking environment variables into unit suites.
  - Enforce `STRICT_PERSISTENCE=true` so queries fail loudly if migrations or database connections are invalid.
- **Suites to Implement in `tests/integration/`**:
  1. `petActions.test.ts`:
     - Pet creation, status updates, `rehabStage` / `rehabProgressPercent` persistence.
     - Soft deletion (`isArchived`) and public catalog query filtering (`getPublicPetsAction`).
  2. `applicationActions.test.ts`:
     - Public adoption application submission and reference code generation (`HFS-APP-YYYYMM-XXXX`).
     - Public status tracking on `/applications/track`.
  3. `atomicTransitions.test.ts`:
     - State machine progression (`SUBMITTED` → `UNDER_REVIEW` → `APPROVED` / `REJECTED`).
     - Concurrent approval race condition guards.
     - Immutable `AuditLog` generation on Postgres.
  4. `authActions.test.ts`:
     - Session signing / unsealing, staff RBAC (`ADMIN`, `STAFF`).
     - Rate limiting sliding window enforcement on public action entry points.

---

### Phase 2: Tier 4 UI Component & Interaction Suite (`TEST_TASK_02`)

- **Setup**: Install/configure `@testing-library/react` and `@testing-library/user-event` with `jsdom` test environment in Vitest.
- **Suites to Implement in `tests/components/`**:
  1. `AdoptionForm.test.tsx`: Multi-step form validation, terms agreement checkbox, error states, and submission handling.
  2. `PetMatchQuiz.test.tsx`: 5-question lifestyle scoring, recommendation ranking, and responsive card rendering.
  3. `LanguageToggle.test.tsx`: Live bilingual switching (`en` ↔ `ms`) with dictionary key parity and UI re-rendering.
  4. `PetDetailView.test.tsx`: 4-part tab switching, WAI-ARIA roving tabindex keyboard navigation (`ArrowRight`, `ArrowLeft`, `Home`, `End`), and sponsorship perk highlights.
  5. `DonationWidget.test.tsx`: Frequency toggle (`one_time` vs `monthly`), `PetChooserCarousel` selection, custom amount entry, and DuitNow QR rendering.

---

### Phase 3: Tier 5 Playwright E2E & GitHub Actions CI (`TEST_TASK_04`)

- **Setup**: Configure `playwright.config.ts` with local webServer targeting `localhost:3000` and pre-authenticated auth fixtures for admin testing.
- **Specs to Implement in `tests/e2e/`**:
  1. `adoptionFlow.spec.ts`: Homepage → Browse Catalog → Pet Profile → Submit Adoption Application → Receive Reference Code.
  2. `applicationTracking.spec.ts`: Input reference code on `/applications/track` → Verify live status & meeting details.
  3. `donationPledge.spec.ts`: Choose dedicated animal in `PetChooserCarousel` → Select tier → Submit pledge → View printable e-Receipt.
  4. `adminPortal.spec.ts`: Pre-authenticated admin login → Review application → Approve → Verify audit log.
  5. `bilingualSwitching.spec.ts`: Toggle EN / MS across public routes and verify heading and badge localization.
- **CI Workflow**: Create `.github/workflows/ci.yml` executing lint, typecheck, layer boundary AST checks, unit tests, integration tests, and Playwright E2E across parallel jobs.

---

## 3. 🤖 Reusable Subagent Prompt

To dispatch an agent or subagent to execute this task, use the prompt below:

```markdown
# Goal: Implement Comprehensive Test Coverage Expansion (Tiers 3, 4 & 5)

## Context & Baseline
- Platform: Next.js 16.3.1 (Turbopack), React 19, Prisma 7.9.1, PostgreSQL / Neon, Vitest 4.1.10.
- Current State: 40 unit test suites (515 tests) passing cleanly on `feat/tnrm-rehabilitation`.
- References:
  - `docs/tasks/TARGET_TEST_COVERAGE_EXPANSION.md`
  - `docs/tasks/TESTING_STRATEGY_AND_MULTI_AGENT_PLAN.md`
  - `docs/tasks/TEST_TASK_03_DATABASE_AND_ACTIONS_INTEGRATION.md`
  - `docs/tasks/TEST_TASK_02_COMPONENT_AND_UI_SUITE.md`
  - `docs/tasks/TEST_TASK_04_PLAYWRIGHT_E2E_AND_CI.md`

## Deliverables
1. **Tier 3 Integration Suite (`tests/integration/`)**:
   - Configure `vitest.config.mts` integration project with `.env.local` database credentials and `STRICT_PERSISTENCE=true`.
   - Implement `petActions.test.ts`, `applicationActions.test.ts`, `atomicTransitions.test.ts`, `authActions.test.ts`.
2. **Tier 4 Component UI Suite (`tests/components/`)**:
   - Implement `AdoptionForm.test.tsx`, `PetMatchQuiz.test.tsx`, `PetDetailView.test.tsx`, `DonationWidget.test.tsx`.
3. **Tier 5 Playwright E2E & CI (`tests/e2e/`, `.github/workflows/ci.yml`)**:
   - Implement 5 golden path E2E specs and GitHub Actions CI workflow.

## Strict Rules
- Never allow integration tests to pass via the fallback memory store (`STRICT_PERSISTENCE` must be active).
- Clean up inserted database rows after each integration suite so tests remain deterministic.
- Test DOM components via accessible roles (`getByRole`, `getByLabelText`) rather than fragile CSS selectors.
- Maintain clean layer boundaries (`node docs/architecture/layer-graph.mjs` must pass with 0 errors).

## Quality Gates
- `npm test`
- `npm run test:integration`
- `npm run test:components`
- `npx tsc --noEmit`
- `npm run lint`
- `node docs/architecture/layer-graph.mjs`
- `npm run build`
```

---

## 4. 🚦 Definition of Done (DoD)

1. `npm test` runs fast unit and architectural tests in < 5 seconds.
2. `npm run test:integration` runs all Server Action and persistence tests under `STRICT_PERSISTENCE=true`.
3. `npm run test:components` runs all client component tests in jsdom.
4. `npm run test:e2e` executes all 5 Playwright golden paths cleanly.
5. `npx tsc --noEmit` and `npm run lint` remain 100% clean with 0 errors.
6. `node docs/architecture/layer-graph.mjs` confirms clean layer boundaries.
7. Next.js production build (`npm run build`) compiles all 27 pages cleanly.
