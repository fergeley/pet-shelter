"use client";

import React, { useState, useEffect, useTransition, useRef } from "react";
import { PhoneCall, ChevronDown, MessageCircle } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { FaqItem } from "@/types/faq";
import { getFaqsAction } from "@/actions/faqs";
import { getFaqCategoryLabel } from "@/lib/presentation/categoryTabs";
import { Section } from "@/components/layout/Section";
import { buttonVariants } from "@/components/ui/button";

export function FaqSection({
  initialFaqs,
}: { initialFaqs?: FaqItem[] } = {}) {
  const { isMs } = useLanguage();
  const [faqs, setFaqs] = useState<FaqItem[]>(initialFaqs || []);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (initialFaqs && initialFaqs.length > 0) return;
    }

    startTransition(async () => {
      const res = await getFaqsAction();
      if (res.success && res.data) {
        setFaqs(res.data);
      }
    });
  }, [initialFaqs]);

  const toggleAccordion = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <Section id="faq">
      <div className="space-y-12">
        {/* Header: left-aligned, page-title scale (docs/page-style-guide.md §3). */}
        <div className="space-y-6">
          <h1 className="font-heading text-3xl font-bold leading-[1.15] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            {isMs ? "Soalan Lazim" : "Frequently Asked Questions"}
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            {isMs
              ? "Adopsi, penajaan, sumbangan, TNRM dan lawatan santuari — semuanya di satu tempat."
              : "Adoption, sponsorship, donations, TNRM and visiting the sanctuary — all in one place."}
          </p>
        </div>

        {/* Accordion FAQ List — full container width, like every card grid. */}
        <div className="space-y-4">
          {isPending && faqs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {isMs ? "Memuatkan soalan lazim..." : "Loading FAQs..."}
            </div>
          ) : (
            faqs.map((faq) => {
              const isOpen = openIds.has(faq.id);
              return (
                <div
                  key={faq.id}
                  className="overflow-hidden rounded-3xl border border-border bg-work-panel shadow-xs transition-colors hover:border-primary/40"
                >
                  <button
                    onClick={() => toggleAccordion(faq.id)}
                    aria-expanded={isOpen}
                    className="flex w-full cursor-pointer items-start justify-between gap-4 p-6 text-left sm:p-7"
                  >
                    <div className="space-y-1">
                      <span className="block text-2xs font-bold uppercase tracking-wider text-primary">
                        {getFaqCategoryLabel(faq.category, isMs)}
                      </span>
                      <h3 className="font-heading text-xl font-bold leading-snug tracking-tight text-foreground">
                        {isMs ? faq.questionMs : faq.question}
                      </h3>
                    </div>
                    <ChevronDown
                      className={`size-5 text-muted-foreground shrink-0 mt-1 transition-transform duration-200 ${
                        isOpen ? "rotate-180 text-foreground" : ""
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="border-t border-border px-6 pb-6 text-base leading-relaxed text-muted-foreground sm:px-7 sm:pb-7">
                      <p className="mt-3.5 whitespace-pre-line">{isMs ? faq.answerMs : faq.answer}</p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Contact Banner */}
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-border bg-muted/30 p-6 sm:flex-row sm:items-center sm:p-7">
          <div className="space-y-2">
            <p className="font-heading text-xl font-bold tracking-tight text-foreground">
              {isMs
                ? "Ada soalan mengenai haiwan reskue atau program TNRM kami?"
                : "Have questions about an animal or reporting a stray?"}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {isMs
                ? "Hubungi meja santuari Petaling Jaya kami Selasa hingga Ahad, 10:00 pagi – 5:00 petang."
                : "Call our shelter desk in Petaling Jaya Tuesday through Sunday, 10:00 AM – 5:00 PM."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <a
              href="tel:+60378765432"
              className={buttonVariants({ variant: "outline", className: "gap-2" })}
            >
              <PhoneCall className="size-3.5" />
              03-7876 5432
            </a>
            <a
              href="https://wa.me/60123456789?text=Hi%20Hope%20for%20Strays%2C%20I%20have%20a%20question%20regarding%20the%20shelter."
              target="_blank"
              rel="noopener noreferrer"
              // Not buttonVariants: its default fill would clash with the brand colour (page-style-guide §8.1).
              className="inline-flex h-10 items-center gap-2 rounded-control bg-brand-whatsapp px-6 text-xs font-semibold uppercase tracking-widest text-white shadow-brand-xs transition-colors hover:bg-brand-whatsapp-hover"
            >
              <MessageCircle className="size-3.5" />
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    </Section>
  );
}
