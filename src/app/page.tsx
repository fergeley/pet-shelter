import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { Hero } from "@/components/Hero";
import { PetGallery } from "@/components/PetGallery";
import { BulletinFeed } from "@/components/BulletinFeed";
import { HomeProcessSection, HomeStandardsSection, HomeCommunitySection } from "@/components/HomeSections";
import { buttonVariants } from "@/components/ui/button";
import { getPublicPets } from "@/actions/pets";

export default async function HomePage() {
  const initialPets = await getPublicPets();

  return (
    <div className="flex flex-col">
      {/* 1. Hero Section */}
      <Hero />

      {/* 2. Urgent Notices & Announcements Newsfeed */}
      <section className="border-t border-border bg-background py-10 sm:py-14">
        <div className="w-full px-6 sm:px-8 lg:px-12">
          <BulletinFeed
            targetPage="home"
            title="Shelter Bulletins & Updates"
            maxItems={2}
          />
        </div>
      </section>

      {/* 3. Adoptable Pets Gallery Showcase */}
      <section id="adopt" className="border-t border-border bg-card py-14 sm:py-18">
        <div className="w-full px-6 sm:px-8 lg:px-12">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 mb-8">
            <div>
              <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Animals Ready for Adoption
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Health-checked, vaccinated, microchipped, and sterilized before rehoming.
              </p>
            </div>
            <Link
              href="/pets"
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "self-start sm:self-auto text-sm font-semibold uppercase tracking-wider focus-visible:ring-2 rounded-xl",
              })}
            >
              View All Animals
              <ArrowRight className="size-4 ml-1.5" />
            </Link>
          </div>

          <Suspense
            fallback={
              <div className="flex items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="size-6 animate-spin mr-2" />
                <span>Loading adoptable animals...</span>
              </div>
            }
          >
            <PetGallery initialPets={initialPets} />
          </Suspense>
        </div>
      </section>

      {/* 4. Adoption Process Steps */}
      <HomeProcessSection />

      {/* 5. Shelter Standards & Veterinary Commitments */}
      <HomeStandardsSection />

      {/* 6. Volunteer, Foster & Community Support Section */}
      <HomeCommunitySection />
    </div>
  );
}
