"use client";

import { Button } from "@/components/ui/button";
import { 
  ShieldCheck, 
  RotateCw, 
  Clock, 
  User, 
  FileText, 
  AlertCircle, 
  Search,
  Download,
  Receipt,
  CheckCircle2,
  HeartHandshake,
  Settings,
  Layers
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuditLogController, AuditTabFilter } from "@/hooks/useAuditLogController";

export function AuditLogViewer() {
  const { state, handlers } = useAuditLogController();
  const { filteredLogs, counts, activeTab, isLoading, error, filter, exportNotice } = state;
  const { setFilter, setActiveTab, loadLogs, handleExportReceiptsCsv, handleExportAuditTrailCsv } = handlers;

  const tabs: { id: AuditTabFilter; label: string; icon: typeof Layers; count: number }[] = [
    { id: "all", label: "All Audit Records", icon: Layers, count: counts.all },
    { id: "receipts", label: "LHDN Tax Receipts", icon: Receipt, count: counts.receipts },
    { id: "adoptions", label: "Adoptions & Pets", icon: HeartHandshake, count: counts.adoptions },
    { id: "system", label: "Auth & Security", icon: Settings, count: counts.system },
  ];

  return (
    <div className="space-y-6">
      {/* Header Info & Actions */}
      <div className="border border-border bg-background p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center bg-emerald-800 text-white dark:bg-emerald-950 dark:text-emerald-300">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Immutable Audit & Security Trail</h2>
            <p className="text-xs text-muted-foreground">
              Append-only ledger of staff mutations, LHDN Section 44(6) tax receipts, and ROS AGM compliance activity.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 1-Click LHDN Receipts CSV Export */}
          <Button
            variant="outline"
            size="xs"
            onClick={handleExportReceiptsCsv}
            disabled={isLoading}
            className="text-xs gap-1.5 font-semibold bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300 hover:bg-emerald-100/70"
            title="Export official donation receipts formatted for Malaysian LHDN Section 44(6) tax reporting"
          >
            <Receipt className="size-3.5" />
            <span>Export Receipts CSV (LHDN)</span>
            {counts.receipts > 0 && (
              <span className="px-1.5 py-0.2 bg-emerald-800 text-white dark:bg-emerald-700 text-[10px] font-bold rounded-xs">
                {counts.receipts}
              </span>
            )}
          </Button>

          {/* 1-Click Full Audit Trail CSV Export for ROS AGM */}
          <Button
            variant="outline"
            size="xs"
            onClick={handleExportAuditTrailCsv}
            disabled={isLoading}
            className="text-xs gap-1.5 font-semibold"
            title="Export immutable audit trail for ROS AGM reporting and compliance"
          >
            <Download className="size-3.5" />
            Export Audit Trail (ROS)
          </Button>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="xs"
            onClick={loadLogs}
            disabled={isLoading}
            className="text-xs gap-1.5"
          >
            <RotateCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Export Status Notification */}
      {exportNotice && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2 animate-in fade-in-50">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 border-b border-border pb-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border transition-colors ${
                  isActive
                    ? "bg-foreground text-background border-foreground font-bold shadow-xs"
                    : "bg-background text-foreground border-border hover:bg-muted/50"
                }`}
              >
                <Icon className="size-3.5" />
                <span>{tab.label}</span>
                <span
                  className={`ml-1 px-1.5 py-0.2 text-[10px] rounded-xs font-mono font-bold ${
                    isActive ? "bg-background text-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Filter by action, staff email, entity ID, receipt number, donor name..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9 text-xs sm:text-sm py-2 bg-background"
          />
        </div>
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
            <p className="text-xs">Staff actions, donation receipts, and approvals will appear here as records are recorded.</p>
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
                {filteredLogs.map((log) => {
                  const isDonation =
                    log.action === "DONATION_RECEIVED" ||
                    log.entity === "DonationReceipt" ||
                    Boolean(log.details && typeof log.details === "object" && "receiptNumber" in log.details);

                  const details = (log.details || {}) as Record<string, unknown>;

                  return (
                    <tr key={log.id} className={`hover:bg-muted/20 transition-colors ${isDonation ? "bg-emerald-50/30 dark:bg-emerald-950/15" : ""}`}>
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
                        <span className={`inline-block mt-0.5 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider border ${
                          isDonation 
                            ? "bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700" 
                            : "bg-muted border-border"
                        }`}>
                          {log.actorRole}
                        </span>
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <span className={`font-mono text-xs font-bold px-2 py-0.5 border ${
                          isDonation 
                            ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800" 
                            : "bg-primary/10 text-foreground border-primary/20"
                        }`}>
                          {log.action}
                        </span>
                        {isDonation && details.amountMYR !== undefined && (
                          <span className="block mt-1 font-mono text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                            RM {Number(details.amountMYR).toFixed(2)}
                          </span>
                        )}
                      </td>

                      <td className="p-3 whitespace-nowrap font-mono text-xs text-foreground">
                        <div>
                          <span className="text-muted-foreground">{log.entity}: </span>
                          <strong className="text-foreground">{log.entityId}</strong>
                        </div>
                        {isDonation && details.donorName ? (
                          <span className="block text-[11px] text-muted-foreground font-sans font-medium">
                            Donor: {String(details.donorName)}
                          </span>
                        ) : null}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
