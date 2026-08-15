import { AuditLogViewer } from "@/components/admin/AuditLogViewer";

export default function AdminAuditPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Audit & Security Activity Log
        </h1>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          Inspect immutable records of administrative actions, authentication attempts, and adoption status transitions.
        </p>
      </div>

      <AuditLogViewer />
    </div>
  );
}
