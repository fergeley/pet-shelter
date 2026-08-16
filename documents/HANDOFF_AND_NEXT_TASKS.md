# Engineering Handoff & Next Steps Roadmap

- **Status as of**: 2026-08-16
- **Stack**: Next.js 16.3.1 (App Router + Turbopack), React 19.2.8, TypeScript 5, Tailwind CSS v4, Prisma 7.9.1, PostgreSQL, Vitest 3.2.
- **Repository Location**: `c:\Users\User\pet-shelter`
- **Full-Stack Engineering Tutorial**: [`documents/TUTORIAL_FULLSTACK_DEVELOPMENT.md`](file:///c:/Users/User/pet-shelter/documents/TUTORIAL_FULLSTACK_DEVELOPMENT.md)
- **Primary Operational Guide**: [`documents/OPERATIONAL_RUNBOOK.md`](file:///c:/Users/User/pet-shelter/documents/OPERATIONAL_RUNBOOK.md)
- **Donation & Sponsorship Handoff**: [`documents/HANDOFF_DONATION_AND_SPONSORSHIP_SUBSYSTEM.md`](file:///c:/Users/User/pet-shelter/documents/HANDOFF_DONATION_AND_SPONSORSHIP_SUBSYSTEM.md)
- **Donation & LHDN Tax Runbook**: [`documents/RUNBOOK_DONATION_AND_LHDN_TAX_RECEIPTS.md`](file:///c:/Users/User/pet-shelter/documents/RUNBOOK_DONATION_AND_LHDN_TAX_RECEIPTS.md)

---

## 1. System Architecture & Completed Milestones

```
┌─────────────────────────────────────────────────────────────────┐
│                       Next.js App Router                        │
│  Public Views (/, /pets, /pets/[id], /donate, /applications/track)│
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
│  - Declarative RBAC Guards  │   │    - Dual In-Memory Fallback  │
│  - Bilingual i18n Engine    │   │    - RFC-4180 CSV Engine      │
│  - Clinical Timeline Normal │   │    - Sliding Rate Limiting    │
└─────────────────────────────┘   └───────────────────────────────┘
```

### Completed & Production-Hardened Components

1. **🌐 Bilingual Localization Engine (`/ms` & `/en`)**:
   - [`src/lib/i18n/translations.ts`](file:///c:/Users/User/pet-shelter/src/lib/i18n/translations.ts): Complete bilingual translation dictionary (`en` & `ms`) with 100% key parity across `nav`, `common`, `hero`, `home`, `pets`, `petDetail`, `medicalTimeline`, `adoptionForm`, `tracking`, `donations`, `bulletins`, and `footer`.
   - [`src/components/LanguageProvider.tsx`](file:///c:/Users/User/pet-shelter/src/components/LanguageProvider.tsx): React context with lazy state initialization, `localStorage` caching, and cookie synchronization.
   - [`src/components/LanguageToggle.tsx`](file:///c:/Users/User/pet-shelter/src/components/LanguageToggle.tsx): Accessible `[ EN | BM ]` toggle button integrated into desktop Navbar, mobile drawer sheet, and the global footer.

2. **🩺 Rescue Intake & Clinical Medical Care Timeline**:
   - [`src/types/pet.ts`](file:///c:/Users/User/pet-shelter/src/types/pet.ts): Added `MedicalTimelineCategory` and `MedicalTimelineEvent`.
   - [`src/data/pets.json`](file:///c:/Users/User/pet-shelter/src/data/pets.json): Seeded realistic clinical milestones for all 8 pets with bilingual fields (`titleMs`, `descriptionMs`, `badgeMs`).
   - [`src/lib/medicalTimeline.ts`](file:///c:/Users/User/pet-shelter/src/lib/medicalTimeline.ts): Normalization, chronological sorting, and deterministic fallback generator with defensive optional chaining.
   - [`src/components/MedicalTimeline.tsx`](file:///c:/Users/User/pet-shelter/src/components/MedicalTimeline.tsx): Responsive milestone timeline component with category filters (*All, Rescue Intake, Diagnostics, Treatments, Vaccinations, Surgery, Clearance*) and vet credentials.
   - Embedded into both [`PetDetailView.tsx`](file:///c:/Users/User/pet-shelter/src/components/PetDetailView.tsx) (`/pets/[id]`) and [`PetDetailDialog.tsx`](file:///c:/Users/User/pet-shelter/src/components/PetDetailDialog.tsx).

3. **📊 LHDN & ROS 1-Click CSV Export Engine ([`src/lib/exportCsv.ts`](file:///c:/Users/User/pet-shelter/src/lib/exportCsv.ts))**:
   - Automated CSV download for Malaysian tax filing (donor IC, receipt sequences, MYR amounts) and audit trails in `src/components/admin/AuditLogViewer.tsx`.
   - Formula injection protection and UTF-8 BOM encoding for Excel compatibility.

4. **📱 Local Area Network (LAN) Testing**:
   - Added `allowedDevOrigins` in [`next.config.ts`](file:///c:/Users/User/pet-shelter/next.config.ts) for `192.168.100.12` and subnet devices.

---

## 2. Verified Quality Baseline

| Verification Gate | Result | Command |
|---|---|---|
| **Vitest Test Suites** | ✅ **24 / 24 suites (183 tests) 100% Passing** | `npm test -- --run` |
| **TypeScript Strict Mode** | ✅ **0 Errors (0 `any` escapes)** | `npx tsc --noEmit` |
| **ESLint Cleanliness** | ✅ **0 Errors** | `npm run lint` |
| **Next.js Production Build** | ✅ **25 / 25 Static & Dynamic Routes Built Cleanly in 1.87s** | `npm run build` |

---

## 3. Recommended Backlog for Next Session

1. **Staff Medical Milestone Admin Editor**:
   - Follow the step-by-step guide in [`documents/TUTORIAL_FULLSTACK_DEVELOPMENT.md`](file:///c:/Users/User/pet-shelter/documents/TUTORIAL_FULLSTACK_DEVELOPMENT.md) to add form controls in `/admin/pets` allowing staff to record new clinical milestones.
2. **Email & SMS Notification Dispatcher**:
   - Connect live SMTP/Resend provider or WhatsApp Business API to deliver instant Meet & Greet scheduling notifications.
3. **Multi-Language Expansion (Optional)**:
   - If desired, add Simplified Chinese (`zh-MY`) and Tamil (`ta-MY`) dictionaries to `src/lib/i18n/translations.ts`.
