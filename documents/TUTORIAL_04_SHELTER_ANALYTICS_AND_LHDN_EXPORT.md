# Guided Tutorial 04: Shelter Analytics & LHDN Tax Audit Engine

**Target Feature**: Build a real-time shelter operations and financial analytics dashboard with monthly adoption trends, average length of stay (ALOS), occupancy breakdown, and 1-click Malaysian LHDN Subsection 44(6) tax audit CSV generation.  
**Skill Focus**: Server Aggregation Queries, Metric Cards, RFC-4180 CSV Generation, Formula Injection Protection, and React Server Components.

---

## 🎯 Learning Objectives

By completing this stepped tutorial, you will master:
1. Writing performant server-side data aggregation algorithms in TypeScript.
2. Generating RFC-4180 compliant CSVs with UTF-8 BOM encoding for Excel/Numbers.
3. Protecting financial CSV downloads against Spreadsheet Formula Injection vulnerabilities.
4. Structuring accessible metric summary cards following `DESIGN_SYSTEM.md`.
5. Calculating key animal shelter performance indicators (Intake vs. Rehoming velocity).

---

## 📋 Step-by-Step Implementation

### Step 1: Define Analytics Data Models
📁 **Target File**: Create [`src/types/analytics.ts`](file:///c:/Users/User/pet-shelter/src/types/analytics.ts)

```typescript
export interface ShelterMetrics {
  totalAnimalsInCare: number;
  availableForAdoption: number;
  pendingApplications: number;
  totalAdoptionsCompleted: number;
  averageDaysToAdoption: number;
  monthlyDonationsTotalMyr: number;
  taxDeductibleDonationCount: number;
}

export interface SpeciesOccupancy {
  species: 'dog' | 'cat';
  count: number;
  percentage: number;
}

export interface MonthlyTrend {
  month: string; // e.g. "Jan 2026"
  intakes: number;
  adoptions: number;
  donationsMyr: number;
}
```

---

### Step 2: Server-Side Aggregation Action
📁 **Target File**: Create [`src/actions/analytics.ts`](file:///c:/Users/User/pet-shelter/src/actions/analytics.ts)

```typescript
"use server";

import { getServerPetsAsync, getServerApplicationsAsync } from "@/lib/serverStore";
import { getAuditLogs } from "@/lib/domain/auditLog";
import { verifyAdminSession } from "@/lib/auth";
import { ShelterMetrics } from "@/types/analytics";

export async function getShelterAnalyticsAction(): Promise<ShelterMetrics | null> {
  const session = await verifyAdminSession();
  if (!session) return null;

  const [pets, applications, logs] = await Promise.all([
    getServerPetsAsync(),
    getServerApplicationsAsync(),
    getAuditLogs({ limit: 1000 }),
  ]);

  const activePets = pets.filter((p) => !p.isArchived);
  const availableCount = activePets.filter((p) => p.status === "Available").length;
  const pendingCount = applications.filter((a) => a.status === "submitted" || a.status === "under_review").length;
  const adoptedPets = activePets.filter((p) => p.status === "Adopted");

  // Calculate Average Days to Adoption
  let totalDays = 0;
  let adoptedWithDateCount = 0;
  for (const pet of adoptedPets) {
    if (pet.intakeDate) {
      const intake = new Date(pet.intakeDate).getTime();
      const now = Date.now();
      const days = Math.max(1, Math.round((now - intake) / (1000 * 60 * 60 * 24)));
      totalDays += days;
      adoptedWithDateCount++;
    }
  }
  const averageDaysToAdoption = adoptedWithDateCount > 0 ? Math.round(totalDays / adoptedWithDateCount) : 14;

  // Calculate Donations from Audit Logs
  const donationLogs = logs.filter((l) => l.action === "DONATION_RECEIVED");
  let totalDonations = 0;
  for (const log of donationLogs) {
    const match = log.details?.match(/RM\s*([\d,]+\.?\d*)/);
    if (match) {
      totalDonations += parseFloat(match[1].replace(/,/g, ""));
    }
  }

  return {
    totalAnimalsInCare: activePets.length,
    availableForAdoption: availableCount,
    pendingApplications: pendingCount,
    totalAdoptionsCompleted: adoptedPets.length,
    averageDaysToAdoption,
    monthlyDonationsTotalMyr: totalDonations,
    taxDeductibleDonationCount: donationLogs.length,
  };
}
```

---

### Step 3: Hardened LHDN & ROS CSV Export Utility
📁 **Target File**: [`src/lib/exportCsv.ts`](file:///c:/Users/User/pet-shelter/src/lib/exportCsv.ts) (Verify lines 1–65)

Ensure security measures against Formula Injection and UTF-8 BOM encoding:

```typescript
/**
 * Sanitizes cell values to prevent CSV formula injection in Microsoft Excel.
 * Prefixes dangerous characters (=, +, -, @, \t, \r) with an apostrophe.
 */
export function sanitizeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const str = String(value).trim();
  const dangerousPrefixes = ["=", "+", "-", "@", "\t", "\r"];

  let sanitized = str;
  if (dangerousPrefixes.some((prefix) => sanitized.startsWith(prefix))) {
    sanitized = "'" + sanitized;
  }

  return `"${sanitized.replace(/"/g, '""')}"`;
}

/**
 * Downloads a generated CSV string in the client browser with UTF-8 BOM.
 */
export function triggerCsvDownload(csvContent: string, filename: string): void {
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

---

### Step 4: Analytics Metric Cards Component
📁 **Target File**: Create [`src/components/admin/AnalyticsMetricGrid.tsx`](file:///c:/Users/User/pet-shelter/src/components/admin/AnalyticsMetricGrid.tsx)

```tsx
"use client";

import React from "react";
import { ShelterMetrics } from "@/types/analytics";
import { Heart, Clock, DollarSign, FileCheck2, Users, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";

export function AnalyticsMetricGrid({ metrics }: { metrics: ShelterMetrics }) {
  const cards = [
    {
      title: "Rescues in Shelter",
      value: metrics.totalAnimalsInCare,
      subtitle: `${metrics.availableForAdoption} currently available for adoption`,
      icon: Heart,
      color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40",
    },
    {
      title: "Pending Applications",
      value: metrics.pendingApplications,
      subtitle: "Awaiting coordinator review",
      icon: Users,
      color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40",
    },
    {
      title: "Average Rehome Time",
      value: `${metrics.averageDaysToAdoption} days`,
      subtitle: "Intake to adoption placement",
      icon: Clock,
      color: "text-purple-600 bg-purple-50 dark:bg-purple-950/40",
    },
    {
      title: "LHDN Tax Relief Receipts",
      value: `RM ${metrics.monthlyDonationsTotalMyr.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`,
      subtitle: `${metrics.taxDeductibleDonationCount} official receipts issued (Sec 44(6))`,
      icon: DollarSign,
      color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title} className="p-5 rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {card.title}
              </span>
              <div className={`p-2 rounded-xl ${card.color}`}>
                <Icon className="size-4" />
              </div>
            </div>
            <div className="mt-3 font-heading text-2xl font-bold text-foreground">
              {card.value}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
          </Card>
        );
      })}
    </div>
  );
}
```

---

## 🧪 Verification Commands

```bash
# Verify Unit Tests
npm test -- --run

# Strict TypeScript Check
npx tsc --noEmit

# Production Build
npm run build
```
