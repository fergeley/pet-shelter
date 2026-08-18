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

---

### 📋 Sprint Tasks & Collaboration Backlogs
- **[Sprint Plan & Task Division (Backend vs Frontend)](tasks/SPRINT_PLAN_BACKEND_AND_FRONTEND.md)**: Master task breakdown, domain assignments, acceptance criteria, and DoD.
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
