import { Pet } from "@/types/pet";
import { getServerPetsAsync } from "@/lib/server/petRepository";
import { getServerApplicationsAsync } from "@/lib/server/applicationRepository";

export type AdminPetRecord = Pet & { applicationCount: number };

/**
 * The admin pet catalog: every pet including archived ones, with the number of
 * adoption applications linked to each.
 *
 * A plain function, deliberately not a server action. It previously lived in
 * `src/actions/pets.ts`, where being an export of a `"use server"` module made
 * it an unauthenticated POST endpoint — archived animals and per-pet application
 * counts were readable by anyone who sent its action id, the same hazard
 * `getVolunteerFormLinks` documents.
 *
 * Gating it there was not an option: its only caller is the `/admin/pets` server
 * component, which Next prerenders at build time with no session, so an
 * authorization throw would have broken the build. Moving it out of the action
 * module removes the endpoint and leaves the page's data path exactly as it was.
 */
export async function getAdminPetCatalog(): Promise<AdminPetRecord[]> {
  const allPets = await getServerPetsAsync();
  const apps = await getServerApplicationsAsync();

  return allPets.map((pet) => {
    const petApps = apps.filter(
      (a) => a.petId === pet.id || a.petName.toLowerCase() === pet.name.toLowerCase()
    );
    return {
      ...pet,
      applicationCount: petApps.length,
    };
  });
}
