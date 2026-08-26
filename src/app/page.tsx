import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Hero } from "@/components/layout/Hero";
import { PetGallery } from "@/components/features/pets/PetGallery";
import { BulletinFeed } from "@/components/features/bulletins/BulletinFeed";
import {
  HomeProcessSection,
  HomeStandardsSection,
  HomeCommunitySection,
  HomeGalleryHeader,
  HomeOurWorkSection,
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

      {/* 3. Urgent Notices & Announcements Newsfeed */}
      <section className="border-t border-border bg-background py-10 sm:py-14">
        <div className="w-full px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto">
          <BulletinFeed
            targetPage="home"
            title="Shelter Bulletins & Updates"
            maxItems={2}
          />
        </div>
      </section>

      {/* 4. Adoptable & Recovering Pets Gallery Showcase */}
      <section id="adopt" className="border-t border-border bg-card py-14 sm:py-18">
        <div className="w-full px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto">
          <HomeGalleryHeader />

          <Suspense
            fallback={
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="size-6 animate-spin mr-2" />
                <span>Loading rescue animals...</span>
              </div>
            }
          >
            <PetGallery initialPets={initialPets} />
          </Suspense>
        </div>
      </section>

      {/* 5. Adoption Process Steps */}
      <HomeProcessSection />

      {/* 6. Shelter Standards & Veterinary Commitments */}
      <HomeStandardsSection />

      {/* 7. Volunteer, Foster & Community Support Section */}
      <HomeCommunitySection />
    </div>
  );
}
