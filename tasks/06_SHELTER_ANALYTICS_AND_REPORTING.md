# [KIV] Phase 3: Shelter Analytics & Performance Metrics Dashboard

> **Status:** **KIV (Keep In View) — Paused / Postponed until further notice**  
> **Reason:** Core web analytics and performance telemetry are handled by `@vercel/analytics` and `@vercel/speed-insights`. Specialized shelter analytics are shelved unless operational reporting is explicitly requested.

---

## 1. Objective
Provide shelter administrators and adoption coordinators with a consolidated analytics dashboard at `/admin/analytics`. The dashboard aggregates intake-to-adoption velocity, application conversion metrics, species population statistics, and automated compliance reporting for animal welfare grants.

---

## 2. Scope & Functional Requirements (Archived for Reference)

### A. Analytics Server Actions (`src/actions/analytics.ts`)
Implement server-side aggregation utilities with in-memory caching and Prisma database support:
- `getShelterMetrics(dateRange?: DateRangeFilter)`:
  - **Total Rescued:** Total lifetime pet count intake.
  - **Currently in Care:** Pets with `Available` or `Pending` status.
  - **Adoption Success Rate:** Percentage of total intakes successfully adopted.
  - **Average Length of Stay (LOS):** Mean days from `intakeDate` to adoption date.
  - **Application Velocity:** Average time from application submission to approval/rejection.
- `getAdoptionTrends(months?: number)`:
  - Monthly time-series data of Intakes vs Adoptions for line/bar visualization.
- `getSpeciesDistribution()`:
  - Breakdown by Dogs, Cats, and Special Care animals.

### B. Admin Analytics Dashboard UI (`src/app/admin/analytics/page.tsx`)
Create a responsive, WCAG-compliant analytics dashboard:
- **KPI Summary Cards:** Clean grid displaying core metrics with percentage trends.
- **Date Range Selector:** Quick filter pills (`7D`, `30D`, `90D`, `1Y`, `All-Time`).
- **Population Composition:** Visual progress gauges for shelter capacity.

### C. Compliance & Grant Reporting (`src/lib/exportReport.ts`)
- Automated CSV download for local authorities (Malaysian Department of Veterinary Services / DVS compliance).
- Formatted summary for grant applications and NGO audits.
