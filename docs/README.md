# Hope for Strays — Documentation Portal

Welcome to the centralized documentation repository for the **Hope for Strays** (*Persatuan Harapan Haiwan Terbiar Selangor*) platform.

---

## 🧭 Navigation Map

### 🚀 Getting Started & Setup
- **[Installation & Local Development Guide](setup.md)**: Prerequisites, environment configuration, database seeding, and development workflow.
- **[Contributing Guidelines](../.github/CONTRIBUTING.md)**: Coding standards, branch strategy, PR workflow, and architectural rules.
- **[Design System & UI Tokens](design-system.md)**: Design philosophy, typography, colors, component guidelines, and accessibility.

---

### 🏗️ Architecture & Technical Blueprints
- **[Application Layer Map (Backend vs Frontend)](architecture/LAYERS.md)**: All 15 layers named and owned, legal dependency directions, machine-verified layer violations, and the type-invisible contract gap between `Pet` and the store. Regenerate its findings with `node docs/architecture/layer-graph.mjs`.
- **[System Architecture Blueprint](architecture/ARCHITECTURE_BLUEPRINT.md)**: High-level system topology, Server Components vs Client Components, security layers, and data flows.
- **[Database & ORM Architecture Guide](architecture/GUIDE_PRISMA_AND_NEON_ARCHITECTURE.md)**: PostgreSQL schema, Neon branching, Prisma ORM setup, connection pooling, and in-memory dual-layer storage pattern.
- **[ADR-001: API Routing Standard (Path vs. Query)](architecture/ADR-001-api-path-vs-query.md)**: When an attribute belongs in the URI path versus the query string, plus the error (RFC 9457), concurrency, idempotency, caching, and versioning rules for every `/api/v1` collection resource. Ships with a typechecked reference kit in [`docs/reference/api-standard/`](reference/api-standard/) and an 11-rule conformance linter — run it with `npx tsx docs/reference/api-standard/conformance.ts src/app/api`.

---

### 📋 Sprint Tasks & Collaboration Backlogs
- **[Testing Strategy & Multi-Agent Plan](tasks/TESTING_STRATEGY_AND_MULTI_AGENT_PLAN.md)**: Master 5-tier testing architecture, critique, and multi-agent dispatch plan.
  - **[Test Task 01: Infrastructure & Mocks](tasks/TEST_TASK_01_INFRASTRUCTURE_AND_MOCKS.md)**: Strict DB mode, `tests/setup/nextMocks.ts`, Vitest setup.
  - **[Test Task 02: Client Component & UI Suite](tasks/TEST_TASK_02_COMPONENT_AND_UI_SUITE.md)**: `@testing-library/react` + `jsdom` testing for forms, quiz, modals.
  - **[Test Task 03: Strict Database & Server Actions](tasks/TEST_TASK_03_DATABASE_AND_ACTIONS_INTEGRATION.md)**: Server actions integration, transactions, RBAC, soft-delete.
  - **[Test Task 04: Playwright E2E & GitHub Actions CI](tasks/TEST_TASK_04_PLAYWRIGHT_E2E_AND_CI.md)**: 5 Golden Path E2E specs, Page Object Models, CI workflow.
  - **[Target: Test Coverage Expansion (Tiers 3, 4 & 5)](tasks/TARGET_TEST_COVERAGE_EXPANSION.md)**: Master dispatch specification and prompt for comprehensive test expansion across DB integration, UI components, and Playwright E2E.
- **[Sprint Plan & Task Division (Backend vs Frontend)](tasks/SPRINT_PLAN_BACKEND_AND_FRONTEND.md)**: Master task breakdown, domain assignments, acceptance criteria, and DoD.
- **[Handoff: TNRM & Rehabilitation Sprint](tasks/HANDOFF_TNRM_REHABILITATION_SPRINT.md)**: Current branch state, shipped work, design decisions, and the prioritized open items with their file references.
- **[🔴 Target: Authentication Secret Hardening](tasks/TARGET_SECRET_HARDENING.md)**: Resolves P1 — committed secret fallbacks, the unconditional invite-code bypass, and the anonymous path to applicant PII. **Do this first.**
- **[🔴 Target: Admin Status Parity](tasks/TARGET_ADMIN_STATUS_PARITY.md)**: Records P7 — the admin pet table renders rehabilitating animals as "Available" and its status filter cannot reach them. Admin-side follow-on to P5.
- **[✅ Target: Shelter Identity Adoption](tasks/TARGET_SHELTER_IDENTITY_ADOPTION.md)**: Records P8 — `shelterIdentity.ts` existed but 24 statutory literals were still inlined across 11 files, so correcting the ROS number by configuration would have half-applied. Landed; P2 itself stays blocked on the certificate.
- **[🔴 Target: Admin Status Write-back](tasks/TARGET_ADMIN_STATUS_WRITEBACK.md)**: Records P9 — `updatePetStatus` returns `{ success: false }` instead of throwing, the caller discards it, and the admin table persists a status the database refused. Live via `PetFormDialog`.
- **[Handoff: Pet History Persistence](tasks/HANDOFF_PET_HISTORY_PERSISTENCE.md)**: Resolves open item P3 — the nested-collection modeling decision for `updates[]` and `medicalTimeline[]`, with the step plan and required test coverage.
- **[⚪ Target: Split the Ledger out of `6c6d6d5`](tasks/TARGET_LEDGER_COMMIT_SPLIT.md)**: Optional cleanup — the donation ledger landed inside a commit whose message describes only UI work, so it is invisible in `git log`. Records the split, and the reasons to skip it in favour of the Postgres verification.
- **[🔴 Target: Schema Type Integrity](tasks/TARGET_SCHEMA_TYPE_INTEGRITY.md)**: The remaining findings from the schema review — why 5NF is the wrong goal here, the `Pet.age` value that silently rots, statuses Postgres cannot constrain, the one real 3NF violation, and the four typed concepts with no persistence. Also records the donation ledger as landed, and the fact that it has **never been run against real Postgres**.
- **[✅ Handoff: Auth Hardening, Rehabilitation UI & Pet History](tasks/HANDOFF_SECURITY_REHAB_AND_HISTORY.md)**: **Start here.** Closes P1, P3 and P5 — what shipped, why `src/instrumentation.ts` must never be deleted, why green tests could not see a missing migration, and the remaining P2/P4 backlog.
- **[🟡 Target: Design System Guards](tasks/TARGET_DESIGN_SYSTEM_GUARDS.md)**: The token / base / component layering in `globals.css` has **landed** and the tree is at zero drift — but nothing enforces it. Adds the structural guard, and records why a manual audit was not sufficient: it passed a pass that had shipped an unused shell and a class name that does not exist.
- **[🟡 Plan: `src/lib/` Restructure](tasks/PLAN_LIB_RESTRUCTURE.md)**: The repository split has **landed** — `serverStore.ts` (883 lines) is now six modules under `src/lib/server/`, with a guard forbidding any `"use client"` module from importing them. The `lib/client/` and `lib/presentation/` moves remain pending (§9). Records why a full `src/features/` migration was rejected on evidence.
- **[🟡 Target: Layer Guard Completeness](tasks/TARGET_LAYER_GUARD_COMPLETENESS.md)**: `tests/unit/layerBoundaries.test.ts` is the enforcement arm of the layer map, and its import-graph model has three silent gaps — bare side-effect imports are invisible (confirmed by injection), the `"use client"` detection window is 400 bytes, and comments are parsed as imports. Nothing exploits them today; all three fail green.
- **[Cross-Team Architecture Contract](architecture/ARCHITECTURE_CONTRACT_BACKEND_FRONTEND.md)**: TypeScript data contracts, Server Action signatures, and deep-link standards.

---

### 🎓 Step-by-Step Technical Tutorials

#### 🖥️ Backend Server Engineer Tutorials (For You)
- **[Tutorial 05: Backend Server Architecture Masterclass](tutorials/TUTORIAL_05_BACKEND_SERVER_ARCHITECTURE.md)**: Prisma models, Zod validation, dual-layer server store, server actions, and unit tests.
- **[Backend Module 01: TNRM & Rehabilitation Data Engine](tutorials/TUTORIAL_BE_01_TNRM_REHAB_DATA_LAYER.md)**: Data modeling, state machine transitions, and query filtering for animals in medical/behavioral rehab.
- **[Backend Module 02: Personalized Sponsorship & LHDN Tax Engine](tutorials/TUTORIAL_BE_02_PERSONALIZED_SPONSORSHIP_ENGINE.md)**: Dedicated pet sponsorship pledges, LHDN Sec 44(6) tax e-receipts, and monthly update dispatchers.
- **[Backend Module 03: Rehabilitation House Needs & FAQ API](tutorials/TUTORIAL_BE_03_REHAB_NEEDS_API.md)**: Wishlist categories API and categorized FAQ indexing.

#### 🎨 Frontend UI/UX Engineer Tutorials (For Your Partner)
- **[Tutorial 06: Frontend UI/UX Architecture Masterclass](tutorials/TUTORIAL_06_FRONTEND_UI_UX_ARCHITECTURE.md)**: Accessible navbar dropdowns, hero impact counters, 4-tab animal profile view, Orangutan Project sponsorship chooser, and wishlist.
- **[Frontend Module 01: Navbar Overhaul & Accessible Dropdowns](tutorials/TUTORIAL_FE_01_NAVBAR_AND_NAVIGATION_DROPDOWNS.md)**: Adoption & Get Involved dropdown menus for desktop and mobile drawer.
- **[Frontend Module 02: 'Meet Our Animals' Gallery & 4-Part Profile Tabs](tutorials/TUTORIAL_FE_02_MEET_OUR_ANIMALS_AND_PROFILE_TABS.md)**: Subcategory filtering (Adoptable vs In Rehab) and the 4-part profile tab layout.
- **[Frontend Module 03: Personalized Sponsorship & Rehab Needs UI](tutorials/TUTORIAL_FE_03_PERSONALIZED_SPONSORSHIP_AND_NEEDS_UI.md)**: Orangutan Project style animal chooser, RM30 tier perks, and 4-category wishlist UI.

#### 📚 General Full-Stack Masterclasses
- **[Full-Stack Architecture Masterclass](tutorials/TUTORIAL_FULLSTACK_DEVELOPMENT.md)**: Deep dive into Next.js App Router, React Server Actions, and resilient store patterns.
- **[Tutorial 01: Medical Milestone Admin Subsystem](tutorials/TUTORIAL_01_MEDICAL_MILESTONE_ADMIN.md)**: Building clinical timeline milestones, modal dialogs, and chronological sorting.
- **[Tutorial 02: Live Notifications Dispatcher](tutorials/TUTORIAL_02_LIVE_NOTIFICATIONS_DISPATCHER.md)**: Automated applicant emails, Malaysian phone number formatting, and WhatsApp dispatch.
- **[Tutorial 03: Multilingual Expansion](tutorials/TUTORIAL_03_MULTILINGUAL_EXPANSION.md)**: Implementing zero-dependency type-safe dictionaries, bilingual state persistence, and toggles.
- **[Tutorial 04: Shelter Analytics & LHDN Tax Export](tutorials/TUTORIAL_04_SHELTER_ANALYTICS_AND_LHDN_EXPORT.md)**: Metrics aggregation, RFC-4180 CSV export engine, and formula injection sanitization.

---

### 📘 Operational Runbooks
- **[TNRM, Rehabilitation & Sponsorship Operations](runbooks/RUNBOOK_TNRM_AND_SPONSORSHIP_OPERATIONS.md)**: Campus TNRM tracking, Rehabilitation House updates, RM30 sponsor photo/video dispatches, and wishlist management.
- **[Operational Runbook & Disaster Recovery](runbooks/OPERATIONAL_RUNBOOK.md)**: Day-to-day operations, health checks, rate limiting, audit inspection, and troubleshooting.
- **[Donations & LHDN Tax e-Receipts](runbooks/RUNBOOK_DONATION_AND_LHDN_TAX_RECEIPTS.md)**: DuitNow QR, bank transfer verification, statutory LHDN Subsection 44(6) tax receipts, and ROS reporting.
- **[Prisma Database Setup & Migrations](runbooks/RUNBOOK_PRISMA_DATABASE_SETUP.md)**: Step-by-step PostgreSQL schema migrations, fallback mechanisms, and seed automation.
- **[Production Media & Pet Image Storage](runbooks/RUNBOOK_PRODUCTION_MEDIA_STORAGE.md)**: Image pipeline, local uploads, AWS S3 / Supabase storage adapters, and Sharp optimization.
- **[Email Deliverability & Resend Integration](runbooks/EMAIL_DELIVERABILITY_BEST_PRACTICES.md)**: Transactional email delivery, SPF/DKIM/DMARC setup, and webhook delivery.

---

### 📦 Archives & Historical Records
- **[Historical Archives & Task Logs](archives/)**: Past task records, feature activation reviews, and release notes.
