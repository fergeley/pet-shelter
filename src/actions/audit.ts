"use server";

import { getVerifiedSession } from "@/lib/security/dal";
import { assertHasPermission, PERMISSIONS } from "@/lib/security/rbac";
import { getAuditLogsAsync, AuditEntry } from "@/lib/domain/auditLog";

export async function fetchAuditLogsAction(
  limit = 200
): Promise<{ success: boolean; data?: AuditEntry[]; error?: string }> {
  try {
    const session = await getVerifiedSession();
    assertHasPermission(session, PERMISSIONS.VIEW_AUDIT_LOG);

    const boundedLimit = Math.min(Math.max(1, limit), 1000);
    const logs = await getAuditLogsAsync(boundedLimit);
    return { success: true, data: logs };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch audit logs";
    return { success: false, error: msg };
  }
}
