"use client";

import React from "react";
import { PhoneCall } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";

export function PetsFaqSection() {
  const { isMs } = useLanguage();

  const faqs = [
    {
      q: isMs ? "Apakah yang diliputi oleh polisi adopsi?" : "What does the adoption process cover?",
      a: isMs
        ? "Semua adopsi adalah 100% percuma dan merangkumi pembedahan pemandulan, vaksinasi teras 6-dalam-1 / FVRCP, pendaftaran mikrocip, dan rawatan pencegahan parasit."
        : "All adoptions are 100% free and cover complete spay/neuter surgery, core vaccinations (6-in-1 / FVRCP), microchip registration, and internal/external parasite treatments.",
    },
    {
      q: isMs ? "Bolehkah saya membawa haiwan peliharaan sedia ada untuk sesi suai kenal?" : "Can I bring my resident dog to meet an adoptable dog?",
      a: isMs
        ? "Ya! Kami menggalakkan pengenalan berstruktur di bawah penyeliaan di laman santuari Petaling Jaya kami. Sila bawa kad vaksinasi haiwan anda."
        : "Yes! We encourage supervised introductions in our outdoor compound in Petaling Jaya. Please bring your dog's vaccination card.",
    },
    {
      q: isMs ? "Apakah syarat kelayakan untuk memohon adopsi?" : "What are the adoption requirements?",
      a: isMs
        ? "Pemohon mestilah berumur sekurang-kurangnya 21 tahun, menyediakan bukti kediaman mesra haiwan yang selamat, dan bersetuju dengan susulan kebajikan berkala."
        : "Applicants must be at least 21 years old, provide proof of a secure pet-friendly residence (landlord or management approval if residing in high-rise), and agree to post-adoption check-ins.",
    },
    {
      q: isMs ? "Berapa lamakah masa semakan permohonan?" : "How long does the application process take?",
      a: isMs
        ? "Kebanyakan permohonan disemak dalam tempoh 1–2 hari bekerja. Jika diluluskan, anda boleh melengkapkan urusan adopsi dan membawa haiwan pulang semasa waktu operasi santuari."
        : "Most applications are reviewed within 1–2 business days. If approved, you can complete the adoption and bring your pet home during open visiting hours.",
    },
  ];

  return (
    <section className="w-full px-6 sm:px-8 lg:px-12 pt-12 border-t border-border mt-10">
      <div className="mb-8 max-w-2xl">
        <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          {isMs ? "Soalan Lazim Mengenai Adopsi" : "Frequently Asked Questions"}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl">
        {faqs.map((faq, idx) => (
          <div
            key={idx}
            className="border border-border bg-background p-6 space-y-2.5 rounded-2xl shadow-xs"
          >
            <h3 className="font-heading text-lg font-bold text-foreground">
              {faq.q}
            </h3>
            <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
              {faq.a}
            </p>
          </div>
        ))}
      </div>

      {/* Contact Banner */}
      <div className="mt-10 bg-muted/40 border border-border p-6 max-w-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl">
        <div>
          <p className="text-base font-bold text-foreground">
            {isMs ? "Ada soalan mengenai haiwan reskue kami di Petaling Jaya?" : "Have questions about an animal in Petaling Jaya?"}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isMs ? "Hubungi meja santuari kami Selasa hingga Ahad, 10:00 pagi – 5:00 petang." : "Call our shelter desk Tuesday through Sunday, 10:00 AM – 5:00 PM."}
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
