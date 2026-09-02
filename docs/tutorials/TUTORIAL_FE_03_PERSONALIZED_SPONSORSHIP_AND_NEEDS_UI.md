# Frontend Tutorial: Personalized Animal Sponsorship & Rehabilitation Needs UI

**Track**: **Frontend UI/UX Engineer**  
**Module Focus**: Building the Orangutan Project style personalized animal sponsorship chooser, Rehabilitation House Wishlist with 4 categories, and interactive FAQ accordion.

---

## 🎯 1. Overview & Inspiration

- **Personalized Animal Sponsorship**: Inspired by The Orangutan Project (`https://www.theorangutanproject.org/all-adoptees/`), allowing donors to visually pick their dedicated animal (e.g. Kopi, Milo, Luna) and view customized perks under the **RM30/month "Rescue Companion"** tier (monthly photo/video updates, digital certificate, and scheduled visiting sessions).
- **Rehabilitation House Needs**: 4-category wishlist with copyable specs and physical drop-off details.
- **Interactive FAQ Accordion**: Real-world Q&A covering TNRM vacuum effect, ear notching, campus rescue reporting, and visiting guidelines.

---

## 🛠️ 2. Step-by-Step Implementation

### Step 1: Personalized Animal Sponsorship Chooser
📁 [`src/components/features/donations/DonationWidget.tsx`](file:///c:/Users/User/pet-shelter/src/components/features/donations/DonationWidget.tsx)

```tsx
"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { HeartHandshake, CheckCircle2, RotateCw, Video, Mail, Calendar } from "lucide-react";
import mockPets from "@/data/pets.json";

export function SponsorshipChooser() {
  const searchParams = useSearchParams();
  const initialPetParam = searchParams.get("pet") || "";

  const [selectedPetName, setSelectedPetName] = useState<string>(initialPetParam);
  const [tierAmount, setTierAmount] = useState<number>(30); // Default RM30

  useEffect(() => {
    if (initialPetParam) {
      setSelectedPetName(initialPetParam);
    }
  }, [initialPetParam]);

  return (
    <div className="border border-border bg-card p-6 sm:p-8 rounded-3xl space-y-8">
      
      {/* 1. Choose Your Rescue Buddy (Orangutan Style) */}
      <div className="space-y-3">
        <h3 className="font-heading text-lg font-bold text-foreground">
          1. Choose an Animal to Sponsor (Or Sponsor General Rescue Care)
        </h3>
        <p className="text-xs text-muted-foreground">
          Select a specific dog or cat currently under rehabilitation or sanctuary care:
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
          {mockPets.slice(0, 6).map((pet) => {
            const isSelected = selectedPetName.toLowerCase() === pet.name.toLowerCase();

            return (
              <button
                key={pet.id}
                type="button"
                onClick={() => setSelectedPetName(isSelected ? "" : pet.name)}
                className={`p-2 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-2 ${
                  isSelected
                    ? "border-primary bg-primary/10 ring-2 ring-primary"
                    : "border-border bg-background hover:bg-muted/40"
                }`}
              >
                <div className="relative size-16 rounded-full overflow-hidden border border-border">
                  <Image src={pet.image} alt={pet.name} fill className="object-cover" />
                </div>
                <div>
                  <div className="font-bold text-xs text-foreground">{pet.name}</div>
                  <div className="text-[10px] text-muted-foreground">{pet.status}</div>
                </div>
              </button>
            );
          })}
        </div>

        {selectedPetName && (
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl text-xs font-semibold text-primary flex items-center justify-between">
            <span>🐾 Sponsoring dedicated rescue buddy: <strong>{selectedPetName}</strong></span>
            <button onClick={() => setSelectedPetName("")} className="text-[10px] underline cursor-pointer">Clear</button>
          </div>
        )}
      </div>

      {/* 2. Personalized Tier Highlight (RM30 Perks) */}
      <div className="space-y-4">
        <h3 className="font-heading text-lg font-bold text-foreground">
          2. Select Monthly Support Tier
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`border p-5 rounded-2xl space-y-3 cursor-pointer transition-all ${
            tierAmount === 30 ? "border-primary bg-primary/5 ring-2 ring-primary" : "border-border bg-background"
          }`} onClick={() => setTierAmount(30)}>
            <div className="flex justify-between items-center">
              <span className="font-heading text-2xl font-bold text-foreground">RM 30 / mo</span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-primary text-primary-foreground rounded-full">Most Popular</span>
            </div>
            <div className="font-bold text-sm text-foreground">Rescue Companion Tier</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Provides daily wholesome meals, medication, and post-surgery comfort.
            </p>

            {/* Exclusive Perks */}
            <div className="border-t border-border pt-3 space-y-1.5 text-xs text-foreground/90 font-medium">
              <div className="flex items-center gap-1.5 text-emerald-600">
                <Video className="size-3.5" /> Monthly photo & video progress update
              </div>
              <div className="flex items-center gap-1.5 text-emerald-600">
                <Calendar className="size-3.5" /> Arranged sanctuary visiting sessions
              </div>
              <div className="flex items-center gap-1.5 text-emerald-600">
                <Mail className="size-3.5" /> Digital Certificate of Sponsorship
              </div>
            </div>
          </div>

          <div className={`border p-5 rounded-2xl space-y-3 cursor-pointer transition-all ${
            tierAmount === 50 ? "border-primary bg-primary/5 ring-2 ring-primary" : "border-border bg-background"
          }`} onClick={() => setTierAmount(50)}>
            <div className="flex justify-between items-center">
              <span className="font-heading text-2xl font-bold text-foreground">RM 50 / mo</span>
            </div>
            <div className="font-bold text-sm text-foreground">Vaccine & Health Tier</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Funds complete core vaccination series, deworming, and parasite prevention.
            </p>
          </div>

          <div className={`border p-5 rounded-2xl space-y-3 cursor-pointer transition-all ${
            tierAmount === 120 ? "border-primary bg-primary/5 ring-2 ring-primary" : "border-border bg-background"
          }`} onClick={() => setTierAmount(120)}>
            <div className="flex justify-between items-center">
              <span className="font-heading text-2xl font-bold text-foreground">RM 120 / mo</span>
            </div>
            <div className="font-bold text-sm text-foreground">Full Sterilization & Care</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sponsors full spay/neuter surgery, anesthesia, and recovery boarding.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
```

---

### Step 2: Rehabilitation House Needs Component (4 Categories)
📁 `src/components/features/needs/RehabNeedsSection.tsx`

```tsx
"use client";

import React, { useState } from "react";
import { Package, AlertCircle, Sparkles, Wrench, CheckCircle2, Copy } from "lucide-react";
import mockNeeds from "@/data/rehabNeeds.json";

export function RehabNeedsSection() {
  const [activeTab, setActiveTab] = useState<"URGENT" | "REGULAR" | "LONG_TERM" | "TNRM_EQUIPMENT">("URGENT");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredItems = mockNeeds.filter((item) => item.category === activeTab);

  const handleCopy = (name: string, id: string) => {
    navigator.clipboard.writeText(name);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <section id="rehab-needs" className="py-14 sm:py-18 bg-card border-t border-border">
      <div className="w-full max-w-6xl mx-auto px-6 sm:px-8 space-y-8">
        
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary block mb-1">
            Shelter Wishlist
          </span>
          <h2 className="font-heading text-3xl font-bold text-foreground">
            Current Rehabilitation House Needs
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Supplies and equipment currently needed by our caregivers and field volunteers.
          </p>
        </div>

        {/* 4 Category Filter Pills */}
        <div className="flex flex-wrap gap-2 border-b border-border pb-4">
          {[
            { id: "URGENT", label: "🚨 Urgent Needs", count: mockNeeds.filter(i => i.category === "URGENT").length },
            { id: "REGULAR", label: "📦 Regular Needs", count: mockNeeds.filter(i => i.category === "REGULAR").length },
            { id: "LONG_TERM", label: "🏗️ Long-term Improvements", count: mockNeeds.filter(i => i.category === "LONG_TERM").length },
            { id: "TNRM_EQUIPMENT", label: "🐾 TNRM Equipment", count: mockNeeds.filter(i => i.category === "TNRM_EQUIPMENT").length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Wishlist Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((item) => (
            <div key={item.id} className="border border-border bg-background p-6 rounded-2xl space-y-3 flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {item.urgencyLevel} Priority
                  </span>
                  <span className="text-xs font-mono font-semibold text-primary">{item.quantityNeeded}</span>
                </div>
                <h3 className="font-heading text-base font-bold text-foreground">{item.name}</h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{item.description}</p>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Brand: {item.brand || "Any"}</span>
                <button
                  onClick={() => handleCopy(item.name, item.id)}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {copiedId === item.id ? <CheckCircle2 className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                  {copiedId === item.id ? "Copied!" : "Copy Spec"}
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
```
