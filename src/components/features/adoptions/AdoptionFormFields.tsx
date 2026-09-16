"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import type { AdoptionFormValues } from "@/lib/validations/application";

/**
 * Shared field furniture for the adoption wizard.
 *
 * The label / control / error-message triple was previously written out in full
 * for every field, fifteen times, which is why three of them silently rendered
 * no validation message at all. Here it exists once.
 */
export function Field({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: React.ReactNode;
  error?: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground leading-relaxed">{hint}</p>}
      {error && <p className="text-sm font-medium text-destructive mt-1">{error}</p>}
    </div>
  );
}

/** The one select skin used across the form. */
export const SELECT_CLASS =
  "w-full bg-background border border-input px-3.5 py-2.5 text-sm sm:text-base text-foreground focus:outline-hidden focus:ring-2 focus:ring-foreground font-medium rounded-lg";

export const FIELD_ROW_CLASS = "grid grid-cols-1 sm:grid-cols-2 gap-4";

type Bilingual = { en: string; ms: string };

/**
 * Bilingual labels for every enum the schema accepts.
 *
 * Each is typed as a total `Record` over the schema's own union, so adding a
 * value to the schema without labelling it here is a compile error, and the
 * options are derived from the table rather than written out beside it. The
 * housing control had already drifted this way once: the markup offered four
 * values the schema rejected, and because the select rendered no error, picking
 * one made the submit button do nothing at all.
 */
export const HOUSING_TYPE_LABELS: Record<AdoptionFormValues["housingType"], Bilingual> = {
  landed_terrace: { en: "Terrace / Link House (Landed)", ms: "Rumah Teres / Berangkai (Bertanah)" },
  semi_d_bungalow: { en: "Semi-Detached / Bungalow", ms: "Rumah Berkembar / Banglo" },
  condo_apartment: { en: "Condominium / Apartment / Flat", ms: "Kondominium / Pangsapuri / Flat" },
  townhouse: { en: "Townhouse", ms: "Rumah Bandar" },
  other: { en: "Other Property Type", ms: "Jenis Hartanah Lain" },
};

export const FENCED_YARD_LABELS: Record<AdoptionFormValues["hasFencedYard"], Bilingual> = {
  yes: { en: "Fully Fenced Perimeter (Secure gate)", ms: "Perimeter Berpagar Penuh (Pagar selamat)" },
  no: { en: "Open Compound / Unfenced Yard", ms: "Kawasan Terbuka / Halaman Tanpa Pagar" },
  not_applicable: { en: "Not Applicable (Indoor high-rise)", ms: "Tidak Berkenaan (Dalam bangunan tinggi)" },
};

export const LANDLORD_APPROVAL_LABELS: Record<AdoptionFormValues["landlordApproval"], Bilingual> = {
  owner_occupied: { en: "I own this home — no approval needed", ms: "Saya pemilik rumah — tiada kelulusan diperlukan" },
  obtained: { en: "I rent, and my landlord has approved a pet", ms: "Saya menyewa, dan tuan rumah telah meluluskan haiwan" },
  pending: { en: "I rent, and I am still awaiting approval", ms: "Saya menyewa, dan masih menunggu kelulusan" },
  not_permitted: { en: "I rent, and pets are not permitted", ms: "Saya menyewa, dan haiwan tidak dibenarkan" },
};

export const CURRENT_PETS_LABELS: Record<AdoptionFormValues["currentPets"], Bilingual> = {
  none: { en: "No current pets", ms: "Tiada haiwan peliharaan" },
  dogs: { en: "Yes, currently have dog(s)", ms: "Ya, ada anjing" },
  cats: { en: "Yes, currently have cat(s)", ms: "Ya, ada kucing" },
  both: { en: "Yes, have both dogs and cats", ms: "Ya, ada anjing dan kucing" },
  other: { en: "Other small animals", ms: "Haiwan kecil lain" },
};

export const EXPERIENCE_LABELS: Record<AdoptionFormValues["householdExperience"], Bilingual> = {
  experienced: { en: "Experienced pet owner & primary caregiver", ms: "Pemilik berpengalaman & penjaga utama" },
  some_experience: { en: "Some past experience with pets", ms: "Ada sedikit pengalaman lalu" },
  first_time: { en: "First-time pet owner", ms: "Pemilik haiwan kali pertama" },
};

export const DAILY_ALONE_HOURS_LABELS: Record<AdoptionFormValues["dailyAloneHours"], Bilingual> = {
  under_4: { en: "Under 4 hours", ms: "Kurang daripada 4 jam" },
  "4_to_8": { en: "4 to 8 hours", ms: "4 hingga 8 jam" },
  "8_to_12": { en: "8 to 12 hours", ms: "8 hingga 12 jam" },
  over_12: { en: "More than 12 hours", ms: "Lebih daripada 12 jam" },
};

/** Renders a labelled `<option>` list from any of the tables above. */
export function options<K extends string>(
  labels: Record<K, Bilingual>,
  isMs: boolean
): React.ReactNode {
  return (Object.entries(labels) as Array<[K, Bilingual]>).map(([value, label]) => (
    <option key={value} value={value}>
      {isMs ? label.ms : label.en}
    </option>
  ));
}
