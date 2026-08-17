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
- **[System Architecture Blueprint](architecture/ARCHITECTURE_BLUEPRINT.md)**: High-level system topology, Server Components vs Client Components, security layers, and data flows.
- **[Database & ORM Architecture Guide](architecture/GUIDE_PRISMA_AND_NEON_ARCHITECTURE.md)**: PostgreSQL schema, Neon branching, Prisma ORM setup, connection pooling, and in-memory dual-layer storage pattern.

---

### 📘 Operational Runbooks
- **[Operational Runbook & Disaster Recovery](runbooks/OPERATIONAL_RUNBOOK.md)**: Day-to-day operations, health checks, rate limiting, audit inspection, and troubleshooting.
- **[Donations & LHDN Tax e-Receipts](runbooks/RUNBOOK_DONATION_AND_LHDN_TAX_RECEIPTS.md)**: DuitNow QR, bank transfer verification, statutory LHDN Subsection 44(6) tax receipts, and ROS reporting.
- **[Prisma Database Setup & Migrations](runbooks/RUNBOOK_PRISMA_DATABASE_SETUP.md)**: Step-by-step PostgreSQL schema migrations, fallback mechanisms, and seed automation.
- **[Production Media & Pet Image Storage](runbooks/RUNBOOK_PRODUCTION_MEDIA_STORAGE.md)**: Image pipeline, local uploads, AWS S3 / Supabase storage adapters, and Sharp optimization.
- **[Email Deliverability & Resend Integration](runbooks/EMAIL_DELIVERABILITY_BEST_PRACTICES.md)**: Transactional email delivery, SPF/DKIM/DMARC setup, and webhook delivery.

---

### 🎓 Step-by-Step Technical Tutorials
- **[Full-Stack Architecture Masterclass](tutorials/TUTORIAL_FULLSTACK_DEVELOPMENT.md)**: Deep dive into Next.js App Router, React Server Actions, and resilient store patterns.
- **[Tutorial 01: Medical Milestone Admin Subsystem](tutorials/TUTORIAL_01_MEDICAL_MILESTONE_ADMIN.md)**: Building clinical timeline milestones, modal dialogs, and chronological sorting.
- **[Tutorial 02: Live Notifications Dispatcher](tutorials/TUTORIAL_02_LIVE_NOTIFICATIONS_DISPATCHER.md)**: Automated applicant emails, Malaysian phone number formatting, and WhatsApp dispatch.
- **[Tutorial 03: Multilingual Expansion](tutorials/TUTORIAL_03_MULTILINGUAL_EXPANSION.md)**: Implementing zero-dependency type-safe dictionaries, bilingual state persistence, and toggles.
- **[Tutorial 04: Shelter Analytics & LHDN Tax Export](tutorials/TUTORIAL_04_SHELTER_ANALYTICS_AND_LHDN_EXPORT.md)**: Metrics aggregation, RFC-4180 CSV export engine, and formula injection sanitization.

---

### 📦 Archives & Historical Records
- **[Historical Archives & Task Logs](archives/)**: Past task records, feature activation reviews, and release notes.
