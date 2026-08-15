import { Metadata } from "next";
import { notFound } from "next/navigation";
import initialPetsData from "@/data/pets.json";
import { Pet } from "@/types/pet";
import { PetDetailView } from "@/components/PetDetailView";

interface PetPageProps {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  const pets = initialPetsData as Pet[];
  return pets.map((pet) => ({
    id: pet.id,
  }));
}

export async function generateMetadata({ params }: PetPageProps): Promise<Metadata> {
  const { id } = await params;
  const pets = initialPetsData as Pet[];
  const pet = pets.find((p) => p.id === id);

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
  const pets = initialPetsData as Pet[];
  const pet = pets.find((p) => p.id === id);

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
      price: pet.adoptionFee.replace(/[^0-9]/g, "") || "180",
      priceCurrency: "MYR",
      availability: pet.status === "Available" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PetDetailView initialPet={pet} />
    </>
  );
}
