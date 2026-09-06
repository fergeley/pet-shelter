"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart, ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { Pet } from "@/types/pet";

/**
 * Three candidate treatments for the home page hero, kept side by side so they can be
 * compared in the real shell rather than as mockups. Whichever one wins moves into
 * `Hero.tsx` and this file is deleted — nothing outside `/hero-preview` imports it.
 *
 * Copy, CTA and bilingual behaviour are identical across all three on purpose. The only
 * variable under test is the imagery.
 */

const SHELL_HEIGHT = "min-h-[calc(100dvh-4rem)]";

/** Placeholder. Every one of these wants a real Hope for Strays photograph before it ships. */
const STOCK = {
  wide: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=2000&q=80",
  scatter: [
    "https://images.unsplash.com/photo-1425082661705-1834bfd09dca?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1511044568932-338cba0ad803?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=600&q=80",
  ],
};

function useCopy() {
  const { isMs } = useLanguage();
  return {
    isMs,
    heading: isMs ? "Hidup bersama melalui TNRM & pendidikan" : "Coexistence through TNRM & Education",
    body: isMs
      ? "Hope for Strays ialah organisasi kebajikan haiwan komuniti yang menjalankan TNRM, pendidikan komuniti, dan pemulihan klinikal di Petaling Jaya dan kampus Universiti Malaya."
      : "Hope for Strays is a community-led animal welfare organisation working through TNRM, public education, and clinical rehabilitation across Petaling Jaya and Universiti Malaya campus.",
    cta: isMs ? "Lihat Haiwan Reskue" : "Meet Our Animals",
  };
}

/* ------------------------------------------------------------------ A */

/**
 * Full-bleed photograph, text centred over it.
 *
 * The scrim is not decorative. White text over an unknown photograph is only guaranteed
 * legible if the overlay alone carries it: at 60% black, the worst case — a blown-out
 * white frame underneath — still measures 5.74:1. At 50% that case falls to 3.95:1, which
 * is why this does not use the lighter wash that looks nicer on a dark photo.
 */
export function HeroFullBleed() {
  const { heading, body, cta } = useCopy();
  return (
    <section className={`relative flex ${SHELL_HEIGHT} items-center overflow-hidden`}>
      <Image
        src={STOCK.wide}
        alt="Rescued shelter animals on the sanctuary grounds"
        fill
        priority
        className="object-cover"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full px-6 py-12 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl space-y-6 text-center">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.15]">
            {heading}
          </h1>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">
            {body}
          </p>
          <div className="flex justify-center pt-1">
            <Link
              href="/pets"
              className={buttonVariants({
                size: "lg",
                className: "gap-2 px-6 text-sm font-bold tracking-wide rounded-xl shadow-xs",
              })}
            >
              <Heart className="size-4 fill-current" />
              {cta}
              <ArrowRight className="size-4 ml-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ B */

/**
 * Centred text with four photographs placed around it.
 *
 * The images are absolutely positioned only from `lg` up. Below that they collapse to a
 * plain row under the copy, because a scattered composition at 375px is just a stack with
 * extra steps.
 */
export function HeroScatter() {
  const { heading, body, cta } = useCopy();
  const spots = [
    "lg:left-[3%] lg:top-[14%] lg:h-44 lg:w-36 lg:-rotate-6",
    "lg:right-[5%] lg:top-[10%] lg:h-40 lg:w-32 lg:rotate-3",
    "lg:left-[8%] lg:bottom-[12%] lg:h-36 lg:w-44 lg:rotate-2",
    "lg:right-[3%] lg:bottom-[16%] lg:h-48 lg:w-36 lg:-rotate-3",
  ];
  return (
    <section className={`relative flex ${SHELL_HEIGHT} items-center overflow-hidden bg-work-ground`}>
      {STOCK.scatter.map((src, i) => (
        <div
          key={src}
          className={`hidden lg:absolute lg:block overflow-hidden rounded-2xl border border-border shadow-brand-lg ${spots[i]}`}
        >
          <Image src={src} alt="" fill className="object-cover" sizes="200px" />
        </div>
      ))}

      <div className="relative w-full px-6 py-12 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-2xl space-y-6 text-center">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl leading-[1.15]">
            {heading}
          </h1>
          <p className="mx-auto text-base leading-relaxed text-muted-foreground sm:text-lg">{body}</p>
          <div className="flex justify-center pt-1">
            <Link
              href="/pets"
              className={buttonVariants({
                size: "lg",
                className: "gap-2 px-6 text-sm font-bold tracking-wide rounded-xl shadow-xs",
              })}
            >
              <Heart className="size-4 fill-current" />
              {cta}
              <ArrowRight className="size-4 ml-0.5" />
            </Link>
          </div>

          {/* Below lg the scatter is meaningless, so the same photos become an honest row. */}
          <div className="grid grid-cols-4 gap-3 pt-6 lg:hidden">
            {STOCK.scatter.map((src) => (
              <div key={src} className="relative aspect-square overflow-hidden rounded-xl border border-border">
                <Image src={src} alt="" fill className="object-cover" sizes="25vw" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ C */

/**
 * Centred text over a strip of animals who are actually in the system right now.
 *
 * The difference from B is that nothing here is decoration: every tile is a record from
 * `getPublicPets()` and links to that animal. An empty roster degrades to the copy alone
 * rather than to empty frames.
 */
export function HeroPetStrip({ pets }: { pets: Pet[] }) {
  const { isMs, heading, body, cta } = useCopy();
  const shown = pets.filter((p) => p.status === "Available").slice(0, 6);

  return (
    <section className={`flex ${SHELL_HEIGHT} items-center bg-work-ground`}>
      <div className="w-full px-6 py-12 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl space-y-6 text-center">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl leading-[1.15]">
            {heading}
          </h1>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {body}
          </p>
          <div className="flex justify-center pt-1">
            <Link
              href="/pets"
              className={buttonVariants({
                size: "lg",
                className: "gap-2 px-6 text-sm font-bold tracking-wide rounded-xl shadow-xs",
              })}
            >
              <Heart className="size-4 fill-current" />
              {cta}
              <ArrowRight className="size-4 ml-0.5" />
            </Link>
          </div>
        </div>

        {shown.length > 0 && (
          <div className="mx-auto mt-14 max-w-6xl">
            <p className="mb-4 text-center text-2xs font-bold uppercase tracking-widest text-muted-foreground">
              {isMs ? "Sedia untuk diadopsi hari ini" : "Looking for a home right now"}
            </p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 sm:gap-4">
              {shown.map((pet) => (
                <Link
                  key={pet.id}
                  href={`/pets/${pet.id}`}
                  className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-work-panel shadow-xs"
                >
                  <Image
                    src={pet.image}
                    alt={pet.name}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 33vw, 16vw"
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-2xs font-bold uppercase tracking-wider text-white">
                    {pet.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
