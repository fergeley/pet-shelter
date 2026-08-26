"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { fetchAuditLogsAction } from "@/actions/audit";
import { AuditEntry } from "@/lib/domain/auditLog";
import { exportReceiptsToCsv, exportAuditLogsToCsv } from "@/lib/presentation/exportCsv";

export type AuditTabFilter = "all" | "receipts" | "adoptions" | "system";

export function useAuditLogController() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [activeTab, setActiveTab] = useState<AuditTabFilter>("all");
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetchAuditLogsAction(250);
      if (res.success && res.data) {
        setLogs(res.data);
      } else {
        setError(res.error || "Failed to load audit logs");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error loading audit records";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const res = await fetchAuditLogsAction(250);
        if (!ignore) {
          if (res.success && res.data) {
            setLogs(res.data);
          } else {
            setError(res.error || "Failed to load audit logs");
          }
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : "Error loading audit records";
          setError(msg);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, []);

  const receiptLogs = useMemo(() => {
    return logs.filter(
      (log) =>
        log.action === "DONATION_RECEIVED" ||
        log.entity === "DonationReceipt" ||
        (log.details && typeof log.details === "object" && "receiptNumber" in log.details)
    );
  }, [logs]);

  const adoptionLogs = useMemo(() => {
    return logs.filter(
      (log) =>
        log.entity === "AdoptionApplication" ||
        log.action.includes("APPLICATION") ||
        log.entity === "Pet"
    );
  }, [logs]);

  const systemLogs = useMemo(() => {
    return logs.filter(
      (log) =>
        log.entity === "ShelterSettings" ||
        log.entity === "Auth" ||
        log.action.includes("AUTH") ||
        log.action.includes("SETTING")
    );
  }, [logs]);

  const filteredLogs = useMemo(() => {
    let base = logs;

    if (activeTab === "receipts") {
      base = receiptLogs;
    } else if (activeTab === "adoptions") {
      base = adoptionLogs;
    } else if (activeTab === "system") {
      base = systemLogs;
    }

    if (!filter.trim()) return base;
    const q = filter.toLowerCase();

    return base.filter(
      (log) =>
        log.action.toLowerCase().includes(q) ||
        log.actorEmail.toLowerCase().includes(q) ||
        log.entity.toLowerCase().includes(q) ||
        (log.entityId && log.entityId.toLowerCase().includes(q)) ||
        (log.details && JSON.stringify(log.details).toLowerCase().includes(q))
    );
  }, [logs, activeTab, receiptLogs, adoptionLogs, systemLogs, filter]);

  const handleExportReceiptsCsv = useCallback(() => {
    setExportNotice(null);
    const targetList = receiptLogs;

    if (targetList.length === 0) {
      setExportNotice("No donation receipt records found to export.");
      setTimeout(() => setExportNotice(null), 4000);
      return;
    }

    exportReceiptsToCsv(targetList);
    setExportNotice(`Exported ${targetList.length} donation receipt(s) to CSV for LHDN reporting.`);
    setTimeout(() => setExportNotice(null), 4000);
  }, [receiptLogs]);

  const handleExportAuditTrailCsv = useCallback(() => {
    setExportNotice(null);
    const targetLogs = filteredLogs.length > 0 ? filteredLogs : logs;
    if (targetLogs.length === 0) {
      setExportNotice("No audit log records available to export.");
      setTimeout(() => setExportNotice(null), 4000);
      return;
    }
    exportAuditLogsToCsv(targetLogs);
    setExportNotice(`Exported ${targetLogs.length} audit log record(s) to CSV.`);
    setTimeout(() => setExportNotice(null), 4000);
  }, [filteredLogs, logs]);

  return {
    state: {
      logs,
      filteredLogs,
      activeTab,
      counts: {
        all: logs.length,
        receipts: receiptLogs.length,
        adoptions: adoptionLogs.length,
        system: systemLogs.length,
      },
      receiptLogsCount: receiptLogs.length,
      isLoading,
      error,
      filter,
      exportNotice,
    },
    handlers: {
      setFilter,
      setActiveTab,
      loadLogs,
      handleExportReceiptsCsv,
      handleExportAuditTrailCsv,
      setExportNotice,
    },
  };
}
