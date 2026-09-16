"use client";

import { useRouter } from "next/navigation";
import { Pet } from "@/types/pet";
import { AdoptionWizard } from "./AdoptionWizard";

/**
 * The adoption wizard as a full page, for `/adopt`.
 *
 * The wizard is shared verbatim with the modal in `AdoptionForm`; only the
 * chrome differs. `onOpenChange(false)` is the wizard's "I am finished" signal,
 * which on a page means going back to the directory rather than closing a
 * dialog.
 */
export function AdoptionPageForm({
  selectedPet,
  allPets,
}: {
  selectedPet: Pet | null;
  allPets: Pet[];
}) {
  const router = useRouter();

  return (
    <AdoptionWizard
      standalone
      selectedPet={selectedPet}
      allPets={allPets}
      open
      onOpenChange={(open) => {
        if (!open) router.push("/pets");
      }}
    />
  );
}
