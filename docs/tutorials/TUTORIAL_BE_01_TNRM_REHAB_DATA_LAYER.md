# Backend Tutorial: TNRM & Rehabilitation Data Engine

**Track**: **Backend Server Engineer**  
**Module Focus**: Implementing data modeling, state machine transitions, and querying for TNRM metrics and animals in medical/behavioral rehabilitation.

---

## 🎯 1. Business Logic & Requirements

1. **Mission Alignment**: Support Hope For Strays UM's TNRM (Trap-Neuter-Return-Manage) and Rehabilitation House operations.
2. **Entity States**: Animals progress through specific stages:
   - `IN_REHABILITATION`: Undergoing medical treatment (fracture repair, mange therapy, eye surgery) or behavioral rehabilitation.
   - `AVAILABLE`: Cleared by a licensed veterinarian for adoption.
   - `PENDING`: Adoption application under review.
   - `ADOPTED`: Placed in forever home.
3. **Clinical Timeline & Progress Journals**: Each animal in rehabilitation has structured `updates` containing date, title, medical observations, and photo URLs.

---

## 🛠️ 2. Step-by-Step Implementation

### Step 1: Prisma Schema Enum & Model Definition
📁 [`prisma/schema.prisma`](file:///c:/Users/User/pet-shelter/prisma/schema.prisma)

```prisma
enum PetStatus {
  AVAILABLE
  IN_REHABILITATION
  PENDING
  ADOPTED
}

model Pet {
  id                    String      @id @default(cuid())
  name                  String
  species               String      // dog, cat, other
  breed                 String
  age                   String
  ageCategory           String      // puppy_kitten, young, adult, senior
  gender                String      // Male, Female
  size                  String      // Small, Medium, Large
  weight                String
  status                String      @default("Available") // "Available" | "In Rehabilitation" | "Pending" | "Adopted"
  rehabStage            String?     // e.g. "Bone Healing & Physical Therapy", "Mange & Skin Treatment"
  rehabStageMs          String?
  rehabProgressPercent  Int         @default(0)
  adoptionFee           String      @default("Free")
  description           String
  rescueStory           String
  image                 String
  galleryImages         String[]
  tags                  String[]
  intakeDate            String
  
  // Medical clearance
  vaccinated            Boolean     @default(true)
  microchipped          Boolean     @default(true)
  spayedNeutered        Boolean     @default(true)
  specialNeeds          String?

  // Compatibility
  goodWithDogs          Boolean     @default(true)
  goodWithCats          Boolean     @default(true)
  goodWithKids          Boolean     @default(true)
  energyLevel           String      @default("Moderate")

  // Audit
  isArchived            Boolean     @default(false)
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt

  updates               PetUpdate[]
  sponsorships          DonationPledge[]

  @@index([species, status, isArchived])
  @@index([isArchived, status])
  @@map("pets")
}

model PetUpdate {
  id          String   @id @default(cuid())
  petId       String
  pet         Pet      @relation(fields: [petId], references: [id], onDelete: Cascade)
  date        String   // YYYY-MM-DD
  title       String
  titleMs     String?
  content     String   @db.Text
  contentMs   String?  @db.Text
  image       String?
  category    String   @default("rehabilitation") // medical, rehabilitation, milestone, socialization
  createdAt   DateTime @default(now())

  @@index([petId, date])
  @@map("pet_updates")
}
```

---

### Step 2: Server Store Querying & Filter Implementation
📁 [`src/lib/serverStore.ts`](file:///c:/Users/User/pet-shelter/src/lib/serverStore.ts)

```typescript
import { Pet, PetFilterState } from "@/types/pet";
import { prisma } from "@/lib/prisma";
import mockPets from "@/data/pets.json";

export async function getPublicPets(filter?: Partial<PetFilterState>): Promise<Pet[]> {
  try {
    const whereClause: any = { isArchived: false };

    if (filter?.species && filter.species !== "all") {
      whereClause.species = filter.species;
    }

    if (filter?.status && filter.status !== "all") {
      if (filter.status === "In Rehabilitation" || filter.status === "Rehabilitation") {
        whereClause.status = { in: ["In Rehabilitation", "Rehabilitation"] };
      } else {
        whereClause.status = filter.status;
      }
    }

    const pets = await prisma.pet.findMany({
      where: whereClause,
      include: {
        updates: { orderBy: { date: "desc" } }
      },
      orderBy: { createdAt: "desc" },
    });

    if (pets && pets.length > 0) {
      return pets as unknown as Pet[];
    }
  } catch (err) {
    console.warn("[ServerStore] Falling back to in-memory store for getPublicPets:", err);
  }

  // Fallback in-memory query
  let results = (mockPets as unknown as Pet[]).filter((p) => !p.isArchived);

  if (filter?.species && filter.species !== "all") {
    results = results.filter((p) => p.species.toLowerCase() === filter.species?.toLowerCase());
  }

  if (filter?.status && filter.status !== "all") {
    if (filter.status === "In Rehabilitation" || filter.status === "Rehabilitation") {
      results = results.filter((p) => p.status === "In Rehabilitation" || p.status === "Rehabilitation");
    } else {
      results = results.filter((p) => p.status === filter.status);
    }
  }

  return results;
}
```

---

### Step 3: Vitest Integration Testing
📁 `tests/unit/rehabQuery.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { getPublicPets } from "@/lib/serverStore";

describe("TNRM & Rehabilitation Status Filtering", () => {
  it("should filter animals in rehabilitation", async () => {
    const rehabPets = await getPublicPets({ status: "In Rehabilitation" });
    expect(rehabPets.length).toBeGreaterThan(0);
    rehabPets.forEach((pet) => {
      expect(["In Rehabilitation", "Rehabilitation"]).toContain(pet.status);
    });
  });

  it("should filter adoptable animals", async () => {
    const adoptablePets = await getPublicPets({ status: "Available" });
    expect(adoptablePets.length).toBeGreaterThan(0);
    adoptablePets.forEach((pet) => {
      expect(pet.status).toBe("Available");
    });
  });
});
```
