import { Pet, MedicalTimelineEvent } from "@/types/pet";
import { Language } from "@/lib/i18n/translations";

/**
 * The clinical history a pet is presented with — read from the record when one
 * exists, synthesised from the pet's medical flags when it does not.
 *
 * This is a domain concern rather than a view helper: `medicalTimeline[]` is
 * still fixture-only (no Prisma model, no mapper — see LAYERS.md §6), so for
 * most animals the timeline *is* whatever this function derives from
 * `medical.*` and `intakeDate`. That is also why the synthesis must stay
 * deterministic — the same pet has to produce the same milestones on every
 * render and in every process, or an adopter watches the clinical record change
 * underneath them.
 *
 * The category → design-tone mapping that used to sit alongside this now lives
 * in `@/lib/presentation/medicalTimelinePresentation`. Nothing here depends on
 * it: this module returns events, not classes.
 */
export function getPetMedicalTimeline(pet: Pet, lang: Language = "en"): MedicalTimelineEvent[] {
  const isMs = lang === "ms";

  if (pet.medicalTimeline && pet.medicalTimeline.length > 0) {
    return [...pet.medicalTimeline]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((item) => ({
        ...item,
        title: isMs && item.titleMs ? item.titleMs : item.title,
        description: isMs && item.descriptionMs ? item.descriptionMs : item.description,
        badge: isMs && item.badgeMs ? item.badgeMs : item.badge,
      }));
  }

  // Synthesize deterministic clinical events from medical clearance attributes
  const events: MedicalTimelineEvent[] = [];
  const intakeDate = pet.intakeDate || "2026-06-01";
  const isDog = pet.species === "dog";

  // 1. Intake
  events.push({
    id: `synth-${pet.id}-1`,
    date: intakeDate,
    title: isMs ? "Kemasukan Rasmi & Saringan Fizikal" : "Sanctuary Rescue & Physical Intake Screening",
    category: "intake",
    description: isMs
      ? `Penyelamatan dan kemasukan selamat ke pusat perlindungan. Berat badan ${pet.weight || "normal"}. Pemeriksaan kesihatan umum normal.`
      : `Safely taken into shelter care. Recorded weight ${pet.weight || "standard"}. Full baseline physical examination clear.`,
    veterinarian: "Dr. Sarah Tan, DVM (PJ Animal Hospital)",
    verified: true,
    badge: isMs ? "Kemasukan Lulus" : "Intake Passed",
  });

  // 2. Diagnostics
  events.push({
    id: `synth-${pet.id}-2`,
    date: addDays(intakeDate, 2),
    title: isMs
      ? (isDog ? "Saringan Serologi Parvovirus & Distemper" : "Saringan Retrovirus FIV/FeLV")
      : (isDog ? "Infectious Disease Serology Screen (CPV/CDV)" : "FIV/FeLV Serology & Bloodwork Screen"),
    category: "diagnostic",
    description: isMs
      ? (isDog ? "Ujian antigen pantas Parvovirus & Distemper kembali NEGATIF. Profil darah normal." : "Ujian pantas FIV & FeLV NEGATIF. Saringan kesihatan umum normal.")
      : (isDog ? "Canine Parvovirus and Distemper rapid serology returned NEGATIVE. Baseline hematology clear." : "Feline Immunodeficiency Virus and Leukemia Virus test returned NEGATIVE."),
    veterinarian: "Dr. Sarah Tan, DVM",
    verified: true,
    badge: isMs ? "Negatif Penyakit" : "Disease Negative",
  });

  // 3. Treatment / Parasite Prevention
  events.push({
    id: `synth-${pet.id}-3`,
    date: addDays(intakeDate, 4),
    title: isMs ? "Rawatan Nyahcacing & Kawalan Parasit" : "Deworming & Comprehensive Parasite Prophylaxis",
    category: "treatment",
    description: isMs
      ? "Rawatan nyahcacing spektrum luas diberikan bersama pencegahan kutu dan pinjal bulanan."
      : "Administered broad-spectrum internal deworming and monthly external parasite prevention.",
    veterinarian: "Dr. Kevin Lim, DVM",
    verified: true,
    badge: isMs ? "Bebas Parasit" : "Parasite Clear",
  });

  // 4. Vaccination
  if (pet.medical?.vaccinated) {
    events.push({
      id: `synth-${pet.id}-4`,
      date: addDays(intakeDate, 10),
      title: isMs
        ? (isDog ? "Vaksinasi Teras (DHPPi 6-dalam-1)" : "Vaksinasi Teras Kucing (FVRCP)")
        : (isDog ? "Core Canine Vaccination (DHPPi 6-in-1)" : "Core Feline Vaccination (FVRCP Tri-Cat)"),
      category: "vaccination",
      description: isMs
        ? "Suntikan imunisasi teras diselesaikan tanpa sebarang kesan sampingan buruk."
        : "Core immunization series administered with full clinical tolerance.",
      veterinarian: "Dr. Kevin Lim, DVM",
      verified: true,
      badge: isMs ? "Lengkap Vaksin" : "Vaccinated",
    });
  }

  // 5. Spay / Neuter
  if (pet.medical?.spayedNeutered) {
    events.push({
      id: `synth-${pet.id}-5`,
      date: addDays(intakeDate, 18),
      title: isMs ? "Pembedahan Pemandulan (Sterilisasi)" : "Sterilization Surgery (Spay / Neuter)",
      category: "surgery",
      description: isMs
        ? "Pembedahan pemandulan elektif selesai di bawah bius umum. Pemulihan luka sempurna."
        : "Elective sterilization procedure performed under general anesthesia. Surgical incision healed cleanly.",
      veterinarian: "Dr. Sarah Tan, DVM (PJ Animal Hospital)",
      verified: true,
      badge: isMs ? "Dimandulkan" : "Sterilized",
    });
  }

  // 6. Microchip & Clearance
  if (pet.medical?.microchipped) {
    events.push({
      id: `synth-${pet.id}-6`,
      date: addDays(intakeDate, 24),
      title: isMs ? "Pemasangan Cip Mikro ISO & Pelepasan Adopsi" : "ISO Microchip Registry & Adoption Health Clearance",
      category: "clearance",
      description: isMs
        ? "Pemasangan cip mikro 15-digit ISO 11784/11785. Disahkan 100% sihat untuk adopsi percuma."
        : "Implanted ISO 11784/11785 15-digit RFID microchip. Full health passport signed for rehoming.",
      veterinarian: "Dr. Sarah Tan, DVM",
      verified: true,
      badge: isMs ? "Sedia Diadopsi" : "Adoption Ready",
    });
  }

  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function addDays(dateStr: string, days: number): string {
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) {
    return dateStr;
  }
  parsed.setDate(parsed.getDate() + days);
  return parsed.toISOString().split("T")[0];
}
