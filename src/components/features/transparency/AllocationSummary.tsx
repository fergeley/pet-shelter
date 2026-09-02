"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import {
  AllocationSlice,
  ImpactStatRecord,
  formatMYR,
} from "@/lib/domain/transparency";
import { getTransparencySnapshotAction } from "@/actions/transparency";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { ALLOCATION_SCOPE, allocationPaletteCss, categoryVar } from "./palette";

/**
 * Compact allocation + impact summary for pages other than /transparency.
 *
 * This exists so the donate page stops carrying its own hand-written split. It
 * previously hard-coded 45/30/20/5 while the ledger said something else — on a
 * page about financial honesty, two different answers is the actual bug. Both
 * surfaces now read the same derived snapshot.
 */
export function AllocationSummary() {
  const { isMs } = useLanguage();
  const [allocation, setAllocation] = useState<AllocationSlice[]>([]);
  const [stats, setStats] = useState<ImpactStatRecord[]>([]);
  const [totalSen, setTotalSen] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;

    getTransparencySnapshotAction()
      .then((snapshot) => {
        if (!active) return;
        setAllocation(snapshot.allocation);
        setStats(snapshot.impactStats);
        setTotalSen(snapshot.totalSen);
        setState("ready");
      })
      .catch(() => {
        // Better to show nothing than a stale split the ledger disagrees with.
        if (active) setState("error");
      });

    return () => {
      active = false;
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-background p-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {isMs ? "Memuatkan lejar perbelanjaan..." : "Loading the expense ledger..."}
      </div>
    );
  }

  if (state === "error" || allocation.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-background p-8 text-center">
        <p className="text-sm text-muted-foreground">
          {isMs
            ? "Pecahan perbelanjaan tidak dapat dimuatkan sekarang."
            : "The expense breakdown could not be loaded right now."}
        </p>
        <Link
          href="/transparency"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
        >
          {isMs ? "Lihat halaman ketelusan" : "Open the transparency page"}
          <ArrowRight className="size-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className={`${ALLOCATION_SCOPE} space-y-8`}>
      <style>{allocationPaletteCss()}</style>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {allocation.map((slice) => (
          <div
            key={slice.key}
            className="flex flex-col justify-between space-y-3 rounded-2xl border border-border bg-background p-6"
          >
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-heading text-3xl font-extrabold tabular-nums text-foreground">
                  {slice.percent}%
                </span>
                <span
                  aria-hidden="true"
                  className="size-3 rounded-full"
                  style={{ backgroundColor: categoryVar(slice.key) }}
                />
              </div>
              <h3 className="font-heading text-base font-bold text-foreground">
                {isMs ? slice.meta.labelMs : slice.meta.label}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {isMs ? slice.meta.blurbMs : slice.meta.blurb}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <div className="text-xs font-semibold tabular-nums text-muted-foreground">
                {formatMYR(slice.totalSen)}
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full"
                  style={{
                    width: `${slice.percent}%`,
                    backgroundColor: categoryVar(slice.key),
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {stats.length > 0 && (
        <dl className="grid grid-cols-1 gap-6 rounded-2xl border border-border bg-muted/30 p-6 text-center sm:grid-cols-3 sm:p-8">
          {stats.slice(0, 3).map((stat) => (
            <div key={stat.key} className="space-y-1">
              <dd className="font-heading text-3xl font-bold text-primary sm:text-4xl">
                {stat.metricValue}
              </dd>
              <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isMs && stat.labelMs ? stat.labelMs : stat.label}
              </dt>
            </div>
          ))}
        </dl>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <p className="text-xs text-muted-foreground">
          {isMs
            ? `Dikira daripada ${formatMYR(totalSen)} perbelanjaan yang disahkan.`
            : `Computed from ${formatMYR(totalSen)} of verified expenses.`}
        </p>
        <Link
          href="/transparency"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
        >
          {isMs
            ? "Lihat setiap resit dan laporan teraudit"
            : "See every receipt and audited report"}
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
