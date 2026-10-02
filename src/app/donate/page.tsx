"use client";

import { PUBLIC_ROS_REGISTRATION_NO } from "@/lib/domain/shelterIdentity";
import React, { Suspense } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Heart,
  MapPin,
  Clock,
  Phone,
  CheckCircle2,
  Package,
  Award,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Section, SectionHeader } from "@/components/layout/Section";

// Shared recipes from docs/page-style-guide.md §3 and §5.
const panel = "rounded-3xl border border-border bg-work-panel p-6 shadow-xs sm:p-7";
const eyebrow = "text-2xs font-bold uppercase tracking-wider text-primary";
const pill = "inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-foreground";
const iconTile = "flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground";
import { DonationWidget } from "@/components/features/donations/DonationWidget";
import { buttonVariants } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/LanguageProvider";

export default function DonatePage() {
  const { t, isMs } = useLanguage();

  const transparencyItems = [
    {
      percentage: "45%",
      title: isMs ? "Rawatan Veterinar & Pembedahan" : "Veterinary Care & Surgeries",
      desc: isMs
        ? "Pembedahan trauma kecemasan, pemandulan wajib, vaksinasi teras 6-dalam-1 / FVRCP, dan ujian makmal diagnostik khas."
        : "Emergency trauma surgeries, compulsory spay/neuter operations, 6-in-1 / FVRCP vaccinations, and specialized diagnostic tests.",
      color: "bg-success-solid",
    },
    {
      percentage: "30%",
      title: isMs ? "Nutrisi Harian & Diet Khas" : "Daily Nutrition & Diets",
      desc: isMs
        ? "Kibble berkualiti tinggi dan berprotein seimbang, formula susu anak anjing/kucing baru lahir, serta makanan pemulihan gastrousus."
        : "Balanced high-protein kibbles, newborn puppy/kitten replacement formulas, and veterinary gastrointestinal recovery foods.",
      color: "bg-primary",
    },
    {
      percentage: "20%",
      title: isMs ? "Kebersihan & Sanitasi Pusat Perlindungan" : "Sanctuary Boarding & Hygiene",
      desc: isMs
        ? "Sanitasi harian fasiliti, disinfektan gred hospital veterinar, alas tidur bersih, utiliti, dan pasukan penjaga berdedikasi."
        : "Daily shelter sanitation, veterinary-grade disinfectants, clean bedding, utilities, and dedicated caretaker staff.",
      color: "bg-warning-solid",
    },
    {
      percentage: "5%",
      title: isMs ? "Logistik Menyelamat Haiwan Terbiar" : "Stray Rescue Logistics",
      desc: isMs
        ? "Operasi perangkap berperikemanusiaan, pengangkutan kecemasan jalan raya, dan sangkar transit di seluruh Selangor dan Lembah Klang."
        : "Humane trapping operations, urgent roadside rescue transport, and transit carriers across Selangor and Klang Valley.",
      color: "bg-info-solid",
    },
  ];

  const wishlistCategories = [
    {
      category: isMs ? "Makanan & Nutrisi Haiwan" : "Food & Nutritional Support",
      items: isMs ? [
        "Kibble Kering Anak Anjing & Anak Kucing (Beg belum dibuka)",
        "Kibble Dewasa Anjing & Kucing (Jenama protein tinggi)",
        "Susu tepung anak anjing/kucing (KMR / Esbilac)",
        "Makanan basah pemulihan (Royal Canin / Hills)",
      ] : [
        "Dry Puppy & Kitten Kibble (Unopened bags)",
        "Adult Dog & Cat Kibbles (High protein brands)",
        "KMR or Esbilac powdered puppy/kitten milk",
        "Recovery canned wet food (Royal Canin / Hills)",
      ],
    },
    {
      category: isMs ? "Sanitasi & Bekalan Perubatan" : "Sanitation & Medical Supplies",
      items: isMs ? [
        "Kloroks & disinfektan veterinar (F10)",
        "Pelapik kencing serap cecair pakai buang (Pee pads)",
        "Kasa steril, pembalut luka & sarung tangan pembedahan",
        "Ubat kutu & sengkenit (Frontline / Bravecto)",
      ] : [
        "Clorox & veterinary hospital disinfectants (F10)",
        "Disposable heavy-duty absorbent pee pads",
        "Sterile medical gauze, bandages & surgical gloves",
        "Flea & tick spot-on preventatives (Frontline / Bravecto)",
      ],
    },
    {
      category: isMs ? "Alas Tidur & Keselesaan" : "Bedding, Enrichment & Comfort",
      items: isMs ? [
        "Tuala mandi bersih dan selimut 'fleece'",
        "Mangkuk makanan tahan karat (Stainless steel)",
        "Mainan getah tahan lasak (Kongs) untuk stimulasi minda",
        "Tali cawak nilon 6 kaki & kolar anjing kukuh",
      ] : [
        "Clean bath towels and fleece blankets",
        "Heavy-duty stainless steel dog & cat food bowls",
        "Durable rubber chew toys (Kongs) for kennel enrichment",
        "Standard 6-foot nylon dog leashes & sturdy collars",
      ],
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {/* 1. Title + giving form: one band, so the form reads as this page's content. */}
      <Section>
        <div className="space-y-12">
          <div className="space-y-6">
            <h1 className="font-heading text-3xl font-bold leading-[1.15] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              {isMs ? "Taja & Sumbang" : "Donate & Sponsor"}
            </h1>
            <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
              {isMs
                ? "Bantu selamatkan nyawa dan biayai rawatan haiwan terbiar. Setiap ringgit disalurkan terus bagi membiayai pembedahan kecemasan, vaksinasi lengkap, dan makanan berkhasiat di pusat perlindungan Petaling Jaya kami. Berkat keprihatinan anda, 100% haiwan reskue kami diserahkan kepada keluarga angkat secara percuma."
                : "Fuel lifesaving medical care and nutrition for rescued strays. Every ringgit directly supports emergency surgeries, core vaccinations, and wholesome meals at our Petaling Jaya sanctuary. Because of your generosity, 100% of our rescued animals are rehomed through our Free Adoption policy."}
            </p>

            {/* Official Credentials Banner */}
            <div className="pt-3 flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm font-semibold">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-muted/60 border border-border rounded-lg text-foreground">
                <ShieldCheck className="size-4 text-success-accent" />
                {t("donations.rosBadge", "ROS Reg: {regNo}", { regNo: PUBLIC_ROS_REGISTRATION_NO })}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-success-surface border border-success-accent/30 rounded-lg text-success-text ">
                <Award className="size-4 text-success-accent" />
                {t("donations.lhdnBadge", "LHDN Tax Deductible: Sec 44(6) ITA 1967")}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-muted/60 border border-border rounded-lg text-foreground">
                <Heart className="size-4 text-primary" />
                {isMs ? "Jaminan Adopsi 100% Percuma" : "100% Free Adoption Guarantee"}
              </span>
            </div>

            <Link href="/impact" className={buttonVariants({ variant: "outline", className: "gap-2" })}>
              {isMs ? "Lihat Laporan Impak" : "View impact report"}
              <ArrowRight className="size-4" />
            </Link>
          </div>

          <Suspense
            fallback={
              <div className="flex min-h-[300px] items-center justify-center rounded-3xl border border-border bg-work-panel p-12 text-muted-foreground">
                <Loader2 className="size-6 animate-spin mr-2" />
                <span>{isMs ? "Memuatkan borang sumbangan..." : "Loading donation form..."}</span>
              </div>
            }
          >
            <DonationWidget />
          </Suspense>
        </div>
      </Section>

      {/* 2. Financial transparency */}
      <Section>
        <div className="space-y-12">
          <SectionHeader
            title={isMs ? "Ke Mana Sumbangan Anda Disalurkan" : "Where Your Donation Goes"}
            subtitle={
              isMs
                ? "Kami beroperasi dengan ketelusan kewangan yang teliti. Sumbangan orang awam diperuntukkan sepenuhnya untuk rawatan perubatan, makanan berprotein tinggi, dan sanitasi fasiliti perlindungan di Selangor."
                : "We operate with strict financial transparency. Direct public donations are allocated entirely to animal medical treatment, high-protein sustenance, and sanitary shelter housing in Selangor."
            }
          />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {transparencyItems.map((item, idx) => (
              <div key={idx} className={`${panel} flex flex-col justify-between gap-6`}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-heading text-3xl font-bold tracking-tight text-foreground">
                      {item.percentage}
                    </span>
                    <span className={`size-3 rounded-full ${item.color}`} />
                  </div>
                  <h3 className="font-heading text-xl font-bold tracking-tight text-foreground">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className={`h-full ${item.color}`} style={{ width: item.percentage }} />
                </div>
              </div>
            ))}
          </div>

          {/* Quick impact stats */}
          <div className="grid grid-cols-1 gap-6 rounded-3xl border border-border bg-muted/30 p-6 sm:grid-cols-3 sm:p-7">
            {[
              { value: "420+", label: isMs ? "Haiwan Diselamatkan & Dirawat pada 2026" : "Animals Rescued & Treated in 2026" },
              { value: "100%", label: isMs ? "Dimandulkan & Divaksin Sebelum Diadopsi" : "Spayed & Vaccinated Before Adoption" },
              { value: "RM 0", label: isMs ? "Yuran Adopsi Dikenakan Kepada Keluarga" : "Adoption Fee Charged to Families" },
            ].map((stat) => (
              <div key={stat.value} className="space-y-1">
                <p className="font-heading text-3xl font-bold tracking-tight text-primary sm:text-4xl">{stat.value}</p>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* 3. In-kind giving */}
      <Section>
        <div className="space-y-12">
          <SectionHeader
            title={isMs ? "Senarai Keperluan Pusat Perlindungan" : "Shelter Supplies Wishlist"}
            subtitle={
              isMs
                ? "Ingin menyumbang barangan secara terus? Kami menerima penghantaran makanan yang belum dibuka, bekalan perubatan, dan alas tidur di pusat perlindungan Petaling Jaya kami."
                : "Prefer to donate items directly? We gladly accept physical drop-offs of unopened food, medical supplies, and shelter bedding at our Petaling Jaya sanctuary."
            }
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {wishlistCategories.map((cat, idx) => (
              <div key={idx} className={`${panel} space-y-4`}>
                <div className="flex items-center gap-2.5 border-b border-border pb-3">
                  <div className={iconTile}>
                    <Package className="size-5" />
                  </div>
                  <h3 className="font-heading text-xl font-bold tracking-tight text-foreground">{cat.category}</h3>
                </div>
                <ul className="space-y-2.5">
                  {cat.items.map((item, itemIdx) => (
                    <li key={itemIdx} className="flex items-start gap-2 text-sm font-medium text-foreground/90">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Drop-off details */}
          <div className={`${panel} grid grid-cols-1 gap-6 md:grid-cols-3`}>
            <div className="space-y-2">
              <p className={`flex items-center gap-2 ${eyebrow}`}>
                <MapPin className="size-4" /> {isMs ? "Lokasi Penghantaran" : "Drop-off Location"}
              </p>
              <p className="font-heading text-xl font-bold tracking-tight text-foreground">Hope for Strays Sanctuary</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("footer.address", "No. 18, Jalan SS 2/72, 47300 Petaling Jaya, Selangor, Malaysia")}
              </p>
            </div>

            <div className="space-y-2">
              <p className={`flex items-center gap-2 ${eyebrow}`}>
                <Clock className="size-4" /> {isMs ? "Waktu Lawatan & Penghantaran" : "Visiting & Drop-off Hours"}
              </p>
              <p className="font-heading text-xl font-bold tracking-tight text-foreground">
                {isMs ? "Selasa – Ahad: 10:00 Pagi – 5:00 Petang" : "Tuesday – Sunday: 10:00 AM – 5:00 PM"}
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("footer.closedMondays", "Closed on Mondays for deep sanitisation")}
              </p>
            </div>

            <div className="space-y-2">
              <p className={`flex items-center gap-2 ${eyebrow}`}>
                <Phone className="size-4" /> {isMs ? "Hubungi Terus" : "Direct Contact"}
              </p>
              <a href="tel:+60378765432" className="block font-mono text-xl font-bold text-foreground hover:underline">
                03-7876 5432
              </a>
              <p className="text-sm text-muted-foreground">info@hopeforstrays.org</p>
            </div>
          </div>
        </div>
      </Section>

      {/* 4. Browse the animals */}
      <Section>
        <div className="space-y-6">
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            {isMs ? "Ingin melihat haiwan-haiwan yang sedang anda bantu hari ini?" : "Want to see the animals whose lives you are changing today?"}
          </p>
          <Link href="/pets" className={buttonVariants({ size: "lg", className: "gap-2" })}>
            <Heart className="size-4 fill-current" />
            {isMs ? "Lihat Haiwan Sedia Diadopsi" : "Meet Our Adoptable Animals"}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </Section>
    </div>
  );
}
