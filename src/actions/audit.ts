"use server";

import { getCurrentSession } from "@/lib/security/session";
import { assertAuthorized, ROLES } from "@/lib/security/rbac";
import { getAuditLogsAsync, AuditEntry } from "@/lib/domain/auditLog";

export async function fetchAuditLogsAction(
  limit = 200
): Promise<{ success: boolean; data?: AuditEntry[]; error?: string }> {
  try {
    const session = await getCurrentSession();
    assertAuthorized(session, [ROLES.ADMIN, ROLES.COORDINATOR]);

    const boundedLimit = Math.min(Math.max(1, limit), 1000);
    const logs = await getAuditLogsAsync(boundedLimit);
    return { success: true, data: logs };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch audit logs";
    return { success: false, error: msg };
  }
}
