"use client";

import React, { useState } from "react";
import { Table2, PieChart } from "lucide-react";
import { AllocationSlice, formatMYR } from "@/lib/domain/transparency";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { categoryVar } from "./palette";

/**
 * Expense allocation, as a 100% stacked bar plus a ranked breakdown.
 *
 * Form: part-to-whole with five long-named categories. A horizontal stacked bar
 * beats a donut here — readers must compare adjacent shares (18% vs 12%), which
 * arc length does badly, and the category names have nowhere to sit around a
 * circle.
 *
 * Colour: the five categorical slots in `EXPENSE_CATEGORIES`, validated for
 * colourblind separation and normal-vision separation in both light and dark
 * mode. Three light-mode slots fall below 3:1 against the cream surface, so the
 * relief rule applies: every share carries a visible direct label and a full
 * table view is one click away. Colour is never the only channel.
 *
 * The bar itself is presentational. It carries no focusable controls — five
 * buttons that only change a hover tint would make keyboard users tab through
 * five no-op stops to reach information the ranked cards below already state in
 * text.
 */

interface Props {
  allocation: AllocationSlice[];
  totalSen: number;
}

const MIN_PERCENT_FOR_INLINE_LABEL = 14;

export function ExpenseAllocationChart({ allocation, totalSen }: Props) {
  const { isMs } = useLanguage();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  if (allocation.length === 0 || totalSen <= 0) {
    return (
      <div className="rounded-2xl border border-border bg-background p-8 text-center">
        <p className="text-sm text-muted-foreground">
          {isMs
            ? "Belum ada perbelanjaan diterbitkan untuk tempoh ini."
            : "No published expenses for this period yet."}
        </p>
      </div>
    );
  }

  const label = (slice: AllocationSlice) =>
    isMs ? slice.meta.labelMs : slice.meta.label;

  const entryCount = allocation.reduce((n, s) => n + s.itemCount, 0);

  return (
    <figure className="m-0 space-y-6">
      {/* 100% stacked allocation bar. The 2px gaps are surface showing through,
          not strokes — a border around each segment would add non-data ink.
          Hidden from assistive tech: the ranked list and table carry the data. */}
      <div className="flex w-full gap-[2px] overflow-hidden rounded-md bg-card" aria-hidden="true">
        {allocation.map((slice, idx) => (
          <div
            key={slice.key}
            onMouseEnter={() => setActiveKey(slice.key)}
            onMouseLeave={() => setActiveKey(null)}
            style={{
              width: `${slice.percent}%`,
              backgroundColor: categoryVar(slice.key),
            }}
            className={`flex h-6 min-w-[2px] items-center justify-center transition-opacity ${
              idx === 0 ? "rounded-l-md" : ""
            } ${idx === allocation.length - 1 ? "rounded-r-md" : ""} ${
              activeKey && activeKey !== slice.key ? "opacity-45" : "opacity-100"
            }`}
          >
            {/* Inline label only where it demonstrably fits; below 14% of the
                track it goes to the card beneath rather than being clipped. */}
            {slice.percent >= MIN_PERCENT_FOR_INLINE_LABEL && (
              <span className="hidden text-2xs font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)] sm:block">
                {slice.percent}%
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Ranked breakdown. Doubles as the legend (a swatch beside every name) and
          as the direct-label layer the light-mode contrast relief requires. */}
      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {allocation.map((slice) => (
          <li
            key={slice.key}
            onMouseEnter={() => setActiveKey(slice.key)}
            onMouseLeave={() => setActiveKey(null)}
            className={`rounded-2xl border border-border bg-background p-4 transition-colors ${
              activeKey === slice.key ? "border-foreground/40 bg-muted/40" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <span
                  aria-hidden="true"
                  style={{ backgroundColor: categoryVar(slice.key) }}
                  className="mt-1 size-3 shrink-0 rounded-full"
                />
                <div className="min-w-0">
                  <p className="font-heading text-sm font-bold leading-snug text-foreground">
                    {label(slice)}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {isMs ? slice.meta.blurbMs : slice.meta.blurb}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-heading text-xl font-extrabold tabular-nums text-foreground">
                  {slice.percent}%
                </div>
                <div className="text-2xs font-semibold tabular-nums text-muted-foreground">
                  {formatMYR(slice.totalSen)}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {showTable && (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <caption className="sr-only">
              {isMs
                ? "Peruntukan perbelanjaan mengikut kategori"
                : "Expense allocation by category"}
            </caption>
            <thead>
              <tr className="bg-muted/40 text-left">
                <th scope="col" className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isMs ? "Kategori" : "Category"}
                </th>
                <th scope="col" className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isMs ? "Jumlah" : "Amount"}
                </th>
                <th scope="col" className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isMs ? "Peratus" : "Share"}
                </th>
                <th scope="col" className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {isMs ? "Rekod" : "Entries"}
                </th>
              </tr>
            </thead>
            <tbody>
              {allocation.map((slice) => (
                <tr key={slice.key} className="border-t border-border">
                  <th scope="row" className="px-4 py-2.5 text-left font-semibold text-foreground">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        style={{ backgroundColor: categoryVar(slice.key) }}
                        className="size-2.5 shrink-0 rounded-full"
                      />
                      {label(slice)}
                    </span>
                  </th>
                  <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                    {formatMYR(slice.totalSen)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                    {slice.percent}%
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                    {slice.itemCount}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/30">
                <th scope="row" className="px-4 py-2.5 text-left font-bold text-foreground">
                  {isMs ? "Jumlah keseluruhan" : "Total"}
                </th>
                <td className="px-4 py-2.5 text-right font-bold tabular-nums text-foreground">
                  {formatMYR(totalSen)}
                </td>
                <td className="px-4 py-2.5 text-right font-bold tabular-nums text-foreground">
                  100%
                </td>
                <td className="px-4 py-2.5 text-right font-bold tabular-nums text-muted-foreground">
                  {entryCount}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Last child of <figure>, as the element requires. */}
      <figcaption className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <span className="text-xs text-muted-foreground">
          {isMs
            ? `Dikira daripada ${entryCount} rekod perbelanjaan disahkan · Jumlah ${formatMYR(totalSen)}`
            : `Computed from ${entryCount} verified expense records · Total ${formatMYR(totalSen)}`}
        </span>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          aria-expanded={showTable}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
        >
          {showTable ? <PieChart className="size-3.5" /> : <Table2 className="size-3.5" />}
          {showTable
            ? isMs
              ? "Sembunyikan jadual"
              : "Hide table"
            : isMs
              ? "Lihat sebagai jadual"
              : "View as table"}
        </button>
      </figcaption>
    </figure>
  );
}
