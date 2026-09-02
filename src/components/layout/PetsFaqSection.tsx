"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { PhoneCall, ArrowRight } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import {
  FaqEntry,
  getFallbackFaqs,
  resolveFaqCopy,
  sortFaqs,
} from "@/lib/domain/faq";

interface PetsFaqSectionProps {
  /**
   * Adoption FAQs loaded from the database by the parent page. When omitted,
   * the bundled launch content is used so this section still renders during a
   * database outage. Either way the copy comes from the single FAQ source
   * rather than a second hardcoded list that would drift from /faq.
   */
  faqs?: FaqEntry[];
  /** How many questions to surface before linking to the full FAQ page. */
  limit?: number;
}

export function PetsFaqSection({ faqs, limit = 4 }: PetsFaqSectionProps) {
  const { isMs } = useLanguage();

  const entries = useMemo(() => {
    const source =
      faqs && faqs.length > 0
        ? faqs
        : getFallbackFaqs().filter((f) => f.category === "ADOPTION");
    return sortFaqs(source).slice(0, limit);
  }, [faqs, limit]);

  if (entries.length === 0) return null;

  return (
    <section className="w-full px-6 sm:px-8 lg:px-12 pt-12 border-t border-border mt-10">
      <div className="mb-8 max-w-2xl">
        <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          {isMs ? "Soalan Lazim Mengenai Adopsi" : "Frequently Asked Questions"}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl">
        {entries.map((entry) => {
          const { question, answer } = resolveFaqCopy(entry, isMs);
          return (
            <div
              key={entry.id}
              className="border border-border bg-background p-6 space-y-2.5 rounded-2xl shadow-xs"
            >
              <h3 className="font-heading text-lg font-bold text-foreground">
                {question}
              </h3>
              <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
                {answer}
              </p>
            </div>
          );
        })}
      </div>

      <Link
        href="/faq"
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-foreground/75 transition-colors focus-visible:ring-2 rounded-md"
      >
        {isMs
          ? "Lihat semua soalan lazim"
          : "See all frequently asked questions"}
        <ArrowRight className="size-4" />
      </Link>

      {/* Contact Banner */}
      <div className="mt-10 bg-muted/40 border border-border p-6 max-w-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl">
        <div>
          <p className="text-base font-bold text-foreground">
            {isMs
              ? "Ada soalan mengenai haiwan reskue kami di Petaling Jaya?"
              : "Have questions about an animal in Petaling Jaya?"}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isMs
              ? "Hubungi meja santuari kami Selasa hingga Ahad, 10:00 pagi – 5:00 petang."
              : "Call our shelter desk Tuesday through Sunday, 10:00 AM – 5:00 PM."}
          </p>
        </div>
        <a
          href="tel:+60378765432"
          className="inline-flex items-center gap-2 bg-foreground text-background px-5 py-2.5 text-sm font-semibold uppercase tracking-wider hover:bg-foreground/85 transition-colors focus-visible:ring-2 shrink-0 rounded-xl"
        >
          <PhoneCall className="size-4" />
          03-7876 5432
        </a>
      </div>
    </section>
  );
}
