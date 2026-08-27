# Target — Shelter Analytics & Statutory LHDN Tax Audit Export

**Date**: 2026-08-27  
**Branch**: eat/tnrm-rehabilitation  
**Baseline**: 41 unit test files / 524 tests green · 
px tsc --noEmit clean  
**Related Specs**:
- [Tutorial 04: Shelter Analytics & LHDN Tax Export](../tutorials/TUTORIAL_04_SHELTER_ANALYTICS_AND_LHDN_EXPORT.md)
- [Runbook: Donations & LHDN Tax Receipts](../runbooks/RUNBOOK_DONATION_AND_LHDN_TAX_RECEIPTS.md)
- [Target: Schema Type Integrity](TARGET_SCHEMA_TYPE_INTEGRITY.md)

---

## 1. 🎯 Objective & Problem Context

As an officially registered Malaysian NGO (*Persatuan Harapan Haiwan Terbiar Selangor*), the shelter is required by the Inland Revenue Board of Malaysia (LHDN) to maintain gapless, immutable records of all Section 44(6) tax-deductible donations, as well as periodic audit reporting on intake capacity and adoption velocity.

This target implements:
1. **Statutory LHDN Annual CSV/Excel Export**: Formats donor records strictly per LHDN Subsection 44(6) specifications, with robust CSV formula injection protection (RFC-4180).
2. **Shelter Analytics Metrics Engine**: Aggregates live operational metrics across donations, animal rehabilitation capacity, and adoption timelines.

---

## 2. 📋 Scope of Work

### Phase 1: CSV Formula Injection Sanitization (src/lib/presentation/exportCsv.ts)
- Ensure all exported textual data (donor names, notes, references) starting with formula trigger characters (=, +, -, @, \t, \r) are automatically escaped with a leading apostrophe '.
- Enforce strict RFC-4180 field quoting (handling embedded quotes, commas, CRLF delimiters).

### Phase 2: LHDN Statutory Export Action
- Create exportLhdnAnnualReport(year: number):
  - Output Columns: Receipt No, Date, Donor Full Name, NRIC / Passport / SSM No, Tax Deductible Amount (MYR), Payment Channel (DuitNow/FPX/Bank Transfer), Shelter ROS Reg No, LHDN Approval Ref.
  - Converts integer Sen directly to formatted Ringgit (senToRinggit()) without floating point rounding errors.

### Phase 3: Analytics Dashboard & Server Action
- Implement getShelterAnalyticsAction() in src/actions/analytics.ts:
  - **Financial Metrics**: Total YTD tax-deductible contributions, active monthly sponsor count, average donation per donor.
  - **Animal Care & TNRM**: Current count of animals in recovery/rehabilitation vs adoptable, total TNRM community cats/dogs sterilized.
  - **Adoption Velocity**: Average intake-to-adoption duration (in days) across species.
- Provide a summary view at /admin/audit or dedicated /admin/analytics.

---

## 3. 🧪 Testing & Verification Plan

1. **Unit Tests**:
   - 	ests/unit/exportCsv.test.ts: Test formula injection prevention and RFC-4180 compliance.
   - 	ests/unit/analytics.test.ts: Verify metric aggregation calculations against seeded dataset.
2. **Quality Gates**:
   - 
pm test green, 
px tsc --noEmit clean, 
pm run lint clean.
