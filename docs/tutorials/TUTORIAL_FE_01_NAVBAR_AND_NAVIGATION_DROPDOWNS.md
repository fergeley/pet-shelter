# Frontend Tutorial: Navigation Overhaul & Accessible Dropdowns

**Track**: **Frontend UI/UX Engineer**  
**Module Focus**: Building responsive, keyboard-navigable dropdown menus for **Adoption** and **Get Involved** across desktop and mobile.

---

## 🎯 1. Navigation Structure & Brand Alignment

### Hierarchy:
1. **Brand**: **Hope For Strays UM** (Tagline: *Coexistence through TNRM & Education*)
2. **Meet Our Animals** (`/pets`)
3. **Our Work** (`/#our-work`)
4. **Adoption** (Dropdown):
   - *Adoption Process* (`/#how-it-works`)
   - *Track Application* (`/applications/track`)
5. **Get Involved** (Dropdown):
   - *Volunteer* (`/#get-involved`)
   - *Foster* (`/#get-involved`)
   - *Corporate CSR & Collaboration* (`/#get-involved`)
   - *Partnerships* (`/#get-involved`)
6. **Rehab Needs** (`/#rehab-needs` or `/needs`)
7. **Donate & Sponsor** (`/donate`)

---

## 🛠️ 2. Complete Component Implementation

📁 [`src/components/layout/Navbar.tsx`](file:///c:/Users/User/pet-shelter/src/components/layout/Navbar.tsx)

```tsx
"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  ChevronDown, 
  Heart, 
  HeartHandshake, 
  Menu, 
  FileText, 
  Search, 
  Users, 
  Home as HomeIcon, 
  Building2, 
  Handshake, 
  Package, 
  Phone 
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function Navbar() {
  const [isAdoptionOpen, setIsAdoptionOpen] = useState(false);
  const [isGetInvolvedOpen, setIsGetInvolvedOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Close dropdown on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsAdoptionOpen(false);
        setIsGetInvolvedOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/95 backdrop-blur-md">
      <div className="flex h-16 w-full items-center justify-between px-6 sm:px-8 lg:px-10">
        
        {/* Brand Logo & Name */}
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

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-6 md:flex" aria-label="Main Navigation">
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
              aria-haspopup="true"
            >
              Adoption
              <ChevronDown className={`size-3.5 transition-transform duration-200 ${isAdoptionOpen ? "rotate-180" : ""}`} />
            </button>

            {isAdoptionOpen && (
              <div className="absolute top-full left-0 w-60 rounded-xl border border-border bg-card p-2 shadow-xl animate-in fade-in-50 zoom-in-95">
                <Link
                  href="/#how-it-works"
                  className="flex items-start gap-2.5 rounded-lg p-2.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                >
                  <FileText className="size-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div>Adoption Process</div>
                    <div className="text-[10px] font-normal text-muted-foreground">3-step matching & requirements</div>
                  </div>
                </Link>

                <Link
                  href="/applications/track"
                  className="flex items-start gap-2.5 rounded-lg p-2.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors mt-1"
                >
                  <Search className="size-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div>Track Application</div>
                    <div className="text-[10px] font-normal text-muted-foreground">Lookup status by reference code</div>
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
              aria-haspopup="true"
            >
              Get Involved
              <ChevronDown className={`size-3.5 transition-transform duration-200 ${isGetInvolvedOpen ? "rotate-180" : ""}`} />
            </button>

            {isGetInvolvedOpen && (
              <div className="absolute top-full left-0 w-64 rounded-xl border border-border bg-card p-2 shadow-xl animate-in fade-in-50 zoom-in-95">
                <Link
                  href="/#get-involved"
                  className="flex items-start gap-2.5 rounded-lg p-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                >
                  <Users className="size-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div>Volunteer</div>
                    <div className="text-[10px] font-normal text-muted-foreground">Walking, campus feeding & TNRM</div>
                  </div>
                </Link>

                <Link
                  href="/#get-involved"
                  className="flex items-start gap-2.5 rounded-lg p-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors mt-1"
                >
                  <HomeIcon className="size-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div>Foster Care</div>
                    <div className="text-[10px] font-normal text-muted-foreground">Temporary post-op healing homes</div>
                  </div>
                </Link>

                <Link
                  href="/#get-involved"
                  className="flex items-start gap-2.5 rounded-lg p-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors mt-1"
                >
                  <Building2 className="size-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div>Corporate CSR & Collaboration</div>
                    <div className="text-[10px] font-normal text-muted-foreground">Workdays & corporate matching</div>
                  </div>
                </Link>

                <Link
                  href="/#get-involved"
                  className="flex items-start gap-2.5 rounded-lg p-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors mt-1"
                >
                  <Handshake className="size-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div>Partnerships</div>
                    <div className="text-[10px] font-normal text-muted-foreground">Vet clinics, university clubs & council</div>
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

        {/* Right CTA */}
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

        {/* Mobile Hamburger Drawer */}
        <div className="flex items-center gap-2 md:hidden">
          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetTrigger className="p-2 border border-border rounded-lg">
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] bg-card p-6">
              <SheetHeader>
                <SheetTitle className="text-left font-heading text-lg font-bold">
                  Hope For Strays UM
                </SheetTitle>
              </SheetHeader>

              <div className="flex flex-col gap-4 mt-6 text-sm">
                <Link href="/pets" onClick={() => setIsMobileOpen(false)} className="font-semibold py-1.5">
                  🐾 Meet Our Animals
                </Link>
                <Link href="/#our-work" onClick={() => setIsMobileOpen(false)} className="font-semibold py-1.5">
                  🌱 Our Work (TNRM & Education)
                </Link>

                <div className="border-t border-border pt-3 space-y-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase">Adoption</span>
                  <Link href="/#how-it-works" onClick={() => setIsMobileOpen(false)} className="block pl-2 text-sm text-foreground">
                    Adoption Process
                  </Link>
                  <Link href="/applications/track" onClick={() => setIsMobileOpen(false)} className="block pl-2 text-sm text-foreground">
                    Track Application
                  </Link>
                </div>

                <div className="border-t border-border pt-3 space-y-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase">Get Involved</span>
                  <Link href="/#get-involved" onClick={() => setIsMobileOpen(false)} className="block pl-2 text-sm text-foreground">
                    Volunteer
                  </Link>
                  <Link href="/#get-involved" onClick={() => setIsMobileOpen(false)} className="block pl-2 text-sm text-foreground">
                    Foster Care
                  </Link>
                  <Link href="/#get-involved" onClick={() => setIsMobileOpen(false)} className="block pl-2 text-sm text-foreground">
                    Corporate CSR & Partnerships
                  </Link>
                </div>

                <div className="border-t border-border pt-3">
                  <Link href="/#rehab-needs" onClick={() => setIsMobileOpen(false)} className="font-semibold py-1.5 block">
                    📦 Current Rehab House Needs
                  </Link>
                  <Link href="/donate" onClick={() => setIsMobileOpen(false)} className="font-semibold py-1.5 block text-primary">
                    💖 Donate & Sponsor an Animal
                  </Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

      </div>
    </header>
  );
}
```
