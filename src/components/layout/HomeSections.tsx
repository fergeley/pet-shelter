"use client";

import { PUBLIC_ROS_REGISTRATION_NO } from "@/lib/domain/shelterIdentity";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  FileText, 
  Users, 
  HomeIcon, 
  Phone,
  Clock,
  MapPin,
  MessageCircle,
  Calendar,
  Truck,
  Heart,
  ArrowRight,
  CheckCircle2,
  Package
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { Section, SectionHeader } from "@/components/layout/Section";

export function HomeGalleryHeader() {
  return null;
}

/**
 * FE-03: "Our Work" — The 3 Core Pillars of Hope for Strays UM:
 * 1. TNRM (Trap-Neuter-Return-Manage)
 * 2. Education & Campus Coexistence
 * 3. Clinical Rehabilitation & Medical Care
 */
export function HomeOurWorkSection() {
  const { isMs } = useLanguage();

  const pillars = [
    {
      image:
        "https://images.unsplash.com/photo-1511044568932-338cba0ad803?auto=format&fit=crop&w=900&q=80",
      altEn: "A community cat resting on a pavement",
      altMs: "Kucing komuniti sedang berehat di kaki lima",
      categoryEn: "Population Control",
      categoryMs: "Kawalan Populasi",
      titleEn: "TNRM (Trap-Neuter-Return-Manage)",
      titleMs: "TNRM (Tangkap-Mandul-Lepas-Urus)",
      descEn:
        "Culling fails because of the 'Vacuum Effect' — removing strays invites new fertile animals to colonize the area. Humane TNRM stabilizes colonies, stops breeding cycles, and protects community health.",
      descMs:
        "Penyingkiran haiwan gagal kerana 'Kesan Vakum' — kawasan kosong akan diduduki haiwan jalanan baru yang tidak mandul. TNRM menstabilkan populasi secara saintifik dan berkesan.",
      highlightsEn: [
        "Ear-notching (left ear) for clear identification",
        "Managed feeding stations across UM campus",
        "Rabies & core vaccination upon spay surgery",
      ],
      highlightsMs: [
        "Penandaan telinga kiri (ear-notching) rasmi",
        "Stesen makanan berjadual di sekitar kampus UM",
        "Vaksinasi teras & pencegahan rabies semasa mandul",
      ],
    },
    {
      image:
        "https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=900&q=80",
      altEn: "A cat and a dog resting together outdoors",
      altMs: "Seekor kucing dan anjing berehat bersama di luar",
      categoryEn: "Community Coexistence",
      categoryMs: "Kewujudan Bersama",
      titleEn: "Education & Coexistence",
      titleMs: "Pendidikan & Harmoni Kampus",
      descEn:
        "Long-term stray welfare requires shifting human perception. We conduct student workshops, bite-prevention campaigns, and advocate for humane campus guidelines across Universiti Malaya.",
      descMs:
        "Kesejahteraan haiwan jalanan bermula dengan pemahaman manusia. Kami menganjurkan bengkel pelajar, kempen keselamatan, dan advokasi polisi kebajikan kampus.",
      highlightsEn: [
        "Campus stray safety & bite prevention seminars",
        "Anti-abandonment and responsible pet ownership",
        "Student volunteer warden & feeding network",
      ],
      highlightsMs: [
        "Seminar keselamatan & pencegahan gigitan haiwan",
        "Kempen anti-pembuangan haiwan peliharaan",
        "Rangkaian skuad sukarelawan & warden pelajar",
      ],
    },
    {
      image:
        "https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?auto=format&fit=crop&w=900&q=80",
      altEn: "A carer gently examining a rescued cat",
      altMs: "Penjaga sedang memeriksa kucing reskue dengan lembut",
      categoryEn: "Clinical Care",
      categoryMs: "Rawatan Klinikal",
      titleEn: "Sanctuary & Rehabilitation",
      titleMs: "Santuari & Rumah Pemulihan",
      descEn:
        "Animals with severe fractures, chronic mange, or trauma are admitted to our Petaling Jaya Rehabilitation House. Under veterinary supervision, they receive medical care until fully healed.",
      descMs:
        "Haiwan yang cedera parah, menghidap kurap teruk, atau trauma dimasukkan ke Rumah Pemulihan Petaling Jaya kami untuk rawatan rapi dan terapi pemulihan berterusan.",
      highlightsEn: [
        "Post-op sterile recovery enclosures & wound care",
        "Medicated baths & demodicosis/sarcoptic therapy",
        "100% free adoptions for cleared animals",
      ],
      highlightsMs: [
        "Kandang pemulihan steril & rawatan luka",
        "Mandian berubat kurap & pemulihan bulu",
        "Adopsi percuma 100% setelah sembuh sepenuhnya",
      ],
    },
  ];

  return (
    <Section id="our-work" className="space-y-14">
      <SectionHeader
        title={isMs ? "Kerja Kami" : "Our Work"}
        subtitle={
          isMs
            ? "Kerja kami berteraskan rawatan berperikemanusiaan, pendidikan, dan kewujudan bersama antara haiwan dan komuniti."
            : "Our work focuses on humane care, education and coexistence between animals and communities."
        }
      />

        {/* Editorial rows: image and copy alternate sides, so each pillar gets a full row
            rather than a third of one and the highlights fit without crushing the body. */}
        <div className="space-y-14">
          {pillars.map((pillar, idx) => (
            <div key={idx} className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-14">
              <div
                className={`relative aspect-16/10 overflow-hidden rounded-3xl border border-border bg-work-panel ${
                  idx % 2 ? "lg:order-2" : ""
                }`}
              >
                <Image
                  src={pillar.image}
                  alt={isMs ? pillar.altMs : pillar.altEn}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
              <div className="space-y-4">
                <p className="text-2xs font-bold uppercase tracking-wider text-primary">
                  {isMs ? pillar.categoryMs : pillar.categoryEn}
                </p>
                <h3 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {isMs ? pillar.titleMs : pillar.titleEn}
                </h3>
                <p className="text-base leading-relaxed text-muted-foreground">
                  {isMs ? pillar.descMs : pillar.descEn}
                </p>
                <div className="space-y-2 pt-1">
                  {(isMs ? pillar.highlightsMs : pillar.highlightsEn).map((item) => (
                    <div key={item} className="flex items-start gap-2 text-sm font-medium text-foreground/90">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
    </Section>
  );
}

export function HomeQuickActionsSection() {
  const { isMs } = useLanguage();

  const actions = [
    {
      image:
        "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=900&q=80",
      alt: isMs ? "Seekor anjing reskue yang ceria" : "A cheerful rescue dog outdoors",
      title: isMs ? "Adopsi" : "Adopt",
      description: isMs
        ? "Temui haiwan yang sedia untuk perumahan baharu dan hantar permohonan adopsi dengan mudah."
        : "Meet animals ready for a new home and apply to adopt in just a few steps.",
      cta: isMs ? "Lihat Haiwan" : "See Animals",
      href: "/pets",
    },
    {
      image:
        "https://images.unsplash.com/photo-1494947665470-20322015e3a8?auto=format&fit=crop&w=900&q=80",
      alt: isMs ? "Sukarelawan memegang tali beberapa ekor anjing" : "A volunteer walking several dogs on leads",
      title: isMs ? "Sukarelawan" : "Volunteer",
      description: isMs
        ? "Bantu di santuari, lawatan mingguan, dan aktiviti komuniti tanpa pengalaman terdahulu."
        : "Support the sanctuary through weekly care, walking, transport, and community events.",
      cta: isMs ? "Sertai Kami" : "Get Involved",
      href: "/get-involved",
    },
    {
      image:
        "https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=900&q=80",
      alt: isMs ? "Mangkuk makanan haiwan di atas lantai kayu" : "A bowl of food on a wooden floor beside a dog",
      title: isMs ? "Derma" : "Donate",
      description: isMs
        ? "Sokong makanan, ubat, operasi dan pemulihan klinikal untuk haiwan yang memerlukan."
        : "Fund food, treatment, surgery, and recovery costs for rescued animals in need.",
      cta: isMs ? "Sokong HFS" : "Support HFS",
      href: "/donate",
    },
    {
      image:
        "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=900&q=80",
      alt: isMs ? "Kucing yang tenang sedang berehat di dalam rumah" : "A settled cat resting indoors",
      title: isMs ? "Taja" : "Sponsor",
      description: isMs
        ? "Taja pemulihan haiwan, rawatan veterinar, dan penjagaan jangka panjang setiap bulan."
        : "Sponsor ongoing care, treatment, and rehabilitation for animals who need longer-term support.",
      cta: isMs ? "Taja Seekor Haiwan" : "Sponsor an Animal",
      href: "/needs",
    },
  ];

  const [lead, second, third, fourth] = actions;
  const big = [lead, third].filter(Boolean);
  const small = [second, fourth].filter(Boolean);
  const cardShell =
    "group flex flex-col overflow-hidden rounded-3xl border border-border bg-work-panel shadow-xs transition-colors hover:border-primary/40";

  const cardBody = (a: (typeof actions)[number], titleSize: string) => (
    <div className="flex flex-1 flex-col gap-3 p-6 sm:p-7">
      <h3 className={`font-heading ${titleSize} font-bold text-foreground`}>{a.title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{a.description}</p>
      <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-xs font-bold uppercase tracking-wider text-primary">
        {a.cta}
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </div>
  );

  return (
    <Section className="space-y-12">
      <SectionHeader
        title={isMs ? "Sertai kami membawa perubahan" : "Join us in making a difference"}
        subtitle={
          isMs
            ? "Sama ada anda mengadopsi, menjadi sukarelawan, menderma atau menaja, setiap tindakan membantu mencipta kehidupan yang lebih baik."
            : "Whether you adopt, volunteer, donate or sponsor, every action helps create better lives."
        }
      />

        {/* Adopt and Donate take the two wide cells; Volunteer and Sponsor stack in the third
            without an image, because at a third of the width a photograph arrives too small to
            read as one and costs the copy the room it needs. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {big.map((a) => (
            <Link key={a.href} href={a.href} className={cardShell}>
              <div className="relative aspect-4/3 w-full bg-work-ground">
                <Image src={a.image} alt={a.alt} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 33vw" />
              </div>
              {cardBody(a, "text-2xl")}
            </Link>
          ))}
          <div className="flex flex-col gap-6">
            {small.map((a) => (
              <Link key={a.href} href={a.href} className={`${cardShell} flex-1`}>
                {cardBody(a, "text-xl")}
              </Link>
            ))}
          </div>
        </div>
    </Section>
  );
}

export function HomeProcessSection() {
  const { isMs } = useLanguage();

  const steps = [
    {
      num: "01",
      title: isMs ? "Pilih Haiwan & Hantar Permohonan" : "Browse & Submit Application",
      description: isMs
        ? "Lihat profil anjing & kucing reskue kami secara dalam talian atau kunjungi santuari PJ. Hantar borang ringkas untuk mendaftar minat keluarga anda."
        : "Browse our adoptable dogs and cats online or visit our Petaling Jaya sanctuary. Submit a straightforward application to register your household interest.",
      icon: FileText,
    },
    {
      num: "02",
      title: isMs ? "Sesi Suai Kenal di Santuari" : "Meet & Socialize",
      description: isMs
        ? "Luangkan masa berinteraksi dengan haiwan di laman luar atau bilik kucing santuari. Kami mengatur pengenalan berstruktur jika anda mempunyai haiwan sedia ada."
        : "Spend time interacting with the animal in our outdoor play yard or cat room. If you have resident pets, we arrange a structured, supervised introduction.",
      icon: Users,
    },
    {
      num: "03",
      title: isMs ? "Lengkapkan Adopsi (100% Percuma)" : "Finalize & Welcome Home",
      description: isMs
        ? "Tandatangani perjanjian adopsi standard tanpa sebarang yuran tersembunyi. Semua haiwan telah divaksin, dimikrocip, dan dimandulkan sepenuhnya."
        : "Sign our standard adoption agreement with zero adoption fees. All animals are already vaccinated, microchipped, and spayed or neutered.",
      icon: HomeIcon,
    },
  ];

  return (
    <Section id="how-it-works">
      <div className="space-y-10">
        <SectionHeader
          title={isMs ? "Padanan yang teliti, langkah demi langkah" : "A careful match, step by step"}
          subtitle={
            isMs
              ? "Proses berstruktur kami memastikan padanan yang bertanggungjawab antara haiwan reskue dan keluarga di seluruh Lembah Klang."
              : "Our structured adoption process ensures responsible matching between animals and families across Selangor and the Klang Valley."
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className="relative flex flex-col justify-between rounded-3xl border border-border bg-work-panel p-6 shadow-xs sm:p-7"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-2xl font-bold text-foreground">
                      {step.num}
                    </span>
                    <div className="flex size-10 items-center justify-center bg-muted text-foreground rounded-xl">
                      <Icon className="size-5" />
                    </div>
                  </div>
                  <h3 className="font-heading text-xl font-bold tracking-tight text-foreground">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}

export function HomeStandardsSection() {
  const { isMs } = useLanguage();

  const shelterProtocols = [
    {
      title: isMs ? "Protokol Veterinar Lengkap" : "Complete Veterinary Protocol",
      description: isMs
        ? "Setiap haiwan menjalani pemeriksaan kesihatan lengkap, pembedahan pemandulan, vaksinasi teras 6-dalam-1 / FVRCP, ubat cacing, dan mikrocip sebelum adopsi."
        : "Every rescue animal undergoes full veterinary health screening, spay/neuter surgery, core vaccinations (6-in-1 / FVRCP), internal deworming, and microchip registration before rehoming.",
    },
    {
      title: isMs ? "Polisi Adopsi Percuma 100%" : "100% Free Adoption Policy",
      description: isMs
        ? "Kami tidak menjual haiwan atau mengenakan yuran adopsi komersial. Penempatan dibuat berdasarkan keserasian gaya hidup dan kebajikan haiwan."
        : "We do not sell animals or charge commercial adoption fees. Rescues are placed into qualified homes purely based on lifestyle compatibility and animal welfare.",
    },
    {
      title: isMs ? "Bimbingan & Jaring Keselamatan" : "Post-Adoption Guidance & Safety Net",
      description: isMs
        ? "Kami menyediakan bimbingan tingkah laku berterusan. Jika situasi hidup pengadopsi berubah, kami mengekalkan polisi pintu terbuka tanpa syarat untuk menerima semula haiwan."
        : "Our team provides ongoing behavioral transition guidance. If an adopter's life circumstances ever change, we maintain an unconditional open-door policy to welcome the animal back.",
    },
    {
      title: isMs ? "Semakan Kediaman & Keselamatan" : "Structured Premise & Lifestyle Review",
      description: isMs
        ? "Kami menyemak kesesuaian asas kediaman (pagar selamat, kelulusan bangunan bertingkat) bagi memastikan persekitaran hidup yang kekal dan selamat."
        : "We verify basic living suitability (landed housing vs high-rise pet guidelines, fenced perimeter safety, and household consensus) to ensure a safe, lasting match.",
    },
  ];

  return (
    <Section id="mission">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4 space-y-4">
            <SectionHeader
              title={isMs ? "Piawaian Kebajikan & Santuari Haiwan" : "Our Animal Welfare & Sanctuary Standards"}
              className="max-w-none"
            />
            <p className="text-sm font-semibold text-muted-foreground">
              {(isMs ? "Persatuan Berdaftar ROS Malaysia: " : "Malaysian Registered Society: ") + PUBLIC_ROS_REGISTRATION_NO}
            </p>
            <p className="text-base text-muted-foreground leading-relaxed">
              {isMs
                ? "Beroperasi di Petaling Jaya dan kampus Universiti Malaya sejak 2016, Hope for Strays menyelamat, memulihkan, dan mencari keluarga baru untuk anjing dan kucing terbiar dengan ketelusan klinikal penuh."
                : "Operating across Petaling Jaya and Universiti Malaya campus since 2016, Hope for Strays rescues, rehabilitates, and rehomes homeless dogs and cats with complete clinical transparency."}
            </p>
            <div className="pt-2">
              <Link
                href="/donate"
                className={buttonVariants({
                  size: "sm",
                  className: "text-xs font-semibold uppercase tracking-wider px-5 py-2.5 rounded-xl",
                })}
              >
                {isMs ? "Sokong Santuari Kami" : "Support Our Sanctuary"}
              </Link>
            </div>
          </div>

          {/* A compliance statement reads more credibly as a document than as four tiles, and
              the rules let each protocol run to whatever length it actually needs. */}
          <dl className="lg:col-span-8">
            {shelterProtocols.map((protocol, idx) => (
              <div key={idx} className="grid grid-cols-1 gap-2 border-t border-border py-6 sm:grid-cols-3 sm:gap-8">
                <dt className="font-heading text-base font-bold text-foreground">{protocol.title}</dt>
                <dd className="text-sm leading-relaxed text-muted-foreground sm:col-span-2">
                  {protocol.description}
                </dd>
              </div>
            ))}
          </dl>
        </div>
    </Section>
  );
}

export function HomeCommunitySection() {
  const { isMs } = useLanguage();

  return (
    <Section id="support">
      <div className="space-y-8">
        <SectionHeader
          title={isMs ? "Sukarelawan, Penjaga Sementara & Penajaan" : "Volunteer, Foster, or Sponsor Care"}
          subtitle={
            isMs
              ? "Tiada pengalaman lampau diperlukan. Kami menyediakan 100% makanan haiwan, kelengkapan perubatan, sangkar, dan rawatan veterinar bagi semua penjaga sementara."
              : "No prior shelter experience is required. We provide 100% of pet food, medical supplies, crates, and veterinary care for all temporary foster parents."
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Volunteer & Foster Care Opportunities */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-5 rounded-3xl border border-border bg-work-panel p-6 shadow-xs sm:p-7">
              <div className="flex items-center gap-2.5 pb-3 border-b border-border">
                <div className="flex size-8 items-center justify-center bg-foreground text-background rounded-lg">
                  <Users className="size-4" />
                </div>
                <div>
                  <h3 className="font-heading text-xl font-bold text-foreground">
                    {isMs ? "Peranan Sukarelawan & Penjaga Aktif" : "Active Volunteer & Foster Roles"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {isMs ? "Slot fleksibel dibuka setiap minggu di santuari Petaling Jaya kami." : "Flexible slots available weekly at our Petaling Jaya sanctuary."}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-border bg-background p-4 space-y-1.5 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Heart className="size-4 text-foreground shrink-0" />
                    <h4 className="text-sm font-bold text-foreground">
                      {isMs ? "Berjalan Bersama Anjing Hujung Minggu" : "Weekend Dog Walking"}
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {isMs ? "Sabtu & Ahad, 10:00 pagi – 12:00 tgh hari. Senaman & sosialisasi anjing di laman luar." : "Saturdays & Sundays, 10:00 AM – 12:00 PM. Exercise and socialize dogs in our outdoor yard."}
                  </p>
                </div>

                <div className="border border-border bg-background p-4 space-y-1.5 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-foreground shrink-0" />
                    <h4 className="text-sm font-bold text-foreground">
                      {isMs ? "Hari Mandian & Penjagaan Bulu" : "Bath & Grooming Days"}
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {isMs ? "Setiap Sabtu ke-2 & ke-4. Mandian berubat, memberus bulu, dan penjagaan rapi." : "Every 2nd & 4th Saturday. Medicated baths, brush-outs, and gentle care for recovering strays."}
                  </p>
                </div>

                <div className="border border-border bg-background p-4 space-y-1.5 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Truck className="size-4 text-foreground shrink-0" />
                    <h4 className="text-sm font-bold text-foreground">
                      {isMs ? "Pengangkutan Klinik Veterinar" : "Clinic Transport"}
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {isMs ? "Pengangkutan hari bekerja untuk pemeriksaan kesihatan dan pembedahan mandul." : "Weekday transport for veterinary health checkups and spay/neuter clinic appointments."}
                  </p>
                </div>

                <div className="border border-border bg-background p-4 space-y-1.5 rounded-xl">
                  <div className="flex items-center gap-2">
                    <HomeIcon className="size-4 text-foreground shrink-0" />
                    <h4 className="text-sm font-bold text-foreground">
                      {isMs ? "Rumah Asuhan Sementara" : "Temporary Foster Homes"}
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {isMs ? "Penjagaan jangka pendek anak haiwan atau pasca pembedahan. Makanan & bil vet ditanggung sepenuhnya." : "Short-term care for nursing litters, kittens, or post-op recovery. All food and vet bills covered."}
                  </p>
                </div>
              </div>

              {/* Pre-filled Direct WhatsApp Action Buttons */}
              <div className="pt-2 border-t border-border flex flex-wrap gap-3">
                <a
                  href="https://wa.me/60123456789?text=Hi%20Hope%20for%20Strays%2C%20I%20would%20like%20to%20volunteer%20for%20weekend%20dog%20walking%20and%20sanctuary%20care!"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({
                    size: "sm",
                    className: "text-xs sm:text-sm font-semibold uppercase tracking-wider focus-visible:ring-2 px-4 py-2.5 gap-2 bg-success-solid text-white hover:bg-success-solid dark:hover:bg-success-solid rounded-xl",
                  })}
                >
                  <MessageCircle className="size-4" />
                  {isMs ? "WhatsApp Penyelaras Sukarelawan" : "WhatsApp Volunteer Coordinator"}
                </a>

                <a
                  href="https://wa.me/60123456789?text=Hi%20Hope%20for%20Strays%2C%20I%20am%20interested%20in%20becoming%20a%20temporary%20foster%20parent%20for%20a%20rescue%20pet!"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                    className: "text-xs sm:text-sm font-semibold uppercase tracking-wider focus-visible:ring-2 px-4 py-2.5 gap-2 rounded-xl",
                  })}
                >
                  <MessageCircle className="size-4" />
                  {isMs ? "WhatsApp Pasukan Asuhan" : "WhatsApp Foster Team"}
                </a>

                <Link
                  href="/get-involved"
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                    className: "text-xs sm:text-sm font-semibold uppercase tracking-wider focus-visible:ring-2 px-4 py-2.5 gap-2 rounded-xl",
                  })}
                >
                  <Users className="size-4" />
                  {isMs ? "Lihat semua cara membantu" : "See all ways to help"}
                </Link>
              </div>
            </div>
          </div>

          {/* Right Column: Walk-in Sanctuary Hours & Physical Drop-off */}
          <div className="lg:col-span-5 space-y-6">
            {/* Visiting Hours Card */}
            <div className="space-y-4 rounded-3xl border border-border bg-work-panel p-6 shadow-xs">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <Clock className="size-4 text-foreground" />
                <h3 className="font-heading text-xl font-bold uppercase tracking-wider text-foreground">
                  {isMs ? "Lawati santuari" : "Visit the sanctuary"}
                </h3>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center py-1 border-b border-border/40">
                  <span className="font-semibold text-foreground">{isMs ? "Selasa – Ahad" : "Tuesday – Sunday"}</span>
                  <span className="font-mono font-medium text-foreground">{isMs ? "10:00 Pagi – 5:00 Petang" : "10:00 AM – 5:00 PM"}</span>
                </div>
                <div className="flex justify-between items-center py-1 text-muted-foreground">
                  <span className="font-medium">{isMs ? "Isnin" : "Mondays"}</span>
                  <span className="text-xs italic">{isMs ? "Tutup (Sanitasi Santuari & Lawatan Vet)" : "Closed (Sanctuary Cleaning & Vet Rounds)"}</span>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs text-muted-foreground pt-1">
                <MapPin className="size-4 text-foreground shrink-0 mt-0.5" />
                <span>No. 18, Jalan SS 2/72, 47300 Petaling Jaya, Selangor, Malaysia</span>
              </div>

              <div className="pt-2">
                <a
                  href="tel:+60378765432"
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                    className: "w-full text-xs font-semibold uppercase tracking-wider gap-1.5 rounded-xl",
                  })}
                >
                  <Phone className="size-3.5" />
                  {isMs ? "Hubungi Santuari: 03-7876 5432" : "Call Sanctuary: 03-7876 5432"}
                </a>
              </div>
            </div>

            {/* In-Kind Shelter Wishlist Banner */}
            <div className="border border-border bg-muted/30 p-5 space-y-3 rounded-2xl">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Package className="size-3.5 text-primary" />
                  {isMs ? "Keperluan Rumah Pemulihan" : "Rehab House Wishlist"}
                </h4>
                <Link
                  href="/needs"
                  className="text-2xs font-bold text-primary hover:underline"
                >
                  {isMs ? "Lihat Senarai Penuh →" : "View Full List →"}
                </Link>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {isMs
                  ? "Sokong rawatan 40+ haiwan reskue dengan menyumbang makanan berkhasiat, ubat cuci F10, alas serap kencing, dan perangkap sangkar TNRM."
                  : "Support 40+ recovering rescues with clinical diet foods, F10 disinfectant, pee pads, and humane TNRM trap cages."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
