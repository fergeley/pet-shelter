"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Heart,
  ArrowRight,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useLanguage } from "@/components/providers/LanguageProvider";

/**
 * Placement for the hero cut-outs: three sizes ringing the centred copy, the larger animals
 * lower and nearer the reader.
 *
 * Coordinates are inline styles, not `lg:left-[2%]` classes. Tailwind scanned that class
 * string and emitted every other utility in it — size, rotate, absolute, block — but not the
 * arbitrary-percentage insets, so all eight elements landed on the same auto position and
 * stacked. Inline styles do not depend on the scanner. They are unconditional, which is
 * harmless: below `lg` these elements are `hidden` and statically positioned, so left/top
 * apply to nothing.
 *
 * These files live in `public/cutouts/` and are caught by the `*.png` rule in `.gitignore`,
 * so they are present locally and absent from a fresh clone. Replace them with real Hope for
 * Strays cut-outs, and commit those, before this ships.
 */
const CUTOUTS = [
  { src: "/cutouts/cat-png-17.png", box: "lg:size-52 lg:-rotate-6", pos: { left: "2%", top: "12%" } },
  { src: "/cutouts/dog-png-2.png", box: "lg:size-60 lg:rotate-3", pos: { left: "12%", bottom: "8%" } },
  { src: "/cutouts/cat-png-9.png", box: "lg:size-36 lg:rotate-6", pos: { left: "24%", top: "4%" } },
  { src: "/cutouts/dog-png-14.png", box: "lg:size-40 lg:rotate-2", pos: { left: "1%", top: "48%" } },
  { src: "/cutouts/dog-png-30.png", box: "lg:size-56 lg:rotate-6", pos: { right: "2%", top: "10%" } },
  { src: "/cutouts/cat-png-20.png", box: "lg:size-60 lg:-rotate-3", pos: { right: "12%", bottom: "8%" } },
  { src: "/cutouts/dog-png-18.png", box: "lg:size-36 lg:-rotate-6", pos: { right: "24%", top: "4%" } },
  { src: "/cutouts/cat-png-28.png", box: "lg:size-40 lg:-rotate-2", pos: { right: "1%", top: "48%" } },
];

export function Hero() {
  const { isMs } = useLanguage();

  return (
    <section className="relative flex min-h-[calc(100dvh-4rem)] items-center overflow-hidden bg-work-ground">
      {/* Transparent-background cut-outs, not framed photographs: a frame reads as a picture
          of an animal, the cut-out reads as the animal. No border or radius for the same
          reason. Eight at three sizes so the ring has depth rather than a flat border,
          object-contain so silhouettes are never cropped, and a drop shadow that follows the
          alpha edge instead of a rectangle. */}
      {CUTOUTS.map((cutout) => (
        <div
          key={cutout.src}
          style={cutout.pos}
          className={`pointer-events-none hidden lg:absolute lg:block ${cutout.box}`}
        >
          <Image src={cutout.src} alt="" width={320} height={320} className="size-full object-contain drop-shadow-xl" />
        </div>
      ))}

      <div className="relative w-full px-6 py-12 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-2xl space-y-6 text-center">
          <h1 className="font-heading text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.15]">
            Coexistence through TNRM & Education
          </h1>

          <p className="mx-auto text-base sm:text-lg text-muted-foreground leading-relaxed">
            {isMs
              ? "Hope for Strays ialah organisasi kebajikan haiwan komuniti yang memberi tumpuan kepada keseimbangan hidup bersama manusia dan haiwan. Kami menjalankan TNRM, pendidikan komuniti, dan pemulihan klinikal."
              : "Hope for Strays is a community-led animal welfare organisation focused on peaceful coexistence between people and animals. We work through TNRM, public education, and clinical rehabilitation."}
          </p>

          <div className="flex justify-center pt-1">
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
          </div>

          {/* Below lg the scatter is meaningless — absolute placement at 375px is a stack with
              extra steps — so the same cut-outs become an honest row. */}
          <div className="grid grid-cols-4 gap-3 pt-8 lg:hidden">
            {CUTOUTS.slice(0, 4).map((cutout) => (
              <Image key={cutout.src} src={cutout.src} alt="" width={160} height={160} className="aspect-square w-full object-contain" />
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
