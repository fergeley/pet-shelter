import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Hero } from "@/components/layout/Hero";
import { PetGallery } from "@/components/features/pets/PetGallery";
import { BulletinFeed } from "@/components/features/bulletins/BulletinFeed";
import {
  HomeStandardsSection,
  HomeOurWorkSection,
  HomeQuickActionsSection,
} from "@/components/layout/HomeSections";
import { Section } from "@/components/layout/Section";
import { getPublicPets } from "@/actions/pets";

export default async function HomePage() {
  const initialPets = await getPublicPets();

  return (
    <div className="flex flex-col bg-background">
      {/* 1. Hero Section with 5 Impact Stats */}
      <Hero />

      {/* 2. FE-03: Our Work — The 3 Core Pillars (TNRM, Education, Rehab) */}
      <HomeOurWorkSection />

      <HomeQuickActionsSection />

      {/* 3. Latest news and updates */}
      <section className="bg-work-ground py-16 sm:py-20">
        <div className="w-full px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto">
          <BulletinFeed
            targetPage="home"
            title="From the shelter"
            subtitle="Rescue updates, clinic notes, and news from the Petaling Jaya sanctuary."
            layout="carousel"
            maxItems={4}
          />
        </div>
      </section>

      {/* 4. Adoptable & Recovering Pets Gallery Showcase */}
      <Section id="adopt">
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
            title="Adoptable Animals"
            subtitle="Rescued dogs, cats, puppies and kittens waiting for a home right now."
            featuredOnly
            showFilters={false}
            syncUrl={false}
          />
        </Suspense>
      </Section>

      {/* 5. Shelter Standards & Veterinary Commitments */}
      <HomeStandardsSection />
    </div>
  );
}
