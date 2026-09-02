"use client";

import React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Award,
  ArrowRight,
  HeartHandshake,
  Receipt,
  ScrollText,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/LanguageProvider";
import {
  TransparencySnapshot,
  formatLongDate,
  formatMYR,
} from "@/lib/domain/transparency";
import { ALLOCATION_SCOPE, ALLOCATION_PALETTE_CSS } from "./palette";
import { ExpenseAllocationChart } from "./ExpenseAllocationChart";
import { ImpactStatHighlights } from "./ImpactStatHighlights";
import { RecentPurchasesFeed } from "./RecentPurchasesFeed";
import { FinancialReportsTable } from "./FinancialReportsTable";

/**
 * "Where Your Money Goes" — the public accountability page.
 *
 * Presentational only: the snapshot is fetched on the server and handed down,
 * so the allocation percentages the reader sees are the same derived figures
 * the donate page and the admin editor read.
 */
/**
 * States the provenance of the figures whenever they are not real ledger rows.
 *
 * A transparency page must never let a reader mistake development sample data,
 * or a failed read, for verified spending — so this is rendered above
 * everything else rather than tucked away.
 */
function LedgerSourceNotice({ source }: { source: TransparencySnapshot["source"] }) {
  const { isMs } = useLanguage();

  if (source === "database") return null;

  const isSample = source === "sample";

  return (
    <div
      role="status"
      className="border-b border-amber-500/40 bg-amber-50 px-6 py-3 text-center text-xs font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <span className="inline-flex items-center gap-2">
        <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
        {isSample
          ? isMs
            ? "Data contoh pembangunan — angka di halaman ini bukan rekod perbelanjaan sebenar."
            : "Development sample data — the figures on this page are not real spending records."
          : isMs
            ? "Lejar kewangan tidak dapat dimuatkan buat masa ini. Sila cuba sebentar lagi."
            : "The financial ledger could not be loaded right now. Please check back shortly."}
      </span>
    </div>
  );
}

export function TransparencyPageView({ snapshot }: { snapshot: TransparencySnapshot }) {
  const { t, isMs } = useLanguage();
  const hasLedger = snapshot.totalSen > 0;

  return (
    <div className={`${ALLOCATION_SCOPE} flex min-h-screen flex-col bg-background`}>
      {/* Categorical palette, defined once for every chart on this page. */}
      <style>{ALLOCATION_PALETTE_CSS}</style>

      <LedgerSourceNotice source={snapshot.source} />

      {/* 1. Hero */}
      <section className="border-b border-border bg-card py-14 sm:py-18 lg:py-22">
        <div className="mx-auto w-full max-w-6xl px-6 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-3xl space-y-4 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-primary">
              <Wallet className="size-4" />
              {isMs ? "Ketelusan Kewangan Penuh" : "Full Financial Transparency"}
            </div>

            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              {isMs ? "Ke Mana Wang Anda Pergi" : "Where Your Money Goes"}
            </h1>

            <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
              {isMs
                ? "Setiap peratusan pada halaman ini dikira terus daripada lejar perbelanjaan kami yang disahkan — bukan angka anggaran. Semak setiap resit, muat turun setiap penyata teraudit, dan lihat sendiri ke mana setiap ringgit disalurkan."
                : "Every percentage on this page is computed directly from our verified expense ledger — not an estimate. Inspect every receipt, download every audited statement, and see exactly where each ringgit goes."}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-3 text-xs font-semibold sm:text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/60 px-3 py-1 text-foreground">
                <ShieldCheck className="size-4 text-emerald-600" />
                {t("donations.rosBadge", "ROS Reg: PPM-012-10-18042016")}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/30 bg-emerald-950/10 px-3 py-1 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Award className="size-4 text-emerald-600" />
                {t("donations.lhdnBadge", "LHDN Tax Deductible: Sec 44(6) ITA 1967")}
              </span>
              {snapshot.lastExpenseDate && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/60 px-3 py-1 text-foreground">
                  <Receipt className="size-4 text-primary" />
                  {isMs ? "Dikemas kini" : "Updated"}{" "}
                  {formatLongDate(snapshot.lastExpenseDate, isMs)}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Impact highlights */}
      <section className="border-b border-border bg-muted/20 py-14 sm:py-18">
        <div className="mx-auto w-full max-w-6xl space-y-8 px-6 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-primary">
              {isMs ? "Impak Terkini" : "Measured Impact"}
            </span>
            <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {isMs ? "Apa Yang Sumbangan Anda Capai" : "What Your Giving Achieved"}
            </h2>
          </div>
          <ImpactStatHighlights stats={snapshot.impactStats} />
        </div>
      </section>

      {/* 3. Expense allocation */}
      <section
        id="allocation"
        className="border-b border-border bg-card py-14 sm:py-18"
      >
        <div className="mx-auto w-full max-w-6xl space-y-10 px-6 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-primary">
              {isMs ? "Pecahan Perbelanjaan" : "Expense Breakdown"}
            </span>
            <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {isMs
                ? "Bagaimana Setiap Ringgit Diperuntukkan"
                : "How Every Ringgit Is Allocated"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {hasLedger
                ? isMs
                  ? `Peratusan di bawah dijumlahkan daripada ${formatMYR(snapshot.totalSen)} perbelanjaan yang disahkan dan direkodkan dalam lejar awam kami. Angka ini berubah secara automatik apabila perbelanjaan baharu direkodkan.`
                  : `The shares below are summed from ${formatMYR(snapshot.totalSen)} of verified expenses recorded in our public ledger. They move automatically as new spending is recorded — nobody types a percentage.`
                : isMs
                  ? "Setiap peratusan di halaman ini dikira terus daripada lejar perbelanjaan kami. Tiada perbelanjaan diterbitkan lagi untuk tempoh ini."
                  : "Every share on this page is computed directly from our expense ledger. No spending has been published for this period yet."}
            </p>
          </div>

          <ExpenseAllocationChart
            allocation={snapshot.allocation}
            totalSen={snapshot.totalSen}
          />
        </div>
      </section>

      {/* 4. Recent verified purchases */}
      <section className="border-b border-border bg-muted/20 py-14 sm:py-18">
        <div className="mx-auto w-full max-w-6xl space-y-8 px-6 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-primary">
              {isMs ? "Lejar Awam" : "Public Ledger"}
            </span>
            <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {isMs ? "Perbelanjaan Terkini Yang Disahkan" : "Recent Verified Purchases"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {isMs
                ? "Setiap baris memaparkan rujukan invois klinik atau pembekal. Hubungi kami untuk memeriksa mana-mana resit asal."
                : "Each entry carries its clinic or supplier invoice reference. Contact us to inspect any original receipt."}
            </p>
          </div>

          <RecentPurchasesFeed
            items={snapshot.expenses}
            hasMore={snapshot.hasMoreExpenses}
            totalCount={snapshot.expenseCount}
          />
        </div>
      </section>

      {/* 5. Audit & spending reports */}
      <section className="border-b border-border bg-card py-14 sm:py-18">
        <div className="mx-auto w-full max-w-6xl space-y-8 px-6 sm:px-8 lg:px-12">
          <div className="max-w-2xl">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-primary">
              {isMs ? "Pematuhan ROS & AGM" : "ROS & AGM Compliance"}
            </span>
            <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {isMs
                ? "Laporan Audit & Perbelanjaan Tahunan"
                : "Annual Audit & Spending Reports"}
            </h2>
            <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
              <ScrollText className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <span>
                {isMs
                  ? "Penyata teraudit yang difailkan kepada Pendaftar Pertubuhan (ROS) dan dibentangkan pada Mesyuarat Agung Tahunan kami."
                  : "Audited statements filed with the Registrar of Societies (ROS) and tabled at our Annual General Meeting."}
              </span>
            </p>
          </div>

          <FinancialReportsTable reports={snapshot.reports} />
        </div>
      </section>

      {/* 6. Closing CTA */}
      <section className="bg-muted/20 py-14 sm:py-18">
        <div className="mx-auto w-full max-w-3xl space-y-4 px-6 text-center sm:px-8">
          <HeartHandshake className="mx-auto size-8 text-primary" aria-hidden="true" />
          <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {isMs
              ? "Sumbangan Anda Muncul Dalam Lejar Ini"
              : "Your Donation Shows Up In This Ledger"}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            {isMs
              ? "Setiap sumbangan menerima e-Resit potongan cukai LHDN rasmi dengan serta-merta, dan perbelanjaan yang dibiayainya disenaraikan di halaman ini."
              : "Every contribution receives an official LHDN tax-deductible e-Receipt instantly, and the spending it funds is listed on this page."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/donate"
              className={buttonVariants({
                size: "lg",
                className:
                  "gap-2 rounded-xl px-8 text-sm font-bold uppercase tracking-wider shadow-xs",
              })}
            >
              {isMs ? "Menderma Sekarang" : "Donate Now"}
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/pets"
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className:
                  "gap-2 rounded-xl px-8 text-sm font-bold uppercase tracking-wider",
              })}
            >
              {isMs ? "Lihat Haiwan Kami" : "Meet Our Animals"}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
