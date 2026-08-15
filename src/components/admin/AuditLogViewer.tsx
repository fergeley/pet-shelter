"use client";

import { Button } from "@/components/ui/button";
import { 
  ShieldCheck, 
  RotateCw, 
  Clock, 
  User, 
  FileText, 
  AlertCircle, 
  Search
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuditLogController } from "@/hooks/useAuditLogController";

export function AuditLogViewer() {
  const { state, handlers } = useAuditLogController();
  const { filteredLogs, isLoading, error, filter } = state;
  const { setFilter, loadLogs } = handlers;

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="border border-border bg-background p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center bg-emerald-800 text-white dark:bg-emerald-950 dark:text-emerald-300">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Immutable Audit & Security Trail</h2>
            <p className="text-xs text-muted-foreground">
              Append-only ledger of all staff mutations, status transitions, and authentication events.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="xs"
            onClick={loadLogs}
            disabled={isLoading}
            className="text-xs gap-1.5"
          >
            <RotateCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh Logs
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Filter by action, staff email, or entity ID..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="pl-9 text-xs sm:text-sm py-2 bg-background"
        />
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 p-3.5 text-xs text-destructive flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Logs Table */}
      <div className="border border-border bg-background overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground space-y-2">
            <FileText className="size-8 mx-auto opacity-40" />
            <p className="text-sm font-semibold">No audit records found.</p>
            <p className="text-xs">Staff actions will appear here as records are mutated or approved.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground uppercase font-bold tracking-wider text-[11px]">
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Actor & Role</th>
                  <th className="p-3">Action Event</th>
                  <th className="p-3">Entity & ID</th>
                  <th className="p-3">Details / Snapshot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3 whitespace-nowrap font-mono text-muted-foreground text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-3 text-foreground" />
                        <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{new Date(log.createdAt).toLocaleDateString()}</span>
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      <div className="font-semibold text-foreground flex items-center gap-1">
                        <User className="size-3 text-muted-foreground" />
                        {log.actorEmail}
                      </div>
                      <span className="inline-block mt-0.5 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider bg-muted border border-border">
                        {log.actorRole}
                      </span>
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      <span className="font-mono text-xs font-bold text-foreground bg-primary/10 px-2 py-0.5 border border-primary/20">
                        {log.action}
                      </span>
                    </td>

                    <td className="p-3 whitespace-nowrap font-mono text-xs text-foreground">
                      <div>
                        <span className="text-muted-foreground">{log.entity}: </span>
                        <strong className="text-foreground">{log.entityId}</strong>
                      </div>
                    </td>

                    <td className="p-3 text-[11px] font-mono text-muted-foreground max-w-xs truncate">
                      {log.details ? (
                        <pre className="bg-muted/50 p-1.5 border border-border text-[10px] whitespace-pre-wrap overflow-x-auto max-h-24">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      ) : (
                        <span className="text-muted-foreground italic">No extra metadata</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
