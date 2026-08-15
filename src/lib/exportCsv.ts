import { AdoptionApplicationRecord } from "@/types/application";

/**
 * Escapes a single CSV field following RFC-4180:
 * - Wrap with double quotes if contains commas, quotes, or newlines.
 * - Escape internal double quotes with two double quotes ("").
 * - Mitigate CSV Formula Injection by prepending single quote to formula trigger characters (=, +, -, @, \t, \r).
 */
function formatCsvField(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return '""';
  }

  let str = String(value).trim();

  // CSV injection mitigation
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return `"${str}"`;
}

/**
 * Exports adoption application records to a formatted CSV string and triggers browser download.
 */
export function exportApplicationsToCsv(applications: AdoptionApplicationRecord[], filenamePrefix = "hope-for-strays-applications"): void {
  const headers = [
    "Application ID",
    "Submitted Date",
    "Status",
    "Pet Name",
    "Pet ID",
    "Applicant Name",
    "Email",
    "Phone",
    "Residential Address",
    "Housing Type",
    "Fenced Yard",
    "Existing Pets",
    "Existing Pet Details",
    "Household Experience",
    "Applicant Notes",
    "Admin Review Notes",
  ];

  const rows = applications.map((app) => [
    app.id,
    new Date(app.createdAt).toISOString().split("T")[0],
    app.status,
    app.petName,
    app.petId,
    app.applicantName,
    app.email,
    app.phone,
    app.address,
    app.housingType,
    app.hasFencedYard,
    app.currentPets,
    app.currentPetDetails || "",
    app.householdExperience,
    app.applicantNotes || "",
    app.adminReviewNotes || "",
  ]);

  const csvContent = [
    headers.map(formatCsvField).join(","),
    ...rows.map((row) => row.map(formatCsvField).join(",")),
  ].join("\r\n");

  // UTF-8 BOM for Excel compatibility
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().slice(0, 10);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `${filenamePrefix}-${timestamp}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports pet inventory records to formatted RFC-4180 CSV string and triggers download.
 */
export function exportPetsToCsv(pets: import("@/types/pet").Pet[], filenamePrefix = "hope-for-strays-pets"): void {
  const headers = [
    "Pet ID",
    "Name",
    "Species",
    "Breed",
    "Age",
    "Age Category",
    "Gender",
    "Size",
    "Weight",
    "Status",
    "Adoption Fee",
    "Vaccinated",
    "Microchipped",
    "Spayed/Neutered",
    "Intake Date",
    "Tags",
  ];

  const rows = pets.map((p) => [
    p.id,
    p.name,
    p.species,
    p.breed,
    p.age,
    p.ageCategory,
    p.gender,
    p.size,
    p.weight,
    p.status,
    p.adoptionFee,
    p.medical.vaccinated ? "Yes" : "No",
    p.medical.microchipped ? "Yes" : "No",
    p.medical.spayedNeutered ? "Yes" : "No",
    p.intakeDate,
    p.tags.join("; "),
  ]);

  const csvContent = [
    headers.map(formatCsvField).join(","),
    ...rows.map((row) => row.map(formatCsvField).join(",")),
  ].join("\r\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().slice(0, 10);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `${filenamePrefix}-${timestamp}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
