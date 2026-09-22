import { ShieldAlert, DatabaseZap } from "lucide-react";

import { BulletinDataTable } from "@/components/admin/BulletinDataTable";
import { getVerifiedSession } from "@/lib/security/dal";
import { hasPermission } from "@/lib/security/rbac";
import { PERMISSIONS } from "@/lib/security/permissions";
import { listBulletinRecords } from "@/lib/server/bulletinRepository";
import type { BulletinRecord } from "@/types/bulletin";

export const dynamic = "force-dynamic";

/**
 * Community bulletin management.
 *
 * `MANAGE_CONTENT` is enforced again inside every action in `@/actions/bulletins`,
 * so this check controls what is rendered rather than what is permitted.
 *
 * This page is where bulletin editing now lives. It used to live on `/bulletins`
 * — the public page — behind a "Staff Admin Access" button that rendered for
 * every visitor and wrote to their own browser. The admin nav sent staff to that
 * public page, so anyone who posted there believed they had published something.
 */
export default async function AdminBulletinsPage() {
  // Verified, so a suspended editor's unexpired cookie does not render the drafts.
  const session = await getVerifiedSession();

  if (!hasPermission(session, PERMISSIONS.MANAGE_CONTENT)) {
    return (
      <div className="max-w-xl border border-border bg-background rounded-2xl p-8 space-y-3">
        <ShieldAlert className="size-7 text-destructive" />
        <h1 className="font-heading text-xl font-bold text-foreground">
          You do not have access to bulletin management
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Posting community bulletins requires the{" "}
          <strong className="text-foreground">MANAGE_CONTENT</strong> permission,
          held by Administrator and Content Editor accounts. You are currently
          signed in as{" "}
          <strong className="text-foreground">{session?.role ?? "a guest"}</strong>.
          Please ask an administrator if you need this permission.
        </p>
      </div>
    );
  }

  /**
   * `listBulletinRecords` has no fixture fallback on purpose — an editor must not
   * be shown rows whose ids the database does not have, because every Edit and
   * Delete on them would fail with "not found" while the table insisted the data
   * was there. So an outage throws, and it is caught HERE to say so plainly
   * rather than rendering the framework's error page, which tells an editor
   * nothing about whether their previous save survived.
   */
  let bulletins: BulletinRecord[];
  try {
    bulletins = await listBulletinRecords();
  } catch {
    return (
      <div className="max-w-xl border border-border bg-background rounded-2xl p-8 space-y-3">
        <DatabaseZap className="size-7 text-destructive" />
        <h1 className="font-heading text-xl font-bold text-foreground">
          Bulletins are unavailable
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The database could not be reached, so the bulletin list cannot be shown.
          The public feeds are still serving the last committed notices. Nothing
          has been lost — try again once the database is reachable.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Community Bulletins
        </h1>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          Notices shown on the{" "}
          <a href="/" target="_blank" className="underline hover:text-foreground">
            home page
          </a>
          , the{" "}
          <a href="/pets" target="_blank" className="underline hover:text-foreground">
            animals directory
          </a>{" "}
          and the{" "}
          <a href="/bulletins" target="_blank" className="underline hover:text-foreground">
            bulletins page
          </a>
          . Changes go live immediately — every edit is recorded in the audit log.
        </p>
      </div>

      <BulletinDataTable initialBulletins={bulletins} />
    </div>
  );
}
