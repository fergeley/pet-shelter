import { Metadata } from "next";

import { FaqBrowser } from "@/components/features/faq/FaqBrowser";
import {
  getServerFaqCategoriesAsync,
  getServerFaqsAsync,
} from "@/lib/server/faqRepository";

export const metadata: Metadata = {
  title: "Frequently Asked Questions | Hope for Strays (Petaling Jaya)",
  description:
    "Answers on TNRM and community animals, adoption fees and home visits, sponsorship and LHDN tax receipts, volunteering, and visiting our Petaling Jaya sanctuary.",
};

/**
 * FAQ content is edited by staff at /admin/faqs, so this page must always
 * reflect the database rather than a value captured at build time.
 */
export const dynamic = "force-dynamic";

export default async function FaqPage() {
  // Independent reads of the same source, so they run together.
  const [faqs, categories] = await Promise.all([
    getServerFaqsAsync(),
    getServerFaqCategoriesAsync(),
  ]);

  return (
    <div className="min-h-screen bg-card py-12 sm:py-16">
      <div className="w-full px-6 sm:px-8 lg:px-12">
        <div className="mb-10 max-w-2xl">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Frequently Asked Questions
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2 leading-relaxed">
            Everything adopters, volunteers, sponsors and neighbours ask us most —
            TNRM and community animals, adoption and fostering, tax-deductible
            giving, and how to find us in Petaling Jaya.
          </p>
        </div>

        <FaqBrowser faqs={faqs} categories={categories} />
      </div>
    </div>
  );
}
