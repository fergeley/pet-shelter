import { Metadata } from "next";
import Link from "next/link";
import { getPublicPets } from "@/actions/pets";
import { AdoptionPageForm } from "@/components/features/adoptions/AdoptionPageForm";

export const metadata: Metadata = {
  title: "Adoption Application | Hope for Strays (Petaling Jaya)",
  description:
    "Apply to adopt a rescue dog or cat from Hope for Strays in Petaling Jaya, Selangor. Four short steps, and you can track your application afterwards.",
};

interface AdoptPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Full-page adoption application.
 *
 * A direct, linkable entry point for the same wizard the pet pages open in a
 * modal — `?petId=` preselects the animal, so a "Adopt me" link from anywhere
 * lands the applicant on the right form. The wizard itself is not reimplemented
 * here; this page supplies the data and the chrome only.
 */
export default async function AdoptPage(props: AdoptPageProps) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const petId = typeof searchParams.petId === "string" ? searchParams.petId : undefined;

  const pets = await getPublicPets();
  const selectedPet = (petId && pets.find((p) => p.id === petId)) || null;

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            {selectedPet ? `Adopt ${selectedPet.name}` : "Adoption Application"}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Four short steps, about five minutes. Our volunteer coordinators in Petaling Jaya review
            every application and follow up within 1–2 business days.
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm">
          {pets.length > 0 ? (
            <AdoptionPageForm selectedPet={selectedPet} allPets={pets} />
          ) : (
            <div className="text-center py-10 space-y-3">
              <p className="text-sm font-semibold text-foreground">
                No animals are listed for adoption right now.
              </p>
              <p className="text-sm text-muted-foreground">
                Please check the{" "}
                <Link href="/pets" className="font-semibold underline underline-offset-2">
                  adoption directory
                </Link>{" "}
                again shortly.
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Already applied?{" "}
          <Link
            href="/applications/track"
            className="font-semibold text-foreground underline underline-offset-2"
          >
            Track your application
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
