import { Metadata } from "next";
import { Suspense } from "react";
import { PetGallery } from "@/components/PetGallery";
import { BulletinFeed } from "@/components/BulletinFeed";
import { getPublicPets } from "@/actions/pets";
import { PhoneCall, Loader2 } from "lucide-react";
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

  const faqs = [
    {
      q: "What does the adoption fee cover?",
      a: "All adoption fees directly cover spay/neuter surgery, core vaccinations (6-in-1 / FVRCP), microchip registration, and internal/external parasite treatment.",
    },
    {
      q: "Can I bring my resident dog to meet an adoptable dog?",
      a: "Yes! We encourage supervised introductions in our outdoor compound in Petaling Jaya. Please bring your dog's vaccination card.",
    },
    {
      q: "What are the adoption requirements?",
      a: "Applicants must be at least 21 years old, provide proof of a secure pet-friendly residence (landlord or management approval if residing in high-rise), and agree to post-adoption check-ins.",
    },
    {
      q: "How long does the application process take?",
      a: "Most applications are reviewed within 1–2 business days. If approved, you can complete the adoption and bring your pet home during open visiting hours.",
    },
  ];

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
            title="Adoptable Animals"
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
      <section className="w-full px-6 sm:px-8 lg:px-12 pt-12 border-t border-border mt-10">
        <div className="mb-8 max-w-2xl">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="border border-border bg-background p-6 space-y-2.5"
            >
              <h3 className="font-heading text-lg font-bold text-foreground">
                {faq.q}
              </h3>
              <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
                {faq.a}
              </p>
            </div>
          ))}
        </div>

        {/* Contact Banner */}
        <div className="mt-10 bg-muted/40 border border-border p-6 max-w-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-base font-bold text-foreground">
              Have questions about an animal in Petaling Jaya?
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Call our shelter desk Tuesday through Sunday, 10:00 AM – 5:00 PM.
            </p>
          </div>
          <a
            href="tel:+60378765432"
            className="inline-flex items-center gap-2 bg-foreground text-background px-5 py-2.5 text-sm font-semibold uppercase tracking-wider hover:bg-foreground/85 transition-colors focus-visible:ring-2 shrink-0"
          >
            <PhoneCall className="size-4" />
            03-7876 5432
          </a>
        </div>
      </section>
    </div>
  );
}
