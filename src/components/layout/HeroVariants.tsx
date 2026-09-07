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
 * Centred text ringed by cut-out animals.
 *
 * The images are transparent PNGs in square boxes with `object-contain`, so each animal
 * keeps its own silhouette against the ground rather than sitting in a photo frame. That is
 * the whole point of the treatment: a framed photograph reads as a picture of an animal, a
 * cut-out reads as the animal. No borders, no radius, no card — a rounded frame here would
 * undo the effect it is meant to create.
 *
 * Eight of them, at three sizes, so the ring has depth instead of reading as a flat border.
 * Below `lg` the scatter is meaningless — absolute placement at 375px is a stack with extra
 * steps — so the same cut-outs become an honest row under the copy.
 */
const CUTOUTS = [
  { src: "/cutouts/cat-png-17.png", at: "lg:left-[2%] lg:top-[12%] lg:size-52 lg:-rotate-6" },
  { src: "/cutouts/dog-png-2.png", at: "lg:left-[13%] lg:bottom-[10%] lg:size-60 lg:rotate-3" },
  { src: "/cutouts/cat-png-9.png", at: "lg:left-[24%] lg:top-[4%] lg:size-36 lg:rotate-6" },
  { src: "/cutouts/dog-png-14.png", at: "lg:left-[1%] lg:top-[46%] lg:size-40 lg:rotate-2" },
  { src: "/cutouts/dog-png-30.png", at: "lg:right-[2%] lg:top-[10%] lg:size-56 lg:rotate-6" },
  { src: "/cutouts/cat-png-20.png", at: "lg:right-[12%] lg:bottom-[8%] lg:size-60 lg:-rotate-3" },
  { src: "/cutouts/dog-png-18.png", at: "lg:right-[24%] lg:top-[3%] lg:size-36 lg:-rotate-6" },
  { src: "/cutouts/cat-png-28.png", at: "lg:right-[1%] lg:top-[48%] lg:size-40 lg:-rotate-2" },
];

export function HeroScatter() {
  const { heading, body, cta } = useCopy();
  return (
    <section className={`relative flex ${SHELL_HEIGHT} items-center overflow-hidden bg-work-ground`}>
      {CUTOUTS.map((c) => (
        <div key={c.src} className={`pointer-events-none hidden lg:absolute lg:block ${c.at}`}>
          <Image
            src={c.src}
            alt=""
            width={320}
            height={320}
            className="size-full object-contain drop-shadow-xl"
          />
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

          <div className="grid grid-cols-4 gap-3 pt-8 lg:hidden">
            {CUTOUTS.slice(0, 4).map((c) => (
              <Image
                key={c.src}
                src={c.src}
                alt=""
                width={160}
                height={160}
                className="aspect-square w-full object-contain"
              />
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
