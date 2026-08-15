import { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck,
  Heart,
  MapPin,
  Clock,
  Phone,
  HelpCircle,
  CheckCircle2,
  Package,
  Award,
  ArrowRight,
  HeartHandshake,
} from "lucide-react";
import { DonationWidget } from "@/components/DonationWidget";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Donate & Sponsor Rescues | Hope for Strays Sanctuary Selangor",
  description:
    "Support lifesaving veterinary surgeries, core vaccinations, and daily nutrition for homeless animals in Petaling Jaya. 100% tax-deductible under LHDN Section 44(6).",
  openGraph: {
    title: "Donate & Sponsor Rescue Animals | Hope for Strays Selangor",
    description:
      "Support lifesaving veterinary surgeries, core vaccinations, and daily nutrition for homeless animals in Petaling Jaya. 100% tax-deductible under LHDN Section 44(6).",
    url: "https://hopeforstrays.org/donate",
    siteName: "Hope for Strays Sanctuary",
    locale: "en_MY",
    type: "website",
  },
  keywords: [
    "pet shelter donation Malaysia",
    "sponsor rescue dog Selangor",
    "animal welfare tax deductible LHDN",
    "Hope for Strays Petaling Jaya",
    "stray dog medical fund Malaysia",
    "DuitNow animal shelter donation",
  ],
};

export default function DonatePage() {
  const transparencyItems = [
    {
      percentage: "45%",
      title: "Veterinary Care & Surgeries",
      desc: "Emergency trauma surgeries, compulsory spay/neuter operations, 6-in-1 / FVRCP vaccinations, and specialized diagnostic tests.",
      color: "bg-emerald-600",
    },
    {
      percentage: "30%",
      title: "Daily Nutrition & Diets",
      desc: "Balanced high-protein kibbles, newborn puppy/kitten replacement formulas, and veterinary gastrointestinal recovery foods.",
      color: "bg-primary",
    },
    {
      percentage: "20%",
      title: "Sanctuary Boarding & Hygiene",
      desc: "Daily shelter sanitation, veterinary-grade disinfectants, clean bedding, utilities, and dedicated caretaker staff.",
      color: "bg-amber-600",
    },
    {
      percentage: "5%",
      title: "Stray Rescue Logistics",
      desc: "Humane trapping operations, urgent roadside rescue transport, and transit carriers across Selangor and Klang Valley.",
      color: "bg-blue-600",
    },
  ];

  const wishlistCategories = [
    {
      category: "Food & Nutritional Support",
      items: [
        "Dry Puppy & Kitten Kibble (Unopened bags)",
        "Adult Dog & Cat Kibbles (High protein brands)",
        "KMR or Esbilac powdered puppy/kitten milk",
        "Recovery canned wet food (Royal Canin / Hills)",
      ],
    },
    {
      category: "Sanitation & Medical Supplies",
      items: [
        "Clorox & veterinary hospital disinfectants (F10)",
        "Disposable heavy-duty absorbent pee pads",
        "Sterile medical gauze, bandages & surgical gloves",
        "Flea & tick spot-on preventatives (Frontline / Bravecto)",
      ],
    },
    {
      category: "Bedding, Enrichment & Comfort",
      items: [
        "Clean bath towels and fleece blankets",
        "Heavy-duty stainless steel dog & cat food bowls",
        "Durable rubber chew toys (Kongs) for kennel enrichment",
        "Standard 6-foot nylon dog leashes & sturdy collars",
      ],
    },
  ];

  const faqs = [
    {
      q: "Is my contribution tax-deductible in Malaysia?",
      a: "Yes! Pertubuhan Kebajikan Hope for Strays is an approved tax-exempt non-profit organisation under Subsection 44(6) of the Income Tax Act 1967 (Approval Ref: LHDN.01/35/42/51/179-6.4912). All monetary donations are eligible for official tax deductions on your individual or corporate tax return.",
    },
    {
      q: "How do I receive my official tax receipt?",
      a: "Upon completing your donation through our secure portal, your computer-generated official e-Receipt with full LHDN reference numbers is rendered instantly on-screen and automatically dispatched to your provided email address.",
    },
    {
      q: "Can corporate organizations donate and claim tax relief?",
      a: "Yes! Corporate donors can provide their official Company Name and SSM Registration Number in the donor form to generate a valid corporate tax-exemption receipt.",
    },
    {
      q: "How do I make a direct bank transfer or scan DuitNow QR?",
      a: "You can scan our national DuitNow QR code using any Malaysian banking app (Maybank MAE, CIMB Clicks, Touch 'n Go eWallet, Public Bank, etc.) or transfer directly to our Maybank Account: 5140 1234 5678 (Pertubuhan Kebajikan Hope for Strays).",
    },
    {
      q: "Can I sponsor a specific rescue pet?",
      a: "Absolutely! You can enter the name of any rescue pet in our 'Dedicate Donation' field, or click 'Sponsor Care' directly from any pet's profile page.",
    },
    {
      q: "Can I drop off physical supplies at the shelter?",
      a: "Yes! We welcome physical supply drop-offs at our Petaling Jaya sanctuary (No. 18, Jalan SS 2/72) from Tuesday to Sunday, 10:00 AM – 5:00 PM (Closed Mondays).",
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden bg-card border-b border-border py-14 sm:py-18 lg:py-22">
        <div className="w-full px-6 sm:px-8 lg:px-12 max-w-6xl mx-auto">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-bold uppercase tracking-wider">
              <HeartHandshake className="size-4" />
              Direct Rescue Giving & Sponsorship
            </div>

            <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
              Fuel Lifesaving Medical Care & Nutrition for Rescued Strays
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              Every ringgit directly supports emergency surgeries, core vaccinations, and wholesome meals at our Petaling Jaya sanctuary. Because of your generosity, 100% of our rescued animals are rehomed through our Free Adoption policy.
            </p>

            {/* Official Credentials Banner */}
            <div className="pt-3 flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm font-semibold">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-muted/60 border border-border rounded-lg text-foreground">
                <ShieldCheck className="size-4 text-emerald-600" />
                ROS Reg: PPM-021-10-18082021
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-950/10 dark:bg-emerald-950/40 border border-emerald-600/30 rounded-lg text-emerald-800 dark:text-emerald-300">
                <Award className="size-4 text-emerald-600" />
                LHDN Tax Deductible: Sec 44(6) ITA 1967
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-muted/60 border border-border rounded-lg text-foreground">
                <Heart className="size-4 text-primary" />
                100% Free Adoption Guarantee
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Interactive Giving Engine */}
      <section className="py-12 sm:py-16 bg-muted/20">
        <div className="w-full px-6 sm:px-8 lg:px-12 max-w-5xl mx-auto">
          <DonationWidget />
        </div>
      </section>

      {/* 3. Financial Transparency & Impact Visualizer */}
      <section className="py-14 sm:py-18 border-t border-border bg-card">
        <div className="w-full px-6 sm:px-8 lg:px-12 max-w-6xl mx-auto space-y-10">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-wider text-primary block mb-1">
              Financial Accountability
            </span>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Where Your Donation Goes
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground mt-2 leading-relaxed">
              We operate with strict financial transparency. Direct public donations are allocated entirely to animal medical treatment, high-protein sustenance, and sanitary shelter housing in Selangor.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {transparencyItems.map((item, idx) => (
              <div
                key={idx}
                className="border border-border bg-background p-6 rounded-2xl space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-heading text-3xl font-extrabold text-foreground">
                      {item.percentage}
                    </span>
                    <span className={`size-3 rounded-full ${item.color}`} />
                  </div>
                  <h3 className="font-heading text-base font-bold text-foreground">
                    {item.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden mt-4">
                  <div className={`h-full ${item.color}`} style={{ width: item.percentage }} />
                </div>
              </div>
            ))}
          </div>

          {/* Quick Impact Stats */}
          <div className="border border-border bg-muted/30 p-6 sm:p-8 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            <div className="space-y-1">
              <div className="font-heading text-3xl sm:text-4xl font-bold text-primary">
                420+
              </div>
              <div className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
                Animals Rescued & Treated in 2026
              </div>
            </div>

            <div className="space-y-1">
              <div className="font-heading text-3xl sm:text-4xl font-bold text-primary">
                100%
              </div>
              <div className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
                Spayed & Vaccinated Before Adoption
              </div>
            </div>

            <div className="space-y-1">
              <div className="font-heading text-3xl sm:text-4xl font-bold text-primary">
                RM 0
              </div>
              <div className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
                Adoption Fee Charged to Families
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Physical Supplies & Drop-off Wishlist */}
      <section className="py-14 sm:py-18 border-t border-border bg-muted/20">
        <div className="w-full px-6 sm:px-8 lg:px-12 max-w-6xl mx-auto space-y-10">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-wider text-primary block mb-1">
              In-Kind Giving
            </span>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Shelter Supplies Wishlist
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground mt-2 leading-relaxed">
              Prefer to donate items directly? We gladly accept physical drop-offs of unopened food, medical supplies, and shelter bedding at our Petaling Jaya sanctuary.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {wishlistCategories.map((cat, idx) => (
              <div
                key={idx}
                className="border border-border bg-card p-6 rounded-2xl space-y-4 shadow-xs"
              >
                <div className="flex items-center gap-2.5 border-b border-border pb-3">
                  <Package className="size-5 text-primary" />
                  <h3 className="font-heading text-base font-bold text-foreground">
                    {cat.category}
                  </h3>
                </div>
                <ul className="space-y-2.5 text-xs sm:text-sm text-foreground/90">
                  {cat.items.map((item, itemIdx) => (
                    <li key={itemIdx} className="flex items-start gap-2">
                      <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Sanctuary Drop-off Address Card */}
          <div className="border border-border bg-background p-6 sm:p-8 rounded-2xl shadow-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                  <MapPin className="size-4" /> Drop-off Location
                </div>
                <div className="font-bold text-foreground text-sm sm:text-base">
                  Hope for Strays Sanctuary
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  No. 18, Jalan SS 2/72, 47300 Petaling Jaya, Selangor, Malaysia
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                  <Clock className="size-4" /> Visiting & Drop-off Hours
                </div>
                <div className="font-bold text-foreground text-sm">
                  Tuesday – Sunday: 10:00 AM – 5:00 PM
                </div>
                <p className="text-xs text-muted-foreground">
                  Closed on Mondays for deep sanitisation
                </p>
              </div>

              <div className="space-y-3 md:text-right">
                <div className="flex items-center md:justify-end gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                  <Phone className="size-4" /> Direct Contact
                </div>
                <div>
                  <a
                    href="tel:+60378765432"
                    className="font-mono font-bold text-foreground text-base hover:underline"
                  >
                    03-7876 5432
                  </a>
                  <p className="text-xs text-muted-foreground">info@hopeforstrays.org</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Frequently Asked Questions */}
      <section className="py-14 sm:py-18 border-t border-border bg-card">
        <div className="w-full px-6 sm:px-8 lg:px-12 max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-primary block">
              Clear Answers
            </span>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Frequently Asked Questions About Donations
            </h2>
            <p className="text-sm text-muted-foreground">
              Have questions about your contribution, tax deductions, or payment methods?
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="border border-border bg-background p-5 sm:p-6 rounded-2xl space-y-2 shadow-xs"
              >
                <div className="flex items-start gap-2.5">
                  <HelpCircle className="size-4.5 text-primary shrink-0 mt-0.5" />
                  <h3 className="font-heading text-base font-bold text-foreground">
                    {faq.q}
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-7">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>

          {/* Bottom CTA to browse pets */}
          <div className="text-center pt-8 border-t border-border space-y-3">
            <p className="text-sm text-muted-foreground">
              Want to see the animals whose lives you are changing today?
            </p>
            <Link
              href="/pets"
              className={buttonVariants({
                size: "lg",
                className: "gap-2 px-8 font-bold text-sm uppercase tracking-wider shadow-xs",
              })}
            >
              <Heart className="size-4.5 fill-current" />
              Meet Our Adoptable Animals
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
