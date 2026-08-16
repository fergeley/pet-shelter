# Engineering Handoff & Next Steps Roadmap

- **Status as of**: 2026-08-16
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
┌─────────────────────────────────────────────────────────────────┐
│                       Next.js App Router                        │
│  Public Views (/, /pets, /donate, /applications/track, /terms)  │
│  Admin Dashboard (/admin/pets, /admin/applications, /admin/audit)│
└────────────────────────────────┬────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│                      Server Actions Layer                       │
│  src/actions/{pets, applications, auth, audit, settings}.ts     │
└──────────────┬──────────────────────────────────┬───────────────┘
               │                                  │
┌──────────────▼──────────────┐   ┌───────────────▼───────────────┐
│     Security & Domain       │   │    Resilient Storage Engine   │
│  - HMAC-SHA256 Sessions     │   │    - PostgreSQL (Prisma 7)    │
│  - Declarative RBAC Guards  │   │    - RFC-4180 CSV Engine      │
│  - Anti-Formula Injection   │   │    - Resend Email & Auditing  │
│  - Privacy-Safe Lookups     │   │    - Sliding Rate Limiting    │
└─────────────────────────────┘   └───────────────────────────────┘
```

### Completed & Production-Hardened Components
* **1-Click CSV Tax & Audit Export Engine ([`src/lib/exportCsv.ts`](file:///c:/Users/User/pet-shelter/src/lib/exportCsv.ts))**:
  - Malaysian Inland Revenue Board (LHDN) Subsection 44(6) Form B/BE compliance exports with donor IC/Tax ID, receipt sequence numbers, and two-decimal currency formatting (`RM 50.00`).
  - Registrar of Societies (ROS) AGM compliance audit trail CSV exports.
  - RFC-4180 compliant quoting, UTF-8 BOM encoding for Microsoft Excel / Apple Numbers, and formula injection protection (`=, +, -, @, \t, \r`).
* **Admin Audit & Security Controller ([`src/components/admin/AuditLogViewer.tsx`](file:///c:/Users/User/pet-shelter/src/components/admin/AuditLogViewer.tsx))**:
  - 4 quick-filter tabs: `All Records`, `LHDN Tax Receipts` (with live count badges & formatted ringgit amounts), `Adoptions & Pets`, `Auth & Security`.
  - Scalable server action [`fetchAuditLogsAction`](file:///c:/Users/User/pet-shelter/src/actions/audit.ts) supporting up to 1,000 records to prevent year-end tax data truncation.
* **Lean Community Support & Urgent Foster Hub ([`src/app/page.tsx`](file:///c:/Users/User/pet-shelter/src/app/page.tsx), [`src/components/BulletinFeed.tsx`](file:///c:/Users/User/pet-shelter/src/components/BulletinFeed.tsx))**:
  - Direct WhatsApp links for Volunteer Coordination and Temporary Foster Care.
  - Walk-in sanctuary visiting hours (Tue–Sun, 10:00 AM – 5:00 PM; Closed Mondays for deep cleaning).
  - Urgent Foster / Medical Need bulletins published via `AdminBulletinModal`.
* **Anti-AI / Anti-"Vibecoded" Aesthetic Audit**:
  - Completely eradicated sparkle icon tropes (`Sparkles` 100% eliminated).
  - Replaced fake stock portrait testimonials with authentic registered society veterinary protocols (PPM-012-10-18042016).
  - Replaced rainbow badge icon palettes and checkmark bullet lists with clean, high-contrast, editorial typography.
* **Statutory Compliance & Legal Pages ([`src/app/privacy/page.tsx`](file:///c:/Users/User/pet-shelter/src/app/privacy/page.tsx), [`src/app/terms/page.tsx`](file:///c:/Users/User/pet-shelter/src/app/terms/page.tsx))**:
  - Statutory Malaysian Personal Data Protection Act (**PDPA 2010**) Privacy Notice.
  - Non-commercial Shelter Adoption Agreement, premise safety standards, and unconditional return policy.
* **Public Application Tracking Portal ([`src/app/applications/track/page.tsx`](file:///c:/Users/User/pet-shelter/src/app/applications/track/page.tsx))**:
  - Adopter self-service lookup by Reference ID + Email with 4-stage visual progress stepper and deep links.
* **Test Suite**: **22 Vitest test files (171 unit tests, 100% passing rate, 0 unawaited promise warnings)**.
* **Quality Gates**: `npx tsc --noEmit` (0 errors), `npm run lint` (0 errors), `npm run build` (25/25 routes statically/dynamically pre-rendered).

---

## 2. Future Enhancements Backlog (Prioritized)

### [PHASE-01] Bilingual Toggle: Bahasa Malaysia & English (`/ms` & `/en`)
* **Priority**: High
* **Goal**: Expand community reach across Selangor and local municipal councils with full Bahasa Malaysia localization for adoption screening, volunteer guidelines, and sanctuary notices.

---

### [PHASE-02] Rescue Intake & Veterinary Timeline on Pet Profile (`/pets/[id]`)
* **Priority**: Medium
* **Goal**: Display an interactive medical and rehabilitation timeline on individual pet profile pages (intake date, vaccination dates, spay/neuter surgery record, behavior milestones).

---

### [PHASE-03] In-Kind Wishlist & Sanctuary Inventory Tracker
* **Priority**: Low / Lean
* **Goal**: Lightweight real-time indicator on the `#support` section showing which physical supplies are urgently needed (e.g. "Puppy Kibble: Low", "Fleece Towels: Sufficient").

---

## 3. Ready-to-Use Copy-Paste Prompt for AI Agents

You can hand off the following prompt directly to your next AI coding assistant session:

```markdown
## Project Overview
You are continuing development on **Hope for Strays** (`c:\Users\User\pet-shelter`), a high-performance Pet Shelter & Adoption Platform built with:
- **Framework**: Next.js 16.3.1 (Turbopack, App Router) & React 19.2.8
- **Language**: TypeScript 5 (Strict Mode, 0 `any` escapes)
- **Database & ORM**: PostgreSQL with Prisma 7.9.1 (`@prisma/adapter-pg`, connection pooling) & dual-layer in-memory fallback
- **Styling**: Tailwind CSS v4 & Lucide React
- **Testing**: Vitest (22 test files, 171 tests, 100% passing)
- **Legal & Compliance**: Malaysian LHDN Subsection 44(6) Tax Exemption Ref `LHDN.01/35/42/51/179-6.4912`, ROS Reg `PPM-012-10-18042016`, PDPA 2010

---

## Current Status & Recent Accomplishments
All recent milestones are committed atomically and verified:
1. **LHDN & ROS 1-Click CSV Export Engine**: Automated CSV download for Malaysian tax filing (donor IC, receipt sequences, MYR amounts) and audit trails in `src/lib/exportCsv.ts` and `src/components/admin/AuditLogViewer.tsx`.
2. **Lean Community Action & Urgent Foster Hub**: Dedicated volunteer roles, sanctuary walk-in hours, direct WhatsApp coordination, and emergency foster bulletins on `/` and `/bulletins`.
3. **Anti-AI Aesthetic Polish**: Removed all 30 "vibecoded" tropes (zero `Sparkles`, removed fake testimonials, replaced rainbow badge icons and checkmark lists with crisp editorial typography).
4. **Statutory Legal Pages**: Added `/privacy` (Malaysian PDPA 2010 compliance) and `/terms` (Shelter adoption agreement & welfare standards).
5. **Zero-Error Quality Gates**: 25/25 routes compiled in Next.js production build, 171/171 unit tests passing across 22 suites, 0 TypeScript/ESLint errors.

---

## Next Recommended Task: [PHASE-01] Bilingual Toggle (Bahasa Malaysia & English) or [PHASE-02] Vet Timeline
Choose between:
1. **Bilingual Localization (`/ms` & `/en`)**:
   - Provide seamless Bahasa Malaysia / English toggle for public pages (`/`, `/pets`, `/donate`, `/applications/track`).
   - Translate adoption application forms, shelter protocols, and FAQ sections.
2. **Rescue Intake & Medical Care Timeline on Pet Detail (`/pets/[id]`)**:
   - Add an interactive chronological medical care timeline (rescue intake, core vaccinations, spay/neuter surgery, recovery milestone).

---

## Quality Gates Checklist Before Finishing Any Task
- `npm test -- --run` (must pass 171+ tests across 22+ suites with 0 unawaited promise warnings)
- `npx tsc --noEmit` (must pass with 0 errors)
- `npm run lint` (must pass with 0 errors)
- `npm run build` (must compile cleanly with 25/25 routes pre-rendered)
```
