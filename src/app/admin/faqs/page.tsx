import { ShieldAlert } from "lucide-react";

import { FaqDataTable } from "@/components/admin/FaqDataTable";
import { getAdminFaqs } from "@/actions/faqs";
import { getCurrentSession } from "@/lib/security/session";
import { hasRole, ROLES } from "@/lib/security/rbac";

export const dynamic = "force-dynamic";

/**
 * FAQ content management.
 *
 * The brief specifies `SUPER_ADMIN` and `CONTENT_EDITOR`; this codebase's Role
 * enum has neither, so the equivalent existing roles gate the page. The same
 * pair is enforced again inside every mutating action in `@/actions/faqs`, so
 * this check controls what is rendered rather than what is permitted.
 */
const FAQ_EDITOR_ROLES = [ROLES.ADMIN, ROLES.COORDINATOR];

export default async function AdminFaqsPage() {
  const session = await getCurrentSession();

  if (!hasRole(session, FAQ_EDITOR_ROLES)) {
    return (
      <div className="max-w-xl border border-border bg-background rounded-2xl p-8 space-y-3">
        <ShieldAlert className="size-7 text-destructive" />
        <h1 className="font-heading text-xl font-bold text-foreground">
          You do not have access to FAQ management
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Editing the public FAQ knowledge base is restricted to Administrator and
          Coordinator accounts. You are currently signed in as{" "}
          <strong className="text-foreground">{session?.role ?? "a guest"}</strong>.
          Please ask an administrator if you need this permission.
        </p>
      </div>
    );
  }

  const faqs = await getAdminFaqs();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          FAQ Knowledge Base
        </h1>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          Questions and answers shown on the public{" "}
          <a href="/faq" target="_blank" className="underline hover:text-foreground">
            FAQ page
          </a>
          . Changes go live immediately — every edit is recorded in the audit log.
        </p>
      </div>

      <FaqDataTable initialFaqs={faqs} />
    </div>
  );
}
