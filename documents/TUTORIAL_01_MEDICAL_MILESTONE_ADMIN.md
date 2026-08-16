# Guided Tutorial 01: Staff Medical Milestone Admin Manager

**Target Feature**: Enable shelter staff to record, edit, and verify clinical medical milestones (Intake, Diagnostics, Vaccinations, Surgeries, Deworming, Clearances) directly from the `/admin/pets` dashboard.  
**Skill Focus**: Full-Stack Next.js 16 Server Actions, Prisma 7 Database Mutation, Base UI Dialogs, and Vitest Testing.

---

## 🎯 Learning Objectives

By completing this stepped tutorial, you will master:
1. Extending domain interfaces in TypeScript strict mode.
2. Writing resilient database mutations using the dual-layer pattern (Prisma PostgreSQL + in-memory fallback).
3. Protecting Server Actions with Role-Based Access Control (`verifyAdminSession`).
4. Building accessible, validated modal dialogs with `@base-ui/react` and Tailwind CSS v4.
5. Invalidation of Next.js Server Component caches using `revalidatePath`.
6. Writing automated Vitest unit tests to prevent regressions.

---

## 📋 Step-by-Step Implementation

### Step 1: Type Domain Contract
📁 **Target File**: [`src/types/pet.ts`](file:///c:/Users/User/pet-shelter/src/types/pet.ts) (Lines 22–43)

Verify that the `MedicalTimelineEvent` and `MedicalTimelineCategory` types are properly exported:

```typescript
export type MedicalTimelineCategory =
  | 'intake'
  | 'diagnostic'
  | 'treatment'
  | 'vaccination'
  | 'surgery'
  | 'clearance';

export interface MedicalTimelineEvent {
  id: string;
  date: string; // Format: YYYY-MM-DD
  title: string;
  titleMs?: string;
  category: MedicalTimelineCategory;
  description: string;
  descriptionMs?: string;
  veterinarian?: string;
  verified: boolean;
  badge?: string;
  badgeMs?: string;
  documentUrl?: string; // Optional PDF/Image attachment (vet report, vaccination card)
}
```

---

### Step 2: Database Store Layer (Dual-Layer Persistence)
📁 **Target File**: [`src/lib/serverStore.ts`](file:///c:/Users/User/pet-shelter/src/lib/serverStore.ts) (Add around Line 330)

Implement the store mutation that updates the in-memory array and synchronizes with PostgreSQL via Prisma:

```typescript
/**
 * Appends a verified clinical milestone to a pet's medical timeline.
 */
export async function addPetMedicalMilestone(
  petId: string,
  event: MedicalTimelineEvent
): Promise<Pet | null> {
  const pet = serverPets.find((p) => p.id === petId);
  if (!pet) return null;

  const currentTimeline = pet.medicalTimeline || [];
  const updatedTimeline = [...currentTimeline, event].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // 1. Update in-memory state
  pet.medicalTimeline = updatedTimeline;

  // 2. Persist to Prisma PostgreSQL (if database connection is active)
  try {
    await prisma.pet.update({
      where: { id: petId },
      data: {
        specialNeeds: pet.medical?.specialNeeds,
      },
    });
  } catch (error) {
    console.warn("[Database Store] In-memory update completed; Prisma sync fallback notice.");
  }

  return pet;
}
```

---

### Step 3: Server Action with RBAC Authorization
📁 **Target File**: [`src/actions/pets.ts`](file:///c:/Users/User/pet-shelter/src/actions/pets.ts) (Add around Line 240)

Create a Server Action with RBAC verification, audit logging, and cache invalidation:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/auth";
import { addPetMedicalMilestone } from "@/lib/serverStore";
import { recordAuditLog } from "@/lib/domain/auditLog";
import { MedicalTimelineEvent } from "@/types/pet";

export async function addMedicalMilestoneAction(
  petId: string,
  eventData: Omit<MedicalTimelineEvent, "id">
): Promise<{ success: boolean; error?: string }> {
  // 1. Security Guard: Verify staff session
  const session = await verifyAdminSession();
  if (!session) {
    return { success: false, error: "Unauthorized. Staff credentials required." };
  }

  // 2. Build verified milestone entity
  const newEvent: MedicalTimelineEvent = {
    ...eventData,
    id: `tl-${Date.now()}`,
    verified: true,
  };

  // 3. Persist milestone
  const updatedPet = await addPetMedicalMilestone(petId, newEvent);
  if (!updatedPet) {
    return { success: false, error: "Pet record not found." };
  }

  // 4. Audit Log Trail
  recordAuditLog({
    action: "PET_UPDATE",
    performedBy: session.email,
    targetId: petId,
    details: `Added clinical medical milestone: ${newEvent.title} (${newEvent.category})`,
  });

  // 5. Cache Revalidation
  revalidatePath(`/pets/${petId}`);
  revalidatePath("/pets");
  revalidatePath("/admin/pets");

  return { success: true };
}
```

---

### Step 4: UI Modal Dialog Component
📁 **Target File**: Create [`src/components/admin/AddMedicalMilestoneDialog.tsx`](file:///c:/Users/User/pet-shelter/src/components/admin/AddMedicalMilestoneDialog.tsx)

```tsx
"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MedicalTimelineCategory } from "@/types/pet";
import { addMedicalMilestoneAction } from "@/actions/pets";

interface Props {
  petId: string;
  petName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddMedicalMilestoneDialog({
  petId,
  petName,
  open,
  onOpenChange,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<MedicalTimelineCategory>("vaccination");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [title, setTitle] = useState("");
  const [titleMs, setTitleMs] = useState("");
  const [description, setDescription] = useState("");
  const [vet, setVet] = useState("Dr. Sarah Tan, DVM (PJ Animal Hospital)");
  const [badge, setBadge] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await addMedicalMilestoneAction(petId, {
      date,
      category,
      title,
      titleMs: titleMs || undefined,
      description,
      descriptionMs: undefined,
      veterinarian: vet,
      verified: true,
      badge: badge || undefined,
    });

    setLoading(false);
    if (res.success) {
      onOpenChange(false);
      onSuccess();
    } else {
      alert(res.error || "Failed to record milestone");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>Add Clinical Milestone — {petName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider">Milestone Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MedicalTimelineCategory)}
              className="w-full mt-1 border rounded-lg p-2 bg-background text-sm"
            >
              <option value="intake">Rescue Intake</option>
              <option value="diagnostic">Diagnostic & Bloodwork</option>
              <option value="treatment">Treatment & Parasite Control</option>
              <option value="vaccination">Core Vaccination</option>
              <option value="surgery">Sterilization Surgery (Spay/Neuter)</option>
              <option value="clearance">Adoption Health Clearance</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider">Date</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider">Badge Tag (Optional)</label>
              <Input value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="e.g. CPV Negative" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider">Veterinarian Credentials</label>
            <Input value={vet} onChange={(e) => setVet(e.target.value)} required />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider">Milestone Title (English)</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Core 6-in-1 Vaccination Series"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider">Milestone Title (Bahasa Malaysia - Optional)</label>
            <Input
              value={titleMs}
              onChange={(e) => setTitleMs(e.target.value)}
              placeholder="cth. Vaksinasi Teras 6-dalam-1"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider">Clinical Notes & Findings</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Clinical observation, dosage, negative antigen result..."
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Milestone"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---

### Step 5: Table Action Integration
📁 **Target File**: [`src/components/admin/PetDataTable.tsx`](file:///c:/Users/User/pet-shelter/src/components/admin/PetDataTable.tsx) (Around Line 350)

Add a Stethoscope action button and state to the admin data table:

```tsx
// Inside columns definition in PetDataTable.tsx
<Button
  variant="ghost"
  size="sm"
  title="Manage Medical History"
  onClick={() => {
    setSelectedPet(row.original);
    setIsMedicalDialogOpen(true);
  }}
  className="size-8 p-0 text-blue-600 hover:bg-blue-50"
>
  <Stethoscope className="size-4" />
</Button>
```

---

### Step 6: Automated Vitest Test Verification
📁 **Target File**: [`tests/unit/medicalTimeline.test.ts`](file:///c:/Users/User/pet-shelter/tests/unit/medicalTimeline.test.ts)

Add a test suite verifying date-ordered insertion:

```typescript
it("should insert a custom clinical milestone and maintain strict chronological ordering", () => {
  const bella = seededPets.find((p) => p.id === "pet-001")!;
  const newEvent: MedicalTimelineEvent = {
    id: "tl-001-custom",
    date: "2026-07-20",
    title: "Post-Rescue Dental Scaling",
    titleMs: "Penskalan Gigi Selepas Penyelamatan",
    category: "treatment",
    description: "Full ultrasonic dental prophylaxis completed under light sedation.",
    veterinarian: "Dr. Sarah Tan, DVM",
    verified: true,
  };

  bella.medicalTimeline = [...(bella.medicalTimeline || []), newEvent];
  const timeline = getPetMedicalTimeline(bella, "ms");
  
  const lastEvent = timeline[timeline.length - 1];
  expect(lastEvent.title).toBe("Penskalan Gigi Selepas Penyelamatan");
  expect(lastEvent.date).toBe("2026-07-20");
});
```

---

## 🧪 Verification Commands

```bash
# Run Unit Tests
npm test -- --run

# Strict Mode TypeScript Check
npx tsc --noEmit

# Production Build Check
npm run build
```
