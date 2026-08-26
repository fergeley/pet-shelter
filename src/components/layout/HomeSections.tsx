"use client";

import { PUBLIC_ROS_REGISTRATION_NO } from "@/lib/domain/shelterIdentity";
import React from "react";
import Link from "next/link";
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
  ShieldCheck,
  ArrowRight,
  Stethoscope,
  GraduationCap,
  Sparkles,
  Scissors,
  CheckCircle2,
  Package
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function HomeGalleryHeader() {
  const { isMs } = useLanguage();

  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 mb-8">
      <div>
        <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          {isMs ? "Haiwan Bersedia untuk Adopsi & Tajaan" : "Animals Ready for Adoption & Sponsorship"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isMs
            ? "Semua haiwan disaring kesihatan, divaksin, dimikrocip, dan dimandulkan sebelum penempatan."
            : "Health-checked, vaccinated, microchipped, and sterilized before rehoming. Recovering rescues available for sponsorship."}
        </p>
      </div>
      <Link
        href="/pets"
        className={buttonVariants({
          variant: "outline",
          size: "sm",
          className: "self-start sm:self-auto text-sm font-semibold uppercase tracking-wider focus-visible:ring-2 rounded-xl",
        })}
      >
        {isMs ? "Lihat Semua Haiwan" : "View All Animals"}
        <ArrowRight className="size-4 ml-1.5" />
      </Link>
    </div>
  );
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
      icon: Scissors,
      tagEn: "Pillar 1: Population Control",
      tagMs: "Teras 1: Kawalan Populasi",
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
      accent: "border-success-accent/30 bg-success-surface",
      badgeColor: "text-success-text bg-success-surface",
    },
    {
      icon: GraduationCap,
      tagEn: "Pillar 2: Community Coexistence",
      tagMs: "Teras 2: Kewujudan Bersama",
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
      accent: "border-warning-accent/30 bg-warning-surface",
      badgeColor: "text-warning-text bg-warning-surface",
    },
    {
      icon: Stethoscope,
      tagEn: "Pillar 3: Clinical Care",
      tagMs: "Teras 3: Rawatan Klinikal",
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
      accent: "border-care-accent/30 bg-care-surface",
      badgeColor: "text-care-text bg-care-surface",
    },
  ];

  return (
    <section id="our-work" className="border-t border-border bg-background py-16 sm:py-20">
      <div className="w-full px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            <Sparkles className="size-3.5" />
            {isMs ? "Misi & Metodologi Kami" : "Our Mission & 3-Pillar Framework"}
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            {isMs ? "Kewujudan Bersama melalui Sains & Kebajikan" : "Coexistence through Science & Compassion"}
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
            {isMs
              ? "Hope for Strays UM beroperasi berpandukan sains kebajikan haiwan antarabangsa — menggabungkan TNRM, pendidikan komuniti, dan rawatan pemulihan klinikal."
              : "Hope for Strays UM operates on evidence-based humane animal welfare: combining scientific TNRM population stabilization, student education, and comprehensive clinical rehabilitation."}
          </p>
        </div>

        {/* 3 Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {pillars.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <div
                key={idx}
                className={`border ${pillar.accent} p-7 sm:p-8 rounded-3xl space-y-6 flex flex-col justify-between shadow-xs`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className={`text-2xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${pillar.badgeColor}`}>
                      {isMs ? pillar.tagMs : pillar.tagEn}
                    </span>
                    <div className="flex size-10 items-center justify-center bg-card border border-border rounded-xl">
                      <Icon className="size-5 text-foreground" />
                    </div>
                  </div>

                  <h3 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
                    {isMs ? pillar.titleMs : pillar.titleEn}
                  </h3>

                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {isMs ? pillar.descMs : pillar.descEn}
                  </p>

                  <div className="space-y-2 pt-2 border-t border-border/40">
                    {(isMs ? pillar.highlightsMs : pillar.highlightsEn).map((item, hIdx) => (
                      <div key={hIdx} className="flex items-start gap-2 text-xs text-foreground/90 font-medium">
                        <CheckCircle2 className="size-3.5 text-primary shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-border/60">
                  <Link
                    href={idx === 0 ? "/#how-it-works" : idx === 1 ? "/get-involved" : "/needs"}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground hover:text-primary transition-colors"
                  >
                    <span>{isMs ? "Ketahui Lebih Lanjut" : "Learn More"}</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
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
    <section id="how-it-works" className="border-t border-border bg-background py-14 sm:py-18">
      <div className="w-full px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto">
        <div className="max-w-2xl mb-10">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
            {isMs ? "Protokol Adopsi Santuari" : "Adoption Protocol"}
          </span>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">
            {isMs ? "Bagaimana Proses Adopsi Berfungsi" : "How Adoption Works"}
          </h2>
          <p className="text-base text-muted-foreground mt-2 leading-relaxed">
            {isMs
              ? "Proses berstruktur kami memastikan padanan yang bertanggungjawab antara haiwan reskue dan keluarga di seluruh Lembah Klang."
              : "Our structured adoption process ensures responsible matching between animals and families across Selangor and the Klang Valley."}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className="border border-border bg-card p-6 sm:p-7 relative flex flex-col justify-between rounded-2xl shadow-xs"
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
                  <h3 className="font-heading text-lg font-bold tracking-tight text-foreground">
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
    </section>
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
    <section id="mission" className="border-t border-border bg-card py-14 sm:py-18">
      <div className="w-full px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          <div className="lg:col-span-5 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-secondary text-secondary-foreground text-xs font-semibold border border-border rounded-md">
              <ShieldCheck className="size-3.5 text-foreground" />
              <span>{(isMs ? "Persatuan Berdaftar ROS Malaysia: " : "Malaysian Registered Society: ") + PUBLIC_ROS_REGISTRATION_NO}</span>
            </div>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {isMs ? "Piawaian Kebajikan & Santuari Haiwan" : "Our Animal Welfare & Sanctuary Standards"}
            </h2>
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

          {/* Protocol Grid */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {shelterProtocols.map((protocol, idx) => (
              <div key={idx} className="border border-border bg-background p-5 space-y-2 rounded-2xl shadow-xs">
                <h3 className="font-heading text-base font-bold text-foreground">
                  {protocol.title}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {protocol.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomeCommunitySection() {
  const { isMs } = useLanguage();

  return (
    <section id="support" className="border-t border-border bg-background py-14 sm:py-18">
      <div className="w-full px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="max-w-3xl mb-8 space-y-2">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
            {isMs ? "Tindakan Komuniti" : "Community Action"}
          </span>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {isMs ? "Sukarelawan, Penjaga Sementara & Penajaan" : "Volunteer, Foster, or Sponsor Care"}
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            {isMs
              ? "Tiada pengalaman lampau diperlukan. Kami menyediakan 100% makanan haiwan, kelengkapan perubatan, sangkar, dan rawatan veterinar bagi semua penjaga sementara."
              : "No prior shelter experience is required. We provide 100% of pet food, medical supplies, crates, and veterinary care for all temporary foster parents."}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Volunteer & Foster Care Opportunities */}
          <div className="lg:col-span-7 space-y-6">
            <div className="border border-border bg-card p-6 sm:p-7 space-y-5 rounded-2xl shadow-xs">
              <div className="flex items-center gap-2.5 pb-3 border-b border-border">
                <div className="flex size-8 items-center justify-center bg-foreground text-background rounded-lg">
                  <Users className="size-4" />
                </div>
                <div>
                  <h3 className="font-heading text-lg font-bold text-foreground">
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
                  {isMs ? "Semua Laluan Penglibatan" : "Get Involved Page"}
                </Link>
              </div>
            </div>
          </div>

          {/* Right Column: Walk-in Sanctuary Hours & Physical Drop-off */}
          <div className="lg:col-span-5 space-y-6">
            {/* Visiting Hours Card */}
            <div className="border border-border bg-card p-6 space-y-4 rounded-2xl shadow-xs">
              <div className="flex items-center gap-2 pb-2 border-b border-border">
                <Clock className="size-4 text-foreground" />
                <h3 className="font-heading text-base font-bold text-foreground uppercase tracking-wider">
                  {isMs ? "Waktu Lawatan Santuari Walk-In" : "Walk-in Sanctuary Visiting Hours"}
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
    </section>
  );
}
