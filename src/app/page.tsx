import { Suspense } from "react";
import Link from "next/link";
import { Loader2, ArrowRight } from "lucide-react";
import { Hero } from "@/components/layout/Hero";
import { buttonVariants } from "@/components/ui/button";
import { PetGallery } from "@/components/features/pets/PetGallery";
import { BulletinFeed } from "@/components/features/bulletins/BulletinFeed";
import {
  HomeStandardsSection,
  HomeOurWorkSection,
  HomeQuickActionsSection,
} from "@/components/layout/HomeSections";
import { getPublicPets } from "@/actions/pets";

export default async function HomePage() {
  const initialPets = await getPublicPets();

  return (
    <div className="flex flex-col">
      {/* 1. Hero Section with 5 Impact Stats */}
      <Hero />

      {/* 2. FE-03: Our Work — The 3 Core Pillars (TNRM, Education, Rehab) */}
      <HomeOurWorkSection />

      <HomeQuickActionsSection />

      {/* 3. Latest news and updates */}
      <section className="border-t border-border bg-background py-10 sm:py-14">
        <div className="w-full px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto">
          <BulletinFeed
            targetPage="home"
            title="Latest news and updates"
            maxItems={2}
          />
        </div>
      </section>

      {/* 4. Adoptable & Recovering Pets Gallery Showcase */}
      <section id="adopt" className="border-t border-border bg-card py-14 sm:py-18">
        <div className="w-full px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="size-6 animate-spin mr-2" />
                <span>Loading rescue animals...</span>
              </div>
            }
          >
            <PetGallery
              initialPets={initialPets}
              featuredOnly
              showFilters={false}
              syncUrl={false}
            />
          </Suspense>

          {/* Centered View All Animals Button */}
          <div className="flex justify-center pt-6">
            <Link
              href="/pets"
              className={buttonVariants({
                variant: "outline",
                className: "text-sm font-semibold uppercase tracking-wider focus-visible:ring-2 rounded-xl gap-2",
              })}
            >
              View All Animals
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 5. Shelter Standards & Veterinary Commitments */}
      <HomeStandardsSection />
    </div>
  );
}
