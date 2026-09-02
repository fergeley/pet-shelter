import { forbidden, unauthorized } from "next/navigation";
import { getVerifiedSession } from "@/lib/security/dal";
import { hasPermission, PERMISSIONS } from "@/lib/security/rbac";
import { listMemberRecords, type MemberRecord } from "@/lib/memberStore";
import { MemberDataTable } from "@/components/admin/MemberDataTable";

// The roster reflects live role and status changes, so it must never be
// served from the full route cache.
export const dynamic = "force-dynamic";

/**
 * Staff & Permissions console.
 *
 * The authorization check runs before anything is rendered, so an
 * under-privileged request gets a genuine HTTP 403 with the `forbidden.tsx`
 * body rather than a 200 carrying an error message. The surrounding admin
 * layout is a client component whose redirect is a convenience, not a security
 * boundary; this check is the boundary.
 */
export default async function AdminMembersPage() {
  const session = await getVerifiedSession();

  if (!session) {
    unauthorized();
  }

  if (!hasPermission(session, PERMISSIONS.MANAGE_MEMBERS)) {
    forbidden();
  }

  let members: MemberRecord[] = [];
  let loadError: string | null = null;

  try {
    members = await listMemberRecords();
  } catch {
    // Member administration talks to Postgres directly and has no in-memory
    // fallback: showing an empty roster as though it were the truth could get
    // an administrator to re-invite people who already exist.
    loadError =
      "Could not reach the staff database. The roster below may be incomplete — refresh before making changes.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Staff &amp; Permissions
        </h1>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          Invite shelter staff, assign the access level their work requires, and suspend
          accounts that should no longer reach the admin console.
        </p>
      </div>

      {loadError && (
        <div className="border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
          {loadError}
        </div>
      )}

      <MemberDataTable initialMembers={members} currentUserId={session.id} />
    </div>
  );
}
