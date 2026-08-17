# Engineering Handoff & Stepped Tutorial Index

- **Status as of**: 2026-08-16
- **Framework**: Next.js 16.3.1 (Turbopack, App Router), React 19.2.8, TypeScript 5 (Strict Mode), Prisma 7.9.1, PostgreSQL.
- **Repository Location**: `c:\Users\User\pet-shelter`
- **Quality Baseline**: **24 Vitest suites (183 unit & integration tests, 100% passing)**.

---

## 📚 Stepped Guided Tutorials

All pending roadmap features have been converted into step-by-step interactive engineering tutorials:

| Tutorial | Target Feature | Key Skills & Files |
|---|---|---|
| 🎓 [`TUTORIAL_FULLSTACK_DEVELOPMENT.md`](file:///c:/Users/User/pet-shelter/documents/TUTORIAL_FULLSTACK_DEVELOPMENT.md) | **Full-Stack Architecture Masterclass** | RSC vs Client Components, Server Actions, Dual-Layer Storage Pattern |
| 🩺 [`TUTORIAL_01_MEDICAL_MILESTONE_ADMIN.md`](file:///c:/Users/User/pet-shelter/documents/TUTORIAL_01_MEDICAL_MILESTONE_ADMIN.md) | **Staff Medical Milestone Admin Editor** | Server Actions, Prisma mutations, Base UI Dialogs, Chronological Sorting |
| 📲 [`TUTORIAL_02_LIVE_NOTIFICATIONS_DISPATCHER.md`](file:///c:/Users/User/pet-shelter/documents/TUTORIAL_02_LIVE_NOTIFICATIONS_DISPATCHER.md) | **Email (Resend) & WhatsApp Dispatcher** | Malaysian Phone Normalization, HTML Email Templates, Mock Fallbacks |
| 🌐 [`TUTORIAL_03_MULTILINGUAL_EXPANSION.md`](file:///c:/Users/User/pet-shelter/documents/TUTORIAL_03_MULTILINGUAL_EXPANSION.md) | **Multi-Language Expansion (Mandarin & Tamil)** | TypeScript Indexed Dictionaries, React Context, Accessible 4-Way Toggle |
| 📊 [`TUTORIAL_04_SHELTER_ANALYTICS_AND_LHDN_EXPORT.md`](file:///c:/Users/User/pet-shelter/documents/TUTORIAL_04_SHELTER_ANALYTICS_AND_LHDN_EXPORT.md) | **Shelter Operations & Tax Audit Analytics** | Server Aggregation, RFC-4180 CSV, Formula Injection Protection |

---

## 🗄️ Active Runbooks & References

- 📖 **Operational Runbook**: [`documents/OPERATIONAL_RUNBOOK.md`](file:///c:/Users/User/pet-shelter/documents/OPERATIONAL_RUNBOOK.md)
- 🗄️ **Database & Prisma Guide**: [`documents/GUIDE_PRISMA_AND_NEON_ARCHITECTURE.md`](file:///c:/Users/User/pet-shelter/documents/GUIDE_PRISMA_AND_NEON_ARCHITECTURE.md)
- 💳 **Donations & LHDN Tax Runbook**: [`documents/RUNBOOK_DONATION_AND_LHDN_TAX_RECEIPTS.md`](file:///c:/Users/User/pet-shelter/documents/RUNBOOK_DONATION_AND_LHDN_TAX_RECEIPTS.md)
- 🖼️ **Media Storage Runbook**: [`documents/RUNBOOK_PRODUCTION_MEDIA_STORAGE.md`](file:///c:/Users/User/pet-shelter/documents/RUNBOOK_PRODUCTION_MEDIA_STORAGE.md)
- 🎨 **Design System Tokens**: [`DESIGN_SYSTEM.md`](file:///c:/Users/User/pet-shelter/DESIGN_SYSTEM.md)
- 🗃️ **Archived Historical Reports**: [`archives/`](file:///c:/Users/User/pet-shelter/archives)

---

## 🏗️ Completed Milestones Summary

1. **🌐 Bilingual Localization Engine (`/ms` & `/en`)**:
   - Zero-dependency type-safe dictionary (`src/lib/i18n/translations.ts`) with 100% key parity.
   - `LanguageProvider.tsx` with lazy state initializer, `localStorage` caching, and cookie synchronization.
   - Accessible `[ EN | BM ]` toggle in Desktop Navbar, Mobile Drawer, and Footer.

2. **🩺 Rescue Intake & Clinical Medical Timeline**:
   - Chronological clinical milestones across all 8 seeded pets (`src/data/pets.json`).
   - Dynamic synthetic generator (`src/lib/medicalTimeline.ts`) with category filtering (*Intake, Diagnostics, Treatments, Vaccinations, Surgery, Clearance*).
   - Integrated into `/pets/[id]` (`PetDetailView.tsx`) and quick-view modals (`PetDetailDialog.tsx`).

3. **📊 LHDN & ROS 1-Click CSV Export Engine**:
   - Form B/BE tax filing exports with NRIC/Tax ID and formula injection protection (`src/lib/exportCsv.ts`).

4. **📱 LAN Cross-Device Testing**:
   - Configured `allowedDevOrigins` in `next.config.ts` for LAN mobile testing.

---

## 🧪 Verified Quality Gates

```bash
# 1. Vitest Unit & Integration Suites (24 suites, 183 tests)
npm test -- --run
✓ 24 passed (24)
✓ 183 passed (183) — 100% passing

# 2. Strict Mode TypeScript Check
npx tsc --noEmit
✓ Exited with code 0

# 3. ESLint Code Cleanliness
npm run lint
✓ Exited with code 0

# 4. Next.js 16 Turbopack Production Build
npm run build
✓ 25/25 static & dynamic routes compiled cleanly in 1.87s
```
