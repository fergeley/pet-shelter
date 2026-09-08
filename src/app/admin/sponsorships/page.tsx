import { forbidden, unauthorized } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { getVerifiedSession } from "@/lib/security/dal";
import { ForbiddenError, UnauthorizedError, hasRole, ROLES } from "@/lib/security/rbac";
import {
  getPendingSponsorshipsAction,
  type PendingSponsorshipDTO,
} from "@/actions/sponsorships";
import { SponsorshipReconciliationTable } from "@/components/features/sponsors/SponsorshipReconciliationTable";

// A payment queue must never be served from the full route cache: a cached page
// would offer a coordinator a commitment a colleague settled minutes ago.
export const dynamic = "force-dynamic";

/**
 * Sponsorship reconciliation console.
 *
 * The only screen that reaches `reconcilePetSponsorshipAction`, and therefore
 * the only path by which a supporter's commitment becomes funded care, earns a
 * receipt number, and unlocks their portal account. Until this existed, every
 * commitment stayed `PENDING_PAYMENT` for good — see
 * `tasks/open/sponsor-portal-is-inert-until-reconciliation-is-reachable.md` §1.
 *
 * Gated on role rather than on a permission because there is no sponsorship
 * permission to gate on, and `src/lib/security/permissions.ts` is outside this
 * task's write scope. The allow-list matches the action's own guard exactly, so
 * the screen cannot offer a button the Server Action will refuse. Adding a real
 * `RECONCILE_SPONSORSHIPS` permission is the follow-up recorded in the claim.
 *
 * The authorization check runs before anything renders, so an under-privileged
 * request gets a genuine 403 rather than a 200 carrying an error message. The
 * admin layout's own redirect is a convenience, not the boundary.
 */
export default async function AdminSponsorshipsPage() {
  const session = await getVerifiedSession();

  if (!session) {
    unauthorized();
  }

  if (!hasRole(session, [ROLES.ADMIN, ROLES.COORDINATOR])) {
    forbidden();
  }

  // Three outcomes, deliberately kept distinct. `getPendingSponsorshipsAction`
  // does not swallow its errors, because an empty queue and an unreachable
  // database look identical to a coordinator and one of them means a supporter
  // is still waiting. Catching it here rather than letting it 500 keeps that
  // distinction visible instead of trading it for a blank error page.
  let pending: PendingSponsorshipDTO[] | null = null;
  let readFailed = false;

  try {
    pending = await getPendingSponsorshipsAction();
  } catch (err) {
    // An authorization failure is not a database failure, and must not be
    // reported as one. The action resolves the session through the DAL, which
    // re-reads the member row, so it can legitimately refuse a request this
    // page admitted — a suspension landing between the two reads does exactly
    // that. Sending that coordinator to go and check a migration would be a
    // wrong answer to a question they did not ask.
    if (err instanceof UnauthorizedError) {
      unauthorized();
    }
    if (err instanceof ForbiddenError) {
      forbidden();
    }

    readFailed = true;
    console.error("[Sponsorship Reconciliation] Could not read the pending queue:", err);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Sponsorship Reconciliation
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Match each pledge reference against a bank statement, then activate it. Activating
          issues the supporter a numbered tax receipt and unlocks their supporter portal.
        </p>
      </div>

      {readFailed ? (
        <div
          role="alert"
          className="flex items-start gap-2 border border-danger-border bg-danger-surface p-4 text-sm text-danger-text"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="leading-relaxed">
            <p className="font-bold">The pending queue could not be read.</p>
            <p className="mt-1">
              This is not an empty queue — supporters may be waiting. If this persists, check
              that the <span className="font-mono">pet_sponsorships</span> migration has been
              applied to this environment.
            </p>
          </div>
        </div>
      ) : (
        <SponsorshipReconciliationTable pending={pending ?? []} />
      )}
    </div>
  );
}
