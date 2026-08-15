import { ApplicationDataTable } from "@/components/admin/ApplicationDataTable";
import { getApplications } from "@/actions/applications";

export default async function AdminApplicationsPage() {
  let applications;
  try {
    applications = await getApplications();
  } catch {
    // If not authenticated in server context, let client controller handle auth redirect / display
    applications = undefined;
  }

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

      <ApplicationDataTable initialApplications={applications} />
    </div>
  );
}
