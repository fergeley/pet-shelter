import { PetDataTable } from "@/components/admin/PetDataTable";

export default function AdminIndexPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Pet Management (CRUD)
        </h1>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          Add new rescue animals, update medical clearances, edit stories, and change adoption statuses.
        </p>
      </div>

      <PetDataTable />
    </div>
  );
}
