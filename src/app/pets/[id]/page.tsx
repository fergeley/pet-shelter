import { cache, Suspense } from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPets, getPetById } from "@/actions/pets";
import { PetDetailView } from "@/components/features/pets/PetDetailView";
import { PetExclusiveMediaPanel } from "@/components/features/sponsors";
import { serializeJsonLd } from "@/lib/presentation/jsonLd";

/**
 * One profile read per request, shared by `generateMetadata` and the page.
 *
 * `getPetById` is a database query with the animal's updates, medical timeline and vet joined
 * in, and both functions below need it. It used to be a synchronous lookup in an in-memory
 * mirror, where calling it twice cost nothing; since it became a real query, every render ran it
 * twice. React's `cache` memoises it for the lifetime of one request, which is the pattern the
 * Next 16 getting-started guide "Metadata and OG images", section "Memoizing data requests"
 * (bundled under `node_modules/next/dist/docs/01-app/`), gives for exactly this pair. Named
 * rather than linked: `tests/unit/docReferences.test.ts` resolves every docs path in code
 * against this repo's own `docs/`. Wrapped here, not in `actions/pets.ts`: a `"use server"`
 * module may export only async functions.
 */
const loadPublicPet = cache((id: string) => getPetById(id));

interface PetPageProps {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  const pets = await getPets();
  return pets.map((pet) => ({
    id: pet.id,
  }));
}

export async function generateMetadata({ params }: PetPageProps): Promise<Metadata> {
  const { id } = await params;
  const pet = await loadPublicPet(id);

  if (!pet) {
    return {
      title: "Pet Not Found | Hope for Strays",
      description: "The requested adoptable pet profile could not be found.",
    };
  }

  const title = `Adopt ${pet.name} (${pet.breed}) | Hope for Strays Selangor`;
  const description = `${pet.name} is a ${pet.gender.toLowerCase()} ${pet.breed} looking for a loving home in Petaling Jaya, Selangor. ${pet.description.slice(0, 140)}...`;

  return {
    title,
    description,
    openGraph: {
      title: `Adopt ${pet.name} — ${pet.breed}`,
      description,
      url: `https://hopeforstrays.org/pets/${pet.id}`,
      siteName: "Hope for Strays Sanctuary",
      images: [
        {
          url: pet.image,
          width: 1200,
          height: 630,
          alt: `${pet.name} - ${pet.breed}`,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `Adopt ${pet.name} (${pet.breed})`,
      description,
      images: [pet.image],
    },
  };
}

export default async function PetProfilePage({ params }: PetPageProps) {
  const { id } = await params;
  const pet = await loadPublicPet(id);

  if (!pet) {
    notFound();
  }

  // Structured Data (JSON-LD) for Google Animal Shelter & Product schema
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: pet.name,
    image: pet.image,
    description: pet.description,
    brand: {
      "@type": "AnimalShelter",
      name: "Hope for Strays Sanctuary",
      address: {
        "@type": "PostalAddress",
        streetAddress: "No. 18, Jalan SS 2/72",
        addressLocality: "Petaling Jaya",
        addressRegion: "Selangor",
        postalCode: "47300",
        addressCountry: "MY",
      },
    },
    offers: {
      "@type": "Offer",
      price: pet.adoptionFee.toLowerCase().includes("free") ? "0" : (pet.adoptionFee.replace(/[^0-9]/g, "") || "0"),
      priceCurrency: "MYR",
      availability: pet.status === "Available" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <Suspense fallback={<div className="min-h-screen bg-card" />}>
        <PetDetailView initialPet={pet} />
      </Suspense>

      {/* Sponsor-exclusive media. Fetched client-side from a Route Handler so this
          page keeps its generateStaticParams prerendering and locked media never
          enters the response at all. */}
      <div className="w-full px-6 pb-16 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl">
          <PetExclusiveMediaPanel petId={pet.id} petName={pet.name} />
        </div>
      </div>
    </>
  );
}
