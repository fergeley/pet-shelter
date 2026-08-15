# Phase 3: Shelter Analytics & Performance Metrics Dashboard

> **Priority:** Low / Optional Backlog  
> **Target Audience:** Shelter Administrators & Adoption Coordinators  
> **Status:** Planned / Future Enhancement  

---

## 1. Objective
Provide shelter administrators and adoption coordinators with a consolidated analytics dashboard at `/admin/analytics`. The dashboard aggregates intake-to-adoption velocity, application conversion metrics, species population statistics, and automated compliance reporting for animal welfare grants.

---

## 2. Scope & Functional Requirements

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
1. **Summary KPI Metric Cards:**
   - 4-column metric grid displaying *Total Intakes*, *Active Sanctuary Population*, *Total Adoptions*, and *Avg. Days to Adoption*.
2. **Interactive Visualizations:**
   - **Monthly Trends Chart:** Bar/line chart comparing Monthly Intake vs Successful Adoptions.
   - **Species & Age Demographics:** Donut chart showing Dog vs Cat ratio and puppy/young/adult/senior distribution.
   - **Application Conversion Funnel:** Visual breakdown of `SUBMITTED` → `UNDER_REVIEW` → `APPROVED` / `REJECTED`.
3. **Date Range & Filter Controls:**
   - Preset time windows: *Last 30 Days*, *Last 90 Days*, *Year-to-Date (YTD)*, and *All Time*.

### C. Grant & NGO Reporting Export (`src/lib/exportReport.ts`)
- Automated summary export in CSV and printable PDF-ready format.
- Preformatted summary tables suitable for Malaysian Department of Veterinary Services (DVS) and animal welfare foundation grant applications.

### D. Security & Access Control
- Restrict dashboard access to `ADMIN` and `COORDINATOR` roles via session validation:
  ```typescript
  assertAuthorized(session, [ROLES.ADMIN, ROLES.COORDINATOR]);
  ```

---

## 3. Implementation Plan & Deliverables

| Step | Deliverable | File Path |
| :--- | :--- | :--- |
| **3.1** | Aggregation logic & server actions | `src/actions/analytics.ts` |
| **3.2** | Analytics dashboard page & KPI cards | `src/app/admin/analytics/page.tsx` |
| **3.3** | Reusable chart components | `src/components/admin/AnalyticsCharts.tsx` |
| **3.4** | Navigation link addition in Admin sidebar | `src/components/admin/AdminNav.tsx` |
| **3.5** | Unit & Integration Test Suite | `tests/unit/analytics.test.ts` |

---

## 4. Verification & Testing Checklist
- [ ] Metric calculations handle empty database / zero-division edge cases gracefully.
- [ ] Dates parsed in ISO format without client-side timezone hydration mismatches.
- [ ] RBAC enforcement: `STAFF` and `VOLUNTEER` accounts receive unauthorized error when accessing `/admin/analytics`.
- [ ] Export utility generates valid CSV without corrupted Unicode characters.
- [ ] `npm run test`, `npm run lint`, and `npm run build` pass with 0 errors.
