"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { fetchAuditLogsAction } from "@/actions/audit";
import { AuditEntry } from "@/lib/domain/auditLog";

export function useAuditLogController() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const loadLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetchAuditLogsAction();
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
        const res = await fetchAuditLogsAction();
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

  const filteredLogs = useMemo(() => {
    if (!filter.trim()) return logs;
    const q = filter.toLowerCase();
    return logs.filter(
      (log) =>
        log.action.toLowerCase().includes(q) ||
        log.actorEmail.toLowerCase().includes(q) ||
        log.entity.toLowerCase().includes(q) ||
        (log.entityId && log.entityId.toLowerCase().includes(q))
    );
  }, [logs, filter]);

  return {
    state: {
      logs,
      filteredLogs,
      isLoading,
      error,
      filter,
    },
    handlers: {
      setFilter,
      loadLogs,
    },
  };
}
