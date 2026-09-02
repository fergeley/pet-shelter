"use client";

import React from "react";
import { PhoneCall } from "lucide-react";

import { useLanguage } from "@/components/providers/LanguageProvider";

/**
 * The "call the shelter desk" banner shown under both FAQ surfaces.
 *
 * Shared so the phone number lives in one place: it was previously written out
 * twice, in the display text and the tel: href of two separate components, so
 * changing it meant four edits and any miss would silently keep dialling the
 * old number.
 */
const SHELTER_PHONE_DISPLAY = "03-7876 5432";
const SHELTER_PHONE_TEL = "+60378765432";

export function FaqContactBanner({
  title,
  titleMs,
}: {
  /** Optional heading override; defaults to the generic "still have a question". */
  title?: string;
  titleMs?: string;
}) {
  const { isMs } = useLanguage();

  const heading = isMs
    ? (titleMs ?? "Masih ada soalan?")
    : (title ?? "Still have a question?");

  return (
    <div className="bg-muted/40 border border-border p-6 max-w-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl">
      <div>
        <p className="text-base font-bold text-foreground">{heading}</p>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isMs
            ? "Hubungi meja santuari kami Selasa hingga Ahad, 10:00 pagi – 5:00 petang."
            : "Call our shelter desk Tuesday through Sunday, 10:00 AM – 5:00 PM."}
        </p>
      </div>
      <a
        href={`tel:${SHELTER_PHONE_TEL}`}
        className="inline-flex items-center gap-2 bg-foreground text-background px-5 py-2.5 text-sm font-semibold uppercase tracking-wider hover:bg-foreground/85 transition-colors focus-visible:ring-2 shrink-0 rounded-xl"
      >
        <PhoneCall className="size-4" />
        {SHELTER_PHONE_DISPLAY}
      </a>
    </div>
  );
}
