"use client";

import { Printer, PawPrint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { tierLabel } from "@/lib/domain/supporterTier";
import { CertificateData } from "@/types/supporter";

/**
 * The annual sponsorship e-Certificate.
 *
 * Deliberately printable HTML rather than `@react-pdf/renderer` or a Canvas raster:
 *
 *  - The browser's own print-to-PDF produces a real PDF with selectable, searchable,
 *    screen-reader-legible text. A Canvas certificate is a picture of words.
 *  - It reuses the `[data-print-root]` print mechanism already in `globals.css`, which
 *    the donation receipt uses, instead of introducing a second way to print.
 *  - It adds no dependency to a project that already prints receipts this way.
 *
 * Every field is passed in from the server after the standing has been verified. Nothing
 * here is derived in the browser, so a sponsor cannot print themselves a Gold certificate
 * by editing the page.
 */
export function SponsorCertificate({ data }: { data: CertificateData }) {
  const { isMs } = useLanguage();
  const tier = tierLabel(data.tier, isMs);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-muted-foreground">
          {isMs
            ? "Cetak halaman ini, kemudian pilih “Simpan sebagai PDF” untuk memuat turun sijil anda."
            : "Print this page, then choose “Save as PDF” to download your certificate."}
        </p>
        <Button onClick={() => window.print()} className="gap-2 font-bold">
          <Printer className="size-4" aria-hidden />
          {isMs ? "Cetak / Simpan sebagai PDF" : "Print / Save as PDF"}
        </Button>
      </div>

      <article
        data-print-root
        className="mx-auto w-full max-w-3xl rounded-2xl border-2 border-border bg-white p-8 text-zinc-900 shadow-xs sm:p-12"
      >
        <header className="space-y-3 border-b-2 border-zinc-900/15 pb-6 text-center">
          <PawPrint className="mx-auto size-9 text-zinc-900" aria-hidden />
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-zinc-600">
            Hope for Strays Sanctuary
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            {isMs ? "Sijil Penajaan Tahunan" : "Annual Sponsorship Certificate"}
          </h1>
          <p className="text-sm font-semibold uppercase tracking-widest text-zinc-700">
            {isMs ? `Taraf ${tier}` : `${tier} Standing`}
          </p>
        </header>

        <div className="space-y-6 py-8 text-center">
          <p className="text-sm text-zinc-600">
            {isMs ? "Sijil ini dianugerahkan kepada" : "This certificate is awarded to"}
          </p>
          <p className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            {data.sponsorName}
          </p>
          <p className="mx-auto max-w-xl text-sm leading-relaxed text-zinc-700">
            {isMs
              ? `sebagai pengiktirafan atas sokongan penajaan bertaraf ${tier} sepanjang ${data.coveringPeriod}, yang membiayai penjagaan perubatan, pemakanan dan pemulihan haiwan terbiar di Selangor.`
              : `in recognition of ${tier}-standing sponsorship throughout ${data.coveringPeriod}, funding the veterinary care, nutrition and rehabilitation of stray animals across Selangor.`}
          </p>

          {data.rescueNames.length > 0 ? (
            <div className="space-y-1 pt-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                {isMs ? "Rescue yang ditaja" : "Rescues sponsored"}
              </p>
              <p className="text-base font-semibold">{data.rescueNames.join(" · ")}</p>
            </div>
          ) : null}
        </div>

        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 border-t-2 border-zinc-900/15 pt-6 text-xs sm:grid-cols-2">
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-600">
              {isMs ? "No. sijil" : "Certificate no."}
            </dt>
            <dd className="font-bold tabular-nums">{data.certificateNumber}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-600">{isMs ? "Dikeluarkan" : "Issued on"}</dt>
            <dd className="font-bold tabular-nums">{data.issuedOn}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-600">
              {isMs ? "Sumbangan diiktiraf" : "Recognised contribution"}
            </dt>
            <dd className="font-bold tabular-nums">
              RM {data.recognisedMYR.toLocaleString("en-MY")}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-600">
              {isMs ? "No. pendaftaran" : "Registration no."}
            </dt>
            <dd className="font-bold tabular-nums">{data.shelterRegistrationNo}</dd>
          </div>
        </dl>

        <footer className="mt-8 flex items-end justify-between gap-6 border-t-2 border-zinc-900/15 pt-6">
          <div className="space-y-1">
            <p className="font-heading text-lg italic">Dr. Sarah Tan</p>
            <p className="border-t border-zinc-400 pt-1 text-[11px] uppercase tracking-widest text-zinc-600">
              {isMs ? "Pengarah Perubatan" : "Veterinary Director"}
            </p>
          </div>
          <p className="max-w-[16rem] text-right text-[10px] leading-snug text-zinc-500">
            {isMs
              ? "Sijil pengiktirafan penajaan. Ini bukan resit cukai — sila rujuk e-Resit LHDN anda."
              : "Sponsorship recognition certificate. This is not a tax receipt — refer to your LHDN e-Receipt for tax purposes."}
          </p>
        </footer>
      </article>
    </div>
  );
}
