# Frontend Tutorial: 'Meet Our Animals' Gallery & 4-Part Profile Tabs

**Track**: **Frontend UI/UX Engineer**  
**Module Focus**: Building the subcategorized animal gallery (*Adoptable* vs *In Rehabilitation*) and the interactive 4-part individual animal profile view.

---

## 🎯 1. User Experience & Layout Specifications

1. **Subcategory Filters**:
   - **All Animals**: Shows the entire active sanctuary catalog.
   - **Adoptable**: Shows animals cleared for forever homes.
   - **In Rehabilitation**: Shows rescues currently undergoing clinical recovery, post-surgery foster care, or behavioral therapy.
2. **Individual Animal Profile Page (`/pets/[id]`)**:
   - **Tab 1: About me** (Personality traits, rescue history, temperament, breed, weight).
   - **Tab 2: My status** (Clear badge: *Adoptable* vs *In Rehabilitation*, clinical milestones checklist, veterinary clearance).
   - **Tab 3: My updates** (Chronological photo journal, weight checks, rehabilitation progress notes).
   - **Tab 4: Support me** (Direct **"Sponsor Me"** button pre-selecting animal under RM30 tier + **"Apply to Adopt"**).

---

## 🛠️ 2. Step-by-Step Implementation

### Step 1: Pet Gallery with Subcategory Filter Pills
📁 [`src/components/features/pets/PetGallery.tsx`](file:///c:/Users/User/pet-shelter/src/components/features/pets/PetGallery.tsx)

```tsx
"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Pet } from "@/types/pet";
import { Heart, HeartHandshake, ShieldCheck, Star } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

interface PetGalleryProps {
  initialPets: Pet[];
}

export function PetGallery({ initialPets }: PetGalleryProps) {
  const [activeCategory, setActiveCategory] = useState<"all" | "adoptable" | "rehab">("all");
  const [speciesFilter, setSpeciesFilter] = useState<"all" | "dog" | "cat">("all");

  const filteredPets = useMemo(() => {
    return initialPets.filter((pet) => {
      // Category Filter
      if (activeCategory === "adoptable" && pet.status !== "Available") return false;
      if (activeCategory === "rehab" && pet.status !== "In Rehabilitation" && pet.status !== "Rehabilitation") return false;

      // Species Filter
      if (speciesFilter !== "all" && pet.species.toLowerCase() !== speciesFilter) return false;

      return true;
    });
  }, [initialPets, activeCategory, speciesFilter]);

  return (
    <div className="space-y-8">
      {/* Header & Subcategory Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            Meet Our Animals
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Browse animals rescued and cared for by Hope For Strays UM.
          </p>
        </div>

        {/* Subcategory Filter Pills */}
        <div className="inline-flex p-1 bg-muted rounded-xl border border-border">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeCategory === "all"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All Animals ({initialPets.length})
          </button>

          <button
            onClick={() => setActiveCategory("adoptable")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeCategory === "adoptable"
                ? "bg-emerald-700 text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Adoptable ({initialPets.filter((p) => p.status === "Available").length})
          </button>

          <button
            onClick={() => setActiveCategory("rehab")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeCategory === "rehab"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            In Rehabilitation ({initialPets.filter((p) => p.status === "In Rehabilitation" || p.status === "Rehabilitation").length})
          </button>
        </div>
      </div>

      {/* Grid of Animals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPets.map((pet) => {
          const isRehab = pet.status === "In Rehabilitation" || pet.status === "Rehabilitation";

          return (
            <div
              key={pet.id}
              className="border border-border bg-card rounded-2xl overflow-hidden shadow-xs hover:border-primary/50 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="relative aspect-4/3 w-full bg-muted">
                  <Image src={pet.image} alt={pet.name} fill className="object-cover" />
                  
                  {/* Status Badge */}
                  <div className="absolute top-3 left-3">
                    <span
                      className={`px-3 py-1 text-xs font-bold uppercase tracking-wider text-white rounded-full ${
                        isRehab ? "bg-amber-600" : "bg-emerald-700"
                      }`}
                    >
                      {pet.status}
                    </span>
                  </div>
                </div>

                <div className="p-5 space-y-3">
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-heading text-xl font-bold text-foreground">{pet.name}</h3>
                    <span className="text-xs font-semibold text-muted-foreground">{pet.gender} • {pet.age}</span>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {pet.rescueStory || pet.description}
                  </p>

                  {isRehab && pet.rehabStage && (
                    <div className="bg-amber-500/10 border border-amber-500/30 p-2 rounded-lg text-[11px] font-semibold text-amber-900 dark:text-amber-300">
                      🩺 Stage: {pet.rehabStage}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-5 pt-0 grid grid-cols-2 gap-2 border-t border-border/50 mt-4">
                <Link
                  href={`/pets/${pet.id}`}
                  className={buttonVariants({ variant: "outline", size: "sm", className: "text-xs font-bold" })}
                >
                  View Profile
                </Link>

                <Link
                  href={`/donate?pet=${encodeURIComponent(pet.name)}`}
                  className={buttonVariants({ size: "sm", className: "text-xs font-bold gap-1" })}
                >
                  <HeartHandshake className="size-3.5" />
                  Sponsor
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```
