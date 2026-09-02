# Backend Tutorial: Rehabilitation House Needs & FAQ Data Layer

**Track**: **Backend Server Engineer**  
**Module Focus**: Implementing endpoints and server actions for the 4 categories of Rehabilitation House Needs and categorized FAQ items.

---

## 🎯 1. Business Logic & Requirements

1. **Rehabilitation House Needs Categories**:
   - **Urgent Needs**: Post-op recovery foods, F10 disinfectant, medical dressings.
   - **Regular Needs**: Daily kibble, pee pads, fleece blankets.
   - **Long-term Improvements**: Modular stainless steel kennels, commercial bedding washers.
   - **TNRM Equipment**: Drop traps, transfer cages with guillotine dividers, bite-proof gloves.
2. **FAQ Engine**: Categorized Q&A serving TNRM, Adoption, Sponsorship, Visiting Guidelines, and CSR partnerships.

---

## 🛠️ 2. Step-by-Step Implementation

### Step 1: Server Store Query for Wishlist Needs
📁 [`src/lib/serverStore.ts`](file:///c:/Users/User/pet-shelter/src/lib/serverStore.ts)

```typescript
import mockRehabNeeds from "@/data/rehabNeeds.json";
import mockFaqs from "@/data/faqs.json";
import { prisma } from "@/lib/prisma";

export interface RehabNeed {
  id: string;
  category: "URGENT" | "REGULAR" | "LONG_TERM" | "TNRM_EQUIPMENT";
  categoryLabel: string;
  categoryLabelMs: string;
  name: string;
  nameMs: string;
  description: string;
  descriptionMs: string;
  quantityNeeded: string;
  urgencyLevel: string;
  estimatedCostMYR?: number;
  brand?: string;
}

export async function getRehabNeeds(category?: string): Promise<RehabNeed[]> {
  try {
    const dbItems = await (prisma as any).rehabNeedItem.findMany({
      where: category && category !== "all" ? { category } : {},
      orderBy: { createdAt: "desc" },
    });
    if (dbItems && dbItems.length > 0) return dbItems;
  } catch (e) {
    // In-memory fallback
  }

  let items = mockRehabNeeds as unknown as RehabNeed[];
  if (category && category !== "all") {
    items = items.filter((item) => item.category === category);
  }
  return items;
}

export async function getFaqs(category?: string) {
  let faqs = mockFaqs;
  if (category && category !== "all") {
    faqs = faqs.filter((f) => f.category === category);
  }
  return faqs;
}
```

---

### Step 2: Server Actions
📁 `src/actions/needs.ts`

```typescript
"use server";

import { getRehabNeeds, getFaqs } from "@/lib/serverStore";

export async function fetchRehabNeedsAction(category?: string) {
  const needs = await getRehabNeeds(category);
  return { success: true, data: needs };
}

export async function fetchFaqsAction(category?: string) {
  const faqs = await getFaqs(category);
  return { success: true, data: faqs };
}
```
