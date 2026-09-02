import { PetDataTable } from "@/components/admin/PetDataTable";
import { getAdminPets } from "@/actions/pets";

export default async function AdminPetsPage() {
  // getAdminPets is authorization-guarded and throws for an unauthorized
  // caller. Mirror /admin/applications and fall through to the client shell,
  // which redirects to the sign-in page, rather than crashing the route.
  let pets;
  try {
    pets = await getAdminPets();
  } catch {
    pets = undefined;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Adoptable Animals Inventory
        </h1>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          Manage all dog, cat, and rescue animal records currently housed in our Petaling Jaya sanctuary.
        </p>
      </div>

      <PetDataTable initialPets={pets} />
    </div>
  );
}
