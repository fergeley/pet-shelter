import { Metadata } from "next";
import { getPublicFaqs } from "@/actions/faqs";
import { FaqBrowser } from "@/components/features/faq/FaqBrowser";

export const metadata: Metadata = {
  title: "Frequently Asked Questions | Hope for Strays (Petaling Jaya)",
  description:
    "Answers on adoption fees and home visits, volunteering and fostering, stray animal care, TNRM, owner surrenders, and visiting hours at our Petaling Jaya sanctuary.",
};

/**
 * FAQ content is edited by staff at /admin/faqs, so this page must always
 * reflect the database rather than a value captured at build time.
 */
export const dynamic = "force-dynamic";

export default async function FaqPage() {
  const faqs = await getPublicFaqs();

  return (
    <div className="min-h-screen bg-card py-12 sm:py-16">
      <div className="w-full px-6 sm:px-8 lg:px-12">
        <div className="mb-10 max-w-2xl">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Frequently Asked Questions
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2 leading-relaxed">
            Everything adopters, volunteers and neighbours ask us most — adoption
            fees and home visits, fostering, stray and community animal care, and
            how to find us in Petaling Jaya.
          </p>
        </div>

        <FaqBrowser faqs={faqs} />
      </div>
    </div>
  );
}
