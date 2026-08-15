import { ApplicationDataTable } from "@/components/admin/ApplicationDataTable";

export default function AdminApplicationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Adoption Applications Board
        </h1>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          Review incoming adoption questionnaires, perform reference checks, and approve adoption meet-and-greets.
        </p>
      </div>

      <ApplicationDataTable />
    </div>
  );
}
