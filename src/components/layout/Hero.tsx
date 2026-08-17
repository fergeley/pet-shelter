"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, ArrowRight, HeartHandshake, ShieldCheck, Compass } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { PetMatchQuiz } from "@/components/features/pets/PetMatchQuiz";
import { SponsorshipModal } from "@/components/features/pets/SponsorshipModal";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function Hero() {
  const { t } = useLanguage();
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [isSponsorshipOpen, setIsSponsorshipOpen] = useState(false);

  return (
    <>
      <section className="border-b border-border bg-muted/20">
        <div className="w-full px-6 py-14 sm:px-8 sm:py-18 lg:px-12 lg:py-20">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
            
            {/* Left Text Content */}
            <div className="space-y-6 lg:col-span-7">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-secondary text-secondary-foreground text-xs font-semibold border border-border rounded-md">
                <ShieldCheck className="size-3.5 text-foreground" />
                <span>{t("hero.badge", "Selangor Animal Welfare & Rescue Sanctuary")}</span>
              </div>

              <h1 className="font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl leading-[1.15]">
                {t("hero.title", "Adopt a dog or cat from your local shelter.")}
              </h1>

              <p className="max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
                {t("hero.subtitle", "We take in strays, owner surrenders, and transfers across Petaling Jaya. Every rescue animal receives full veterinary care, core vaccinations, microchip registration, and spay/neuter surgery before finding their forever family.")}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <Link
                  href="/pets"
                  className={buttonVariants({
                    size: "lg",
                    className: "gap-2 px-7 text-sm font-semibold tracking-wide shadow-xs focus-visible:ring-2 focus-visible:ring-offset-2",
                  })}
                >
                  <Heart className="size-4 fill-current" />
                  {t("hero.browseBtn", "Browse Adoptable Pets")}
                  <ArrowRight className="size-4 ml-0.5" />
                </Link>

                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setIsQuizOpen(true)}
                  className="gap-2 px-6 text-sm font-semibold tracking-wide cursor-pointer"
                >
                  <Compass className="size-4" />
                  {t("hero.quizBtn", "Pet Compatibility Quiz")}
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setIsSponsorshipOpen(true)}
                  className="gap-2 px-6 text-sm font-semibold tracking-wide cursor-pointer"
                >
                  <HeartHandshake className="size-4" />
                  {t("hero.sponsorBtn", "Sponsor Care")}
                </Button>
              </div>

              <div className="border-t border-border pt-4 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-foreground">{t("hero.visitingHoursLabel", "Sanctuary Visiting Hours:")} </span>
                  {t("hero.visitingHoursText", "Tuesday through Sunday, 10:00 AM – 5:00 PM. Walk-ins welcome.")}
                </div>
                <div className="font-mono font-semibold text-foreground">
                  {t("hero.locationText", "Petaling Jaya, Selangor")}
                </div>
              </div>
            </div>

            {/* Right Image */}
            <div className="lg:col-span-5">
              <div className="relative aspect-4/3 w-full overflow-hidden border border-border bg-muted shadow-sm rounded-2xl">
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
