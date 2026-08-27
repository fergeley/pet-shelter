# Target — Medical Milestone & Clinical History Admin Editor

**Date**: 2026-08-27  
**Branch**: eat/tnrm-rehabilitation  
**Baseline**: 41 unit test files / 524 tests green · 
px tsc --noEmit clean  
**Related Specs**:
- [Tutorial 01: Medical Milestone Admin Subsystem](../tutorials/TUTORIAL_01_MEDICAL_MILESTONE_ADMIN.md)
- [Handoff: Pet History Persistence](HANDOFF_PET_HISTORY_PERSISTENCE.md)
- [Sprint Plan: Backend & Frontend](SPRINT_PLAN_BACKEND_AND_FRONTEND.md)

---

## 1. 🎯 Objective & Problem Context

The data layer, Prisma schema, and public animal profile view (PetDetailView.tsx and MedicalTimeline.tsx) now fully support nested clinical milestones (medicalTimeline[]) and narrative recovery updates (updates[]).

However, the admin portal form ([src/components/admin/PetFormDialog.tsx](file:///c:/Users/User/pet-shelter/src/components/admin/PetFormDialog.tsx)) currently lacks an interactive UI for staff to manage these collections. Staff can edit basic animal attributes (weight, age, status, rehab stage), but cannot add, edit, reorder, or remove clinical events (such as vaccinations, surgeries, diagnostics, and clearance milestones) or publish photo recovery updates without manually editing raw database rows or JSON fixtures.

---

## 2. 📋 Scope of Work

### Phase 1: Interactive Clinical Timeline Editor in PetFormDialog.tsx
- Add a collapsible accordion section: **"Clinical Timeline & Veterinary Milestones"**.
- Provide a dynamic list builder allowing staff to add multiple chronological events:
  - date: Date picker formatted as YYYY-MM-DD (validated via isoDateSchema).
  - category: Select dropdown mapped to MEDICAL_TIMELINE_CATEGORY_VALUES (intake, diagnostic, 	reatment, accination, surgery, clearance).
  - 	itle & 	itleMs: Bilingual event headline (e.g., "Orthopedic Surgery Clearance" / "Pembedahan Ortopedik").
  - description & descriptionMs: Detailed clinical notes and care instructions.
  - eterinarian: Attending vet name or clinic reference (e.g., "Dr. Teo (Gasing Vet)").
  - erified: Boolean checkbox for official veterinary sign-off.
  - adge / adgeMs: Optional highlight pill (e.g., "Core Vaccinations Completed").
- Support drag-and-drop or up/down ordering and item deletion with confirmation.

### Phase 2: Animal Recovery Updates Editor in PetFormDialog.tsx
- Add an **"Animal Recovery Updates Feed"** list builder:
  - date: YYYY-MM-DD.
  - 	itle & 	itleMs: Update headline.
  - content & contentMs: Narrative text for donors and sponsors.
  - category: Select (medical, ehabilitation, milestone, socialization).
  - image: Optional photo URL or direct file upload linking to the update.

### Phase 3: Form Controller & Validation Integration
- Connect state in useForm() with zodResolver(petFormSchema).
- Ensure payloads pass through sortHistoryByDate() before form submission.
- Verify that isRehabilitationStatus(status) rules remain enforced.

---

## 3. 🧪 Testing & Verification Plan

1. **Unit Tests (	ests/unit/petHistory.test.ts)**:
   - Verify that adding multiple medical milestones and updates to a pet payload serializes properly.
   - Assert validation fails on duplicate milestone IDs or invalid date strings.
   - Verify chronological ascending sorting of submitted timeline entries.
2. **Quality Gates**:
   - 
pm test: all unit tests pass.
   - 
px tsc --noEmit: 0 TypeScript errors.
   - 
pm run lint: 0 ESLint errors.
