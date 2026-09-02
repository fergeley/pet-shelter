# Frontend UI/UX Engineer Masterclass: TNRM, Coexistence & Interactive Giving

**Role Track**: **Frontend UI/UX Engineer (Your Partner)**  
**Target Milestone**: Building the responsive, accessible, beautifully crafted user interface for **Hope For Strays UM** (*Coexistence through TNRM & Education*).

---

## 🎨 1. Frontend Architecture & Design Philosophy

As the Frontend Engineer, your focus is on delivering a **premium, frictionless, dynamic experience** that embodies modern web design standards:
- **Clean Information Hierarchy**: High readability, generous whitespace, structured typography.
- **Micro-Interactions**: Smooth hover effects, interactive dropdowns, animated counters, and tab transitions.
- **Accessible & Responsive**: Fully accessible keyboard navigation (WAI-ARIA dropdowns), mobile drawer accordions, and fluid layouts.
- **Deep Personalization**: "Orangutan Project" style interactive animal sponsorship chooser and 4-part profile tabs.

---

## 🧩 2. Component Implementation Walkthrough

### Module 1: Navbar Overhaul & Accessible Dropdown Menus
📁 **Target File**: [`src/components/layout/Navbar.tsx`](file:///c:/Users/User/pet-shelter/src/components/layout/Navbar.tsx)

#### A. Desktop Dropdown Architecture
Implement clean hover/focus-friendly dropdown menus for **Adoption** and **Get Involved**:

```tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronDown, Heart, HeartHandshake, Compass, Users, FileText, Search, Building2, Handshake } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export function Navbar() {
  const [isAdoptionOpen, setIsAdoptionOpen] = useState(false);
  const [isGetInvolvedOpen, setIsGetInvolvedOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/95 backdrop-blur-md">
      <div className="flex h-16 w-full items-center justify-between px-6 sm:px-8 lg:px-10">
        
        {/* Brand Logo & Mission Tagline */}
        <Link href="/" className="flex items-center gap-2.5 focus-visible:ring-2 rounded-lg">
          <div className="flex size-9 items-center justify-center overflow-hidden rounded-xl bg-primary/10 ring-1 ring-primary/20">
            <Image src="/android-icon-192x192.png" alt="Hope For Strays UM" width={36} height={36} className="h-full w-full object-cover" priority />
          </div>
          <div className="flex flex-col">
            <span className="font-heading text-lg font-bold tracking-tight text-foreground leading-tight">
              Hope For Strays UM
            </span>
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              Coexistence through TNRM & Education
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links & Dropdowns */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/pets" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Meet Our Animals
          </Link>

          <Link href="/#our-work" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Our Work
          </Link>

          {/* 1. Adoption Dropdown */}
          <div 
            className="relative"
            onMouseEnter={() => setIsAdoptionOpen(true)}
            onMouseLeave={() => setIsAdoptionOpen(false)}
          >
            <button 
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2 cursor-pointer"
              aria-expanded={isAdoptionOpen}
            >
              Adoption
              <ChevronDown className={`size-3.5 transition-transform duration-200 ${isAdoptionOpen ? "rotate-180" : ""}`} />
            </button>

            {isAdoptionOpen && (
              <div className="absolute top-full left-0 w-56 rounded-xl border border-border bg-card p-2 shadow-lg animate-in fade-in-50 zoom-in-95">
                <Link
                  href="/#how-it-works"
                  className="flex items-start gap-2.5 rounded-lg p-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                >
                  <FileText className="size-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div>Adoption Process</div>
                    <div className="text-[10px] font-normal text-muted-foreground">Requirements & 3-step guide</div>
                  </div>
                </Link>

                <Link
                  href="/applications/track"
                  className="flex items-start gap-2.5 rounded-lg p-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors mt-1"
                >
                  <Search className="size-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div>Track Application</div>
                    <div className="text-[10px] font-normal text-muted-foreground">Check status with reference ID</div>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* 2. Get Involved Dropdown */}
          <div 
            className="relative"
            onMouseEnter={() => setIsGetInvolvedOpen(true)}
            onMouseLeave={() => setIsGetInvolvedOpen(false)}
          >
            <button 
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2 cursor-pointer"
              aria-expanded={isGetInvolvedOpen}
            >
              Get Involved
              <ChevronDown className={`size-3.5 transition-transform duration-200 ${isGetInvolvedOpen ? "rotate-180" : ""}`} />
            </button>

            {isGetInvolvedOpen && (
              <div className="absolute top-full left-0 w-64 rounded-xl border border-border bg-card p-2 shadow-lg animate-in fade-in-50 zoom-in-95">
                <Link
                  href="/#get-involved"
                  className="flex items-start gap-2.5 rounded-lg p-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                >
                  <Users className="size-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div>Volunteer</div>
                    <div className="text-[10px] font-normal text-muted-foreground">Weekend dog walking & campus TNRM shifts</div>
                  </div>
                </Link>

                <Link
                  href="/#get-involved"
                  className="flex items-start gap-2.5 rounded-lg p-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors mt-1"
                >
                  <Heart className="size-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div>Foster</div>
                    <div className="text-[10px] font-normal text-muted-foreground">Temporary recovery foster home care</div>
                  </div>
                </Link>

                <Link
                  href="/#get-involved"
                  className="flex items-start gap-2.5 rounded-lg p-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors mt-1"
                >
                  <Building2 className="size-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div>Corporate CSR & Collaboration</div>
                    <div className="text-[10px] font-normal text-muted-foreground">Company workdays & matching gifts</div>
                  </div>
                </Link>

                <Link
                  href="/#get-involved"
                  className="flex items-start gap-2.5 rounded-lg p-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors mt-1"
                >
                  <Handshake className="size-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div>Partnerships</div>
                    <div className="text-[10px] font-normal text-muted-foreground">Vet clinics, university clubs & council ties</div>
                  </div>
                </Link>
              </div>
            )}
          </div>

          <Link href="/#rehab-needs" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Rehab Needs
          </Link>

          <Link href="/donate" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Donate & Sponsor
          </Link>
        </nav>

        {/* Right CTA Actions */}
        <div className="hidden lg:flex items-center gap-3">
          <Link
            href="/donate"
            className={buttonVariants({
              size: "sm",
              className: "text-xs font-semibold uppercase tracking-wider gap-1.5 h-8 px-3.5",
            })}
          >
            <HeartHandshake className="size-3.5" />
            Sponsor
          </Link>
        </div>
      </div>
    </header>
  );
}
```

---

### Module 2: Hero & "Our Impact So Far" Section
📁 **Target File**: [`src/components/layout/Hero.tsx`](file:///c:/Users/User/pet-shelter/src/components/layout/Hero.tsx)

```tsx
export function Hero() {
  const impactStats = [
    { value: "520+", label: "Animals Neutered through TNRM", icon: "🐾" },
    { value: "380+", label: "Animals Rehabilitated", icon: "🩺" },
    { value: "290+", label: "Animals Adopted into Homes", icon: "🏡" },
    { value: "150+", label: "Volunteers Involved", icon: "👥" },
    { value: "25+", label: "Corporate / Community Collaborations", icon: "🤝" },
  ];

  return (
    <section className="border-b border-border bg-muted/20">
      <div className="w-full px-6 py-14 sm:px-8 sm:py-18 lg:px-12 lg:py-20">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-bold uppercase tracking-wider">
            Universiti Malaya & Selangor Stray Animal Welfare
          </div>

          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
            Hope For Strays UM
          </h1>
          <p className="font-heading text-xl sm:text-2xl font-semibold text-primary">
            Coexistence through TNRM & Education
          </p>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground leading-relaxed">
            Pioneering humane stray management at Universiti Malaya and surrounding communities. Through structured Trap-Neuter-Return-Manage (TNRM), public education, and medical rehabilitation, we build a compassionate, sustainable coexistence.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
            <Link href="/pets" className={buttonVariants({ size: "lg", className: "gap-2 px-7" })}>
              <Heart className="size-4 fill-current" />
              Meet Our Animals
            </Link>
            <Link href="/donate" className={buttonVariants({ variant: "outline", size: "lg", className: "gap-2 px-6" })}>
              <HeartHandshake className="size-4" />
              Sponsor an Animal
            </Link>
            <Link href="/#our-work" className={buttonVariants({ variant: "outline", size: "lg", className: "gap-2 px-6" })}>
              Our Work
            </Link>
          </div>
        </div>

        {/* Our Impact So Far Showcase */}
        <div className="mt-14 pt-10 border-t border-border/80 max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">
              Milestones & Achievements
            </span>
            <h2 className="font-heading text-2xl font-bold text-foreground mt-1">
              Our Impact So Far
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {impactStats.map((stat, idx) => (
              <div key={idx} className="border border-border bg-card p-5 rounded-2xl text-center space-y-2 shadow-xs hover:border-primary/40 transition-colors">
                <div className="text-2xl">{stat.icon}</div>
                <div className="font-heading text-3xl font-extrabold text-foreground">{stat.value}</div>
                <div className="text-xs text-muted-foreground font-medium leading-snug">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
```

---

### Module 3: 4-Part Tabbed Animal Profile View
📁 **Target File**: [`src/components/features/pets/PetDetailView.tsx`](file:///c:/Users/User/pet-shelter/src/components/features/pets/PetDetailView.tsx)

Implement the 4 distinct tabs (**About me**, **My status**, **My updates**, **Support me**):

```tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Pet } from "@/types/pet";
import { Heart, HeartHandshake, ShieldCheck, Clock, Calendar, CheckCircle2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export function PetDetailView({ initialPet }: { initialPet: Pet }) {
  const [activeTab, setActiveTab] = useState<"about" | "status" | "updates" | "support">("about");
  const pet = initialPet;
  const isRehab = pet.status === "In Rehabilitation" || pet.status === "Rehabilitation";

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-10 space-y-8">
      
      {/* Top Pet Hero Summary */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center border border-border bg-card p-6 sm:p-8 rounded-3xl shadow-sm">
        <div className="md:col-span-5 relative aspect-4/3 rounded-2xl overflow-hidden border border-border">
          <Image src={pet.image} alt={pet.name} fill className="object-cover" priority />
          <div className="absolute top-3 left-3">
            <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wider text-white rounded-full ${
              isRehab ? "bg-amber-600" : "bg-emerald-700"
            }`}>
              {pet.status}
            </span>
          </div>
        </div>

        <div className="md:col-span-7 space-y-4">
          <div>
            <h1 className="font-heading text-4xl font-bold text-foreground">{pet.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {pet.breed} • {pet.age} • {pet.gender} • {pet.weight}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {pet.tags.map((tag, idx) => (
              <span key={idx} className="bg-secondary text-secondary-foreground text-xs px-2.5 py-1 rounded-md font-semibold">
                {tag}
              </span>
            ))}
          </div>

          <div className="pt-2 flex flex-wrap gap-3">
            <Link
              href={`/donate?pet=${encodeURIComponent(pet.name)}`}
              className={buttonVariants({
                className: "gap-2 font-bold text-xs uppercase tracking-wider",
              })}
            >
              <HeartHandshake className="size-4" />
              Sponsor {pet.name} (RM30/mo)
            </Link>

            {pet.status === "Available" && (
              <Button variant="outline" className="text-xs font-bold uppercase tracking-wider">
                <Heart className="size-4 text-primary" />
                Apply to Adopt
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border gap-2 sm:gap-6 overflow-x-auto pb-1">
        {[
          { id: "about", label: "🐾 About Me" },
          { id: "status", label: "🩺 My Status & Health" },
          { id: "updates", label: `📸 My Updates (${pet.updates?.length || 0})` },
          { id: "support", label: "💖 Support Me" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 px-3 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: About Me */}
      {activeTab === "about" && (
        <div className="space-y-6 animate-in fade-in-50">
          <div className="border border-border bg-card p-6 rounded-2xl space-y-3">
            <h2 className="font-heading text-lg font-bold text-foreground">Rescue Background & Personality</h2>
            <p className="text-sm leading-relaxed text-foreground/90">{pet.rescueStory}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{pet.description}</p>
          </div>
        </div>
      )}

      {/* Tab 2: My Status */}
      {activeTab === "status" && (
        <div className="space-y-6 animate-in fade-in-50">
          <div className="border border-border bg-card p-6 rounded-2xl space-y-4">
            <h2 className="font-heading text-lg font-bold text-foreground">Current Welfare & Medical Phase</h2>
            {isRehab ? (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                <div className="font-bold text-amber-900 dark:text-amber-300 text-sm">
                  🚧 In Active Rehabilitation: {pet.rehabStage || "Medical & Socialization Care"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {pet.name} is currently receiving daily clinical care and nutrition at our Rehabilitation House. You can sponsor their ongoing recovery below.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl font-bold text-emerald-800 dark:text-emerald-300 text-sm">
                ✅ Cleared for Adoption: Fully vaccinated, sterilized, and microchipped.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: My Updates */}
      {activeTab === "updates" && (
        <div className="space-y-4 animate-in fade-in-50">
          <h2 className="font-heading text-lg font-bold text-foreground">Recent Photos & Care Updates</h2>
          {pet.updates && pet.updates.length > 0 ? (
            pet.updates.map((update, idx) => (
              <div key={idx} className="border border-border bg-card p-5 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono">{update.date}</span>
                  <span className="capitalize px-2 py-0.5 bg-muted rounded text-[10px] font-bold">{update.category}</span>
                </div>
                <h3 className="font-bold text-foreground text-sm">{update.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{update.content}</p>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No recent journal updates posted yet.</p>
          )}
        </div>
      )}

      {/* Tab 4: Support Me */}
      {activeTab === "support" && (
        <div className="border border-border bg-card p-6 sm:p-8 rounded-2xl space-y-6 animate-in fade-in-50">
          <h2 className="font-heading text-xl font-bold text-foreground">Become {pet.name}&apos;s Sponsor</h2>
          <p className="text-sm text-muted-foreground">
            By sponsoring {pet.name} for RM30/month, you provide vital food, medication, and recovery boarding. You&apos;ll receive monthly photo/video updates and may arrange occasional visiting sessions.
          </p>
          <Link
            href={`/donate?pet=${encodeURIComponent(pet.name)}`}
            className={buttonVariants({ size: "lg", className: "gap-2" })}
          >
            <HeartHandshake className="size-4" />
            Sponsor {pet.name} Now (RM 30/mo)
          </Link>
        </div>
      )}

    </div>
  );
}
```

---

### Module 4: Personalized Sponsorship Chooser (Orangutan Project Style)
📁 **Target File**: [`src/components/features/donations/DonationWidget.tsx`](file:///c:/Users/User/pet-shelter/src/components/features/donations/DonationWidget.tsx)

- Add visual animal selector carousel with photo, name, and status.
- Highlight the **RM30 "Rescue Companion & Updates"** tier with monthly photo/video update perks and sanctuary visit perks.
- Wire search params so clicking "Sponsor Bella" directly sets `targetPetName` to "Bella".
