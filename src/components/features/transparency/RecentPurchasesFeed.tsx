"use client";

import React, { useMemo, useState } from "react";
import { BadgeCheck, Building2, PawPrint, ChevronDown } from "lucide-react";
import {
  EXPENSE_CATEGORIES,
  ExpenseItemRecord,
  formatLongDate,
  formatMYR,
  getCategoryMeta,
  groupExpensesByMonth,
} from "@/lib/domain/transparency";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { categoryVar } from "./palette";

/**
 * Chronological feed of verified shelter expenses, grouped by month.
 *
 * The category filter re-filters rows but never re-assigns colour: a category
 * keeps its hue whether it is one of five on screen or the only one left.
 */

const INITIAL_MONTHS = 3;

export function RecentPurchasesFeed({ items }: { items: ExpenseItemRecord[] }) {
  const { isMs } = useLanguage();
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [visibleMonths, setVisibleMonths] = useState(INITIAL_MONTHS);

  const filtered = useMemo(
    () =>
      categoryFilter === "ALL"
        ? items
        : items.filter((i) => i.category === categoryFilter),
    [items, categoryFilter]
  );

  const months = useMemo(
    () => groupExpensesByMonth(filtered, isMs),
    [filtered, isMs]
  );

  const shown = months.slice(0, visibleMonths);
  const hasMore = months.length > visibleMonths;

  return (
    <div className="space-y-6">
      {/* Filters sit in one row above the feed. */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setCategoryFilter("ALL");
            setVisibleMonths(INITIAL_MONTHS);
          }}
          aria-pressed={categoryFilter === "ALL"}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
            categoryFilter === "ALL"
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-background text-muted-foreground hover:text-foreground"
          }`}
        >
          {isMs ? "Semua kategori" : "All categories"}
        </button>

        {EXPENSE_CATEGORIES.map((cat) => {
          const isActive = categoryFilter === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => {
                setCategoryFilter(cat.key);
                setVisibleMonths(INITIAL_MONTHS);
              }}
              aria-pressed={isActive}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                isActive
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              <span
                aria-hidden="true"
                className="size-2 rounded-full"
                style={{ backgroundColor: categoryVar(cat.key) }}
              />
              {isMs ? cat.labelMs : cat.label}
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-border bg-background p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {isMs
              ? "Tiada perbelanjaan direkodkan bagi kategori ini."
              : "No expenses recorded in this category yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {shown.map((month) => (
            <section key={month.monthKey} className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2">
                <h3 className="font-heading text-base font-bold text-foreground">
                  {month.monthLabel}
                </h3>
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                  {isMs ? "Jumlah bulan" : "Month total"}: {formatMYR(month.subtotalSen)}
                </span>
              </div>

              <ul className="space-y-2.5 list-none p-0 m-0">
                {month.items.map((item) => {
                  const meta = getCategoryMeta(item.category);
                  return (
                    <li
                      key={item.id}
                      className="flex flex-col gap-2 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          aria-hidden="true"
                          className="mt-1.5 size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: categoryVar(item.category) }}
                        />
                        <div className="min-w-0 space-y-1.5">
                          <p className="text-sm font-semibold leading-snug text-foreground">
                            {item.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="font-medium">
                              {meta ? (isMs ? meta.labelMs : meta.label) : item.category}
                            </span>
                            <span aria-hidden="true">·</span>
                            <time dateTime={item.date}>
                              {formatLongDate(item.date, isMs)}
                            </time>
                            {item.vendorOrClinic && (
                              <span className="inline-flex items-center gap-1">
                                <Building2 className="size-3" aria-hidden="true" />
                                {item.vendorOrClinic}
                              </span>
                            )}
                            {item.petName && (
                              <span className="inline-flex items-center gap-1">
                                <PawPrint className="size-3" aria-hidden="true" />
                                {item.petName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                        <span className="font-heading text-base font-bold tabular-nums text-foreground">
                          {formatMYR(item.amountSen)}
                        </span>
                        {item.receiptRef && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                            <BadgeCheck className="size-3.5" aria-hidden="true" />
                            {item.receiptRef}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setVisibleMonths((v) => v + INITIAL_MONTHS)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-foreground hover:bg-muted"
          >
            <ChevronDown className="size-4" />
            {isMs ? "Papar bulan terdahulu" : "Show earlier months"}
          </button>
        </div>
      )}
    </div>
  );
}
