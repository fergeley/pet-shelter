import { PetDataTable } from "@/components/admin/PetDataTable";
import { getAdminPetCatalog } from "@/lib/domain/adminPetCatalog";

export default async function AdminPetsPage() {
  const pets = await getAdminPetCatalog();

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
