import { Metadata } from "next";
import { Suspense } from "react";
import { PetGallery } from "@/components/features/pets/PetGallery";
import { BulletinFeed } from "@/components/features/bulletins/BulletinFeed";
import { PetsFaqSection } from "@/components/layout/PetsFaqSection";
import { getPublicPets } from "@/actions/pets";
import { getPublicFaqs } from "@/actions/faqs";
import { Loader2 } from "lucide-react";
import { Species, PetSize, AgeCategory, PetStatus } from "@/types/pet";

export const metadata: Metadata = {
  title: "Adoptable Dogs & Cats | Hope for Strays (Petaling Jaya)",
  description:
    "Browse rescue dogs and cats currently available for adoption at Hope for Strays shelter in Petaling Jaya, Selangor.",
};

interface PetsDirectoryPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function PetsDirectoryPage(props: PetsDirectoryPageProps) {
  const searchParams = props.searchParams ? await props.searchParams : {};

  const species = typeof searchParams.species === "string" ? (searchParams.species as Species) : undefined;
  const size = typeof searchParams.size === "string" ? (searchParams.size as PetSize) : undefined;
  const ageCategory = typeof searchParams.ageCategory === "string" ? (searchParams.ageCategory as AgeCategory) : undefined;
  const status = typeof searchParams.status === "string" ? (searchParams.status as PetStatus) : undefined;
  const search = typeof searchParams.search === "string" ? searchParams.search : undefined;

  const initialPets = await getPublicPets({
    species,
    size,
    ageCategory,
    status,
    search,
  });

  // Adoption FAQs come from the same database the /faq page reads, so staff
  // edits made in the admin panel show up here too.
  const adoptionFaqs = (await getPublicFaqs()).filter(
    (faq) => faq.category === "ADOPTION"
  );

  return (
    <div className="min-h-screen bg-card pb-20">
      {/* Directory Gallery */}
      <div className="w-full px-6 sm:px-8 lg:px-12 pt-8 sm:pt-10">
        <Suspense
          fallback={
            <div className="flex min-h-[360px] items-center justify-center p-12 text-muted-foreground">
              <Loader2 className="size-8 animate-spin mr-2" />
              <span>Loading adoptable animals...</span>
            </div>
          }
        >
          <PetGallery
            initialPets={initialPets}
            showFilters={true}
          />
        </Suspense>
      </div>

      {/* Directory Bulletins / Notices */}
      <section className="w-full px-6 sm:px-8 lg:px-12 pt-10 border-t border-border mt-10">
        <BulletinFeed
          targetPage="pets"
          title="Adoption Notices & Clinic Updates"
          compact={true}
          maxItems={2}
        />
      </section>

      {/* FAQs */}
      <PetsFaqSection faqs={adoptionFaqs} />
    </div>
  );
}
