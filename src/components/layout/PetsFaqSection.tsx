"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { FaqContactBanner } from "@/components/features/faq/FaqContactBanner";
import { FaqEntry, resolveFaqCopy, sortFaqs } from "@/lib/domain/faq";

interface PetsFaqSectionProps {
  /**
   * Adoption FAQs, already resolved by the server.
   *
   * Required, and an empty array means "nothing is published" — the section
   * then renders nothing. It deliberately has no fallback of its own: an
   * optional prop could not tell "staff unpublished every adoption FAQ" apart
   * from "no data supplied", so an empty list used to resurrect the bundled
   * answers here while /faq correctly showed none. The bundled content is
   * substituted server-side in the page, and only when the database is
   * actually unreachable.
   *
   * Keeping the seed content out of this file also keeps it out of the /pets
   * client bundle: importing `getFallbackFaqs` here pulled the whole 15-entry
   * bilingual array (~20 KB of prose, most of it categories this component can
   * never show) into the browser on top of the rows already sent as props.
   */
  faqs: FaqEntry[];
  /** How many questions to surface before linking to the full FAQ page. */
  limit?: number;
}

export function PetsFaqSection({ faqs, limit = 4 }: PetsFaqSectionProps) {
  const { isMs } = useLanguage();

  const entries = useMemo(() => sortFaqs(faqs).slice(0, limit), [faqs, limit]);

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
        {isMs ? "Lihat semua soalan lazim" : "See all frequently asked questions"}
        <ArrowRight className="size-4" />
      </Link>

      <div className="mt-10">
        <FaqContactBanner
          title="Have questions about an animal in Petaling Jaya?"
          titleMs="Ada soalan mengenai haiwan reskue kami di Petaling Jaya?"
        />
      </div>
    </section>
  );
}
