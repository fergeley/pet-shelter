import { Metadata } from "next";
import { FaqSection } from "@/components/layout/FaqSection";
import { getServerFaqsAsync } from "@/lib/server/faqCatalog";

export const metadata: Metadata = {
  title: "Frequently Asked Questions | Hope for Strays",
  description:
    "Answers about adopting a rescue animal, sponsoring care, donations and LHDN tax receipts, our TNRM programme, and visiting the sanctuary.",
};

export default async function FaqPage() {
  const initialFaqs = await getServerFaqsAsync();

  return <FaqSection initialFaqs={initialFaqs} />;
}
