"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Heart,
  ArrowRight,
  HeartHandshake,
  ShieldCheck,
  Package,
  Award,
  Users2,
  Stethoscope,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { PetMatchQuiz } from "@/components/features/pets/PetMatchQuiz";
import { SponsorshipModal } from "@/components/features/pets/SponsorshipModal";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function Hero() {
  const { isMs } = useLanguage();
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [isSponsorshipOpen, setIsSponsorshipOpen] = useState(false);

  const impactStats = [
    {
      metric: "520+",
      labelEn: "Neutered via TNRM",
      labelMs: "Dimandulkan (TNRM)",
      icon: ShieldCheck,
      color: "text-success-accent ",
    },
    {
      metric: "380+",
      labelEn: "Animals Rehabilitated",
      labelMs: "Haiwan Dipulihkan",
      icon: Stethoscope,
      color: "text-care-accent ",
    },
    {
      metric: "290+",
      labelEn: "Adopted into Homes",
      labelMs: "Berjaya Diadopsi",
      icon: Heart,
      color: "text-danger-accent ",
    },
    {
      metric: "150+",
      labelEn: "Active Volunteers",
      labelMs: "Sukarelawan Aktif",
      icon: Users2,
      color: "text-warning-accent ",
    },
    {
      metric: "25+",
      labelEn: "Partnerships & Vets",
      labelMs: "Rakan Kolaborasi & Vet",
      icon: Award,
      color: "text-info-accent ",
    },
  ];

  return (
    <>
      <section className="border-b border-border bg-muted/20">
        <div className="w-full px-6 py-12 sm:px-8 sm:py-16 lg:px-12 lg:py-20">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12 max-w-7xl mx-auto">
            
            {/* Left Text Content */}
            <div className="space-y-6 lg:col-span-7">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-secondary text-secondary-foreground text-xs font-bold border border-border rounded-full">
                <ShieldCheck className="size-3.5 text-primary" />
                <span>{isMs ? "TNRM Kampus UM & Santuari Haiwan Selangor" : "UM Campus TNRM & Selangor Rescue Sanctuary"}</span>
              </div>

              <div className="space-y-2">
                <h1 className="font-heading text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.15]">
                  {isMs ? (
                    <>
                      Kewujudan Bersama melalui <span className="text-primary">TNRM</span> & Pendidikan.
                    </>
                  ) : (
                    <>
                      Coexistence through <span className="text-primary">TNRM</span> & Education.
                    </>
                  )}
                </h1>
                <p className="font-heading text-lg sm:text-xl font-semibold text-foreground/80">
                  Hope for Strays UM
                </p>
              </div>

              <p className="max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
                {isMs
                  ? "Kami menstabilkan populasi haiwan jalanan di kampus Universiti Malaya dan Petaling Jaya melalui kaedah berkebajikan Tangkap-Mandul-Lepas-Urus (TNRM), rawatan klinikal di Rumah Pemulihan kami, dan adopsi percuma 100%."
                  : "Stabilizing stray animal populations across Universiti Malaya campus and Petaling Jaya through humane Trap-Neuter-Return-Manage (TNRM), clinical trauma recovery at our Rehabilitation House, and 100% free adoptions."}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  href="/pets"
                  className={buttonVariants({
                    size: "lg",
                    className: "gap-2 px-6 text-sm font-bold tracking-wide rounded-xl shadow-xs focus-visible:ring-2",
                  })}
                >
                  <Heart className="size-4 fill-current" />
                  {isMs ? "Lihat Haiwan Reskue" : "Meet Our Animals"}
                  <ArrowRight className="size-4 ml-0.5" />
                </Link>

                <Link
                  href="/needs"
                  className={buttonVariants({
                    variant: "outline",
                    size: "lg",
                    className: "gap-2 px-5 text-sm font-bold tracking-wide rounded-xl",
                  })}
                >
                  <Package className="size-4 text-primary" />
                  {isMs ? "Keperluan Pemulihan" : "Wishlist Needs"}
                </Link>

                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setIsSponsorshipOpen(true)}
                  className="gap-2 px-5 text-sm font-bold tracking-wide rounded-xl cursor-pointer"
                >
                  <HeartHandshake className="size-4 text-care-accent" />
                  {isMs ? "Taja Haiwan (RM30)" : "Sponsor Care"}
                </Button>
              </div>

              {/* Sanctuary Hours & Address Banner */}
              <div className="border-t border-border pt-4 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-foreground">{isMs ? "Waktu Santuari PJ:" : "Sanctuary Visiting Hours:"} </span>
                  {isMs ? "Selasa – Ahad, 10:00 PG – 5:00 PTG. Walk-in dialu-alukan." : "Tuesday through Sunday, 10:00 AM – 5:00 PM. Walk-ins welcome."}
                </div>
                <div className="font-bold text-foreground">
                  Petaling Jaya & UM Campus, Selangor
                </div>
              </div>
            </div>

            {/* Right Image */}
            <div className="lg:col-span-5">
              <div className="relative aspect-4/3 w-full overflow-hidden border border-border bg-muted shadow-md rounded-3xl">
                <Image
                  src="https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1000&q=80"
                  alt="Rescued shelter animals enjoying sanctuary grounds"
                  fill
                  priority
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 40vw"
                />
              </div>
            </div>
          </div>

          {/* Impact Showcase Strip (FE-02) */}
          <div className="max-w-7xl mx-auto mt-12 sm:mt-16 pt-8 border-t border-border/80">
            <div className="mb-4">
              <span className="text-2xs font-bold uppercase tracking-widest text-muted-foreground">
                {isMs ? "Impak Komuniti & Penyelamatan Setakat Ini" : "Our Impact & Stray Management So Far"}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {impactStats.map((stat, idx) => (
                <div
                  key={idx}
                  className="border border-border bg-card p-4 rounded-2xl space-y-1.5 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-heading text-2xl sm:text-3xl font-bold tracking-tight ${stat.color}`}>
                      {stat.metric}
                    </span>
                    <stat.icon className="size-4 text-muted-foreground opacity-60" />
                  </div>
                  <p className="text-xs font-semibold text-foreground leading-tight">
                    {isMs ? stat.labelMs : stat.labelEn}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Modals */}
      <PetMatchQuiz
        open={isQuizOpen}
        onOpenChange={setIsQuizOpen}
      />

      <SponsorshipModal
        open={isSponsorshipOpen}
        onOpenChange={setIsSponsorshipOpen}
      />
    </>
  );
}
